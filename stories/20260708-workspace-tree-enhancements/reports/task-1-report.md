# Task 1 Report — Daemon settings 新增排序策略与手动顺序字段

## 改动文件

1. `apps/daemon/src/settings/service.ts`
   - 新增导出类型 `WorkspaceTreeSort`（`'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'`）。
   - `WorkspaceSettings` 接口新增两个字段：`workspace_tree_sort: WorkspaceTreeSort`、`workspace_tree_manual_order?: Record<string, string[]>`。
   - `DEFAULT_SETTINGS` 增加 `workspace_tree_sort: 'name-asc'`。
   - `normalizeSettings` 返回对象新增 `workspace_tree_sort`（走 `normalizeTreeSort`）与 `workspace_tree_manual_order`（`isRecord` 通过则原样透传，否则 `undefined`）。
   - 文件底部新增 `VALID_TREE_SORTS` 常量与 `normalizeTreeSort` 辅助函数。
2. `apps/daemon/src/settings/service.test.ts`
   - 在 `describe('SettingsService', ...)` 末尾新增 2 个用例：默认值 + 垃圾值回退；`workspace_tree_manual_order` 透传。

未改动其他文件，未引入新依赖。

## 测试证据

命令：`cd apps/daemon && bunx vitest run src/settings/service.test.ts`

```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/daemon


 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  20:37:33
   Duration  128ms (transform 29ms, setup 0ms, import 38ms, tests 8ms, environment 0ms)

```

8 个原有用例 + 2 个新用例，全部通过。

## 遇到的问题

无。

SUMMARY: result=pass | steps_done=5/5
