---
story: ./story.md
design: ./design.md
date: 2026-07-08
round: 3
result: pass
scope: 'git diff HEAD -- apps/ packages/（较 r2 仅变更 apps/daemon/src/server.ts 装配一处 + server.test.ts 回归断言）'
---

# 验收报告 R3 — Workspace 磁盘契约：根目录归用户，.journal/ 归系统

本轮重点：复核 r2 唯一 fail 项（`/files` 写路径 ChangeSet 绑 `process.cwd()`）的修复，并检查是否引入新越界。

测试证据（2026-07-08 本机复跑）：daemon `bunx vitest run` 45 files / 286 tests 全绿（含新增回归断言）。web 侧文件较 r2 无改动，r2 已复跑 54 files / 398 tests 全绿。

## r2 fail 项复核 — ✅ 已修复

- `filesService` 工厂改为 `new FilesService(workspaceRoot(), workspaceChangeSets())`，且 `workspaceChangeSets` 声明已提前至其上一行（`apps/daemon/src/server.ts:269-271`）。cwd 单例 `changeSetService` 不再流入任何 `/files` 路由。
- 回归测试补齐 delete 断言：config workspace ≠ cwd 时 `POST /files/delete` 返回 204 **且** workspace 内文件真实消失（`apps/daemon/src/server.test.ts:78-85`），通过。
- 独立 live repro 复跑（r2 同一脚本，`startDaemon` + config workspace ≠ tmp cwd）：
  ```
  DELETE status: 204
  workspace notes.md still exists: false
  cwd .journal/trash created: false
  ```
  删除真实生效于 workspace，cwd 无污染；trash stash 由 workspace 根的 ChangeSetService 落在 `<workspace>/.journal/trash/`（`changeset/service.ts:142-148`，root 现为 workspace）。rename/move/duplicate 的 ChangeSet 记录/授权/revert 目标同步回到 workspace 根（同一工厂传参，`server.ts:269-271`）。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据 |
| ---- | ------- | ---- |
| AC-1 | ✅ pass | 维持 r1/r2：`workspace/migration.ts:40-52` 五类系统内容按序搬迁；`migration.test.ts` 全量搬迁 / 用户文件不动 / 非 YYMM 不误搬，全绿 |
| AC-2 | ✅ pass | 维持 r1/r2：journal/todos/identity 经 `workspace/paths.ts` + `workspaceChangeSets()`（`server.ts:270-285`），既有测试全绿；ChangeSet 排除规则收窄使系统写入仍可追踪（`changeset/service.ts:66-80`） |
| AC-3 | ✅ pass | 列举：`/files` per-request 绑定 `workspaceRoot()` + dot 过滤（`files/service.ts:178`），`server.test.ts:57-76` 通过；web 兜底 `useTopics.ts:10-15`。变更操作：delete/rename/move/duplicate 全部作用于配置 workspace（本轮修复 + `server.test.ts:78-85` + live repro） |
| AC-4 | ✅ pass | 维持：`migration.ts:41,51` 空 workspace 仅建 `.journal/` + marker；测试通过 |
| AC-5 | ✅ pass | 维持：`migration.ts:43` layoutVersion 短路 + `server.ts:249-261` per-root 去重；幂等/续搬测试通过 |

## 范围完整性（不少）/ 方案落实（不偏）/ 越界（不多）/ 冗余（不重）

- r1/r2 已逐项核对通过的部分（路径集中化、迁移原子性与续搬、trash legacy 回退、materials/local/ai_processor 跟随、web 树根遍历、无反向迁移/迁移 UI/topics 语义变更、web 侧 dot 过滤兜底有声明原因）本轮 diff 未触及对应文件，维持 ✅。
- 本轮新增改动仅两处：`server.ts:269-271` 工厂传参 + 声明顺序调整、`server.test.ts:78-85` delete 回归断言，全部归属 r2 fail 项修复，无新越界、无冗余实现。

## 结论

**pass**。六字标准全部通过，r1/r2 fail 项均已修复并有回归测试与 live repro 双重证据。

## 待用户裁决

- 无。维持既往备注（不计 fail、非本 story 范围）：`server.ts:239,241` changeSetService/sedimentService 仍为 cwd 单例（现仅服务 run 级路由，`/files` 已不经它）、`GET /workspace` 返回 `process.cwd()`（`server.ts:437-442` 附近）为迁移前既有装配问题，建议另立 story 清理。
