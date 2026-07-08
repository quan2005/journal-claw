# 左侧分类导航条（Nav Rail）

## 概述

在应用最左侧新增一个固定宽度的竖向图标导航条，将日志、想法、记忆、专题、自动化、技能六个类别统一收口到此处切换。左树不再承担类别切换职责，变为纯条目列表。

## 布局架构

```
┌─────────────────────────────────────────────────┐
│ app-root (display: flex; flex-direction: row)    │
│ ┌────────┐┌──────────────────────────────────┐  │
│ │NavRail ││ app-shell (现有三栏 grid 不变)     │  │
│ │ 52px   ││ TreeSidebar | DetailView | Chat   │  │
│ │ fixed  ││                                    │  │
│ └────────┘└──────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

采用外层 flex 包裹，NavRail 固定 52px（`flex-shrink: 0`），右侧 `flex: 1` 放现有布局。现有三栏 grid 的拖拽、折叠逻辑完全不动。

## 新组件：NavRail

### 文件

- `src/components/NavRail.tsx`
- `src/styles/nav-rail.css`

### Props

```ts
interface NavRailProps {
  activeCategory: Category
  onCategoryChange: (category: Category) => void
  onSettingsClick: () => void
}
```

### 导航项分组

| 组别   | 项目   | 图标      | 行为                                                   |
| ------ | ------ | --------- | ------------------------------------------------------ |
| 内容类 | 日志   | book      | 左树显示日志列表，中间显示 DetailView                  |
| 内容类 | 想法   | lightbulb | 左树显示想法列表，中间显示 DetailView                  |
| 内容类 | 记忆   | heart     | 左树显示记忆列表，中间显示 DetailView                  |
| 内容类 | 专题   | archive   | 左树显示专题列表，中间显示 DetailView                  |
| 工具类 | 自动化 | refresh   | 左树隐藏或显示规则列表，中间替换为 AutomationWorkbench |
| 工具类 | 技能   | bolt      | 左树隐藏或显示技能列表，中间替换为 SkillsWorkbench     |

两组之间用 1px 分隔线分开。底部固定设置按钮。

### 视觉规格

- 整体：宽 52px，背景同 TreeSidebar，`border-right: 1px solid var(--border)`
- 按钮：36×36px，圆角 8px，图标 18px stroke-width 1.6
- 激活态：左侧 3px 色条（`var(--accent)`），图标变为 `var(--accent)`，背景 `color-mix(in srgb, var(--accent) 12%, transparent)`
- Hover：背景同激活态（无色条），图标变为 `var(--text)`
- Tooltip：hover 200ms 后在右侧显示（CSS `::after` + `data-tooltip`）
- 分隔线：宽 24px，高 1px，`var(--border)`，上下 margin 8px

### 键盘交互

- 上/下方向键在导航项间移动焦点
- Enter / Space 激活当前焦点项
- 使用 `role="navigation"` + `aria-label="分类导航"`
- 每个按钮 `aria-current="page"` 标记激活项

## 状态管理

### 新增类型

```ts
type Category = 'journal' | 'ideas' | 'memory' | 'topics' | 'automation' | 'skills'
```

### App.tsx 顶层 state

```ts
const [activeCategory, setActiveCategory] = useState<Category>('journal')
```

### 持久化

`activeCategory` 通过现有 `workspace_settings` Rust 命令持久化（遵循约束 #3：不用 localStorage）。启动时读取，切换时写入。

### 联动逻辑

- 内容类（journal / ideas / memory / topics）：
  - 传 `category` prop 给 `TreeSidebar`，TreeSidebar 根据值渲染对应列表
  - 中间区域显示 `DetailView`
- 工具类（automation / skills）：
  - 中间区域替换为 `AutomationWorkbench` / `SkillsWorkbench`
  - 左树可选择性显示该工具的子项列表，或保持当前行为

## TreeSidebar 改动

### 移除

- "想法"切换按钮（原 `showIdeas` toggle）
- "自动化"切换按钮（原 `view === 'automation'` toggle）

### 新增

- `category: Category` prop
- 根据 category 渲染对应列表：
  - `journal`：现有按月分组日志列表（不变）
  - `ideas`：现有 ideas 列表逻辑迁移过来
  - `memory`：记忆条目列表（初期可为空态占位）
  - `topics`：从现有 topic-file 逻辑迁移
  - `automation` / `skills`：可显示子项列表或隐藏整个 sidebar

### 切换动画

列表切换时 opacity fade，120ms ease-out。

## 主题适配

NavRail 使用现有 CSS 变量，暗色/亮色主题自动适配：

- `--bg-sidebar`：背景
- `--border`：边框和分隔线
- `--text`：默认图标色
- `--text-muted`：非激活图标色
- `--accent`：激活态色条和图标

## TitleBar 适配

现有 TitleBar 在 `app-shell` grid 的第一行内，外层新增 flex 容器后 TitleBar 位置不变。NavRail 在其左侧全高显示（从窗口顶部到底部），与 TitleBar 平级但不受其管辖。macOS traffic lights 区域由 TitleBar 处理，NavRail 顶部留出等高的空白（38px padding-top）以视觉对齐。

## 不在本次范围

- 记忆/专题的具体列表实现（仅预留空态）
- SkillsWorkbench 的具体实现（仅预留切换入口）
- NavRail 折叠/展开动画（固定显示即可）
- 导航项拖拽排序

## Mockup

参见 `docs/superpowers/mockups/nav-rail-mockup.html`（浏览器打开查看效果）。
