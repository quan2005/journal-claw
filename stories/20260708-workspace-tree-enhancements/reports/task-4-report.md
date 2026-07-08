# Task 4 报告：排序菜单 UI（AC-1, AC-2 收尾）

## 改动文件

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `apps/web/src/components/TreeSidebar.tsx` | 修改 | 导入 `ArrowUpDown`（lucide-react 既有依赖）+ `WorkspaceTreeSort` 类型；新增模块级常量 `SORT_LABELS`；`useTreeSort()` 扩展解构 `setStrategy`；新增 `sortMenuOpen` 本地 state；在 Workspace 面板头部 Search 与 LayoutGrid 按钮之间插入排序按钮 + 下拉菜单（5 个选项 + 分隔线） |
| `apps/web/src/tests/TreeSidebar.test.tsx` | 修改 | `beforeEach` 的 `mockInvoke` 增加 `get_workspace_tree_sort → 'name-asc'` 默认响应；新增用例 "opens sort menu and updates active sort strategy" |

## 实现说明

### 测试写法

现有测试文件使用 `renderTreeSidebar` helper（内部调用 `renderWithProviders`）+ vi.mock 模拟 `usePinned`/`useTopics`/`runtimeClient`，未 mock `useTreeSort` 本身——hook 走真实实现，依赖 `runtimeClient` mock 返回值。

新用例按相同模式：
1. `renderTreeSidebar({ category: 'topics' })`
2. `screen.getByRole('button', { name: '排序' })` 定位排序按钮
3. 断言初始 `data-active-sort="name-asc"`
4. `fireEvent.click` 打开菜单 → 断言 5 个选项可见
5. 点击 "名称 Z-A" → 断言 `data-active-sort="name-desc"`

需在 `beforeEach` 补 `get_workspace_tree_sort → 'name-asc'`，否则 hook 的 useEffect resolve 到 `undefined`，初始 `data-active-sort` 为 `"undefined"` 而非 `"name-asc"`。

### UI 行为

- 排序按钮 `aria-label="排序"`，`data-active-sort` 反映当前策略
- 点击切换 `sortMenuOpen`，菜单以绝对定位渲染（top:32, right:0, zIndex:20）
- 4 个非 manual 选项在上，分隔线后是 "手动排序"
- 选中项高亮（`var(--item-selected-bg)`），点击后 `setTreeSort(key)` + 关闭菜单

## 验收

### 目标测试

```
$ cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx

 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web


 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  20:55:28
   Duration  950ms
```

### 全量回归（web workspace）

```
$ cd apps/web && bunx vitest run

 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web


 Test Files  56 passed (56)
      Tests  415 passed (415)
   Start at  20:56:08
   Duration  15.67s
```

（414 → 415，新增 1 用例）

### TypeCheck / Lint

- `bunx tsc --noEmit`：本次改动的 2 个文件 0 错误。仓库仅存的 2 个错误在 `src/tests/DetailView.test.tsx`（`WorkspaceDirEntry.mtime_secs` 缺失），为 Task 3 之前已存在的遗留问题，与 Task 4 无关。
- `bunx eslint src/components/TreeSidebar.tsx src/tests/TreeSidebar.test.tsx`：0 errors（exit 0，无输出）。

## 遇到的问题与处理

### 1. `get_workspace_tree_sort` mock 缺失

现有 `beforeEach` 的 `mockInvoke` 只处理 `get_workspace_path`，其余命令返回 `undefined`。`useTreeSort` 的 effect 调用 `get_workspace_tree_sort` 会 resolve 到 `undefined`，导致初始 `data-active-sort` 不为 `"name-asc"`。补一行 `if (cmd === 'get_workspace_tree_sort') return Promise.resolve('name-asc')` 解决。`set_workspace_tree_sort` 无需特殊处理（返回 `undefined` 即可，不影响本地 state 更新）。

### 2. 未引入新依赖

`ArrowUpDown` 来自 `lucide-react`（既有依赖），`WorkspaceTreeSort` 类型来自 `../hooks/useTreeSort`（Task 3 已存在），零新增依赖。

### 3. act() 警告

测试运行时有 React "not wrapped in act" 警告，来自 `useTreeSort` effect 的异步 state 更新。这是既有 hook 异步行为在测试环境下的标准告警，不影响断言正确性，与现有其他渲染 TreeSidebar 的测试行为一致，未额外处理。

## 步骤完成情况

- [x] Step 1 写红测试（`opens sort menu and updates active sort strategy`）
- [x] Step 2 跑红（Unable to find button with name "排序"）
- [x] Step 3 实现排序按钮 + 下拉菜单
- [x] Step 4 跑绿（8/8 通过 + 全量 415/415 回归通过）
- [x] Step 5 未 git commit

SUMMARY: result=pass | steps_done=5/5
