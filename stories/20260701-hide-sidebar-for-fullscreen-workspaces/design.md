# design.md — 全屏工作区隐藏左侧边栏及左侧展开/收起按钮

对应 story：`./story.md`

## 方案概述

在 `App.tsx` 的布局层做条件渲染：

1. 全局移除左侧 divider 上的展开/收起按钮。
2. 保留右侧 divider 上的展开/收起按钮，确保右侧 Agent 面板始终可打开/关闭。
3. 当 `activeCategory` 为 `ideas` / `automation` / `skills` 时，完全不渲染左侧树形边栏容器（`app-sidebar-panel`）和左侧 divider。
4. 当 `activeCategory` 为 `journal` / `identity` / `topics` 时，保留左侧树形边栏容器和 divider，但 divider 内不再放按钮；展开/收起改由重复点击 NavRail 当前分类按钮触发（已有逻辑）。

## 关键改动点

### 1. 提取 `needsSidebar` 计算

在 `App.tsx` 组件内使用 `useMemo` 提取：

```ts
const needsSidebar = useMemo(
  () => activeCategory === 'journal' || activeCategory === 'identity' || activeCategory === 'topics',
  [activeCategory],
)
```

`handleCategoryChange` 中的局部 `needsSidebar` 可替换为直接引用，也可保留独立计算，二者等价。

### 2. 左侧边栏容器条件渲染

当前代码始终渲染：

```jsx
<div className="app-sidebar-panel" data-sidebar-panel="left">...</div>
<div data-sidebar-divider="left">...</div>
```

改为仅在 `needsSidebar` 时渲染，并移除 divider 内的 `<button>`：

```jsx
{needsSidebar && (
  <>
    <div className="app-sidebar-panel" data-sidebar-panel="left">...</div>
    <div data-sidebar-divider="left" onMouseDown={leftSidebarOpen ? onDividerMouseDown : undefined}>...</div>
  </>
)}
```

### 3. 保留 divider 拖拽

左侧 divider 继续承载拖拽调整宽度的功能：`onMouseDown={leftSidebarOpen ? onDividerMouseDown : undefined}`。

### 4. 保留 NavRail 切换

`handleCategoryChange` 中已有逻辑：

```ts
if (cat === activeCategory && needsSidebar) {
  setLeftSidebarOpen((prev) => !prev)
  return
}
```

保持不变。用户在 `journal` / `identity` / `topics` 页面重复点击 NavRail 当前分类即可收起/展开左侧边栏。

### 5. 保留右侧 divider 按钮

右侧 divider 内保留展开/收起按钮，用于打开/关闭右侧聊天/对话面板。按钮样式沿用 `sidebarToggleStyle()`，点击时切换 `rightPanelOpen`：

```jsx
<div data-sidebar-divider="right" onMouseDown={rightPanelOpen ? onRightPanelDividerMouseDown : undefined}>
  <button onClick={() => setRightPanelOpen((prev) => !prev)} style={sidebarToggleStyle()}>
    {rightPanelOpen ? <ChevronRight /> : <ChevronLeft />}
  </button>
</div>
```

因此 `sidebarToggleStyle()`、`PANEL_TOGGLE_TOP` 常量、`ChevronLeft`、`ChevronRight` 导入继续保留。

## 受影响的文件

- `apps/web/src/App.tsx`：主要改动点。

## 测试策略

1. **手动验证**：
   - 切换到“想法”“自动化”“技能”，确认左侧无树形边栏容器、无 divider、无展开/收起按钮，内容区占满可用宽度；右侧 divider 上保留按钮。
   - 切换到“流水”“画像”“专题”，确认左侧树形边栏仍在，divider 可用于拖拽调整宽度，但 divider 上无按钮；右侧 divider 上保留按钮且可切换右侧面板。
   - 在“流水”页面重复点击 NavRail 的“流水”按钮，确认左侧边栏收起/展开。
   - 窗口宽度 < 720px 时，左侧边栏自动收起，再次点击 NavRail 当前分类可展开。

2. **自动化测试**：
   - 运行 `npm run test -- App.test.tsx` 或相关测试，确保现有布局测试不因此回归。
   - 测试应覆盖：左侧 button 不存在、右侧 button 存在且可切换右侧面板。

## 回滚

单文件改动，可直接 `git checkout apps/web/src/App.tsx` 或还原对应 commit。
