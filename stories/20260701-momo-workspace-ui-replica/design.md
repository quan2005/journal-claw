# design.md — Momo Workspace UI 复刻（Topics 分类）

> 对应 story: `./story.md`（status: verified）
> 本文件回答「怎么实现」，包含方案选型、数据契约、NFR、技术异常分支与架构决策。

## 1. 总体方案

将现有 Topics（专题）分类的默认中心视图从「空/详情」替换为 **Workspace hub**：左侧沿用 `TreeSidebar` 展示 Topics 树，中间新增 `WorkspaceView` 组件，右侧复用现有 `RightPanel` Chat 面板。

**核心决策：**
- **不复刻独立应用**：直接嵌入 `apps/web`，复用谨迹的 NavRail、TreeSidebar、RightPanel、主题系统、设计 token。
- **不新增导航图标**：Workspace 不是新 category，而是 `activeCategory === 'topics'` 时的中心视图。
- **选中文件行为不变**：点击 Topics 树中的**文件**（`treeSelection.type === 'topic-file'`）仍进入原有 `DetailView`；选中文件夹或清空选择时回到 Workspace hub。
- **右侧 Chat 默认收起**：与当前谨迹行为一致，用户通过标题栏或快捷键展开后，才显示 Momo 风格的 Chat 占位。

## 2. 组件拆分

| 组件 | 路径 | 职责 |
|---|---|---|
| `WorkspaceView` | `apps/web/src/components/WorkspaceView.tsx` | 中心视图容器，组合以下子组件；Recently Viewed 优先使用真实 topic 文件，不足时补充 mock。 |
| `WorkspaceHeader` | 同文件内部子组件 | 顶部标题栏：Workspace + 搜索/视图图标（占位）。 |
| `QuickStart` | 同文件内部子组件 | New File / New Folder / Import 三个卡片。 |
| `RecentlyViewed` | 同文件内部子组件 | 表格 + Show more。 |
| `WorkspaceChatShell` | 同文件内部子组件 | Momo 风格 Chat 面板：顶部「New Chat」历史会话下拉框（聊天图标）、问候语/真实消息列表、融合输入框（内部包含引擎/模型/权限选择 chip）、发送/取消/重试；集成 `useAgentEngine` / `useAgentRun` / `useConversation` 的真实能力。 |
| `SessionDropdown` | 同文件内部子组件 | 历史会话下拉：触发器显示聊天图标 +「New Chat」，下拉菜单内包含「新建对话」选项、搜索框、会话列表（切换/删除）。 |

**为什么不拆成多个文件？** 本次为原型验证，子组件间无复用需求；单文件可减少扩散面，后续若其他视图复用再提取。

## 3. 集成点

### 3.1 App.tsx 中心渲染分支

在现有中心内容区（`DetailView` 外层）增加条件分支：

```tsx
{activeCategory === 'topics' && (!treeSelection || treeSelection.type === 'topic') ? (
  <WorkspaceView />
) : (
  <Suspense fallback={null}>
    <DetailView ... />
  </Suspense>
)}
```

- `!treeSelection` 表示：未选中任何文件时展示 Workspace hub。
- 选中文件夹时 `treeSelection` 仍为 `null`（焦点由 `topicFocusSelection` 记录），Workspace hub 保持显示。
- 选中具体文件（`treeSelection.type === 'topic-file'`）或从链接返回旧日志（`type === 'journal'`）时，渲染原有 `DetailView`。

### 3.2 左侧 TreeSidebar

`TreeSidebar` 在 `category === 'topics'` 时已渲染 Topics 树，**无需修改**。Workspace 视图只需把中心区域替换掉。

### 3.3 右侧 RightPanel

复用现有 `RightPanel` 容器，但将内部的 `UnifiedChatShell` 替换为 Momo 风格的 `WorkspaceChatShell`。`App.tsx` 把 `useConversation` 提供的真实会话状态（`sessionId`、`messages`、`isStreaming`、`onSend`、`onCancel`、`onRetry` 等）注入 `WorkspaceChatShell`，从而在所有分类（含 Topics）下都保留真实 Chat 能力。

`WorkspaceChatShell` 内部集成：
- `useAgentEngine`：切换 built-in / CLI 引擎、选择 agent；
- `useAgentRun`：当引擎为 CLI 时驱动外部 agent 的运行流；
- `SessionDropdown`：顶部「New Chat」下拉框，展示历史会话并支持切换/删除/新建；
- `EngineSwitcher` / `AuthModeToggle`：放置于输入框下方作为可点击 chip，分别控制引擎/模型与外部 agent 授权模式；
- `MarkdownRenderer` / `RunStreamEntries`： assistant 消息与 CLI 运行产物的渲染。

原 `UnifiedChatShell` 与 `HistoryFloatingButton` 不再被 `App.tsx` 使用，但保留在代码库中供其他未改动的调用方继续使用。

## 4. 数据契约

### 4.1 组件 props

`WorkspaceView` 接收 `onOpenRecent(path: string)`，当用户点击 Recently Viewed 中某一行时调用，由 `App.tsx` 负责导航到原有 `DetailView`。Quick Start 使用本地状态/mock 占位，不调用真实后端。

`WorkspaceChatShell` 接收 `ConversationSlice`（来自 `useConversation`）以及：
- `onNewChat?: () => void`：创建新会话；
- `onSelectSession?: (id: string) => void`：切换到已有会话；
- `activeSessionId?: string | null`：高亮当前会话。

所有消息发送、取消、重试均委托给 `useConversation` 的真实回调；CLI 引擎路径 additionally 通过 `useAgentRun` 触发外部 agent 运行。历史会话数据由 `SessionDropdown` 内部通过 `conversationList` 拉取并通过 `conversation-stream` SSE 事件保持同步。

### 4.2 Mock 数据结构

Quick Start / Chat 占位使用本地状态或 mock 数据。Recently Viewed 优先消费真实 topic 文件：

```ts
interface WorkspaceRecentItem {
  id: string
  name: string
  path: string // 用于 @ 引用与详情跳转
  iconType: 'markdown' | 'html' | 'skill'
  contributorInitial: string
  contributorColor: string
  viewedAt: Date
}

interface WorkspaceFolder {
  id: string
  name: string
  children?: WorkspaceFolder[]
  files?: { name: string; path: string; iconType: string }[]
}
```

- `Recently Viewed` 通过 `useTopics()` 读取真实 topic 文件，按 `mtime_secs` 排序；真实文件不足 5 条时补充写死的 mock 数据，底部 `Show more` 展开到最多 10 条。
- 文件树左侧仍由 `TreeSidebar` 提供真实 Topics 结构；若当前无 Topics 数据，显示空提示。

## 5. 样式方案

### 5.1 文件

新增 `apps/web/src/styles/workspace.css`，在 `main.tsx` 或组件内 `import`。

### 5.2 设计 token 消费

| 视觉元素 | Token / 值 | 说明 |
|---|---|---|
| 背景 | `var(--bg)` / `var(--bg-secondary)` | 中心白底，文件树暖白底 |
| 文字 | `var(--text-primary)` / `var(--text-secondary)` / `var(--text-tertiary)` | 主/次/三级文字 |
| 边框 | `var(--divider)` | 1px 浅灰边框 |
| 圆角 | `var(--radius-lg)` / `var(--radius-md)` | 卡片 8px，按钮 6px |
| 阴影 | `var(--shadow-overlay)` | 仅用于浮层，卡片无阴影 |
| 悬停/选中 | `var(--item-hover-bg)` / `var(--item-selected-bg)` | 复用谨迹列表项模式 |
| 主按钮 | `var(--workbench-btn-primary-bg)` | Quick Start 卡片 hover 时可用 |
| 聚焦环 | `var(--focus-ring)` | 所有可聚焦元素 |

### 5.3 布局尺寸

- 左侧文件树：复用 `TreeSidebar`，宽度由 `sidebarWidth` 状态决定。
- 中心 Workspace 内容区：自适应，最大宽度约 `900px`，居左或撑满。
- 右侧 Chat 面板：复用 `rightPanelWidth`，约 `360px`。
- Quick Start 卡片：等宽三列，gap `16px`。
- Recently Viewed 表格：表头 `14px` 次要色，行高 `56px`。
- Chat composer：输入框、工具栏、引擎/权限选择器融为同一带边框卡片；选择器通过顶部细线与输入区分隔。

## 6. 暗色主题

依赖 CSS 变量自动切换：
- 背景/文字直接使用 `--bg`、`--text-primary` 等已有暗色变量。
- 悬停态使用 `var(--item-hover-bg)` 的暗色定义（`rgba(255,255,255,0.04)`）。
- 聚焦环使用 `--focus-ring` 暗色版（混入 `--bg` 后浓度自然降低）。
- 文件类型图标颜色沿用 `--file-*` token。

**验证方式**：切换系统/应用暗色主题后，目视检查无低对比度区域。

## 7. 交互行为

| 元素 | 行为 |
|---|---|
| New File / New Folder / Import | 点击后弹出临时占位提示（toast 或内联输入框），不调用 daemon。 |
| Recently Viewed 行 | 点击后调用 `onSelectFile(path, true)`，进入原有 `DetailView`。 |
| 文件树文件夹 | 沿用 `TreeSidebar` 展开/折叠行为。 |
| 文件树文件 | 沿用现有行为，进入详情视图。 |
| Chat 输入框 | 回车触发真实发送（built-in 走 `useConversation.onSend`，CLI 走 `useAgentRun.start`）；发送按钮在空输入/流式中禁用；流式时再次回车或点击变为取消。 |
| 顶部「New Chat」下拉框 | 点击展开会话列表，可搜索、切换、删除已有会话；顶部「New Chat」选项创建新会话；左侧使用聊天图标。 |
| 输入框内引擎 chip | 点击展开 `EngineSwitcher` 弹窗，切换 built-in / CLI 引擎及 agent。 |
| 输入框内权限 chip | 仅在 CLI 引擎下显示，点击展开 `AuthModeToggle` 弹窗，切换授权模式。 |
| 工具调用胶囊 | Assistant 消息中的 `tools` 默认以单行胶囊（图标 + 工具名 + 描述）收起展示；有 `output` 时胶囊可点击，点击后展开显示执行过程与结果；错误态使用危险色。 |
| Show more | 展开更多 mock 行，仅前端状态。 |

## 8. 异常分支

| 场景 | 处理 |
|---|---|
| Topics 数据为空 | 按 story 边界，Recently Viewed 优先真实文件、不足 5 条时补充 mock 数据，因此空 Topics 时仍展示 mock 列表，不显示单独空状态。 |
| 暗色 token 缺失 | 若发现某 token 在暗色下对比度不足，优先使用 `color-mix` 派生，避免硬编码。 |
| 右侧面板未展开 | Chat 占位不渲染，不影响 Workspace hub 使用。 |
| 用户选中 topic 文件 | 中心自动切换为 `DetailView`，Workspace hub 隐藏。 |

## 9. 测试策略

- **Vitest + React Testing Library**：
  - `WorkspaceView.test.tsx`：渲染后断言 Quick Start 三个按钮、Recently Viewed 表头、Show more 存在；断言点击 Recently Viewed 行触发 `onOpenRecent`。
  - `WorkspaceChatShell` 测试：mock `useAgentEngine` / `useAgentRun` / `listLocalAgents` / `getEngineConfig` / `conversationList` / `conversationDelete` / `selectRuntimeClient`，断言问候语渲染、输入后点击发送触发真实 `onSend`、空输入时发送禁用、New Chat 按钮触发 `onNewChat`。
- **视觉验收**：
  - 在浅色/暗色主题下运行 `npm run dev`，与截图并排对比。
  - 若后续维护，可补充 Playwright 截图测试，本次不强制。

## 10. 变更文件清单

- 新增 `apps/web/src/components/WorkspaceView.tsx`
- 新增 `apps/web/src/styles/workspace.css`
- 修改 `apps/web/src/App.tsx`（中心渲染分支与右侧 Chat 占位）
- 修改 `apps/web/src/main.tsx`（引入 workspace.css）
- 新增 `apps/web/src/tests/WorkspaceView.test.tsx`

---

## 11. 未决事项（开发过程中可能细化）

- 是否需要把「New File / New Folder / Import」的点击反馈做成具体 UI（内联输入框 / 确认弹窗）？——本次用 toast/占位提示，保持最小实现。
- 左侧文件树是否后续要完全替换为截图中的 Workspace 侧边栏（Home / Personal Space 分组）？——当前保留现有 `TreeSidebar` 以保证 Topics 数据一致性；如需完全还原可再拆 `WorkspaceSidebar`。
