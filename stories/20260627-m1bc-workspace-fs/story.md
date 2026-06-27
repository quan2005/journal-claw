---
status: verified
phase: M1b+M1c
created: 2026-06-27
---

# M1b+M1c · Workspace FS（daemon）

## 背景
M1 地基的文件系统子单元。Rust FS 命令在 `apps/web/src-tauri/src/commands/workspace.rs`：list_workspace_dir、list_at_mention_candidates、workspace_duplicate_file、workspace_rename_file、workspace_move_file、workspace_delete_file、import_file、import_text、import_text_temp、import_image_temp。

## 目标
- **M1b 读**：daemon 提供 workspace 目录树列举 + at-mention 候选 → `GET /files`、`GET /files/at-mention-candidates`（或对齐现有路由风格）。
- **M1c 写**：duplicate/rename/move/delete/import → daemon 路由，**复用 ChangeSetService**（apps/daemon/src/changeset/service.ts，recordChangeSet 支持 operation/mode/afterContent，delete 走 .journal-trash 可恢复）。FS 操作用合成 runId（如 `fs-manual`）或扩展 ChangeSetService 支持无 run 的直接 FS 变更——择优实现并说明。
- 前端 tauri.ts 对应封装经 selectRuntimeClient runtime flag 走 daemon，Tauri 不回退。

## 范围
1. daemon `apps/daemon/src/files/service.ts` + 路由：列目录树（尊重 workspace root，忽略 .git/node_modules 等）、at-mention 候选、duplicate/rename/move/delete/import。
2. 写操作复用 ChangeSetService：beforeHash/afterHash/diffPreview、delete 进 .journal-trash 可恢复、AuthorizationMode 校验（workspace_write 默认）。
3. Gate G：目录列举与 Rust 行为一致（同样的忽略规则、排序、字段）；不改 workspace 文件格式。
4. 前端 tauri.ts FS 封装走 runtime flag。
5. 测试：daemon service 单元测试（列目录、import、duplicate/rename/move、delete+recover、越界/.. /symlink 拒绝）；前端 client 测试。

## 不在范围
- import_file_to_topic（属 M2 topics）。
- skills/main.rs 中对 FS 的间接引用。

## 验收（Given-When-Then）
- Given workspace 有文件，When GET /files，Then 返回树与 Rust 一致（忽略规则/排序）。
- Given delete 一个文件，Then 进 .journal-trash，revert 可还原。
- Given workspace 外路径/.. /symlink 写入，Then 结构化拒绝。
- Given daemon 测试，Then 全绿且 ≥288 不回退；web tsc clean。

## Leader 独立验收（2026-06-27）：PASS
- daemon 325 passed/44 files（基线 288，零回退）；web tsc clean
- delete→.journal-trash + revert；路径逃逸/read_only/symlink 全部结构化拒绝
- Gate G：目录列举忽略 `.` 前缀，与 Rust skills.rs:744 一致；冲突命名 Rust 兼容
- ChangeSet 复用合成 runId `fs-manual`；越界无
