# ToDo List 设计规格

## 概述

为谨迹添加一个**全局待办清单**，以右侧栏形式按需展开，数据存储在 workspace 根目录的 `todos.md` 文件中。待办与日志条目解耦——不解析日志中的 GFM checkbox，但 AI 处理日志时可自动提取待办事项追加到清单中。

## 用户故事

- 用户点击 TitleBar 右侧的待办图标，展开侧栏查看所有待办
- 用户点击"+ 添加待办"内联输入新任务
- 用户勾选 checkbox 标记完成，状态实时写入 `todos.md`
- AI 处理录音/文件后，自动将发现的待办事项追加到 `todos.md`

## 数据存储

### 文件格式

`{workspace}/todos.md`，使用 YAML frontmatter + GFM task list 语法：

```markdown
---
description: 全局待办清单，由用户手动添加或 AI 自动提取
format: GFM task list
rules:
  - 每行一条待办，`- [ ]` 未完成，`- [x]` 已完成
  - 截止日期用 HTML 注释 `<!-- due:YYYY-MM-DD -->` 附在行尾（可选）
  - 完成日期用 `<!-- done:YYYY-MM-DD -->` 附在行尾（勾选时自动添加）
  - 新条目追加到未完成项末尾、已完成项之前
  - 不要重复已存在的条目
---

# 待办

- [ ] 输出首页改版高保真稿 <!-- due:2026-04-10 -->
- [ ] 更新 Q2 路线图 <!-- due:2026-04-15 -->
- [ ] 排期 API 性能优化
- [x] 准备竞品分析报告 <!-- done:2026-04-02 -->
```

规则：
- 每行一条待办，`- [ ]` 未完成，`- [x]` 已完成
- 截止日期用 HTML 注释 `<!-- due:YYYY-MM-DD -->` 附在行尾（可选）
- 完成日期用 `<!-- done:YYYY-MM-DD -->` 附在行尾（勾选时自动添加）
- 未完成在前，已完成在后，新条目追加到未完成区域末尾
- 文件不存在时，首次添加 todo 自动创建，写入完整的 YAML frontmatter 头 + `# 待办\n\n`
- YAML frontmatter 中的 rules 字段供 AI 读取，解析 todo 时应跳过 frontmatter 部分

### 解析逻辑（Rust 端）

新模块 `src-tauri/src/todos.rs`：

- `list_todos(workspace: &Path) -> Vec<TodoItem>` — 读取并解析 `todos.md`
- `add_todo(workspace: &Path, text: &str, due: Option<String>)` — 追加一行到未完成区域末尾
- `toggle_todo(workspace: &Path, line_index: usize, checked: bool)` — 修改指定行的 `[ ]` ↔ `[x]`，若勾选则追加 `<!-- done:YYYY-MM-DD -->`，若取消勾选则移除 done 注释
- `delete_todo(workspace: &Path, line_index: usize)` — 删除指定行

```rust
pub struct TodoItem {
    pub text: String,           // 待办内容
    pub done: bool,             // 是否完成
    pub due: Option<String>,    // 截止日期 YYYY-MM-DD
    pub done_date: Option<String>, // 完成日期
    pub line_index: usize,      // 在文件中的行号（用于定位修改）
}
```

## UI 设计

### 入口：TitleBar 按钮

- 位置：TitleBar 右侧，与 Identity 按钮同排
- 图标：Lucide `check-square`（16px，strokeWidth 1.5）
- 未完成数量徽标：右上角 14px 圆形，背景 `#C8933B`，文字 `#0f0f0f`，8px 字号
- 点击切换侧栏展开/收起
- 展开时图标颜色变为 `var(--record-btn)`（amber），收起时 `#888`

### 侧栏面板

- 宽度：固定 220px
- 位置：Detail 面板右侧，Detail 自动压缩（`flex: 1` 不变，侧栏抢占空间）
- 分隔线：左边 `0.5px solid var(--divider)`
- 展开动画：`width` 从 0 到 220px，`0.2s ease-out`
- 内边距：`12px 14px`

### 侧栏内容

#### 头部
- 标题 "待办"：10px，`var(--record-btn)` 色，`letter-spacing: 0.08em`，`text-transform: uppercase`，`font-weight: 500`
- 右侧计数："3 项"，10px，`#555`

#### 未完成列表
- 每条 todo：
  - Checkbox：14x14px，`border: 1.5px solid #555`，`border-radius: 3px`
  - 文本：11px，`line-height: 1.4`
  - 截止日期（可选）：9px，`color: #666`
  - 行容器：`padding: 6px 8px`，`border-radius: 5px`，`background: rgba(255,255,255,0.02)`
  - 行间距：`margin-bottom: 10px`
- Checkbox hover：`border-color` 变为 `var(--record-btn)`

#### 已完成列表
- 顶部分隔线：`0.5px solid var(--divider)`，`margin-top: 16px`，`padding-top: 8px`
- 标题 "已完成 · N"：10px，`color: #444`，大写
- Checkbox 已勾选：背景 `var(--record-btn)`，白色 ✓
- 文本：`color: #555`，`text-decoration: line-through`
- 默认折叠，点击标题展开

#### 添加按钮
- 位置：列表底部
- 样式：`border: 1px dashed #333`，`border-radius: 5px`，`padding: 8px`，居中
- 文字："+ 添加待办"，11px，`color: #555`
- 点击后变为内联输入框：
  - `font-size: 11px`，`background: transparent`，`border: none`，`outline: none`
  - `Enter` 提交，`Escape` 取消
  - 提交后调用 `add_todo` Tauri 命令

### 交互细节

- **勾选动画**：checkbox 填充 `0.15s ease`，文字划线 `0.2s ease`
- **勾选后**：条目经 `0.3s` 延迟滑入已完成区域（避免误触时立即消失）
- **右键菜单**：在 todo 条目上右键显示上下文菜单
  - "删除" — 删除此条待办
  - "设置截止日期" — 弹出日期输入（内联，不用 modal）
- **快捷键**：`Cmd+T` 展开/收起侧栏

## Tauri IPC

### 新增命令

| 命令 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `list_todos` | — | `Vec<TodoItem>` | 读取 workspace/todos.md |
| `add_todo` | `text: String, due: Option<String>` | `TodoItem` | 追加新待办 |
| `toggle_todo` | `line_index: usize, checked: bool` | — | 切换完成状态 |
| `delete_todo` | `line_index: usize` | — | 删除待办 |

### 事件

| 事件名 | 触发时机 | payload |
|---|---|---|
| `todos-updated` | todos.md 被修改后 | — |

AI 处理日志后追加待办时，也发出 `todos-updated` 事件，前端自动刷新侧栏。

## AI 提取集成

在 workspace 模板的 `.claude/CLAUDE.md` 中增加指令：

```
如果内容中包含待办事项、行动计划或后续步骤，将它们以 GFM task list 格式追加到 workspace 根目录的 todos.md 文件中。
格式：`- [ ] 待办内容 <!-- due:YYYY-MM-DD -->`（截止日期可选）。
不要重复已存在的条目。
```

AI 处理完成后，Rust 端检测 `todos.md` 是否被修改（比较 mtime），若有变化则发出 `todos-updated` 事件。

## 前端组件

### 新增文件

| 文件 | 职责 |
|---|---|
| `src/components/TodoSidebar.tsx` | 侧栏组件：列表渲染、checkbox 交互、内联输入 |
| `src/hooks/useTodos.ts` | 加载 todos、监听 `todos-updated` 事件、提供 CRUD 方法 |

### 修改文件

| 文件 | 变更 |
|---|---|
| `src/components/TitleBar.tsx` | 添加待办按钮 + 徽标 |
| `src/App.tsx` | 管理侧栏展开状态，在 Detail 面板右侧渲染 TodoSidebar |
| `src/lib/tauri.ts` | 添加 `listTodos`、`addTodo`、`toggleTodo`、`deleteTodo` IPC 包装 |
| `src/types.ts` | 添加 `TodoItem` 类型 |

### Rust 修改

| 文件 | 变更 |
|---|---|
| `src-tauri/src/todos.rs` | 新模块：解析/读写 todos.md |
| `src-tauri/src/main.rs` | 注册 4 个新命令 |
| `src-tauri/src/ai_processor.rs` | 处理完成后检测 todos.md mtime 变化，发出 `todos-updated` 事件 |

## 浅色主题适配

| 元素 | 暗色 | 浅色 |
|---|---|---|
| 侧栏背景 | `#0f0f0f`（继承 bg） | `#f5f6f7`（继承 bg） |
| Checkbox 边框 | `#555` | `#bbb` |
| Checkbox 选中填充 | `#C8933B` | `#4a6a7a`（跟随主题 accent shift） |
| Todo 行背景 | `rgba(255,255,255,0.02)` | `rgba(0,0,0,0.02)` |
| 已完成文字 | `#555` | `#aaa` |
| 添加按钮虚线 | `#333` | `#d8dce0` |

## 不做的事情

- 不解析日志中的 `- [ ]` checkbox
- 不做优先级、分类、项目分组
- 不做提醒/通知
- 不做拖拽排序（MVP）
- 不做日期选择器组件（内联文本输入即可）
