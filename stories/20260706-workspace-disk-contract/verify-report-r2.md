---
story: ./story.md
design: ./design.md
date: 2026-07-08
round: 2
result: fail
scope: 'git diff HEAD -- apps/ packages/（27 文件；较 r1 新增 server.ts 装配修复 + server.test.ts 回归测试）'
---

# 验收报告 R2 — Workspace 磁盘契约：根目录归用户，.journal/ 归系统

本轮重点：复核 r1 唯一 fail 项（AC-3：`/files` 路由绑定 `process.cwd()`）的修复，并检查修复是否引入新越界。

测试证据（2026-07-08 本机复跑）：daemon `bunx vitest run` 45 files / 286 tests 全绿；web `bunx vitest run` 54 files / 398 tests 全绿。

## r1 fail 项复核

**修复动作（已确认）**：

- `filesService` / `workspaceService` 从启动时 `process.cwd()` 单例改为 per-request 工厂，根取 `workspaceRoot()`（`apps/daemon/src/server.ts:267-269`）；全部 `/files` 与 `/workspace/meta` 路由改经工厂（`server.ts:1081-1212`、`:486-499`）。
- `workspaceRoot()` 取用时触发一次性幂等迁移 `ensureWorkspaceMigrated`（`server.ts:249-266`）——`/files` 不再绕过迁移。
- 新增 server 层回归测试：`GET /files` 列出的是 config workspace 而非 cwd，且触发迁移、dot 条目被过滤（`apps/daemon/src/server.test.ts:57-82`），通过。

**结论：修复不完整（❌）。** r1 修复建议是 `new FilesService(workspaceRoot(), workspaceChangeSets())`，实际落地为 `new FilesService(workspaceRoot(), changeSetService)`（`server.ts:269`），而 `changeSetService` 仍是启动时 `new ChangeSetService(process.cwd())` 的单例（`server.ts:239`）。FilesService 的读路径已正确，但写路径的 ChangeSet 侧仍按 cwd 解析：

- **delete 在生产链路是静默 no-op**：`FilesService.delete` 不自己动盘，实际删除动作是 `ChangeSetService.recordChangeSet` 的 trash stash rename（`apps/daemon/src/changeset/service.ts:142-148`，`abs = resolve(this.workspaceRoot, input.path)`，`service.ts:102`）。cwd 下无同名文件时 → 无 stash、状态仍 `applied`、路由返 204，**workspace 文件根本没删**；cwd 下恰有同名文件时 → **cwd 里的无辜文件被搬进 `<cwd>/.journal/trash/`**。
- 可复现证据（live repro，`bunx vite-node` 驱动 `startDaemon` + config workspace ≠ cwd）：
  ```
  DELETE /files/delete {relativePath: 'notes.md'} → status 204
  workspace notes.md still exists: true
  ```
- duplicate/rename/move 的实际 fs 操作用对了根（FilesService 内部 `this.workspaceRoot`，`files/service.ts:296-371`），但其 ChangeSet 记录/授权/快照仍挂在 cwd 根的 ChangeSetService 上——revert 这些记录会指向 cwd 而非 workspace（`changeset/service.ts:201-203`）。
- 单测全绿是因为 `server.test.ts` 新增回归测试只覆盖了 GET 列举，未覆盖 delete；`files/service.test.ts` 构造时两个根一致。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据 |
| ---- | ------- | ---- |
| AC-1 | ✅ pass | 与 r1 相同，无回归：`workspace/migration.ts:40-52` 五类系统内容按序搬迁；`migration.test.ts` 旧结构全量搬迁 / 用户文件不动 / 非 YYMM 不误搬，全绿 |
| AC-2 | ✅ pass | 与 r1 相同：journal/todos/identity 均经 `workspace/paths.ts` + `workspaceChangeSets()`（`server.ts:270-283`），既有测试全绿 |
| AC-3 | ⚠️ 展示层 pass、同一装配的写路径 fail | 可见性本身已修复：`/files` per-request 绑定 `workspaceRoot()` + dot 过滤（`files/service.ts:178`），回归测试 `server.test.ts:57-82` 通过。但同一 `filesService()` 工厂的 delete 因 ChangeSet 根错误在生产链路失效（见上），r1 fail 项中"树上下文菜单 delete 作用于错误目录"未修复 |
| AC-4 | ✅ pass | 与 r1 相同：`migration.ts:41,51`；`migration.test.ts` 空 workspace 用例通过 |
| AC-5 | ✅ pass | `migration.ts:43` layoutVersion 短路 + `server.ts:249-261` 进程内 per-root 去重；幂等/续搬测试通过 |

## 范围完整性（不少）/ 方案落实（不偏）/ 越界（不多）/ 冗余（不重）

r1 已逐项核对通过的部分（路径集中化、迁移原子性与续搬、ChangeSet 排除规则收窄、trash legacy 回退、materials/local/ai_processor 跟随、web 树根遍历与 dot 兜底、无反向迁移/迁移 UI/topics 语义变更），本轮 diff 未触及这些文件，抽查一致，维持 ✅。本轮新增改动（`server.ts` 装配 + `server.test.ts`）全部归属 r1 fail 项修复，无新越界。

## 结论

**fail（1 项）**：

1. **`/files` 写路径 ChangeSet 仍绑 `process.cwd()`（高风险，r1 修复残留）**：`server.ts:269` 把 cwd 单例 `changeSetService`（`server.ts:239`）传给 per-request FilesService。后果：文件树 delete 生产环境静默失效（204 但文件不删）、cwd 下同名文件可能被误搬进 cwd trash、rename/move/duplicate 的 revert 记录指向错误根。
   **修复建议**：`server.ts:269` 改为 `new FilesService(workspaceRoot(), workspaceChangeSets())`（注意把该行移到 `workspaceChangeSets` 声明之后），并在 `server.test.ts` 补一条 delete 回归：config workspace ≠ cwd 时 `POST /files/delete` 后断言 workspace 内文件已进入 `<workspace>/.journal/trash/`。

## 待用户裁决

- 无新增。r1 备注维持：`server.ts:239,241` 的 changeSetService/sedimentService cwd 单例、`GET /workspace` 返回 `process.cwd()`（`server.ts:414-419`）为迁移前既有装配问题，除上述 fail 项涉及的传参外不在本 story 范围，未计 fail。
