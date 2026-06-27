---
story: ./story.md
design: N/A
date: 2026-06-27
round: 3
result: fail
scope: "实现文件清单：apps/daemon/src/config/service.ts, apps/daemon/src/config/service.test.ts, apps/daemon/src/config/routes.test.ts, apps/daemon/src/local/service.ts, apps/daemon/src/journal/service.ts, apps/daemon/src/journal/service.test.ts, apps/daemon/src/todos/service.ts, apps/daemon/src/todos/service.test.ts, apps/daemon/src/topics/service.ts, apps/daemon/src/topics/service.test.ts, apps/daemon/src/identity/service.ts, apps/daemon/src/identity/service.test.ts, apps/daemon/src/materials/service.ts, apps/daemon/src/materials/service.test.ts, apps/daemon/src/server.ts, apps/web/src/lib/httpRuntimeClient.ts, apps/web/src/lib/tauri.ts, apps/web/src/tests/httpRuntimeClient.test.ts, apps/web/src/tests/tauri.test.ts"
---

# 验收报告 — M2 · 本地数据 CRUD（daemon）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 每模块：daemon service + 路由 + 前端封装 + 测试；读已有 workspace 文件与 Rust 行为一致 | ✅ pass | journal service 覆盖 months/list/all/paginated/content/save/delete/sample/if_needed（`apps/daemon/src/journal/service.ts:61`-`apps/daemon/src/journal/service.ts:124`），路由覆盖（`apps/daemon/src/server.ts:269`-`apps/daemon/src/server.ts:352`），前端封装经 `selectRuntimeClient()`（`apps/web/src/lib/tauri.ts:43`-`apps/web/src/lib/tauri.ts:89`、`apps/web/src/lib/tauri.ts:254`-`apps/web/src/lib/tauri.ts:258`），HTTP runtime 映射（`apps/web/src/lib/httpRuntimeClient.ts:198`-`apps/web/src/lib/httpRuntimeClient.ts:257`）。todos service/路由/前端覆盖 list/add/toggle/delete/set due/set path/set session/remove path/update text（`apps/daemon/src/todos/service.ts:27`-`apps/daemon/src/todos/service.ts:139`，`apps/daemon/src/server.ts:354`-`apps/daemon/src/server.ts:465`，`apps/web/src/lib/tauri.ts:332`-`apps/web/src/lib/tauri.ts:379`，`apps/web/src/lib/httpRuntimeClient.ts:258`-`apps/web/src/lib/httpRuntimeClient.ts:321`）。topics 覆盖 list/create/delete/import（`apps/daemon/src/topics/service.ts:29`-`apps/daemon/src/topics/service.ts:73`，`apps/daemon/src/server.ts:467`-`apps/daemon/src/server.ts:519`，`apps/web/src/lib/tauri.ts:684`-`apps/web/src/lib/tauri.ts:694`，`apps/web/src/lib/httpRuntimeClient.ts:322`-`apps/web/src/lib/httpRuntimeClient.ts:350`）。identity 覆盖 list/get/save/delete/archive/unarchive/create/merge，并保留 `speaker_id`（`apps/daemon/src/identity/service.ts:42`-`apps/daemon/src/identity/service.ts:157`，`apps/daemon/src/server.ts:521`-`apps/daemon/src/server.ts:616`，`apps/web/src/lib/tauri.ts:291`-`apps/web/src/lib/tauri.ts:330`，`apps/web/src/lib/httpRuntimeClient.ts:351`-`apps/web/src/lib/httpRuntimeClient.ts:407`）。materials 覆盖 4 命令（`apps/daemon/src/materials/service.ts:29`-`apps/daemon/src/materials/service.ts:74`，`apps/daemon/src/server.ts:618`-`apps/daemon/src/server.ts:662`，`apps/web/src/lib/tauri.ts:77`-`apps/web/src/lib/tauri.ts:113`，`apps/web/src/lib/httpRuntimeClient.ts:170`-`apps/web/src/lib/httpRuntimeClient.ts:197`）。r2 fail 修复已核对：CRUD service 动态使用配置 workspace（`apps/daemon/src/server.ts:101`-`apps/daemon/src/server.ts:115`），`set_workspace_path` 写入同一 config（`apps/daemon/src/server.ts:174`-`apps/daemon/src/server.ts:187`），路由测试证明本地 CRUD 读取配置 workspace（`apps/daemon/src/config/routes.test.ts:65`-`apps/daemon/src/config/routes.test.ts:72`）；sample flag 使用 config 字段（`apps/daemon/src/config/service.ts:130`-`apps/daemon/src/config/service.ts:136`，`apps/daemon/src/journal/service.ts:118`-`apps/daemon/src/journal/service.ts:123`，`apps/daemon/src/server.ts:103`-`apps/daemon/src/server.ts:107`）；YAML block array 覆盖在 journal/identity 测试中（`apps/daemon/src/journal/service.test.ts:26`-`apps/daemon/src/journal/service.test.ts:45`，`apps/daemon/src/identity/service.test.ts:46`-`apps/daemon/src/identity/service.test.ts:61`）；materials hash 对齐 Rust DefaultHasher（`apps/daemon/src/materials/service.ts:77`-`apps/daemon/src/materials/service.ts:89`，`apps/daemon/src/materials/service.test.ts:13`-`apps/daemon/src/materials/service.test.ts:16`；Rust 对照 `apps/web/src-tauri/src/materials.rs:14`-`apps/web/src-tauri/src/materials.rs:30`）。 |
| AC-2 delete 类操作可恢复或符合 Rust 语义 | ✅ pass | journal delete 经 `removeTracked` 删除（`apps/daemon/src/journal/service.ts:108`-`apps/daemon/src/journal/service.ts:111`），Rust 是 `remove_file` 语义（`apps/web/src-tauri/src/journal.rs:543`-`apps/web/src-tauri/src/journal.rs:546`，r2 已取证）。todos delete 按 Rust 同样按 lineIndex 删除并写回（daemon `apps/daemon/src/todos/service.ts:84`-`apps/daemon/src/todos/service.ts:88`；Rust `apps/web/src-tauri/src/todos.rs:335`-`apps/web/src-tauri/src/todos.rs:358`）。topics delete 支持目录/文件删除并记录 changeset（daemon `apps/daemon/src/topics/service.ts:55`-`apps/daemon/src/topics/service.ts:60`；Rust `apps/web/src-tauri/src/topics.rs:144`-`apps/web/src-tauri/src/topics.rs:155`）。identity delete 保护 README 并删除其他身份（`apps/daemon/src/identity/service.ts:66`-`apps/daemon/src/identity/service.ts:74`，测试 `apps/daemon/src/identity/service.test.ts:81`-`apps/daemon/src/identity/service.test.ts:87`）。 |
| AC-3 daemon 测试全绿 ≥334 不回退；web tsc clean | ✅ pass | 命令 `pnpm --filter @journal/daemon test` 退出码 0，输出 `Test Files 58 passed (58)`、`Tests 380 passed (380)`，满足 ≥334。命令 `pnpm --filter @journal/web build` 退出码 0，输出包含 `tsc && npm run build:magicui && vite build` 和最终 `✓ built in 5.85s`。命令 `pnpm --filter @journal/web exec vitest run src/tests/httpRuntimeClient.test.ts src/tests/tauri.test.ts` 退出码 0，输出 `Test Files 2 passed (2)`、`Tests 18 passed (18)`。 |
| AC-4 越界核查：仅各模块 daemon service + server.ts + 前端 tauri.ts + 测试 + story | ❌ fail | `git status --short` 输出仍包含 `M docs/adr/rust-removal-roadmap.md`。该文件不在本轮实现文件清单内，也不能归入 story 的越界约束“仅各模块 daemon service + server.ts + 前端 tauri.ts + 测试 + story”（`stories/20260627-m2-local-crud/story.md:31`）。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ journal：范围列出的 list months / list by months / list all / paginated / get content / save content / delete / create sample entry / if_needed 均有 service、route、HTTP runtime 和前端封装证据（`apps/daemon/src/journal/service.ts:61`-`apps/daemon/src/journal/service.ts:124`，`apps/daemon/src/server.ts:269`-`apps/daemon/src/server.ts:352`，`apps/web/src/lib/httpRuntimeClient.ts:198`-`apps/web/src/lib/httpRuntimeClient.ts:257`，`apps/web/src/lib/tauri.ts:43`-`apps/web/src/lib/tauri.ts:89`、`apps/web/src/lib/tauri.ts:254`-`apps/web/src/lib/tauri.ts:258`）。Rust 使用 config workspace 与 sample config flag（`apps/web/src-tauri/src/journal.rs:388`-`apps/web/src-tauri/src/journal.rs:392`，`apps/web/src-tauri/src/journal.rs:652`-`apps/web/src-tauri/src/journal.rs:668`），daemon 已改为同源 config（`apps/daemon/src/server.ts:101`-`apps/daemon/src/server.ts:107`）。
- ✅ todos：范围列出的 9 个命令在 daemon service 与路由中完整覆盖（`apps/daemon/src/todos/service.ts:27`-`apps/daemon/src/todos/service.ts:139`，`apps/daemon/src/server.ts:354`-`apps/daemon/src/server.ts:465`），与 Rust 任务文本/元数据格式对应（Rust `apps/web/src-tauri/src/todos.rs:82`-`apps/web/src-tauri/src/todos.rs:152`；daemon `apps/daemon/src/todos/service.ts:178`-`apps/daemon/src/todos/service.ts:230`）。
- ✅ topics：list dir / create / delete / import file 覆盖（`apps/daemon/src/topics/service.ts:29`-`apps/daemon/src/topics/service.ts:73`），排序与忽略隐藏文件规则对齐 Rust（daemon `apps/daemon/src/topics/service.ts:33`-`apps/daemon/src/topics/service.ts:46`；Rust `apps/web/src-tauri/src/topics.rs:84`-`apps/web/src-tauri/src/topics.rs:126`）。
- ✅ identity：list / get content / save content / delete / archive / unarchive / create / merge 覆盖，`speaker_id` 在 entry、create、format、merge 中保留（`apps/daemon/src/identity/service.ts:19`-`apps/daemon/src/identity/service.ts:31`，`apps/daemon/src/identity/service.ts:84`-`apps/daemon/src/identity/service.ts:112`，`apps/daemon/src/identity/service.ts:190`-`apps/daemon/src/identity/service.ts:224`）；Rust 对照保留同字段（`apps/web/src-tauri/src/identity.rs:22`-`apps/web/src-tauri/src/identity.rs:35`，`apps/web/src-tauri/src/identity.rs:355`-`apps/web/src-tauri/src/identity.rs:423`）。
- ✅ materials：4 命令 import file / import text / import text temp / import image temp 覆盖（`apps/daemon/src/materials/service.ts:29`-`apps/daemon/src/materials/service.ts:74`），路径返回语义与 Rust 对齐：`import_file` 返回绝对 dest，`import_text` 返回 `ym/raw/...` 相对路径，temp 返回系统临时绝对路径（daemon `apps/daemon/src/materials/service.ts:42`、`apps/daemon/src/materials/service.ts:51`、`apps/daemon/src/materials/service.ts:58`、`apps/daemon/src/materials/service.ts:73`；Rust `apps/web/src-tauri/src/materials.rs:70`-`apps/web/src-tauri/src/materials.rs:78`、`apps/web/src-tauri/src/materials.rs:141`-`apps/web/src-tauri/src/materials.rs:145`、`apps/web/src-tauri/src/materials.rs:94`-`apps/web/src-tauri/src/materials.rs:98`、`apps/web/src-tauri/src/materials.rs:118`-`apps/web/src-tauri/src/materials.rs:122`）。

## 方案落实（不偏，对照 design.md）

N/A。本任务无 design.md。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ❌ 范围外修改仍存在：`git status --short` 输出 `M docs/adr/rust-removal-roadmap.md`；story 明确越界核查范围为“仅各模块 daemon service + server.ts + 前端 tauri.ts + 测试 + story”（`stories/20260627-m2-local-crud/story.md:31`），本轮实现文件清单也未包含该 docs 文件。
- ✅ 指定实现清单内新增的 config service/routes/test 修改可归入 r2 fail 修复所需基础设施：workspace path 与 sample flag 均在 config 中落地（`apps/daemon/src/config/service.ts:109`-`apps/daemon/src/config/service.ts:136`），route 读写 config workspace（`apps/daemon/src/server.ts:174`-`apps/daemon/src/server.ts:187`），测试覆盖迁移、持久化与 CRUD 使用配置 workspace（`apps/daemon/src/config/service.test.ts:92`-`apps/daemon/src/config/service.test.ts:130`，`apps/daemon/src/config/routes.test.ts:65`-`apps/daemon/src/config/routes.test.ts:72`）。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一模块 CRUD 的并行 service 实现。server 每次请求通过一组 factory 构造 5 个模块 service，均共享 `workspaceRoot()` 与 `workspaceChangeSets()`（`apps/daemon/src/server.ts:101`-`apps/daemon/src/server.ts:115`）。
- ✅ materials 的 `/files/import` 复用同一个 `MaterialsService`，没有另建一套材料导入实现（`apps/daemon/src/server.ts:687`-`apps/daemon/src/server.ts:709`）。

## 结论

result: fail。

本轮已修复 r2 的主要 fail 项：CRUD workspace root 与 config workspace 一致，`create_sample_entry_if_needed` 使用 config 的 `sample_entry_created`，YAML block array 与 materials Rust hash 有测试证据。剩余失败项是范围外文件 `docs/adr/rust-removal-roadmap.md` 仍处于 modified，未被 story 或本轮实现文件清单覆盖。

修复建议：处理 `docs/adr/rust-removal-roadmap.md` 的归属。若它是本任务必要文档维护，需要先回写契约或走 docs-maintenance 后再验收；若不是本任务交付，应从本任务变更中隔离。

## 待用户裁决

1. `docs/adr/rust-removal-roadmap.md` 修改是否纳入本任务？
   - 接受：需要把 docs 维护纳入契约或补走 docs-maintenance，使实现与契约一致。
   - 不接受：该文件不能作为本任务交付的一部分。
   - 保守结论：计入 fail。
