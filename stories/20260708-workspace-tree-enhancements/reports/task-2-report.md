# Task 2 Report — 前端排序策略读写 hook + httpRuntimeClient 接线

## 改动文件

1. `apps/web/src/hooks/useTreeSort.ts`（新建）
   - 导出类型 `WorkspaceTreeSort`（`'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'`）。
   - 导出 `useTreeSort()` hook：挂载时通过 `get_workspace_tree_sort` 读取持久化策略（失败回退 `name-asc`）；`setStrategy()` 乐观更新本地状态并立即 `set_workspace_tree_sort` 持久化。返回 `{ strategy, setStrategy, loading }`。
2. `apps/web/src/lib/httpRuntimeClient.ts`
   - 在 `case 'set_workspace_theme':` 块之后新增两个 case：
     - `get_workspace_tree_sort` → 读 settings，返回 `workspace_tree_sort ?? 'name-asc'`。
     - `set_workspace_tree_sort` → `updateSettings({ workspace_tree_sort: args?.strategy })`。
3. `apps/web/src/tests/useTreeSort.test.tsx`（新建）
   - mock `selectRuntimeClient`，3 个用例：挂载读取、失败回退 `name-asc`、切换后立即持久化。

未改动其他文件，未引入新依赖。

## 测试证据

命令：`cd apps/web && bunx vitest run src/tests/useTreeSort.test.tsx`

```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web


 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  20:40:31
   Duration  770ms (transform 50ms, setup 112ms, import 11ms, tests 171ms, environment 416ms)

```

3 个用例全部通过。

### 附加校验

- TDD 红阶段已确认：实现前先跑测试，得到 `Error: Failed to resolve import "../hooks/useTreeSort"`（模块不存在），符合预期。
- `eslint`（3 个改动文件）：无输出，0 error / 0 warning。
- `tsc --noEmit`：本次新增文件零类型错误。仅存在 2 个**预先存在**的无关错误（`src/tests/DetailView.test.tsx` 的 `mtime_secs` 字段缺失），已通过 `git stash` 对比基线确认与本次改动无关。

## 遇到的问题

无。Task 1 提供的 `workspace_tree_sort` 字段在 daemon settings 中已就绪，前端接线直接复用既有 `getSettings()`/`updateSettings()` 私有方法，无新增依赖、无新增路由。

SUMMARY: result=pass | steps_done=5/5
