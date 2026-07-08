# Task 10 — 键盘导航（AC-10）报告

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `apps/web/src/components/TreeSidebar.tsx` | +`sortEntries`/`filterCuration` import；+`focusedPath` state；+`flattenVisible()` 辅助 + `handleTreeKeyDown()` 键盘事件处理（↑↓↑→← Enter）；专题树 `<TopicTree>` 包裹 `role="tree"` + `aria-label="Workspace"` + `tabIndex={0}` + `onKeyDown` 容器；两处 `<TopicTree>` 传 `focusedPath` |
| `apps/web/src/components/TopicTree.tsx` | `TopicTreeProps` +`focusedPath?` prop（含递归透传）；行根 `<div>` +`role="treeitem"` +`data-path` +`aria-selected` +`tabIndex={-1}`；ref 回调在 `entry.path === focusedPath` 时 `el.focus()`；style +`outline: var(--focus-ring)` / `outlineOffset: -1` |
| `apps/web/src/tests/TreeSidebar.test.tsx` | +1 个测试用例 `moves focus down via ArrowDown and exposes it via data-path` |

## 实现要点

- `flattenVisible()` 返回完整 `TopicEntry[]`（而非提示词示例的 `{ path, isDir }[]`），避免 Enter 处理时还要从 `dirs` 反查 entry——行为与提示词一致，但嵌套文件也能正确触发 `handleSelect`。
- `handleSelect` 调用参数照抄文件内已有调用点（`onSelectFile` 回调，line ~1199-1207）：`{ type: 'topic-file', path, name, created_secs, mtime_secs }`。`created_secs` 在 `TopicEntry` 上是 optional，与 `TreeSelection` 一致，无需特殊处理。
- 聚焦环走已有 CSS 变量 `var(--focus-ring)`（`globals.css:83`），无硬编码。
- `act()` 警告：pre-existing，所有 `TreeSidebar` 测试都有（来自 `useTreeSort` 异步 effect），非本次引入。

## 测试命令与结果

```
$ cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx src/tests/TopicTree.test.tsx

 Test Files  2 passed (2)
      Tests  19 passed (19)
   Duration  988ms
```

tsc（仅本次改动的文件零错误，`DetailView.test.tsx` 的 pre-existing 错误不在本次范围）：

```
$ bunx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "(TreeSidebar|TopicTree)"
(no output)
```

eslint（三个改动文件零警告）：

```
$ bunx eslint apps/web/src/components/TreeSidebar.tsx apps/web/src/components/TopicTree.tsx apps/web/src/tests/TreeSidebar.test.tsx
(no output)
```

## RED → GREEN 验证

- **RED**：实现前运行测试 → `Unable to find an accessible element with the role "tree" and name "Workspace"`（1 failed）。
- **GREEN**：实现后运行测试 → 19/19 passed。

## 遇到的问题

无。`handleSelect` 参数形状与文件内已有调用点完全一致，直接复用。`flattenVisible` 的返回值类型从 `{ path, isDir }` 改为完整 `TopicEntry[]`，使 Enter 处理能直接使用 entry 对象，不需要二次查找。

SUMMARY: result=pass | steps_done=5/5
