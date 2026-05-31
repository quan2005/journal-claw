# Ideas Workbench Design

## Context

当前“想法”已经从右侧面板进入中栏详情区，但实现仍是把窄栏 `TodoSidebar` 原样渲染到 `DetailView(type="ideas")`。它可用，但中栏首屏缺少自动化页面那种清晰、沉静、有呼吸感的层级。

本设计把想法详情升级为“轻工作台”：参考自动化页面的排版节奏和状态统计，但不做完整管理后台，不做常驻右侧详情栏，不改变 `todos.md` 存储格式。

## Confirmed Decisions

1. 方向选择“轻工作台”：比当前列表更有首屏层级，比完整工作台更轻。
2. 顶部参考自动化页面：eyebrow、标题、短说明、三段统计、主操作按钮。
3. 顶部统计使用处理状态：未完成、已探讨、有截止日期。
4. 主体保持单栏宽列表，不做右侧常驻详情栏。
5. 默认不展开行详情；详情和操作通过行点击、右键菜单或小按钮进入。
6. 第一版只做前端派生筛选，不改 `todos.md` / `done.md` 格式。
7. 保留现有想法能力：编辑、完成、设置截止、来源跳转、深入探讨、复制、设置路径、删除。
8. 右侧 Chat panel 架构不变；从想法进入探讨时打开或继续对应会话。

## Goals

- 让中栏“想法”页面具有和自动化页面一致的安静、专业、可扫描的排版质量。
- 保留想法列表的轻量属性，不把它变成复杂管理后台。
- 复用现有 `TodoContext`、`useTodos`、IPC 和 `todos.md` 数据模型。
- 将中栏视觉从窄栏列表升级为宽版列表，改善阅读、筛选和操作效率。
- 给后续“沉淀到日志”等更复杂状态预留空间，但不在第一版实现。

## Non-Goals

- 不修改 `todos.md` 或 `done.md` 文件格式。
- 不新增 Rust IPC、后端模型或数据库。
- 不新增“已沉淀到日志”等持久状态。
- 不做右侧常驻详情栏。
- 不做主题、项目或来源聚合卡片区。
- 不改右侧 Chat panel 架构。
- 不改自动化页面实现，只参考其视觉语言。

## Product Shape

`DetailView(type="ideas")` 渲染新的 `IdeasWorkbench`。

页面结构：

```text
IdeasWorkbench
  Header
    eyebrow: IDEAS
    title: 想法
    summary
    stats: 未完成 / 已探讨 / 有截止日期
    primary action: 新建想法
  Filter tabs
    全部 / 已探讨 / 有截止日期 / 已完成
  Wide list
    idea text
    status chip
    source/path summary
    due/date summary
    compact action entry
```

The user should be able to scan the page without opening any detail panel. More detail remains available, but it is secondary.

## Component Boundaries

### `IdeasWorkbench`

New component responsible for the center detail experience:

- Reads `TodoContext`.
- Computes stats and active filter counts.
- Owns filter tab state.
- Renders the header, tabs, empty state, loading state, and wide list.
- Calls existing todo handlers for changes.
- Receives optional navigation/conversation callbacks from `DetailView` or `App`.

### `IdeasRow`

Focused row component for the wide list:

- Displays text, done state, due date, source/path, discussion state.
- Handles row selection affordance.
- Supports inline text editing.
- Exposes compact action buttons for discuss, due date, source, and completion.
- Uses the same semantic actions as existing `TodoRow`.

### Existing `TodoSidebar`

Retain it for narrow/sidebar use and as implementation reference. Do not use it directly for the center workbench once `IdeasWorkbench` exists.

Reusable logic should be extracted only when it removes real duplication. Candidate helpers:

- date picker logic
- due badge formatting
- group display name computation
- context menu actions

Avoid large refactors before the new workbench passes tests.

## Data Flow

```text
TreeSidebar click "想法"
  -> App sets showIdeas
  -> DetailView receives type="ideas"
  -> DetailView renders IdeasWorkbench
  -> IdeasWorkbench reads TodoContext
  -> filter state derives visible todos
  -> row actions call existing TodoContext handlers
```

Stats:

- `未完成`: todos where `done === false`
- `已探讨`: todos where `session_id` is present
- `有截止日期`: unfinished todos where `due` is present

Tabs:

- `全部`: `done === false`, the default active scan
- `已探讨`: `session_id` present
- `有截止日期`: `done === false && due`
- `已完成`: `done === true`

Completed ideas stay out of the default scan. If `全部` should include completed in a later iteration, that should be a product decision.

## Interaction Design

Default behavior:

- Single-click row: select/highlight row only.
- Text click or double-click: enter inline editing.
- Completion control: toggles done through existing `toggleTodo`.
- Due chip or calendar icon: opens the existing date picker behavior.
- Source chip: navigates to source file when available.
- Discuss action: opens right Chat panel and either continues `session_id` or starts a new discussion.
- Right-click menu: preserves current menu capabilities.

Creation:

- `新建想法` creates a blank inline input at the top of the current list.
- Submit calls existing `addTodo`.
- Escape cancels the draft.

Empty state:

- Uses the same quiet visual language as automation empty states.
- Shows concise copy and `新建想法`.
- No decorative illustration or large card cluster.

Loading and errors:

- Loading uses narrow skeleton rows.
- Read/update failures show an `automation-alert`-style bar below the header.
- The workbench should not block previously loaded items if a later refresh fails.

## Visual Design

The page should feel like a lighter sibling of automation:

- Use a new `ideas-workbench-*` CSS namespace.
- Align underlying token choices with `automation-workbench`.
- Deep dark-mode quality is the primary benchmark.
- Light mode must preserve contrast and spacing.
- Accent remains amber gold only.
- Recording red is not used.
- No purple-blue gradients, glass, blur decoration, bounce motion, or nested cards.
- Row height should be more spacious than current `TodoSidebar`, but below automation template card density.
- Motion is limited to background, border, and opacity changes, <=150ms.
- Responsive behavior collapses secondary row columns before text truncates badly.

## Accessibility

- Filter tabs are buttons with accessible labels/counts.
- Row action buttons have labels or titles.
- Inline editing preserves keyboard escape/enter behavior.
- Keyboard focus must be visible using existing focus ring tokens.
- Text truncation must not hide the only available action for source, due date, or discussion.

## Testing

Component tests:

- `DetailView(type="ideas")` renders `IdeasWorkbench`.
- Header renders title and three processing stats.
- Filter tabs render and filter expected todo sets.
- `新建想法` calls `addTodo`.
- Inline edit calls `updateTodoText`.
- Completion control calls `toggleTodo`.
- Due control calls `setTodoDue`.
- Discuss action calls the provided conversation callback.

CSS/theme tests:

- Assert `ideas-workbench` class family exists.
- Assert the page uses semantic tokens rather than hard-coded one-off dark colors where practical.

Manual verification:

- Run targeted Vitest tests.
- Run `npm run build`.
- Smoke-check dark mode and a narrow viewport in the browser.
- Confirm no text overlap in header stats, tabs, or row actions.

## Implementation Notes

Keep the first implementation incremental:

1. Add tests for the current `DetailView(type="ideas")` expectation.
2. Add `IdeasWorkbench` and route `DetailView(type="ideas")` to it.
3. Move only the necessary shared todo UI helpers out of `TodoSidebar`.
4. Add the `ideas-workbench-*` CSS section near automation CSS in `src/styles/globals.css`.
5. Keep `TodoSidebar` functional and avoid broad rewrites.

## Open Risks

- `TodoSidebar` currently mixes UI, date picker, context menu, and todo actions in one file. Extracting shared behavior may be needed, but should stay scoped.
- Current `TodoItem` does not distinguish “source” from “path” as cleanly as the new visual design might imply. The first version should display existing fields honestly instead of inventing a richer model.
- If the user later wants “已沉淀到日志”, that requires a new persisted state or a derivation rule and should be handled as a separate design.
