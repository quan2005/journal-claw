# 工作空间文件树原型对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 workspace 文件树真实 UI 对齐用户原型，落地 B · Glyph Tile 文件图标、移除目录统计数字，并修复 Web/Electron 右键删除，同时保留信号橙选中态、常显排序和全部既有交互。

**Architecture:** workspace 专用 `WorkspaceTreeRow` 由 `TopicTree` 与 `TreeItem` 的 `topic-file` 分支共享；递归结构和业务回调仍留在 `TopicTree`/`TreeSidebar`。几何与状态样式集中到 scoped CSS，文件图标通过 `FileTypeIcon` 的 workspace-only `glyph-tile` variant 复用现有矢量 glyph。删除继续经过现有 `runtimeClient`，但 workspace 节点改走现有 `workspace_delete_file` 协议；浏览器确认由 `hostBridge` 回退到标准 `window.confirm`，daemon 不变。

**Tech Stack:** React 19、TypeScript、CSS custom properties、Vitest、Testing Library、Playwright。

## Global Constraints

- 用户原型归一化基准为 298×550 CSS px，关键几何误差不超过 ±2 CSS px。
- 行高 34 px；每级缩进 10 px；选中背景为 `var(--item-selected-bg)` 且圆角必须消费 `--radius-pill`。
- 信号橙 `#FF5701` 是唯一交互 accent；不复制原型的灰色选中背景。
- 标题只显示“个人空间”和常显排序按钮；删除 `Workspace`、搜索、布局和额外“工作空间”标题。
- 尾部操作顺序为 `…` 后 `@`。
- workspace 文件夹和文件均不显示子项统计数字。
- workspace 文件图标使用 16×16 Glyph Tile；内部 glyph 约 11–12 px；marker 槽 16 px、gap 5 px，名称列锚点保持不变。
- Glyph Tile 必须暴露 `data-file-kind` 和 `data-file-icon-variant="glyph-tile"`；禁止依赖本地化 `aria-label` 做视觉选择器。
- 选中行的 glyph/tile 必须切换为 `var(--item-selected-text)` 对比色；交互 accent 仍只有信号橙。
- Electron 确认继续走 `electronAPI.ask`；Plain Web 回退到标准 `window.confirm(message)`；SSR/无 `window` 返回 `false`。
- workspace 删除必须调用现有 `workspace_delete_file({ relativePath })`；取消确认不得调用删除，成功后才 deselect/refresh。
- 不修改 daemon、runtime 协议、文件排序算法、权限或持久化。
- 不新增第三方依赖，不修改版本号。
- 视觉/交互变更必须先红后绿；提交前执行独立 `verification-gate` 和 `docs-maintenance`。

---

## File Map

| 文件                                           | 职责                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| `apps/web/src/components/WorkspaceTreeRow.tsx` | workspace 行的 DOM、图标、重命名、操作按钮和事件边界      |
| `apps/web/src/components/FileTypeIcon.tsx`     | workspace-only Glyph Tile variant 与文件类型数据属性      |
| `apps/web/src/styles/workspace-tree.css`       | 34 px 行、10 px 缩进、引导线、胶囊、hover/focus/dark 样式 |
| `apps/web/src/styles/globals.css`              | 文件类型语义色 token（如确需补齐 HTML 类型）              |
| `apps/web/src/components/TopicTree.tsx`        | 递归数据、展开/折叠、拖拽排序，组合共享行                 |
| `apps/web/src/components/TreeItem.tsx`         | `topic-file` 分支委托共享行；Journal/Identity 保持原状    |
| `apps/web/src/components/TreeSidebar.tsx`      | “个人空间”标题、常显排序、树根和既有交互编排              |
| `apps/web/src/lib/hostBridge.ts`               | Electron 原生确认与 Plain Web confirm 回退                |
| `apps/web/src/tests/hostBridge.test.ts`        | host 确认分流、确认/取消行为                              |
| `apps/web/src/tests/WorkspaceTreeRow.test.tsx` | 行级几何、状态、操作顺序和事件测试                        |
| `apps/web/src/tests/TopicTree.test.tsx`        | 多层缩进、引导线、展开、图标、拖拽和重命名回归            |
| `apps/web/src/tests/TreeItem.test.tsx`         | pinned topic 共享行与非 workspace 条目回归                |
| `apps/web/src/tests/TreeSidebar.test.tsx`      | 标题、移除入口、排序、键盘和上下文菜单回归                |
| `apps/web/e2e/workspace-tree.visual.spec.ts`   | 真实应用的几何 bounding box 和浅/暗色截图证据             |

---

### Task 1: 固化共享行的行为与几何契约

**Files:**

- Create: `apps/web/src/tests/WorkspaceTreeRow.test.tsx`
- Create: `apps/web/src/components/WorkspaceTreeRow.tsx`
- Create: `apps/web/src/styles/workspace-tree.css`

**Interfaces:**

- Consumes: `TopicEntry`, `FileTypeIcon`, `fileTypeIconKindFromName`, `displayTopicName`
- Produces:

```ts
export interface WorkspaceTreeRowProps {
  entry: TopicEntry
  depth: number
  expanded?: boolean
  selected: boolean
  focused?: boolean
  editing?: boolean
  manualSort?: boolean
  onActivate: () => void
  onAt?: () => void
  onMore?: (x: number, y: number) => void
  onCommitEdit?: (newName: string) => void
  onCancelEdit?: () => void
  drag?: {
    onDragStart: React.DragEventHandler<HTMLSpanElement>
    onDragOver: React.DragEventHandler<HTMLSpanElement>
    onDrop: React.DragEventHandler<HTMLSpanElement>
  }
}
```

- [ ] **Step 1: 写共享行红测试**

覆盖以下断言：

```tsx
expect(row).toHaveAttribute('data-depth', '2')
expect(row).toHaveAttribute('aria-selected', 'true')
expect(row.querySelector('[data-workspace-marker]')).toBeTruthy()
expect(row.querySelector('[data-workspace-selection-bar]')).toBeNull()
expect(
  within(actions)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label')),
).toEqual(['更多', '引用'])
```

同时断言目录没有 folder icon、文件有 `Markdown 文件`/`HTML 文件`、点击操作不触发行 `onActivate`、Enter/Escape 正确提交/取消重命名。

- [ ] **Step 2: 运行红测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/WorkspaceTreeRow.test.tsx
```

Expected: FAIL，因为 `WorkspaceTreeRow` 尚不存在。

- [ ] **Step 3: 实现最小共享行**

实现上述 props。行根节点使用：

```tsx
<div
  className="workspace-tree-row tree-item-row"
  role="treeitem"
  data-depth={depth}
  data-path={entry.path}
  aria-expanded={entry.is_dir ? expanded : undefined}
  aria-selected={selected}
  style={{ '--workspace-tree-depth': depth } as React.CSSProperties}
/>
```

marker 槽内目录渲染 chevron，文件渲染 `<FileTypeIcon size={18} />`。trailing actions 固定按“更多”再“引用”输出，并为两个按钮提供中文 accessible name。

- [ ] **Step 4: 实现 scoped CSS**

根容器声明：

```css
.workspace-tree {
  --workspace-tree-row-height: 34px;
  --workspace-tree-indent: 10px;
  --workspace-tree-inline: 7px;
  --workspace-tree-marker: 14px;
  --workspace-tree-marker-gap: 7px;
}
```

行使用 34 px 高、`grid-template-columns: 14px minmax(0, 1fr) auto`、`padding-inline` 计算 depth、`border-radius: var(--radius-pill)`。选中、hover、`:focus-visible`、操作显隐、reduced motion 和 children guide 均限定在 `.workspace-tree` 下；只动画 opacity/transform。

- [ ] **Step 5: 运行共享行测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/WorkspaceTreeRow.test.tsx
```

Expected: PASS。

---

### Task 2: 让递归树使用统一行和引导线

**Files:**

- Modify: `apps/web/src/components/TopicTree.tsx`
- Modify: `apps/web/src/tests/TopicTree.test.tsx`

**Interfaces:**

- Consumes: Task 1 的 `WorkspaceTreeRow`
- Produces: `TopicTree` 原公开 props 保持兼容；递归 children wrapper 暴露 `data-workspace-depth`

- [ ] **Step 1: 写递归与同列对齐红测试**

构造根目录、同级 Markdown、一级目录、二级 HTML fixture，断言：

```tsx
expect(rootFolder).toHaveAttribute('data-depth', '0')
expect(rootFile).toHaveAttribute('data-depth', '0')
expect(levelOneFolder).toHaveAttribute('data-depth', '1')
expect(levelTwoFile).toHaveAttribute('data-depth', '2')
expect(screen.getAllByTestId('workspace-tree-children')).toHaveLength(2)
expect(rootFolder.querySelector('[data-workspace-marker]')).toBeTruthy()
expect(rootFile.querySelector('[data-workspace-marker]')).toBeTruthy()
```

保留并更新现有 hover、selected、展开/折叠、空目录、手动拖拽和 inline rename 测试；目录无论展开与否都不显示 child count。

- [ ] **Step 2: 运行 `TopicTree` 红测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/TopicTree.test.tsx
```

Expected: 新增的 depth、children wrapper 和操作顺序断言 FAIL。

- [ ] **Step 3: 用共享行替换内联行 markup**

删除 `TopicTree` 内的 `actBtnStyle`、`rowIndent = 8 + indent * 16` 和内联 hover 样式。为每项传入：

```tsx
<WorkspaceTreeRow
  entry={entry}
  depth={indent}
  expanded={isExpanded}
  selected={isSelected}
  focused={entry.path === focusedPath}
  editing={entry.path === editingPath}
  manualSort={sortStrategy === 'manual'}
  onActivate={() => (isDir ? onToggleDir(entry.path) : onSelectFile(entry))}
  onAt={() => onAt(entry.path)}
  onMore={(x, y) => onMore(entry, x, y)}
  onCommitEdit={(newName) => onCommitEdit?.(entry.path, newName, isDir)}
  onCancelEdit={onCancelEdit}
  drag={sortStrategy === 'manual' ? dragHandlers : undefined}
/>
```

展开子项包裹在：

```tsx
<div
  className="workspace-tree-children"
  data-testid="workspace-tree-children"
  data-workspace-depth={indent}
/>
```

加载中和空文件夹占位同样使用 depth 自定义属性，使文字起点与该层名称列对齐。

- [ ] **Step 4: 运行 `TopicTree` 测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/TopicTree.test.tsx
```

Expected: PASS。

---

### Task 3: 对齐 pinned topic 行且隔离其他列表

**Files:**

- Modify: `apps/web/src/components/TreeItem.tsx`
- Modify: `apps/web/src/tests/TreeItem.test.tsx`

**Interfaces:**

- Consumes: Task 1 的 `WorkspaceTreeRow`
- Produces: `TreeItemProps` 公开签名保持兼容，`topic-file` 分支使用 depth=`indent`

- [ ] **Step 1: 写隔离红测试**

新增 pinned topic 测试，断言 `topic-file` 的根节点具有 `.workspace-tree-row`、`data-depth="0"`、选中胶囊且操作顺序为“更多”再“引用”。保留 Journal 长标题、标签和 action-collapse 测试，断言它们仍不出现 `.workspace-tree-row`。

- [ ] **Step 2: 运行 `TreeItem` 红测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/TreeItem.test.tsx
```

Expected: pinned topic 的共享行断言 FAIL。

- [ ] **Step 3: 委托 `topic-file` 分支**

在 `TreeItem` 组件主体最前方处理：

```tsx
if (itemType === 'topic-file' && topicEntry) {
  return (
    <div className="workspace-tree">
      <WorkspaceTreeRow
        entry={topicEntry}
        depth={indent}
        selected={isSelected}
        onActivate={onClick}
        onAt={onAt}
        onMore={onMore}
      />
    </div>
  )
}
```

从通用 `ItemBlock` 删除 topic 文件分支及其不再使用的 import。Journal/Identity 的 DOM 与行为不改。

- [ ] **Step 4: 运行 `TreeItem` 测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/TreeItem.test.tsx
```

Expected: PASS。

---

### Task 4: 落地“个人空间”标题和常显排序

**Files:**

- Modify: `apps/web/src/components/TreeSidebar.tsx`
- Modify: `apps/web/src/tests/TreeSidebar.test.tsx`

**Interfaces:**

- Consumes: 现有 `useTreeSort`、`SORT_LABELS`、`TopicTree`
- Produces: `role="tree"` 的 accessible name 改为“个人空间”；排序按钮仍暴露 `data-active-sort`

- [ ] **Step 1: 写标题与移除入口红测试**

新增/更新断言：

```tsx
expect(screen.getByText('个人空间')).toBeTruthy()
expect(screen.getByRole('button', { name: '排序' })).toBeVisible()
expect(screen.queryByText('Workspace')).toBeNull()
expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
expect(screen.queryByRole('button', { name: 'View layout' })).toBeNull()
expect(screen.queryByRole('button', { name: '折叠工作空间' })).toBeNull()
expect(screen.getByRole('tree', { name: '个人空间' })).toBeTruthy()
```

排序菜单切换、ArrowDown/Enter、右键、`@` 和更多菜单测试继续保留。

- [ ] **Step 2: 运行 `TreeSidebar` 红测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx
```

Expected: 新标题与移除入口断言 FAIL。

- [ ] **Step 3: 替换 topics 顶部结构**

删除 `Search`、`LayoutGrid` import 和按钮，删除 topics 的 `SectionHeader` 包装及 `isCollapsed('topics')` 判定。新增：

```tsx
<header className="workspace-tree-header">
  <span className="workspace-tree-title">个人空间</span>
  <div className="workspace-tree-sort">…现有排序按钮和菜单…</div>
</header>
```

topics 树根增加 `className="workspace-tree"`、`aria-label="个人空间"`，保留 `tabIndex={0}` 与 `onKeyDown={handleTreeKeyDown}`。排序按钮和菜单使用 scoped CSS、`--radius-pill`/`--radius-lg`/`--border-menu`/`--shadow-overlay`/`--focus-ring`。

- [ ] **Step 4: 运行 sidebar 及相关组件测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx src/tests/TopicTree.test.tsx src/tests/TreeItem.test.tsx src/tests/WorkspaceTreeRow.test.tsx
```

Expected: PASS。

---

### Task 5: 真实渲染几何与主题验收

**Files:**

- Create: `apps/web/e2e/workspace-tree.visual.spec.ts`
- Create: `stories/20260730-workspace-tree-prototype-alignment/evidence/actual-light.png`
- Create: `stories/20260730-workspace-tree-prototype-alignment/evidence/actual-dark.png`
- Create: `stories/20260730-workspace-tree-prototype-alignment/evidence/overlay.png`
- Modify: component/CSS files only if measurements exceed tolerance

**Interfaces:**

- Consumes: 真实 Vite app、Playwright `page.route`、用户参考 PNG
- Produces: 可重复的 geometry assertions 和三张验收证据

- [ ] **Step 1: 写视觉红测试**

用 daemon route fixture 构造：

```text
帮助文档/
  导入和协同/
    从 Notion 和 Google Drive 迁入.md
    接入外部工具.md
    文件格式与导入说明.md   ← selected
    邀请你的同事一起来.md
操作技巧与快捷键.md
产品理念.html
```

测试使用 DPR 2，并通过 locator bounding boxes 断言：

```ts
expect(Math.abs(nextRowY - rowY - 34)).toBeLessThanOrEqual(2)
expect(Math.abs(depthOneNameX - rootNameX - 10)).toBeLessThanOrEqual(2)
expect(Math.abs(depthTwoNameX - depthOneNameX - 10)).toBeLessThanOrEqual(2)
expect(Math.abs(selectedBox.height - 34)).toBeLessThanOrEqual(2)
```

- [ ] **Step 2: 运行视觉红测试**

Run:

```bash
bun run --filter @journal/web test:e2e -- workspace-tree.visual.spec.ts
```

Expected: 当前几何或缺少测试 fixture 时 FAIL。

- [ ] **Step 3: 校准真实 CSS**

只根据 Playwright 实测调整集中式 workspace custom properties。不得为单个 depth 写特例；同一锚点连续两次测量稳定后才接受。

- [ ] **Step 4: 生成浅色、暗色和叠加证据**

截取 596×1100 px 的浅色与暗色 workspace 侧栏。将浅色图与：

`/var/folders/3v/zv__rrqn0j3g_jh35z22krdc0000gn/T/codex-clipboard-918f816a-2f92-42b8-8d7d-7c9ca71b78b6.png`

按相同画布 50% opacity 叠加生成 `overlay.png`，并在 verify report 中记录信号橙与常显排序两个批准差异。

- [ ] **Step 5: 运行视觉测试**

Run:

```bash
bun run --filter @journal/web test:e2e -- workspace-tree.visual.spec.ts
```

Expected: PASS，所有几何差值 ≤2 CSS px。

---

### Task 6: 修复 workspace 右键删除链路

**Files:**

- Modify: `apps/web/src/tests/hostBridge.test.ts`
- Modify: `apps/web/src/lib/hostBridge.ts`
- Modify: `apps/web/src/tests/TreeSidebar.test.tsx`
- Modify: `apps/web/src/components/TreeSidebar.tsx`

**Interfaces:**

- Consumes: `TreeContextMenu` 既有确认流程、`selectRuntimeClient()`、现有 `workspace_delete_file` runtime command
- Produces: Electron/Plain Web 一致的确认结果；workspace 删除命令与成功后刷新语义

- [ ] **Step 1: 为 Plain Web 确认回退写红测试**

在无 `window.electronAPI` 的 jsdom 环境中用 `vi.spyOn(window, 'confirm')` 分别返回 `true`、`false`，断言 `hostAsk('Delete?')` 返回相同结果且只把消息传给 `window.confirm`。保留 Electron 测试，断言存在 `electronAPI.ask` 时不会调用 Web confirm。

- [ ] **Step 2: 运行 hostBridge 红测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/hostBridge.test.ts
```

Expected: FAIL，因为 Plain Web 当前固定返回 `false`。

- [ ] **Step 3: 实现最小确认回退**

`hostAsk` 先读取 Electron host；存在时保持 `electron.ask(message, options)`。否则在 `typeof window !== 'undefined'` 时返回 `window.confirm(message)`，SSR 返回 `false`。同步更正文档注释。

- [ ] **Step 4: 为 workspace 删除命令写红测试**

在 `TreeSidebar.test.tsx` 构造 workspace 根文件 `AGENTS.md`，右键打开菜单并点击“删除”。确认成功后断言 runtime 收到：

```ts
expect(invoke).toHaveBeenCalledWith('workspace_delete_file', {
  relativePath: 'AGENTS.md',
})
```

并断言成功后调用 `onDeselect` 与 workspace refresh。另一个取消确认用例断言删除命令、deselect、refresh 均未发生。测试中的确认只 mock `hostAsk`，不操作真实文件系统。

- [ ] **Step 5: 运行 sidebar 红测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx
```

Expected: workspace 删除断言 FAIL，实际命令仍为 `delete_topic`。

- [ ] **Step 6: 改用现有 workspace 删除协议**

把 topic file/folder 分支改为：

```ts
selectRuntimeClient().invoke<void>('workspace_delete_file', { relativePath: path })
```

只有删除成功才调用 `onDeselect()`、`refreshPinned()` 和 `loadTopics()`；异常路径保持现有错误处理。

- [ ] **Step 7: 运行局部删除回归**

Run:

```bash
cd apps/web && bunx vitest run src/tests/hostBridge.test.ts src/tests/TreeContextMenu.test.tsx src/tests/TreeSidebar.test.tsx src/tests/ipc-contract.test.ts
```

Expected: PASS。

---

### Task 7: 移除统计数字并落地 B · Glyph Tile

**Files:**

- Modify: `apps/web/src/tests/WorkspaceTreeRow.test.tsx`
- Modify: `apps/web/src/components/WorkspaceTreeRow.tsx`
- Modify: `apps/web/src/tests/TopicTree.test.tsx`
- Modify: `apps/web/src/components/TopicTree.tsx`
- Modify: `apps/web/src/components/FileTypeIcon.tsx`
- Modify: `apps/web/src/styles/workspace-tree.css`
- Modify: `apps/web/src/styles/globals.css`（仅当 HTML 缺少语义色 token）

**Interfaces:**

- Consumes: 既有 `VectorGlyph`、`ICON_PALETTES`、结构化 radius/color token
- Produces: `FileTypeIcon` 可选 `variant="glyph-tile"`；workspace 行不再接受 `childCount`

- [ ] **Step 1: 写无计数和 Glyph Tile 红测试**

`WorkspaceTreeRow.test.tsx` 断言目录与文件均没有 `.workspace-tree-child-count`；目录仍只有 chevron；文件图标具有：

```tsx
expect(icon).toHaveAttribute('data-file-kind', 'markdown')
expect(icon).toHaveAttribute('data-file-icon-variant', 'glyph-tile')
```

断言 selected 文件图标消费 `var(--item-selected-text)`；操作按钮的 accessible names 与顺序仍为 `['更多', '引用']`，且两个按钮都渲染 SVG glyph、引用按钮不再暴露裸文本 `@`。`TopicTree.test.tsx` 删除 child count 预期，改为展开目录也不出现统计数字。

- [ ] **Step 2: 运行视觉组件红测试**

Run:

```bash
cd apps/web && bunx vitest run src/tests/WorkspaceTreeRow.test.tsx src/tests/TopicTree.test.tsx
```

Expected: 新 variant、数据属性和无计数断言 FAIL。

- [ ] **Step 3: 实现最小 Glyph Tile API**

为 `FileTypeIconProps` 增加 `variant?: 'glyph-tile'`，默认保持所有非 workspace 调用的现状。variant 下根 span 使用 16×16、结构化圆角、现有 palette 的 fg/bg/border，并输出 `data-file-kind`、`data-file-icon-variant`；内部继续复用 `VectorGlyph`。selected 时前景和边框/底色组合必须以 `var(--item-selected-text)` 为对比来源。

- [ ] **Step 4: 接入 workspace 行并移除计数 API**

`WorkspaceTreeRow` 删除 `childCount` prop 和 DOM；`TopicTree` 不再计算/传递该值。文件行调用：

```tsx
<FileTypeIcon
  kind={fileTypeIconKindFromName(entry.name)}
  size={16}
  selected={selected}
  variant="glyph-tile"
/>
```

操作按钮改用已安装 `lucide-react` 的 `Ellipsis`、`AtSign`，保持按钮尺寸、中文 accessible name 和顺序不变。

- [ ] **Step 5: 校准 scoped CSS**

marker 槽改为 16 px、gap 改为 5 px，名称列总锚点保持 21 px。删除 `.workspace-tree-child-count` 和基于 `[aria-label='…']` 的样式选择器；只使用 `data-file-*`/variant 和结构化 token。保留 34 px 行高、10 px 缩进、`--radius-pill` 选中胶囊和信号橙。

- [ ] **Step 6: 运行组件回归**

Run:

```bash
cd apps/web && bunx vitest run src/tests/WorkspaceTreeRow.test.tsx src/tests/TopicTree.test.tsx src/tests/TreeItem.test.tsx
```

Expected: PASS。

---

### Task 8: 用真实浏览器验收删除与 Glyph Tile

**Files:**

- Modify: `apps/web/e2e/workspace-tree.visual.spec.ts`
- Modify/Create: `stories/20260730-workspace-tree-prototype-alignment/evidence/*.png`
- Modify: component/CSS files only if real measurements reveal a contract failure

**Interfaces:**

- Consumes: Playwright daemon route fixture；不得访问真实 workspace
- Produces: 删除确认/取消、无统计数字、Glyph Tile 几何与浅/深色截图证据

- [ ] **Step 1: 扩展隔离 fixture 与红测试**

让 route fixture 对 `DELETE /files?relativePath=...` 只记录请求并更新内存数组；绝不落盘。新增用例验证：取消浏览器确认时没有 DELETE 且条目仍存在；接受确认时请求 `relativePath=AGENTS.md` 且刷新后条目消失。

- [ ] **Step 2: 更新视觉契约**

断言没有 `.workspace-tree-child-count`；Markdown/HTML 图标均为 16×16 Glyph Tile、`data-file-*` 正确、圆角来自渲染后的结构化 token；selected icon 与 selected 文字颜色一致。保留所有 34 px 行高、10 px 缩进、引导线和 action 顺序测试。

- [ ] **Step 3: 运行真实浏览器测试并按实测校准**

Run:

```bash
bun run --filter @journal/web test:e2e -- workspace-tree.visual.spec.ts
```

Expected: PASS；DELETE 仅命中 fixture，几何误差 ≤2 CSS px。

- [ ] **Step 4: 刷新视觉证据**

重新生成浅色、暗色、hover、focus 和 overlay 截图；确保信号橙选中态、圆润胶囊和 Glyph Tile 均清楚可见。

---

### Task 9: 全量验证、独立验收与文档同步

**Files:**

- Modify: `stories/20260730-workspace-tree-prototype-alignment/story.md`
- Create: `stories/20260730-workspace-tree-prototype-alignment/verify-report.md`
- Modify: `docs/DESIGN.md`（仅当 docs-maintenance 判断本次 workspace tree 规则应成为长期规范）

**Interfaces:**

- Consumes: Tasks 1–8 的代码、测试和截图证据
- Produces: 全绿门禁、独立验收报告、`status: verified`

- [ ] **Step 1: 格式与局部测试**

Run:

```bash
bunx prettier --write \
  apps/web/src/components/WorkspaceTreeRow.tsx \
  apps/web/src/components/FileTypeIcon.tsx \
  apps/web/src/components/TreeSidebar.tsx \
  apps/web/src/components/TopicTree.tsx \
  apps/web/src/components/TreeItem.tsx \
  apps/web/src/styles/workspace-tree.css \
  apps/web/src/styles/globals.css \
  apps/web/src/lib/hostBridge.ts \
  apps/web/src/tests/hostBridge.test.ts \
  apps/web/src/tests/WorkspaceTreeRow.test.tsx \
  apps/web/src/tests/TreeSidebar.test.tsx \
  apps/web/src/tests/TopicTree.test.tsx \
  apps/web/src/tests/TreeItem.test.tsx \
  apps/web/e2e/workspace-tree.visual.spec.ts \
  stories/20260730-workspace-tree-prototype-alignment/*.md
```

- [ ] **Step 2: 运行用户要求的三项 web 门禁**

Run:

```bash
bun run --filter @journal/web test
bun run --filter @journal/web build
bun run --filter @journal/web lint
```

Expected: 三项 exit code 均为 0。

- [ ] **Step 3: 运行仓库硬门**

Run:

```bash
bun run test
bun run build
bun run lint
bun run format:check
```

Expected: 四项 exit code 均为 0。

- [ ] **Step 4: 执行独立 verification gate**

按 `.agents/skills/verification-gate/SKILL.md` 调用独立 Codex，对 story AC-1 至 AC-11 和三类边界逐项核验。任何 AC 未通过时，把 story 设为 `in_progress`，记录缺口并回到对应任务修复；全部通过时生成 `verify-report.md` 并把 story 设为 `verified`。

- [ ] **Step 5: 执行 docs-maintenance**

按 `.agents/skills/docs-maintenance/SKILL.md` 判断长期设计文档影响。若更新 `docs/DESIGN.md`，只加入 workspace 文件树的稳定规则，不复制 story 的短期实现过程。

- [ ] **Step 6: 请求用户视觉确认**

向用户展示 `actual-light.png`、`actual-dark.png` 和 `overlay.png`。用户确认前不提交。

- [ ] **Step 7: 用户确认后提交**

```bash
git add \
  apps/web/src/components/WorkspaceTreeRow.tsx \
  apps/web/src/components/FileTypeIcon.tsx \
  apps/web/src/components/TreeSidebar.tsx \
  apps/web/src/components/TopicTree.tsx \
  apps/web/src/components/TreeItem.tsx \
  apps/web/src/styles/workspace-tree.css \
  apps/web/src/styles/globals.css \
  apps/web/src/lib/hostBridge.ts \
  apps/web/src/tests/hostBridge.test.ts \
  apps/web/src/tests/WorkspaceTreeRow.test.tsx \
  apps/web/src/tests/TreeSidebar.test.tsx \
  apps/web/src/tests/TopicTree.test.tsx \
  apps/web/src/tests/TreeItem.test.tsx \
  apps/web/e2e/workspace-tree.visual.spec.ts \
  stories/20260730-workspace-tree-prototype-alignment \
  docs/DESIGN.md
git commit -m "feat: align workspace tree with prototype"
```

只 stage 实际存在且属于本 story 的文件；不得包含工作树中其他用户改动。
