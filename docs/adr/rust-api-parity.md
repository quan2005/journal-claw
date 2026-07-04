# Rust -> TypeScript daemon API parity 矩阵

日期：2026-06-27

用途：作为 `docs/adr/rust-removal-acceptance.md` Gate B 的终局证据，确认旧 Rust command 能力已经由 TypeScript daemon / Electron host 替代，或按产品决策下线。

## 结论

M8-b 删除 `apps/web/src-tauri/` 后，旧 Rust API 不再是可执行路径。旧 134 个 command 的终局状态如下：

| 状态     | 数量 | 说明                                                                           |
| -------- | ---: | ------------------------------------------------------------------------------ |
| replaced |  117 | 用户仍保留的能力已迁到 daemon services、runtime client 或 Electron host bridge |
| retired  |   17 | 音频/语音/转写、speaker profile、MDX 等已按产品决策下线                        |
| blocked  |    0 | 无仍需 Rust/Tauri 才能触达的用户路径                                           |
| 总计     |  134 | 来源为 M8 前 Rust command 快照                                                 |

## 能力矩阵

| 能力域                                         | 终局状态 | 主要替代/下线证据                                                                                                                                           | 测试证据                                                                                                                                                             |
| ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host/runtime/window/menu/dialog/open/reveal    | replaced | `apps/desktop/src/main.ts`, `apps/desktop/src/hostIpc.ts`, `apps/desktop/src/preload.cts`, `apps/web/src/lib/hostBridge.ts`                                 | `apps/desktop/tests/hostIpc.test.ts`, `apps/desktop/tests/preload.test.ts`                                                                                           |
| Runtime transport                              | replaced | `apps/web/src/lib/runtimeClient.ts`, `apps/web/src/lib/httpRuntimeClient.ts`, `apps/web/src/lib/tauri.ts` shim                                              | `apps/web/src/tests/runtimeClient.test.ts`, `apps/web/src/tests/httpRuntimeClient.test.ts`, `apps/web/src/tests/tauri.test.ts`                                       |
| Settings/config/API keys/platform capabilities | replaced | `apps/daemon/src/settings/service.ts`, `apps/daemon/src/config/service.ts`, `apps/daemon/src/config/routes.test.ts`                                         | `apps/daemon/src/settings/service.test.ts`, `apps/daemon/src/config/service.test.ts`, `apps/daemon/src/config/routes.test.ts`                                        |
| Workspace/files/material import                | replaced | `apps/daemon/src/workspace/service.ts`, `apps/daemon/src/files/service.ts`, `apps/daemon/src/materials/service.ts`, `apps/web/src/lib/httpRuntimeClient.ts` | `apps/daemon/src/workspace/service.test.ts`, `apps/daemon/src/files/service.test.ts`, `apps/daemon/src/materials/service.test.ts`                                    |
| Journal entries                                | replaced | `apps/daemon/src/journal/service.ts`                                                                                                                        | `apps/daemon/src/journal/service.test.ts`                                                                                                                            |
| Todos                                          | replaced | `apps/daemon/src/todos/service.ts`                                                                                                                          | `apps/daemon/src/todos/service.test.ts`                                                                                                                              |
| Topics                                         | replaced | `apps/daemon/src/topics/service.ts`                                                                                                                         | `apps/daemon/src/topics/service.test.ts`                                                                                                                             |
| Identity/rules/memory                          | replaced | `apps/daemon/src/identity/service.ts`, `apps/daemon/src/sediment/service.ts`                                                                                | `apps/daemon/src/identity/service.test.ts`, `apps/daemon/src/sediment/service.test.ts`                                                                               |
| Skills                                         | replaced | `apps/daemon/src/skills/service.ts`                                                                                                                         | `apps/daemon/src/skills/service.test.ts`                                                                                                                             |
| Agent Run / conversation / AI engine           | replaced | `apps/daemon/src/runs/service.ts`, `apps/daemon/src/engine/service.ts`, `apps/daemon/src/conversation/service.ts`                                           | `apps/daemon/src/runs/service.test.ts`, `apps/daemon/src/engine/service.test.ts`, `apps/daemon/src/conversation/service.test.ts`                                     |
| CLI adapters                                   | replaced | `apps/daemon/src/runtimes/defs/*`, `apps/daemon/src/runtimes/stream/*`, `apps/daemon/src/runtimes/runner.ts`                                                | `apps/daemon/src/runtimes/defs/claude.test.ts`, `apps/daemon/src/runtimes/defs/codex.test.ts`, `apps/daemon/src/runtimes/defs/opencode.test.ts`, stream parser tests |
| ChangeSet/recovery                             | replaced | `apps/daemon/src/changeset/service.ts`, `apps/daemon/src/changeset/authorization.ts`                                                                        | `apps/daemon/src/changeset/service.test.ts`, `apps/daemon/src/changeset/authorization.test.ts`                                                                       |
| Automation/routines/work queue                 | replaced | `apps/daemon/src/automation/service.ts`, `apps/daemon/src/automation/store.ts`, `apps/daemon/src/work_queue/service.ts`                                     | `apps/daemon/src/automation/service.test.ts`, `apps/daemon/src/automation/store.test.ts`, `apps/daemon/src/work_queue/service.test.ts`                               |
| Auto lint / event log                          | replaced | `apps/daemon/src/auto_lint/service.ts`, `apps/daemon/src/event_log/service.ts`                                                                              | `apps/daemon/src/auto_lint/service.test.ts`, `apps/daemon/src/event_log/service.test.ts`                                                                             |
| Onboarding/permissions                         | replaced | `apps/daemon/src/onboarding/service.ts`, `apps/daemon/src/permissions/service.ts`                                                                           | `apps/daemon/src/onboarding/service.test.ts`, `apps/daemon/src/permissions/service.test.ts`                                                                          |
| Audio/voice/transcription/speaker profiles     | retired  | M0 产品决策下线；M8-b 删除 Swift sidecar、Apple SpeechAnalyzer、WhisperKit、speaker profile 残余                                                            | `rg` 删除后无默认源码入口；release note 记录用户可见下线                                                                                                             |
| MDX compile/render path                        | retired  | 用户 2026-06-27 决策彻底移除 MDX 支持，降级为 Markdown 渲染                                                                                                 | web tests/build 基线；release note 记录下线                                                                                                                          |

## M8-b 删除证据

- `apps/web/src-tauri/` 已删除。
- `apps/web/package.json` 不再包含 `@tauri-apps/api`、`@tauri-apps/cli`、`@tauri-apps/plugin-dialog`、`@tauri-apps/plugin-opener`。
- root/package scripts 不再提供默认 Tauri dev/build 入口。
- 四个死 mock 已删除：`AutomationWorkbench.test.tsx`、`SectionAiEngine.test.tsx`、`HistoryFloatingButton.test.tsx`、`App.test.tsx`。
- `useConversation.test.ts` 保留“不 import @tauri-apps/api/event”的守护断言。

## Gate B 判定

PASS。`blocked = 0`，Rust 删除不再被 API parity 阻塞。
