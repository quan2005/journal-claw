# Gate Report: P1 本地 Agent 引擎检测

目标：作为独立把关方，对照 `/Users/yanwu/Projects/github/journal/stories/20260628-local-agent-detection/spec.md` 的 AC-1..AC-5、`/Users/yanwu/Projects/github/open-design` 参考实现，以及当前 worktree diff 做严苛验收。

结论：打回开发。

原因：检测层没有复刻 open-design 的 PATH 对称 launch env。GUI/minimal PATH 场景下，resolver 能在用户工具链目录中找到 CLI shim，但 version probe 的 child PATH 没补入同一目录，导致本应可用的 agent 被误判为 `shim-broken`/不可用。已补充红灯测试固定该问题。

## AC 判定

| AC                   | 判定 | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 检测            | FAIL | 当前 `probeEnv` 仅 `{ ...process.env, ...configuredEnv }`，随后直接 probe `resolution.selectedPath`，见 `apps/daemon/src/runtimes/detection.ts:122-127`。open-design 在 `resolveAgentLaunch` 后调用 `applyAgentLaunchEnv`，把 wrapper 目录、Node 目录和 user toolchain dirs 合入 child PATH，见 `/Users/yanwu/Projects/github/open-design/apps/daemon/src/runtimes/detection.ts:203-220`、`launch.ts:39-85`。新增测试 `apps/daemon/src/runtimes/detection.test.ts:106-129` 失败，`agent.available` 实际为 `false`。 |
| AC-2 诊断 + 修复意图 | FAIL | reason/fix intent 类型基本齐全，见 `packages/contracts/src/registry.ts:22-45`，诊断 builder 也覆盖六类 reason，见 `apps/daemon/src/runtimes/diagnostics.ts:30-115`。但 auth probe 非 0 退出除 ENOENT/EACCES 外一律归为 `auth-missing`，见 `apps/daemon/src/runtimes/auth.ts:63-74`，相比 open-design 的文本分类与 `auth-unknown` 分流过度简化，网络错误、超时、CLI 状态命令异常会被误报为未登录。另有响应契约泄漏，见 Major-2。                                                                                     |
| AC-3 端点            | PASS | `GET /agents` 返回 `{ agents }`，`?rescan=1                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | true`传入`forceRefresh`绕过缓存，见`apps/daemon/src/server.ts:1735-1739`、`apps/daemon/src/runtimes/detection.ts:200-213`。未接 HTTP 流式端点，但 spec 标明流式为加分项非必须。 |
| AC-4 设置页展示      | PASS | 设置页新增 `localAgents` 分区，卡片展示名称、状态、版本、路径、登录状态，见 `apps/web/src/settings/components/SectionLocalAgents.tsx:150-206`；diagnostics 渲染 reason 和 fix action，见 `SectionLocalAgents.tsx:208-234`、`apps/web/src/components/AgentDiagnosticRow.tsx:71-135`；顶部 rescan 有进行中态，见 `SectionLocalAgents.tsx:247-298`。可见文案走 `en.ts`/`zh.ts`，未发现可见 hardcode。                                                                                                                  |
| AC-5 不回退/绿       | FAIL | `npm run build` 通过。`cd apps/daemon && npx vitest run` 失败：`src/runtimes/detection.test.ts` 与 build 后的 `dist/runtimes/detection.test.js` 同源失败，核心断言为 `expected false to be true` at `src/runtimes/detection.test.ts:127`。`npm test` 失败中包含该新增失败；web 的 `HistoryFloatingButton` 和 `SandboxPreview` 两个失败为用户已声明的 pre-existing，可忽略。                                                                                                                                         |

## 发现的问题

### Critical

无。

### Major

1. PATH 解析与 child spawn PATH 不对称，导致 GUI/minimal PATH 下误判可用 agent 为 broken shim。

   当前实现额外搜索 `~/.local/bin`、nvm/fnm 等目录，见 `apps/daemon/src/runtimes/executables.ts:49-116`，但 probe 时没有把这些目录补回 `env.PATH`，见 `apps/daemon/src/runtimes/detection.ts:126-127`。open-design 明确把 `userToolchainBinDirs()` 暴露给 launch env，注释说明该问题，见 `/Users/yanwu/Projects/github/open-design/apps/daemon/src/runtimes/executables.ts:78-84` 和 `launch.ts:54-60`。

   已补测试：`apps/daemon/src/runtimes/detection.test.ts:106-129` 构造 `HOME` 含空格、CLI shim 在 `~/.local/bin`、interpreter 也在 `~/.local/bin`、process PATH 不含该目录。期望可用并解析版本 `7.7.7`，实际 `available:false`。

   必修项：复刻 open-design 的 launch env 路径处理，至少保证 detection probe 与 runtime spawn 使用同一 resolved launch path 和同一 child PATH 规则。

2. `GET /agents` payload 泄漏 RuntimeAgentDef 内部字段，契约不纯。

   `AgentInfo` 契约只包含 `id/name/bin/available/authStatus/authMessage/path/version/diagnostics/installUrl/docsUrl`，见 `packages/contracts/src/registry.ts:48-60`。但 `stripFns` 只剥离 `buildArgs/fallbackModels/promptInputFormat/version/authProbe`，见 `apps/daemon/src/runtimes/detection.ts:94-105`，会把 `fallbackBins`、`promptViaStdin`、`streamFormat` 等 spawn/runtime 内部字段带进 API 响应。open-design 明确 strip `fallbackBins` 等 probe/spawn-only metadata，见 `/Users/yanwu/Projects/github/open-design/apps/daemon/src/runtimes/detection.ts:260-286`。

   必修项：按 journal `AgentInfo` 契约白名单输出，或至少补齐 strip 列表，避免内部运行时字段外泄。

3. Auth probe 过度简化，`auth-unknown` 语义不忠实。

   当前 auth probe 对非 0 退出默认 `auth-missing`，见 `apps/daemon/src/runtimes/auth.ts:63-74`。这会把 timeout、网络错误、CLI 状态命令内部错误误导成“未登录”。open-design 的 `auth.ts` 对输出文本做 classifier，不能确认登录问题时返回 unknown。

   必修项：区分明确未登录与无法确认，至少 timeout/非认证错误文本应落 `auth-unknown`，并保留 stderr tail。

### Minor

1. `GET /agents` 没有 route-level error envelope。

   `apps/daemon/src/server.ts:1735-1739` 没有 try/catch。`safeProbe` 能隔离 adapter 级错误，但 registry/cache 级异常仍会落到 Express 默认错误路径。open-design route 对非流式检测有 catch 并返回 JSON error。建议补齐。

2. `apps/web/src/lib/localAgents.ts` 直接拼 daemon URL。

   该文件使用 `http://127.0.0.1:17510` / `JOURNAL_DAEMON_URL` 并直接 fetch `/agents`，见 `apps/web/src/lib/localAgents.ts:12-35`。这复用了现有 `agentRuns.ts` 模式，但与 AGENTS.md 的 runtime 单一入口约束存在张力。不是本轮打回主因，建议后续统一到 `runtimeClient` 或在项目约定中明确例外。

3. OpenCode binary precedence 与 open-design 参考相反。

   journal 当前 `bin: 'opencode'`、`fallbackBins: ['opencode-cli']`，见 `apps/daemon/src/runtimes/defs/opencode.ts:9-14`；open-design 为 `bin: 'opencode-cli'`、fallback `opencode`。spec 允许清单合理收敛，此项不单独阻塞，但两者并存时选择不同 binary。

4. `apps/desktop/package.json` 将 `electron` 从 dependencies 移到 devDependencies，`pnpm-lock.yaml` 同步变化。

   未引入新依赖；但该 manifest churn 与本 story 无直接关系。若不是刻意清理，建议开发确认保留理由。

## 对抗测试覆盖

| 场景             | 结果                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| 恶意/含空格 PATH | 部分覆盖。新增测试 HOME 路径含空格，`execFile` 无 shell 注入风险；但 PATH 对称性失败。                        |
| 符号链接/破 shim | 已有测试覆盖 shebang target missing -> `shim-broken`。                                                        |
| 空/无效 `*_BIN`  | 已有测试覆盖 invalid `CODEX_BIN` -> `configured-bin-invalid`；empty env 被忽略，行为与 open-design 接近。     |
| 版本输出畸形     | 已有测试覆盖 version probe 非 0 exit -> available true + version null。                                       |
| 并发扫描         | 代码层面 `Promise.all` + `safeProbe`；无共享 mutable result，未发现数据竞争。                                 |
| 缓存失效         | 已有测试覆盖 `forceRefresh` 绕过缓存。                                                                        |
| 流式中途异常     | `detectAgentsStream` 使用 `safeProbe`，单 adapter 异常不应打断 generator；HTTP 端未实现流式，按 spec 非必须。 |

## 执行命令

| 命令                                                                  | 结果                                                                                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                       | PASS。Electron signing/icon 与 web chunk size 仅为警告。                                                                                           |
| `cd apps/daemon && npx vitest run`                                    | FAIL。2 个失败均为新增同源对抗测试：`src/runtimes/detection.test.ts` 和 build 后 `dist/runtimes/detection.test.js`。其余 540 个测试通过。          |
| `npm test`                                                            | FAIL。包含本轮 daemon 对抗测试失败；web `HistoryFloatingButton`、`SandboxPreview` 为 pre-existing 失败。contracts 20/20 pass，desktop 13/13 pass。 |
| `cd apps/web && npx vitest run src/tests/AgentDiagnosticRow.test.tsx` | PASS，6/6。                                                                                                                                        |
| `cd apps/web && npx vitest run src/tests/SectionLocalAgents.test.tsx` | PASS，6/6。                                                                                                                                        |
| `cd apps/daemon && npx vitest run src/runtimes/detection.test.ts`     | FAIL，1/13，失败点为 `toolchain PATH symmetry`。                                                                                                   |

## 独立 opencode 审查交叉结果

- daemon/contracts 子审查发现 `stripFns` payload field leak，但未覆盖我后补的 PATH 对称红灯测试。
- web/settings 子审查判 AC-4 PASS，确认 UI 文案走 locale、设计 token 基本合规、无新 web 依赖，并把 direct daemon fetch 记录为既有模式例外。

## 必修项

1. 复刻 open-design 的 launch path/env 处理：resolved binary 的目录、Node 目录、user toolchain dirs 必须进入 detection probe 的 child PATH；Codex wrapper/native path 差异也需确认。
2. 修正 `AgentInfo` 响应契约，避免 `fallbackBins`、`promptViaStdin`、`streamFormat` 等内部字段泄漏。
3. 修正 auth probe 分类，明确未登录才 `auth-missing`，无法确认时 `auth-unknown`。
4. 修复后保留并跑通新增对抗测试 `toolchain PATH symmetry`，再跑 `npm run build`、`cd apps/daemon && npx vitest run`、`npm test`。

---

## 第 2 轮复核

目标：复核 opencode 针对上一轮 3 个 Major 必修项的修复；独立验证 `electron` 依赖位置争议；重跑 AC-1..AC-5 与指定命令。

结论：可合并。第 1 轮必修项已修复；`Minor-4 electron` 划掉，不再作为 churn 问题记录。`npm test` 仍因用户已声明可忽略的 `HistoryFloatingButton` / `SandboxPreview` 两个 pre-existing 用例失败而返回非 0，本轮新增/相关用例未失败。

### 必修项复核

| 项                | 判定 | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Major-1 PATH 对称 | PASS | `detection.ts` probe 先 `resolveAgentLaunch` 再 `applyAgentLaunchEnv`，见 `apps/daemon/src/runtimes/detection.ts:144-152`；runtime spawn 走同一套解析和 env，见 `apps/daemon/src/runtimes/runner.ts:95-126`；`launch.ts` 把 resolved wrapper dir、Node bin、`userToolchainBinDirs()` 合入 child PATH，见 `apps/daemon/src/runtimes/launch.ts:54-101`；resolution 搜索范围与 toolchain dirs 对齐，见 `apps/daemon/src/runtimes/executables.ts:49-152`。红灯测试 `toolchain PATH symmetry` 已转绿，见 `apps/daemon/src/runtimes/detection.test.ts:106-129` 与命令结果 14/14 pass。 |
| Major-2 契约泄漏  | PASS | 原黑名单 strip 改为 `agentInfoBase` 白名单，只发 `id/name/bin/installUrl/docsUrl` 再显式拼 `available/path/version/authStatus/diagnostics`，见 `apps/daemon/src/runtimes/detection.ts:105-176`。`fallbackBins`、`promptViaStdin`、`streamFormat`、`buildArgs`、`authProbe` 不再能经 `...def` 泄漏。                                                                                                                                                                                                                                                                              |
| Major-3 auth 分流 | PASS | `AUTH_FAILURE_RE` 只把明确认证失败文本归 `missing`，见 `apps/daemon/src/runtimes/auth.ts:53-75`；exit 0 JSON `loggedIn:false` -> `missing`，无字段/非 JSON 无认证失败信号 -> `unknown`，见 `auth.ts:96-123`；ENOENT/EACCES 与非 0 无认证失败信号 -> `unknown`，见 `auth.ts:126-145`。测试覆盖 `auth-missing`、`auth-unknown`、`auth-ok`，见 `apps/daemon/src/runtimes/detection.test.ts:142-205`。                                                                                                                                                                               |

### AC 判定

| AC                   | 判定                   | 证据                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 检测            | PASS                   | `not-on-path`、healthy version、bad version still available、not executable、broken shim、configured bin、cache、streaming 均由 `apps/daemon/src/runtimes/detection.test.ts` 覆盖；单文件命令 `cd apps/daemon && npx vitest run src/runtimes/detection.test.ts` 通过，14 tests passed。PATH 对称对抗测试已包含 HOME 含空格 + `~/.local/bin` shim/interpreter 场景。      |
| AC-2 诊断 + 修复意图 | PASS                   | 诊断 reason/fixActions 在 daemon detection tests 覆盖；auth unknown/missing 分流已转绿；web `AgentDiagnosticRow` 测试覆盖 not-on-path、auth-missing、configured-bin-invalid、rescan/openDocs/openInstall/setEnv/clearEnv 等按钮行为，`cd apps/web && npx vitest run src/tests/AgentDiagnosticRow.test.tsx src/tests/SectionLocalAgents.test.tsx` 通过，12 tests passed。 |
| AC-3 端点            | PASS                   | `GET /agents` 返回 `{ agents }` 并支持 `?rescan=1                                                                                                                                                                                                                                                                                                                        | true`强制刷新，见`apps/daemon/src/server.ts:1738-1747`；设置页 rescan 会请求 `?rescan=1`，见 `apps/web/src/tests/SectionLocalAgents.test.tsx:122-129`。route-level JSON error envelope 已补齐。 |
| AC-4 设置页展示      | PASS                   | web local agents 测试通过，覆盖卡片名称/状态、version/path、诊断文案、安装按钮、rescan 进行路径、error/empty state。`cd apps/web && npx vitest run src/tests/AgentDiagnosticRow.test.tsx src/tests/SectionLocalAgents.test.tsx` 结果：2 files / 12 tests passed。                                                                                                        |
| AC-5 不回退/绿       | PASS（带既有失败豁免） | `npm run build` PASS；`cd apps/daemon && npx vitest run` PASS，88 files / 544 tests；`npm test` 因 `HistoryFloatingButton.test.tsx` 与 `SandboxPreview.test.ts` 两个用户声明 pre-existing 失败返回 1，其余 contracts 20/20、desktop 13/13、daemon 已单独全量通过，web local-agent 新增测试无失败。                                                                       |

### Electron 裁决

opencode 对。`electron-builder@25.1.8` 确实要求 `electron` 只放在 `devDependencies`。

独立反证：临时把 `apps/desktop/package.json` 改回 `dependencies: { "electron": "33.2.1" }` 并从 `devDependencies` 移除后，执行 `npm run desktop:build`，`electron-builder` 直接失败：

```text
Package "electron" is only allowed in "devDependencies". Please remove it from the "dependencies" section in your package.json.
```

恢复为当前修复状态后，`npm run build` 通过，且 `apps/desktop/package.json:17-22` 为 `dependencies: {}`、`devDependencies.electron: "33.2.1"`。因此第 1 轮 `Minor-4` 应划掉，不作为无关 manifest churn。关于“master 同样坏”：本 worktree 的 `master` / `origin/master` 不含 `apps/desktop/package.json`，无法直接验证；但当前分支基线 `HEAD:apps/desktop/package.json` 原本确实把 `electron` 放在 `dependencies`，且反证构建已证明该状态会失败。

### 执行命令

| 命令                                                                                                        | 结果                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cd apps/daemon && npx vitest run src/runtimes/detection.test.ts`                                           | PASS，1 file / 14 tests。                                                                                                                                                                   |
| `cd apps/web && npx vitest run src/tests/AgentDiagnosticRow.test.tsx src/tests/SectionLocalAgents.test.tsx` | PASS，2 files / 12 tests。                                                                                                                                                                  |
| `npm run desktop:build`（临时 electron 放回 dependencies）                                                  | FAIL，符合预期，electron-builder 明确报 `electron` only allowed in `devDependencies`。随后已恢复 manifest。                                                                                 |
| `npm run build`                                                                                             | PASS。Electron signing/icon、web chunk size 仅为警告。                                                                                                                                      |
| `cd apps/daemon && npx vitest run`                                                                          | PASS，88 files / 544 tests。                                                                                                                                                                |
| `npm test`                                                                                                  | FAIL only because `HistoryFloatingButton` 与 `SandboxPreview` 两个 pre-existing web failures；contracts 20/20、desktop 13/13 通过，daemon 本轮已全量通过，local-agent 新增 web tests 通过。 |

### 独立 opencode 交叉复核

只读 `opencode run` 子代理复核结论：Major-1/2/3 均 PASS；确认 `/agents` route 已补 error envelope。其 electron 判断没有实跑，因此最终 electron 裁决以上述本地反证命令为准。

### 最终结论

可合并。无新增必修项。
