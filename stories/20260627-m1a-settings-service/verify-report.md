---
story: ./story.md
design: N/A
date: 2026-06-27
round: 1
result: fail
scope: "实现文件清单：apps/daemon/src/settings/service.ts, apps/daemon/src/settings/service.test.ts, apps/daemon/src/server.ts, apps/web/src/lib/httpRuntimeClient.ts, apps/web/src/lib/tauri.ts, apps/web/src/lib/runtimeClient.ts, apps/web/src/hooks/useTheme.ts, apps/web/src/tests/httpRuntimeClient.test.ts, apps/web/src/tests/ipc-contract.test.ts, apps/web/src/tests/runtimeClient.test.ts；并用 git diff -- <上述文件> 核对"
---

# 验收报告 — M1a · Settings 服务（daemon）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 Given 已有 .setting.json，When daemon GET /settings，Then 返回与文件一致、未知字段保留 | ✅ pass | `apps/daemon/src/server.ts:124`-`127` 注册 `GET /settings` 并返回 `settingsService.load()`；`apps/daemon/src/settings/service.ts:79`-`87` 从 `<workspaceRoot>/.setting.json` 读取 raw JSON；`apps/daemon/src/settings/service.ts:126`-`136` 在返回对象中展开 `...raw` 并规范 known fields；`apps/daemon/src/settings/service.test.ts:37`-`59` 覆盖读取已有文件；`apps/daemon/src/settings/service.test.ts:90`-`106` 证明未知 top-level 与 nested 字段在更新后保留。 |
| AC-2 Given PUT /settings 改 theme，Then .setting.json theme 更新、其余字段不丢 | ✅ pass | `apps/daemon/src/server.ts:129`-`154` 注册 `PUT /settings`；`apps/daemon/src/settings/service.ts:57`-`62` 对 patch 做 merge、validate、persist；`apps/daemon/src/settings/service.ts:95`-`113` 用 shallow merge 保留既有 top-level 字段并 merge `auto_lint`；`apps/daemon/src/settings/service.test.ts:90`-`106` 直接断言改 theme 后 `future_flag` 和 `auto_lint.custom` 未丢。 |
| AC-3 Given 非法 theme，Then 结构化拒绝 | ✅ pass | `apps/daemon/src/settings/service.ts:148`-`151` 在 strict update 下非法 theme 抛 `SettingsValidationError`；`apps/daemon/src/server.ts:140`-`150` 捕获后返回 400 且 body 包含 `error.code`、`field`、`value`、`message`；`apps/daemon/src/settings/service.test.ts:126`-`128` 覆盖非法 theme 拒绝。 |
| AC-4 Given daemon 测试，When 运行，Then 全绿；daemon 既有 281 测试不回退 | ✅ pass | 命令 `pnpm --filter @journal/daemon test` 输出：`Test Files 39 passed (39)`、`Tests 288 passed (288)`。288 >= story 所述既有 281，未回退。 |
| AC-5 Given 前端 flag on，Then theme/skills 切换走 daemon 持久化 | ✅ pass | `apps/web/src/lib/runtimeClient.ts:61`-`81` 读取 `JOURNAL_RUNTIME=http`，`apps/web/src/lib/runtimeClient.ts:90`-`92` flag on 选择 `HttpRuntimeClient`；`apps/web/src/lib/tauri.ts:34`-`38` theme 读写走 `selectRuntimeClient()`，`apps/web/src/hooks/useTheme.ts:23`-`30`/`50`-`53` 实际使用该封装；`apps/web/src/lib/tauri.ts:405`-`409` global skills 走 runtime client，`apps/web/src/lib/tauri.ts:464`-`468` per-skill 开关走 runtime client；`apps/web/src/lib/httpRuntimeClient.ts:77`-`120` 将这些命令映射到 `GET/PUT /settings`；`apps/web/src/tests/httpRuntimeClient.test.ts:44`-`65`、`92`-`143` 覆盖 theme 与 per-skill 通过 `/settings` 持久化。命令 `pnpm --filter @journal/web exec vitest run src/tests/httpRuntimeClient.test.ts src/tests/ipc-contract.test.ts src/tests/runtimeClient.test.ts` 输出：`Test Files 3 passed (3)`、`Tests 95 passed (95)`。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 范围 1 daemon SettingsService：`apps/daemon/src/settings/service.ts:37`-`47` 定义默认值；`apps/daemon/src/settings/service.ts:79`-`91` 读写 `<workspaceRoot>/.setting.json`；`apps/daemon/src/settings/service.ts:115`-`136` 对齐字段名和默认值；`apps/daemon/src/settings/service.ts:148`-`191` 校验 theme/frequency/time/min_entries；`apps/daemon/src/settings/service.test.ts:23`-`134` 覆盖默认值、读取、merge 保留未知字段、校验拒绝。
- ✅ 范围 2 HTTP：`apps/daemon/src/server.ts:124`-`154` 提供 `GET /settings` 与 `PUT /settings`，并对非法 patch/非法 known fields 返回结构化错误。
- ❌ 范围 3 前端 runtime flag：theme、auto_lint、skills 已接入，但 automation 相关命令仍未接入 runtime flag。`apps/web/src/lib/tauri.ts:373`-`402` 的 `listAutomationTemplates`、`listRoutines`、`createRoutine`、`updateRoutine`、`deleteRoutine`、`pauseRoutine`、`resumeRoutine`、`runRoutineNow`、`listRoutineRuns`、`getAutomationRun` 仍直接调用 `invoke()`；`apps/web/src/lib/httpRuntimeClient.ts:70`-`124` 未支持这些 automation command，default 分支会抛 unsupported command。story 范围要求 `theme / auto_lint / automation / skills 开关相关命令经 runtime flag 走 daemon`（`stories/20260627-m1a-settings-service/story.md:18`）。
- ✅ 范围 4 测试：daemon service 测试存在于 `apps/daemon/src/settings/service.test.ts:23`-`134`；前端 client 测试存在于 `apps/web/src/tests/httpRuntimeClient.test.ts:44`-`143`、`apps/web/src/tests/ipc-contract.test.ts:96`-`130`/`525`-`544`、`apps/web/src/tests/runtimeClient.test.ts:28`-`35`。

## 方案落实（不偏，对照 design.md）

N/A。本任务无 design.md，仅以 story.md 为基准。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 未发现命中 API key / engine config 非目标的实现改动。`git diff -- <核对文件清单>` 仅显示 SettingsService、`/settings` route、runtime client、theme hook 与相关测试改动；`apps/web/src/lib/tauri.ts:221`-`227` 的 engine config 仍直接 `invoke()`，未被纳入 daemon settings。
- ✅ 未发现命中 ASR/音频设置非目标的实现改动。核对文件 diff 中未出现 ASR/音频设置逻辑；`apps/web/src/lib/tauri.ts:120`-`122` 的 `importAudioFile` 不是 settings 持久化改动。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的多套并行实现。daemon 侧 settings 读写集中在 `SettingsService`（`apps/daemon/src/settings/service.ts:49`-`93`），HTTP 只委托该 service（`apps/daemon/src/server.ts:124`-`154`）；前端 flag 路径集中在 `selectRuntimeClient()`（`apps/web/src/lib/runtimeClient.ts:90`-`92`）和 `HttpRuntimeClient.invoke()`（`apps/web/src/lib/httpRuntimeClient.ts:67`-`125`）。

## 结论

result: fail。

主体 AC 通过：daemon SettingsService、`GET/PUT /settings`、非法 theme 结构化拒绝、daemon 测试、前端 flag-on theme/per-skill 持久化均有代码和测试证据。

阻塞偏差：story 范围第 3 条要求 automation 相关命令经 runtime flag 走 daemon，但当前 automation workbench 命令仍直接走 Tauri，且 HttpRuntimeClient 不支持这些命令。修复方向：要么把 automation 相关命令纳入 runtime client/daemon HTTP surface，要么由用户确认本 story 中的 “automation settings” 仅指 `.setting.json` 内的 auto_lint frequency/time/min_entries，并回写 story 范围以排除 automation workbench 命令。

## 待用户裁决

- `automation settings` 的边界需用户裁决。接受当前实现的代价：story.md 需要回写，明确 M1a 只覆盖 `.setting.json` 内的 auto_lint/自动整理配置，不覆盖 automation workbench routine/template/run 命令；不接受的代价：本轮按 fail 处理，需要继续实现 `apps/web/src/lib/tauri.ts:373`-`402` 对应命令的 daemon runtime 路径与 HttpRuntimeClient 测试。
