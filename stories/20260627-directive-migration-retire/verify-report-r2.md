---
story: ./story.md
design: N/A
date: 2026-06-27
round: 2
result: pass
scope: "git diff -- apps/web/src apps/daemon/src stories/20260627-directive-migration-retire/story.md; git diff --name-status"
---

# 验收报告 — 下线 directiveMigration 与 compile_mdx 残留

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 失效入口不可见 | ✅ pass | 契约要求 General 设置不再显示旧 directive 到 MDX 迁移入口，且无前端触发路径（`stories/20260627-directive-migration-retire/story.md:47`-`story.md:51`）。当前 `SectionGeneral` 只导入 `getWorkspacePath` / `setWorkspacePath` / `pickFolder`（`apps/web/src/settings/components/SectionGeneral.tsx:1`、`apps/web/src/settings/components/SectionGeneral.tsx:3`），初始化 effect 只读取 workspace path（`apps/web/src/settings/components/SectionGeneral.tsx:62`-`apps/web/src/settings/components/SectionGeneral.tsx:68`），渲染内容只包含 workspace folder 表单与保存按钮（`apps/web/src/settings/components/SectionGeneral.tsx:104`、`apps/web/src/settings/components/SectionGeneral.tsx:131`、`apps/web/src/settings/components/SectionGeneral.tsx:140`、`apps/web/src/settings/components/SectionGeneral.tsx:204`）。旧迁移 locale 键不在 General 段内，中文从 General 直接到 AI Engine（`apps/web/src/locales/zh.ts:196`-`apps/web/src/locales/zh.ts:209`），英文同样从 General 直接到 AI Engine（`apps/web/src/locales/en.ts:168`-`apps/web/src/locales/en.ts:181`）。`tauri.ts` 在 journal content 后直接进入 Materials，没有旧迁移封装（`apps/web/src/lib/tauri.ts:66`-`apps/web/src/lib/tauri.ts:72`）。命令 `rg -n "apply_directive_migration|scan_legacy_directive_files|/mdx/compile|/directive-migration|legacyMigration|Preview migration|预览迁移|迁移旧版" apps/web/src apps/daemon/src; printf 'RG_EXIT:%s\n' $?` 输出 `RG_EXIT:1`。 |
| AC-2 失效 runtime 能力不可调用 | ✅ pass | 契约要求 `compile_mdx`、`apply_directive_migration`、`scan_legacy_directive_files` 不再从 web 封装或 daemon HTTP 映射暴露（`stories/20260627-directive-migration-retire/story.md:53`-`story.md:56`）。`HttpRuntimeClient.invoke` 的 switch 中 skills 后直接进入 onboarding/permissions/auto-lint 等现存能力（`apps/web/src/lib/httpRuntimeClient.ts:149`-`apps/web/src/lib/httpRuntimeClient.ts:210`），未知 command 默认抛错（`apps/web/src/lib/httpRuntimeClient.ts:737`-`apps/web/src/lib/httpRuntimeClient.ts:738`）。daemon `server.ts` import 列表没有 mdx/directive migration service（`apps/daemon/src/server.ts:9`-`apps/daemon/src/server.ts:40`），M3 路由段只保留 skills、onboarding、permissions、auto-lint、event-log 并随后进入 journal 路由（`apps/daemon/src/server.ts:506`-`apps/daemon/src/server.ts:650`）。命令 `rg -n "directiveMigration|directive_migration|compile_mdx|compileMdx|legacyDirectives|apply_directive_migration|scan_legacy_directive_files" apps/web/src apps/daemon/src; printf 'RG_EXIT:%s\n' $?` 输出 `RG_EXIT:1`。 |
| AC-3 残留代码清零 | ✅ pass | 契约要求在 `apps/web/src` 与 `apps/daemon/src` 搜索 `directiveMigration|directive_migration|compile_mdx|compileMdx|legacyDirectives` 为 0 个有效命中（`stories/20260627-directive-migration-retire/story.md:58`-`story.md:61`）。命令 `rg -n "directiveMigration|directive_migration|compile_mdx|compileMdx|legacyDirectives" apps/web/src apps/daemon/src; printf 'RG_EXIT:%s\n' $?` 输出 `RG_EXIT:1`。旧实现文件在 diff 中为删除：`git diff --name-status -- apps/web/src apps/daemon/src stories/20260627-directive-migration-retire/story.md` 输出 `D apps/web/src/lib/directiveMigration.ts`、`D apps/web/src/lib/legacyDirectives/index.ts`、`D apps/web/src/lib/legacyDirectives/toJsx.ts`、`D apps/daemon/src/directive_migration/service.ts`、`D apps/daemon/src/mdx/service.ts`。命令 `find apps/web/src/lib/legacyDirectives apps/daemon/src/mdx apps/daemon/src/directive_migration -maxdepth 2 -type f -print 2>/dev/null; printf 'FIND_EXIT:%s\n' $?` 只输出 `FIND_EXIT:0`，没有残留文件路径。 |
| AC-4 既有主线不回退 | ✅ pass | 契约要求 web 与 daemon TypeScript 检查 0 错误，web vitest 不新增失败且允许维持用户给定 9 个既有失败基线，daemon vitest 为 446 项通过（`stories/20260627-directive-migration-retire/story.md:63`-`story.md:68`）。`pnpm --filter @journal/web typecheck` 退出 0，输出 `tsc --noEmit` 无错误；`pnpm --filter @journal/daemon typecheck` 退出 0，输出 contracts build 与 daemon `tsc --noEmit` 无错误；`pnpm --filter @journal/daemon test` 退出 0，输出 `Test Files 72 passed (72)` / `Tests 446 passed (446)`；`pnpm --filter @journal/web test -- src/tests/SectionGeneral.test.tsx` 退出 0，输出 `Test Files 1 passed (1)` / `Tests 1 passed (1)`。完整 `pnpm --filter @journal/web test` 退出 1，但输出为 `Test Files 4 failed | 43 passed (47)` / `Tests 9 failed | 328 passed (337)`，等于 story 允许的 9 个既有失败基线；上一轮报告也记录同一数量与同一失败文件集合（`stories/20260627-directive-migration-retire/verify-report.md:19`），因此本轮未发现新增失败。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 设置页入口已移除。story 成功标准要求残留命中清零并移除设置入口（`stories/20260627-directive-migration-retire/story.md:39`-`story.md:41`、`stories/20260627-directive-migration-retire/story.md:47`-`story.md:51`）；当前 `SectionGeneral` 只保留 workspace path 读取、选择、保存（`apps/web/src/settings/components/SectionGeneral.tsx:62`-`apps/web/src/settings/components/SectionGeneral.tsx:89`、`apps/web/src/settings/components/SectionGeneral.tsx:131`-`apps/web/src/settings/components/SectionGeneral.tsx:219`），设置页测试 mock 也只保留 workspace 三个 API（`apps/web/src/tests/SectionGeneral.test.tsx:6`-`apps/web/src/tests/SectionGeneral.test.tsx:14`）。
- ✅ web runtime 封装和 HTTP runtime 映射已移除。`tauri.ts` 无旧迁移类型或 command 封装，journal content 后直接进入 Materials（`apps/web/src/lib/tauri.ts:66`-`apps/web/src/lib/tauri.ts:72`）；`HttpRuntimeClient` 没有三项旧 command case，未知 command 抛错（`apps/web/src/lib/httpRuntimeClient.ts:149`-`apps/web/src/lib/httpRuntimeClient.ts:210`、`apps/web/src/lib/httpRuntimeClient.ts:737`-`apps/web/src/lib/httpRuntimeClient.ts:738`）。
- ✅ daemon 路由与旧服务已移除。`server.ts` import 列表无 `compileMdx` 或 `DirectiveMigrationService`（`apps/daemon/src/server.ts:9`-`apps/daemon/src/server.ts:40`），M3 路由段没有 `/mdx/compile` 或 `/directive-migration/*`，并在 event-log 后进入 journal 路由（`apps/daemon/src/server.ts:506`-`apps/daemon/src/server.ts:650`）。`git diff --name-status -- apps/web/src apps/daemon/src stories/20260627-directive-migration-retire/story.md` 输出删除 `apps/daemon/src/directive_migration/service.ts` 与 `apps/daemon/src/mdx/service.ts`。
- ✅ 测试与类型残留已收窄。`apps/web/src/types.ts` 在 `RawMaterial` 后直接进入 `JournalEntry` / `ProcessingUpdate`，没有旧迁移类型（`apps/web/src/types.ts:5`-`apps/web/src/types.ts:28`）。`git diff --name-status -- apps/web/src apps/daemon/src stories/20260627-directive-migration-retire/story.md` 输出删除 `apps/daemon/src/directive_migration/service.test.ts`、`apps/web/src/tests/directiveMigration.test.ts`、`apps/web/src/tests/legacyDirectiveToJsx.test.ts`。
- ✅ 验证反馈范围满足。`pnpm --filter @journal/web typecheck` 与 `pnpm --filter @journal/daemon typecheck` 均退出 0；`pnpm --filter @journal/daemon test` 输出 `Tests 446 passed (446)`；完整 `pnpm --filter @journal/web test` 输出 `Tests 9 failed | 328 passed (337)`，与 story 的 9 个既有失败基线一致（`stories/20260627-directive-migration-retire/story.md:67`）。

## 方案落实（不偏，对照 design.md）

N/A。本任务无 design.md，story frontmatter 为 `design: N/A`（`stories/20260627-directive-migration-retire/story.md:8`）；命令 `test -f stories/20260627-directive-migration-retire/design.md; printf 'DESIGN_EXISTS:%s\n' $?` 输出 `DESIGN_EXISTS:1`。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 未命中 story 非目标。story 明确不删除 Rust 侧 `directive_migration.rs` 与 `mdx.rs`，不处理历史文档 MDX 叙述，不重做 Markdown 迁移脚本，不调整 MDX 降级渲染策略（`stories/20260627-directive-migration-retire/story.md:70`-`story.md:74`）。`git diff --name-status -- apps/web/src apps/daemon/src stories/20260627-directive-migration-retire/story.md` 只列出 `apps/web/src` 与 `apps/daemon/src` 下的旧入口、runtime、路由、服务、测试、类型、locale 相关改动，没有 `src-tauri`、历史文档或 Markdown 迁移脚本文件。
- ✅ diff 均可归属到 AC 或必要测试收窄。`git diff --numstat -- apps/web/src apps/daemon/src stories/20260627-directive-migration-retire/story.md` 显示 16 个文件共 `3` 行新增、`1476` 行删除；删除项对应旧 directive migration / compile_mdx 服务、映射、UI、测试、类型，少量新增为 `SectionGeneral` 删除迁移 UI 后的结构收尾（`apps/web/src/settings/components/SectionGeneral.tsx:121`-`apps/web/src/settings/components/SectionGeneral.tsx:223`）与 `server.ts` 删除旧服务后的结构收尾（`apps/daemon/src/server.ts:506`-`apps/daemon/src/server.ts:650`）。

## 冗余（不重，对照 story.md）

✅ pass。未发现同一旧迁移能力的并行实现：指定残留检索命令 `rg -n "directiveMigration|directive_migration|compile_mdx|compileMdx|legacyDirectives" apps/web/src apps/daemon/src; printf 'RG_EXIT:%s\n' $?` 输出 `RG_EXIT:1`；`HttpRuntimeClient` 对未知 command 默认抛错（`apps/web/src/lib/httpRuntimeClient.ts:737`-`apps/web/src/lib/httpRuntimeClient.ts:738`）；daemon M3 路由段没有旧迁移/MDX compile 路由（`apps/daemon/src/server.ts:506`-`apps/daemon/src/server.ts:650`）。

## 结论

result: pass。

六字标准均通过：AC-1、AC-2、AC-3、AC-4 均有代码或命令证据；范围完整性满足 story 成功标准；本任务无 design.md；越界检查未发现命中非目标或无法归属的功能性改动；未发现重复实现。

上一轮 fail 项已关闭：上一轮阻塞为 AC-4 的 web 全量 vitest 9 个失败缺少基线裁决（`stories/20260627-directive-migration-retire/verify-report.md:19`、`stories/20260627-directive-migration-retire/verify-report.md:49`-`stories/20260627-directive-migration-retire/verify-report.md:57`）。本轮以当前 story 明确的“允许维持用户给定的 9 个既有失败基线”为契约（`stories/20260627-directive-migration-retire/story.md:67`），复跑完整 web vitest 得到同为 9 个失败，且上一轮报告记录的数量和失败文件集合一致，因此未发现新增失败。

## 待用户裁决

无。
