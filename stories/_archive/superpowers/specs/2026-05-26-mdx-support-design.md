# MDX 支持设计

## 目标

JournalClaw 支持 `.mdx` 文件格式，在 Markdown 中嵌入 React 组件，运行时编译渲染。AI 生成和用户手动编辑的日志条目均可使用。

## 架构

```
.mdx 文件 → Rust 扫描（journal.rs）→ 前端加载内容
  → MdxRenderer（@mdx-js/mdx evaluate）→ React Element tree
  → ErrorBoundary 包裹，编译失败降级为 marked 渲染
```

## 文件识别

- 新增 `.mdx` 扩展名支持
- Rust `parse_entry_filename`：`DD-title.mdx` 同现有 `.md` / `.html` 格式
- Frontmatter 解析：YAML（`---` 分隔）与 `.md` 一致，无需改动
- AI 处理输出可选 `.mdx` 格式

## MDX 运行时

### 编译方式

使用 `@mdx-js/mdx` v3 的 `evaluate()` 进行运行时编译：

```ts
import { evaluate } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'
import { mdxComponents } from './components/mdx'

const { default: Content } = await evaluate(mdxSource, {
  ...runtime,
  ...mdxComponents,
})
```

### 与现有 marked 管线共存

`MarkdownRenderer.tsx` 根据文件扩展名路由：

- `.md` → 现有 marked + DOMPurify + 虚拟化管线
- `.mdx` → 新 MdxRenderer（evaluate + ErrorBoundary）

### 大文件策略

MDX 无法像 marked 那样分批虚拟化（因为编译产生完整 React 元素树）。对于 `.mdx` 文件：

- 不做虚拟化，直接渲染整个文档
- 通过 React Error Boundary 处理编译异常
- 如果后续有性能问题，考虑编译结果缓存

### CSP

Tauri `tauri.conf.json` 安全配置中添加 `'unsafe-eval'`（`@mdx-js/mdx` 的 `evaluate()` 内部使用 `new Function()`）。

## 安全模型

### 信任边界

- 日志内容由用户自己的 AI 生成或用户手动编辑，属于受信内容
- 不从外部源加载 `.mdx` 文件
- 默认启用，无开关

### 防御措施

1. **组件白名单**：`evaluate()` 只注入预置组件，MDX 无法 import 任意模块
2. **Error Boundary**：编译失败或组件抛错时，降级为 marked 渲染原始 markdown
3. 不做 DOMPurify 过滤（JSX 不是 HTML 字符串，技术上不可行）

### 不会做的事

- 不在 iframe 沙箱中渲染（过度设计）
- 不对外部文件做额外警告（YAGNI）

## 组件库

位置：`src/components/mdx/`

### 一、布局容器

| 组件                 | 说明                                                |
| -------------------- | --------------------------------------------------- |
| `Split`              | 双列并排，移动端自动折叠                            |
| `Columns` / `Column` | 灵活多列（2-4 列）                                  |
| `Mockup`             | 带标题栏的预览框（`Mockup.Header` + `Mockup.Body`） |
| `Placeholder`        | 虚线边框占位区                                      |

### 二、信息展示

| 组件                     | 说明                    |
| ------------------------ | ----------------------- |
| `ProsCons`               | 双列优缺点对比          |
| `Stat` / `StatGroup`     | 关键指标数字 + 趋势箭头 |
| `Table`                  | 增强表格                |
| `Timeline`               | 事件时间线              |
| `TagList`                | 标签列表                |
| `Progress`               | 进度条 0-100%           |
| `Avatar` / `AvatarGroup` | 人名缩写头像            |

### 三、提示与引用

| 组件              | 说明                                  |
| ----------------- | ------------------------------------- |
| `Callout`         | 四种类型：info / warning / tip / note |
| `Quote`           | 带来源的引用块                        |
| `RelatedEntry`    | 链接到其他日记条目                    |
| `RelatedIdentity` | 链接到身份画像                        |

### 四、静态列表 / 卡片

| 组件                 | 说明                   |
| -------------------- | ---------------------- |
| `Cards` / `Card`     | 卡片网格（纯展示）     |
| `Options` / `Option` | 字母徽章列表（纯展示） |
| `Kanban`             | 静态看板列             |
| `Checklist`          | 静态清单 ✓/○           |
| `Counter`            | 计数器                 |
| `RatingBar`          | 静态评分条             |

### 五、媒体嵌入

| 组件          | 说明           |
| ------------- | -------------- |
| `AudioCard`   | 原生 `<audio>` |
| `VideoCard`   | 原生 `<video>` |
| `ImageViewer` | 图片 + 标题    |
| `FileCard`    | 文件卡片       |

### 六、图表（按需动态加载）

| 组件         | 说明                 | 依赖       |
| ------------ | -------------------- | ---------- |
| `BarChart`   | 柱状图               | Recharts   |
| `LineChart`  | 折线图               | Recharts   |
| `PieChart`   | 饼图                 | Recharts   |
| `RadarChart` | 雷达图               | Recharts   |
| `Mermaid`    | 流程图/时序图/甘特图 | Mermaid.js |

### 七、排版辅助

| 组件       | 说明         |
| ---------- | ------------ |
| `Section`  | 内容区块     |
| `Subtitle` | 标题辅助文字 |
| `Label`    | 小号大写标签 |
| `Divider`  | 分隔线       |

**总计 34 个组件，纯 CSS 29 个，带依赖 5 个（按需动态 import）。**

### 设计约束

- 所有组件遵循 `.impeccable.md` 设计规范（克制、沉静、琥珀金 accent）
- 不支持 JS 交互（纯展示组件）
- 图表类组件按需加载，不在 MDX 内容中引用时不加载对应库

## Rust 后端改动

### journal.rs

- `parse_entry_filename`：`.mdx` 加入 `strip_suffix` 列表
- 现有 frontmatter 解析（gray_matter + fallback）对 `.mdx` 同样适用
- `workspace_has_any_entry`：`.mdx` 加入扩展名检查

### AI prompt（llm/prompt.rs）

- 在 workspace CLAUDE.md 或系统提示中，告知 AI 可用的 MDX 组件列表及用法示例

### tauri.conf.json

- `app.security.csp`：添加 `script-src 'unsafe-eval'`

## 前端改动

### 新增文件

| 文件                                | 职责                                                                |
| ----------------------------------- | ------------------------------------------------------------------- |
| `src/components/MdxRenderer.tsx`    | MDX 运行时编译 + 渲染 + ErrorBoundary                               |
| `src/components/mdx/index.ts`       | 组件映射表导出                                                      |
| `src/components/mdx/layout.tsx`     | Split, Columns, Mockup, Placeholder                                 |
| `src/components/mdx/display.tsx`    | ProsCons, Stat, Table, Timeline, TagList, Progress, Avatar          |
| `src/components/mdx/callout.tsx`    | Callout, Quote, RelatedEntry, RelatedIdentity                       |
| `src/components/mdx/cards.tsx`      | Cards, Card, Options, Option, Kanban, Checklist, Counter, RatingBar |
| `src/components/mdx/media.tsx`      | AudioCard, VideoCard, ImageViewer, FileCard                         |
| `src/components/mdx/charts.tsx`     | BarChart, LineChart, PieChart, RadarChart（动态 import Recharts）   |
| `src/components/mdx/mermaid.tsx`    | Mermaid（动态 import mermaid.js）                                   |
| `src/components/mdx/typography.tsx` | Section, Subtitle, Label, Divider                                   |

### 修改文件

| 文件                   | 改动                                           |
| ---------------------- | ---------------------------------------------- |
| `MarkdownRenderer.tsx` | 添加扩展名路由：`.mdx` → MdxRenderer           |
| `package.json`         | 新增 `@mdx-js/mdx`、`recharts`、`mermaid` 依赖 |

## 非目标

- 不支持 JS 交互（点击、拖拽、勾选等），纯展示
- 不替换现有 `.md` 渲染管线
- MDX 组件不暴露给会话系统（仅日志条目使用）
