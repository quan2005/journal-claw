# Rust -> TypeScript daemon API parity 矩阵

日期：2026-06-26

用途：作为 `docs/adr/rust-removal-acceptance.md` Gate B 的前置矩阵，逐项核对现有 Rust `#[tauri::command]` 是否已被 TypeScript daemon 同等替代、明确下线或删除。

## 判定规则

- Rust command 来源：`rg -n "#\[tauri::command\]" apps/web/src-tauri/src`，再提取 command 后的 Rust 函数名；本次共 134 个。
- `replaced`：TS daemon 有同等能力，且有 route/service、前端调用点、测试文件三类证据。
- `retired`：产品入口已经从 UI/文档移除，且明确下线。
- `removed`：Rust command 已不存在。
- `blocked`：找不到同等 daemon 实现，或前端用户路径仍通过 Rust/Tauri 可触达。

> 注意：`apps/daemon/src/server.ts` 已有 Agent Run、artifact、memory、changeset、source、workspace metadata 等新主路径，但它们多数不是旧 Tauri command 的同等 API。只要旧用户可见能力仍通过 `apps/web/src/lib/tauri.ts` 或组件直接 `invoke()` 触达，本矩阵按 `blocked` 处理。

## 总览

| 状态 | 数量 |
|---|---:|
| replaced | 1 |
| retired | 16 |
| removed | 0 |
| blocked | 117 |
| 总计 | 134 |

## daemon 已有但不构成旧 API parity 的主要证据

- Agent Run route/service：`apps/daemon/src/server.ts` (`POST /runs`, `GET /runs/:id/events`, `POST /runs/:id/cancel`), `apps/daemon/src/runs/service.ts`, `apps/daemon/src/runs/store.ts`；测试：`apps/daemon/src/runs/service.test.ts`, `apps/daemon/src/runs/store.test.ts`, `apps/daemon/src/runtimes/runner.test.ts`, `apps/daemon/src/runtimes/routes.test.ts`；前端：`apps/web/src/lib/agentRuns.ts`, `apps/web/src/hooks/useAgentRun.ts`, `apps/web/src/components/AgentRunPanel.tsx`, `apps/web/src/tests/AgentRunPanel.test.tsx`。
- ChangeSet / artifact / memory / source route/service：`apps/daemon/src/server.ts` (`/runs/:id/changesets`, `/artifacts`, `/memory`, `/runs/:id/sources`), `apps/daemon/src/changeset/service.ts`, `apps/daemon/src/artifacts/index.ts`, `apps/daemon/src/sediment/service.ts`, `apps/daemon/src/sources/service.ts`；测试分别在同目录 `*.test.ts`。
- Workspace metadata route/service：`apps/daemon/src/server.ts` (`GET/PUT /workspace/meta`, `POST /workspace/goals`, `POST /workspace/sources`), `apps/daemon/src/workspace/service.ts`；测试：`apps/daemon/src/workspace/service.test.ts`, `apps/daemon/src/workspace/context-assembly.test.ts`。
- 当前 HTTP runtime client 只映射旧 command `get_workspace_path`：`apps/web/src/lib/httpRuntimeClient.ts:52`；测试：`apps/web/src/tests/httpRuntimeClient.test.ts:32`。未知 command 会拒绝：`apps/web/src/tests/httpRuntimeClient.test.ts:47`。

## apps/web/src-tauri/src/ai_processor.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `trigger_ai_processing` | `apps/web/src-tauri/src/ai_processor.rs` | 无同等 daemon route；Agent Run `POST /runs` 不能替代“素材 AI 处理队列” | `apps/web/src/lib/tauri.ts:72`, `apps/web/src/App.tsx:637` | `apps/web/src/tests/ipc-contract.test.ts:237`（仅验证 Tauri IPC） | blocked |
| `get_workspace_prompt` | `apps/web/src-tauri/src/ai_processor.rs` | 无同等 daemon route；`WorkspaceService` 只存 workspace meta，不读写 prompt | `apps/web/src/lib/tauri.ts:105`, `apps/web/src/components/SoulView.tsx:17` | `apps/web/src/tests/SoulView.test.tsx:18`（mock Tauri） | blocked |
| `set_workspace_prompt` | `apps/web/src-tauri/src/ai_processor.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:107`, `apps/web/src/components/SoulView.tsx:26` | `apps/web/src/tests/SoulView.test.tsx:30`（mock Tauri） | blocked |
| `reset_workspace_prompt` | `apps/web/src-tauri/src/ai_processor.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:110`, `apps/web/src/components/DetailView.tsx:2219` | `apps/web/src/tests/ipc-contract.test.ts:113`（仅验证 Tauri IPC） | blocked |
| `cancel_ai_processing` | `apps/web/src-tauri/src/ai_processor.rs` | 无同等 daemon route；`POST /runs/:id/cancel` 只取消 Agent Run | `apps/web/src/lib/tauri.ts:116` | `apps/web/src/tests/ipc-contract.test.ts:115`（仅验证 Tauri IPC） | blocked |
| `cancel_queued_item` | `apps/web/src-tauri/src/ai_processor.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:118` | `apps/web/src/tests/ipc-contract.test.ts:260`（仅验证 Tauri IPC） | blocked |
| `trigger_ai_prompt` | `apps/web/src-tauri/src/ai_processor.rs` | 无同等 daemon route；`POST /runs` 是 Agent Run，不是当前 merge identity prompt helper | `apps/web/src/lib/tauri.ts:93`, `apps/web/src/components/MergeIdentityDialog.tsx:3` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/audio_files.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `reveal_in_file_manager` | `apps/web/src-tauri/src/audio_files.rs` | 无同等 daemon route；仍是系统文件管理器能力 | `apps/web/src/lib/tauri.ts:22`, `apps/web/src/components/TreeContextMenu.tsx:3` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/audio_pipeline.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `prepare_audio_for_ai` | `apps/web/src-tauri/src/audio_pipeline.rs` | M0 下线 | — | — | retired |

## apps/web/src-tauri/src/auto_lint.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `get_auto_lint_status` | `apps/web/src-tauri/src/auto_lint.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:432` | `apps/web/src/tests/ipc-contract.test.ts:132`（仅验证 Tauri IPC） | blocked |
| `trigger_lint_now` | `apps/web/src-tauri/src/auto_lint.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:435` | `apps/web/src/tests/ipc-contract.test.ts:133`（仅验证 Tauri IPC） | blocked |

## apps/web/src-tauri/src/automation_commands.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `list_automation_templates` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:438`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `list_routines` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:441`, `apps/web/src/hooks/useAutomation.ts:34` | `apps/web/src/tests/ipc-contract.test.ts:135`（仅验证 Tauri IPC） | blocked |
| `create_routine` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:444`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `update_routine` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:447`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `delete_routine` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:452`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `pause_routine` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:454`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `resume_routine` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:457`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `run_routine_now` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:460`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `list_routine_runs` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:463`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |
| `get_automation_run` | `apps/web/src-tauri/src/automation_commands.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:466`, `apps/web/src/hooks/useAutomation.ts:13` | `apps/web/src/tests/AutomationWorkbench.test.tsx`（mock Tauri） | blocked |

## apps/web/src-tauri/src/config.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `check_whisperkit_cli_installed` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `install_whisperkit_cli` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `get_api_key` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:33` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `set_api_key` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:35` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `open_settings` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route；仍是 host/window 能力 | `apps/web/src/lib/tauri.ts:25`, `apps/web/src/App.tsx:172` | `apps/web/src/tests/ipc-contract.test.ts:108`（仅验证 Tauri IPC） | blocked |
| `get_workspace_path` | `apps/web/src-tauri/src/config.rs` | `GET /workspace` in `apps/daemon/src/server.ts:97`; HTTP mapping `apps/web/src/lib/httpRuntimeClient.ts:52` | `apps/web/src/lib/tauri.ts:37`; daemon path via `apps/web/src/lib/runtimeClient.ts` / `apps/web/src/lib/httpRuntimeClient.ts` | `apps/web/src/tests/httpRuntimeClient.test.ts:32`; `apps/daemon/src/server.test.ts:4` | replaced |
| `set_workspace_path` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route；`PUT /workspace/meta` 不改变 workspace root | `apps/web/src/lib/tauri.ts:39`, `apps/web/src/settings/components/SectionGeneral.tsx:108`, `apps/web/src/components/OnboardingView.tsx:148` | `apps/web/src/tests/ipc-contract.test.ts:178`; `apps/web/src/tests/SectionGeneral.test.tsx`（Tauri mock） | blocked |
| `get_engine_config` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:225`, `apps/web/src/settings/components/SectionAiEngine.tsx` | `apps/web/src/tests/tauri.test.ts:2`; `apps/web/src/tests/SectionAiEngine.test.tsx` | blocked |
| `set_engine_config` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:228`, `apps/web/src/settings/components/SectionAiEngine.tsx` | `apps/web/src/tests/tauri.test.ts:2`; `apps/web/src/tests/SectionAiEngine.test.tsx` | blocked |
| `get_app_version` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:135`, `apps/web/src/settings/components/SectionAbout.tsx:2` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `get_platform_capabilities` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:145`, `apps/web/src/settings/components/SectionPermissions.tsx` | `apps/web/src/tests/SettingsLayout.test.tsx`（settings mock） | blocked |
| `get_asr_config` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `get_apple_stt_variant` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `set_asr_config` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `get_whisperkit_models_dir` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `check_whisperkit_model_downloaded` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `download_whisperkit_model` | `apps/web/src-tauri/src/config.rs` | M0 下线 | — | — | retired |
| `get_feishu_config` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:488` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `set_feishu_config` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:491` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `get_feishu_status` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:494` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `list_models` | `apps/web/src-tauri/src/config.rs` | 无同等 daemon route；`GET /agents` 只列 agent adapter，不列 LLM 模型 | `apps/web/src/lib/tauri.ts:613`, `apps/web/src/settings/components/SectionAiEngine.tsx` | `apps/web/src/tests/SectionAiEngine.test.tsx`（mock Tauri） | blocked |

## apps/web/src-tauri/src/conversation.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `conversation_create` | `apps/web/src-tauri/src/conversation.rs` | 局部相关：`POST /runs` (`apps/daemon/src/server.ts:166`)；不等同旧 session conversation API | `apps/web/src/lib/tauri.ts:539`, `apps/web/src/hooks/useConversation.ts:798` | `apps/daemon/src/runs/service.test.ts`; `apps/web/src/hooks/useConversation.test.ts` 仍 mock Tauri | blocked |
| `conversation_send` | `apps/web/src-tauri/src/conversation.rs` | 局部相关：`POST /runs` + SSE；不等同向既有 session 发送消息 | `apps/web/src/lib/tauri.ts:550`, `apps/web/src/hooks/useConversation.ts:929` | `apps/daemon/src/runtimes/runner.test.ts`; `apps/web/src/hooks/useConversation.test.ts` 仍 mock Tauri | blocked |
| `conversation_cancel` | `apps/web/src-tauri/src/conversation.rs` | 局部相关：`POST /runs/:id/cancel` (`apps/daemon/src/server.ts:357`)；旧 ChatPanel 仍用 Tauri session id | `apps/web/src/lib/tauri.ts:557`, `apps/web/src/hooks/useConversation.ts:762`, `apps/web/src/hooks/useConversation.ts:993` | `apps/daemon/src/runs/service.test.ts:108`; `apps/daemon/src/runtimes/runner.test.ts:239`; 前端 Chat 仍 mock Tauri | blocked |
| `conversation_close` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:560`, `apps/web/src/hooks/useConversation.ts:768` | `apps/web/src/hooks/useConversation.test.ts`（mock Tauri） | blocked |
| `conversation_inject` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:563` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `conversation_truncate` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:566`, `apps/web/src/hooks/useConversation.ts:1014` | `apps/web/src/hooks/useConversation.test.ts`（mock Tauri） | blocked |
| `conversation_retry` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:569`, `apps/web/src/hooks/useConversation.ts:967` | `apps/web/src/hooks/useConversation.test.ts`（mock Tauri） | blocked |
| `conversation_get_stats` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:609`, `apps/web/src/hooks/useConversation.ts:742` | `apps/web/src/hooks/useConversation.test.ts`（mock Tauri） | blocked |
| `conversation_list` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route；daemon 没有 list runs route | `apps/web/src/lib/tauri.ts:581`, `apps/web/src/components/SessionList.tsx:30`, `apps/web/src/components/HistoryFloatingButton.tsx:23` | `apps/web/src/tests/HistoryFloatingButton.test.tsx`（mock Tauri） | blocked |
| `conversation_rename` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:584` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `conversation_delete` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:587`, `apps/web/src/components/SessionList.tsx:109`, `apps/web/src/components/HistoryFloatingButton.tsx:119` | `apps/web/src/tests/HistoryFloatingButton.test.tsx`（mock Tauri） | blocked |
| `conversation_get_messages` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route；daemon 仅有 event stream replay 内部 store，无 HTTP messages API | `apps/web/src/lib/tauri.ts:600`, `apps/web/src/hooks/useConversation.ts:626` | `apps/web/src/hooks/useConversation.test.ts`（mock Tauri） | blocked |
| `conversation_load` | `apps/web/src-tauri/src/conversation.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:597` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/directive_migration.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `scan_legacy_directive_files` | `apps/web/src-tauri/src/directive_migration.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:61`, `apps/web/src/settings/components/SectionGeneral.tsx` | `apps/web/src/tests/directiveMigration.test.ts`; `apps/web/src/tests/SectionGeneral.test.tsx`（front helper/mock，不是 daemon） | blocked |
| `apply_directive_migration` | `apps/web/src-tauri/src/directive_migration.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:64`, `apps/web/src/settings/components/SectionGeneral.tsx` | `apps/web/src/tests/directiveMigration.test.ts`; `apps/web/src/tests/SectionGeneral.test.tsx`（front helper/mock，不是 daemon） | blocked |

## apps/web/src-tauri/src/event_log.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `get_events_since` | `apps/web/src-tauri/src/event_log.rs` | 局部相关：daemon `GET /events` 是 SSE heartbeat，不支持 seq catch-up | `apps/web/src/lib/tauri.ts:733`, `apps/web/src/hooks/useEventSync.ts:22` | `apps/web/src/tests/useJournal.test.ts:35`（mock Tauri） | blocked |

## apps/web/src-tauri/src/identity.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `list_identities` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route；`/memory` 是 run sediment memory，不是 identity library | `apps/web/src/lib/tauri.ts:331`, `apps/web/src/hooks/useIdentity.ts:12`, `apps/web/src/components/MergeIdentityDialog.tsx:23` | `apps/web/src/tests/ipc-contract.test.ts:129`（仅验证 Tauri IPC） | blocked |
| `get_identity_content` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:334` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `save_identity_content` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:337` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `delete_identity` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:340`, `apps/web/src/components/TreeSidebar.tsx:10` | `apps/web/src/tests/TreeSidebar.test.tsx`（mock Tauri） | blocked |
| `archive_identity` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:343`, `apps/web/src/components/TreeSidebar.tsx:10` | `apps/web/src/tests/TreeSidebar.test.tsx`（mock Tauri） | blocked |
| `unarchive_identity` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:346`, `apps/web/src/components/TreeSidebar.tsx:10` | `apps/web/src/tests/TreeSidebar.test.tsx`（mock Tauri） | blocked |
| `create_identity` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:349` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `merge_identity` | `apps/web/src-tauri/src/identity.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:357`, `apps/web/src/components/MergeIdentityDialog.tsx:3` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/journal.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `list_journal_entries` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | 未找到 `apps/web/src` 调用；Rust command 仍注册 | 无 daemon parity test | blocked |
| `list_all_journal_entries` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:47`, `apps/web/src/App.tsx:801`, `apps/web/src/App.tsx:1011` | `apps/web/src/tests/ipc-contract.test.ts:112`; `apps/web/src/tests/App.test.tsx`（mock Tauri） | blocked |
| `list_available_months` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:42`, `apps/web/src/hooks/useJournal.ts:99` | `apps/web/src/tests/useJournal.test.ts:63`; `apps/web/src/tests/ipc-contract.test.ts:111` | blocked |
| `list_journal_entries_by_months` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:44`, `apps/web/src/hooks/useJournal.ts:108` | `apps/web/src/tests/useJournal.test.ts:64`; `apps/web/src/tests/ipc-contract.test.ts:188` | blocked |
| `list_journal_entries_paginated` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:49` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `get_journal_entry_content` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route；ChangeSet/artifact services 不提供 arbitrary journal read API | `apps/web/src/lib/tauri.ts:55`, `apps/web/src/components/DetailView.tsx:1153`, `apps/web/src/components/mdx/html-preview.tsx:48` | `apps/web/src/tests/ipc-contract.test.ts:195`; `apps/web/src/tests/DetailView.test.tsx:198`; `apps/web/src/tests/MdxPreviewComponents.test.tsx:72` | blocked |
| `save_journal_entry_content` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | 未找到 `apps/web/src` 调用；Rust command 仍注册 | 无 daemon parity test | blocked |
| `delete_journal_entry` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route；ChangeSet revert 不替代用户删除 journal entry API | `apps/web/src/lib/tauri.ts:75`, `apps/web/src/components/TreeSidebar.tsx:545` | `apps/web/src/tests/ipc-contract.test.ts:202`; `apps/web/src/tests/TreeSidebar.test.tsx` | blocked |
| `create_sample_entry` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:278` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `create_sample_entry_if_needed` | `apps/web/src-tauri/src/journal.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:275` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/main.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `open_with_system` | `apps/web/src-tauri/src/main.rs` | 无同等 daemon route；仍是 host/system open 能力 | `apps/web/src/lib/tauri.ts:112`, `apps/web/src/components/MarkdownRenderer.tsx:478` | `apps/web/src/tests/ipc-contract.test.ts:302`; `apps/web/src/tests/MdxRenderer.test.tsx:297` | blocked |

## apps/web/src-tauri/src/materials.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `import_file` | `apps/web/src-tauri/src/materials.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:68`, `apps/web/src/lib/tauri.ts:121`, `apps/web/src/App.tsx:643` | `apps/web/src/tests/ipc-contract.test.ts:212`; `apps/web/src/tests/App.test.tsx:100` | blocked |
| `import_text_temp` | `apps/web/src-tauri/src/materials.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:78` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `import_image_temp` | `apps/web/src-tauri/src/materials.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:86` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `import_text` | `apps/web/src-tauri/src/materials.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:82`, `apps/web/src/components/ChatPanel.tsx:29` | `apps/web/src/tests/ChatPanel.test.tsx`（mock Tauri） | blocked |

## apps/web/src-tauri/src/mdx.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `compile_mdx` | `apps/web/src-tauri/src/mdx.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:58` | `apps/web/src/tests/mdx-pipeline-integration.test.ts:9`; `apps/web/src/tests/mdx-block-compiler.test.ts:9`（front tests，非 daemon） | blocked |

## apps/web/src-tauri/src/onboarding.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `get_onboarding_status` | `apps/web/src-tauri/src/onboarding.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:286`, `apps/web/src/hooks/useOnboarding.ts` | `apps/web/src/tests/App.test.tsx`（mock Tauri） | blocked |
| `complete_onboarding` | `apps/web/src-tauri/src/onboarding.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:289`, `apps/web/src/hooks/useOnboarding.ts` | `apps/web/src/tests/App.test.tsx`（mock Tauri） | blocked |
| `set_onboarding_step` | `apps/web/src-tauri/src/onboarding.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:291`, `apps/web/src/hooks/useOnboarding.ts` | `apps/web/src/tests/App.test.tsx`（mock Tauri） | blocked |
| `reset_onboarding` | `apps/web/src-tauri/src/onboarding.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:294`, `apps/web/src/settings/components/SectionAbout.tsx:2` | `apps/web/src/tests/App.test.tsx`（mock Tauri） | blocked |

## apps/web/src-tauri/src/permissions.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `check_app_permissions` | `apps/web/src-tauri/src/permissions.rs` | 无同等 daemon route；speech permission UI 仍可触达 | `apps/web/src/lib/tauri.ts:324`, `apps/web/src/settings/components/SectionPermissions.tsx:191` | `apps/web/src/tests/ipc-contract.test.ts:128`; `apps/web/src/tests/SettingsLayout.test.tsx` | blocked |
| `request_permission` | `apps/web/src-tauri/src/permissions.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:318`, `apps/web/src/settings/components/SectionPermissions.tsx:221` | `apps/web/src/tests/ipc-contract.test.ts:398`; `apps/web/src/tests/SettingsLayout.test.tsx` | blocked |
| `open_privacy_settings` | `apps/web/src-tauri/src/permissions.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:327`, `apps/web/src/settings/components/SectionPermissions.tsx` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/skills.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `list_skills` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route；daemon context assembly 不提供 skill catalog API | `apps/web/src/lib/tauri.ts:521`, `apps/web/src/components/SkillsWorkbench.tsx:347`, `apps/web/src/lib/slashCommands.ts:19` | `apps/web/src/tests/ipc-contract.test.ts:138`; `apps/web/src/tests/AtMentionMenu.test.tsx`（部分 mock） | blocked |
| `get_skill_content` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:535`, `apps/web/src/components/SkillsWorkbench.tsx` | `apps/web/src/tests/SkillsWorkbench` 未找到；无 daemon parity test | blocked |
| `open_skills_dir` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:523`, `apps/web/src/components/SkillsWorkbench.tsx` | 无 daemon parity test | blocked |
| `open_skill_dir` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:526`, `apps/web/src/components/SkillsWorkbench.tsx` | 无 daemon parity test | blocked |
| `list_workspace_dir` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route；daemon 没有 workspace file listing route | `apps/web/src/lib/tauri.ts:663` | 无 daemon parity test | blocked |
| `list_at_mention_candidates` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:679`, `apps/web/src/components/AtMentionMenu.tsx:130` | `apps/web/src/tests/AtMentionMenu.test.tsx`（mock Tauri） | blocked |
| `workspace_duplicate_file` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route；ChangeSet snapshot/revert 不提供 direct duplicate API | `apps/web/src/lib/tauri.ts:685` | 无 daemon parity test | blocked |
| `workspace_rename_file` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:688` | 无 daemon parity test | blocked |
| `workspace_move_file` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:691` | 无 daemon parity test | blocked |
| `workspace_delete_file` | `apps/web/src-tauri/src/skills.rs` | 无同等 daemon route；daemon ChangeSet revert 不是 user-invoked delete API | `apps/web/src/lib/tauri.ts:694` | 无 daemon parity test | blocked |

## apps/web/src-tauri/src/speaker_profiles.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `check_speaker_embedder` | `apps/web/src-tauri/src/speaker_profiles.rs` | M0 下线 | — | — | retired |
| `get_speaker_profiles` | `apps/web/src-tauri/src/speaker_profiles.rs` | M0 下线 | — | — | retired |
| `update_speaker_name` | `apps/web/src-tauri/src/speaker_profiles.rs` | M0 下线 | — | — | retired |
| `delete_speaker_profile` | `apps/web/src-tauri/src/speaker_profiles.rs` | M0 下线 | — | — | retired |
| `merge_speaker_profiles` | `apps/web/src-tauri/src/speaker_profiles.rs` | M0 下线 | — | — | retired |

## apps/web/src-tauri/src/todos.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `list_todos` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:364`, `apps/web/src/hooks/useTodos.ts:22` | `apps/web/src/tests/ipc-contract.test.ts:130`; `apps/web/src/tests/IdeasWorkbench.test.tsx`（context/mock） | blocked |
| `add_todo` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:366`, `apps/web/src/hooks/useTodos.ts:42`, `apps/web/src/App.tsx:809` | `apps/web/src/tests/ipc-contract.test.ts:459`; `apps/web/src/tests/IdeasWorkbench.test.tsx:192` | blocked |
| `toggle_todo` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:379`, `apps/web/src/hooks/useTodos.ts` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `delete_todo` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:382`, `apps/web/src/hooks/useTodos.ts` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `set_todo_due` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:385`, `apps/web/src/hooks/useTodos.ts` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `set_todo_path` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:391`, `apps/web/src/hooks/useTodos.ts` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `set_todo_session_id` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:400`, `apps/web/src/hooks/useTodos.ts` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `remove_todo_path` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:397`, `apps/web/src/hooks/useTodos.ts` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `update_todo_text` | `apps/web/src-tauri/src/todos.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:406`, `apps/web/src/hooks/useTodos.ts` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/topics.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `list_topics_dir` | `apps/web/src-tauri/src/topics.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:707`, `apps/web/src/hooks/useTopics.ts:64`, `apps/web/src/components/TreeSidebar.tsx:363` | `apps/web/src/tests/useTopics.test.tsx:89`; `apps/web/src/tests/App.test.tsx:331` | blocked |
| `create_topic` | `apps/web/src-tauri/src/topics.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:710`, `apps/web/src/hooks/useTopics.ts` | `apps/web/src/tests/TopicTree.test.tsx`（type/mock only） | blocked |
| `delete_topic` | `apps/web/src-tauri/src/topics.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:713`, `apps/web/src/components/TreeSidebar.tsx:550` | `apps/web/src/tests/TreeSidebar.test.tsx`（mock Tauri） | blocked |
| `import_file_to_topic` | `apps/web/src-tauri/src/topics.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:716` | 无 daemon parity test | blocked |

## apps/web/src-tauri/src/transcription.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `get_transcript` | `apps/web/src-tauri/src/transcription.rs` | M0 下线 | — | — | retired |
| `retry_transcription` | `apps/web/src-tauri/src/transcription.rs` | M0 下线 | — | — | retired |

## apps/web/src-tauri/src/work_queue.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `enqueue_work` | `apps/web/src-tauri/src/work_queue.rs` | 无同等 daemon route；Agent Run `POST /runs` 不等同 work queue item | `apps/web/src/lib/tauri.ts:633` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `list_work_queue` | `apps/web/src-tauri/src/work_queue.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:646` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `cancel_work_item` | `apps/web/src-tauri/src/work_queue.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:648` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `retry_work_item` | `apps/web/src-tauri/src/work_queue.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:651` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `dismiss_work_item` | `apps/web/src-tauri/src/work_queue.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:653` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |

## apps/web/src-tauri/src/workspace_settings.rs

| Rust command | 模块文件 | TS daemon route/service | 前端调用点 | 测试文件 | 状态 |
|---|---|---|---|---|---|
| `get_workspace_theme` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/hooks/useTheme.ts`（via runtime client/Tauri command） | `apps/web/src/tests/runtimeClient.test.ts`; `apps/web/src/tests/tauri.test.ts` | blocked |
| `set_workspace_theme` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/hooks/useTheme.ts:53`（direct invoke） | `apps/web/src/tests/runtimeClient.test.ts`; `apps/web/src/tests/tauri.test.ts` | blocked |
| `get_auto_lint_config` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:426` | `apps/web/src/tests/ipc-contract.test.ts:131`（仅验证 Tauri IPC） | blocked |
| `set_auto_lint_config` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:429` | `apps/web/src/tests/ipc-contract.test.ts`（legacy wrapper 覆盖不完整） | blocked |
| `get_global_skills_enabled` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:470`, `apps/web/src/components/SkillsWorkbench.tsx` | 无 daemon parity test | blocked |
| `set_global_skills_enabled` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:473`, `apps/web/src/components/SkillsWorkbench.tsx` | 无 daemon parity test | blocked |
| `set_skill_enabled` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:529`, `apps/web/src/components/SkillsWorkbench.tsx` | 无 daemon parity test | blocked |
| `set_global_skill_enabled` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:532`, `apps/web/src/components/SkillsWorkbench.tsx` | 无 daemon parity test | blocked |
| `get_pinned_items` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:727`, `apps/web/src/hooks/usePinned.ts:10`, `apps/web/src/components/TreeSidebar.tsx:341` | `apps/web/src/tests/App.test.tsx:67`; `apps/web/src/tests/TreeSidebar.test.tsx`（mock Tauri） | blocked |
| `set_pinned_items` | `apps/web/src-tauri/src/workspace_settings.rs` | 无同等 daemon route | `apps/web/src/lib/tauri.ts:729`, `apps/web/src/hooks/usePinned.ts:26` | `apps/web/src/tests/App.test.tsx:68`; `apps/web/src/tests/TreeSidebar.test.tsx`（mock Tauri） | blocked |

## blocked 列表

blocked 共 117 个：

`trigger_ai_processing`, `get_workspace_prompt`, `set_workspace_prompt`, `reset_workspace_prompt`, `cancel_ai_processing`, `cancel_queued_item`, `trigger_ai_prompt`, `reveal_in_file_manager`, `get_auto_lint_status`, `trigger_lint_now`, `list_automation_templates`, `list_routines`, `create_routine`, `update_routine`, `delete_routine`, `pause_routine`, `resume_routine`, `run_routine_now`, `list_routine_runs`, `get_automation_run`, `get_api_key`, `set_api_key`, `open_settings`, `set_workspace_path`, `get_engine_config`, `set_engine_config`, `get_app_version`, `get_platform_capabilities`, `get_feishu_config`, `set_feishu_config`, `get_feishu_status`, `list_models`, `conversation_create`, `conversation_send`, `conversation_cancel`, `conversation_close`, `conversation_inject`, `conversation_truncate`, `conversation_retry`, `conversation_get_stats`, `conversation_list`, `conversation_rename`, `conversation_delete`, `conversation_get_messages`, `conversation_load`, `scan_legacy_directive_files`, `apply_directive_migration`, `get_events_since`, `list_identities`, `get_identity_content`, `save_identity_content`, `delete_identity`, `archive_identity`, `unarchive_identity`, `create_identity`, `merge_identity`, `list_journal_entries`, `list_all_journal_entries`, `list_available_months`, `list_journal_entries_by_months`, `list_journal_entries_paginated`, `get_journal_entry_content`, `save_journal_entry_content`, `delete_journal_entry`, `create_sample_entry`, `create_sample_entry_if_needed`, `open_with_system`, `import_file`, `import_text_temp`, `import_image_temp`, `import_text`, `compile_mdx`, `get_onboarding_status`, `complete_onboarding`, `set_onboarding_step`, `reset_onboarding`, `check_app_permissions`, `request_permission`, `open_privacy_settings`, `list_skills`, `get_skill_content`, `open_skills_dir`, `open_skill_dir`, `list_workspace_dir`, `list_at_mention_candidates`, `workspace_duplicate_file`, `workspace_rename_file`, `workspace_move_file`, `workspace_delete_file`, `list_todos`, `add_todo`, `toggle_todo`, `delete_todo`, `set_todo_due`, `set_todo_path`, `set_todo_session_id`, `remove_todo_path`, `update_todo_text`, `list_topics_dir`, `create_topic`, `delete_topic`, `import_file_to_topic`, `enqueue_work`, `list_work_queue`, `cancel_work_item`, `retry_work_item`, `dismiss_work_item`, `get_workspace_theme`, `set_workspace_theme`, `get_auto_lint_config`, `set_auto_lint_config`, `get_global_skills_enabled`, `set_global_skills_enabled`, `set_skill_enabled`, `set_global_skill_enabled`, `get_pinned_items`, `set_pinned_items`。

## 对照 §12 一票否决项

来源：`docs/adr/rust-removal-acceptance.md` §12。

| 一票否决项 | 当前是否命中 | 证据 |
|---|---|---|
| 仍需要 Rust/Tauri 才能启动默认桌面应用。 | 命中 | `package.json` 仍有 `npm run tauri dev` / `tauri build` 路径；`apps/web/src/lib/tauri.ts:1` 仍 import `@tauri-apps/api/core`；Gate A 也要求默认桌面不依赖 Tauri/Rust。 |
| 用户可见能力仍只存在于 Rust command。 | 命中 | 本矩阵 133 个 `blocked`，覆盖 journal、topics、todos、identity、settings、audio、automation、conversation history 等用户路径。 |
| Agent Run 主路径仍经过 Rust conversation/tool_loop。 | 部分命中 | 新 Agent Run 面板走 daemon：`apps/web/src/lib/agentRuns.ts`；但 ChatPanel/useConversation 仍调用 Rust conversation commands：`apps/web/src/hooks/useConversation.ts:798`, `apps/web/src/hooks/useConversation.ts:929`。 |
| Claude Code、Codex CLI、OpenCode 任一首批 adapter 没有基础验收。 | 命中 | daemon 有 `claude`、`opencode` adapter tests；`codex` 仅见 `apps/daemon/src/runtimes/defs/codex.ts` 与 `apps/daemon/src/runtimes/stream/codexStream.ts`，未见对应 `codex*.test.ts`。 |
| ChangeSet 或自动沉淀缺少恢复路径。 | 未命中（代码层面已有基础） | ChangeSet revert route：`apps/daemon/src/server.ts:463`；memory reject/restore routes：`apps/daemon/src/server.ts:443`, `apps/daemon/src/server.ts:453`；测试：`apps/daemon/src/changeset/service.test.ts`, `apps/daemon/src/sediment/service.test.ts`。仍需真实任务验收。 |
| 删除仍依赖系统 Trash。 | 未能证实为 daemon 主路径命中；Rust 旧删除仍需另查实现细节 | 本矩阵未发现 daemon 删除 API；旧 Rust `delete_*` / `workspace_delete_file` 仍 blocked。是否调用系统 Trash 需在 Rust 删除实现中继续核查。 |
| 默认 build/test 需要 Apple Speech、Whisper、ffmpeg 或平台专属二进制。 | 命中风险 | `config.rs`/`permissions.rs`/`speaker_profiles.rs`/`audio_pipeline.rs` 多个语音、WhisperKit、Apple STT command 仍 blocked，且设置 UI 可触达。 |
| 没有 API parity 矩阵。 | 未命中 | 本文件即 `docs/adr/rust-api-parity.md`。 |
| 没有真实任务验收记录。 | 命中 | 本文件只建立 API parity 矩阵，未发现 Gate I 的真实任务验收记录。 |
| 没有回滚计划。 | 命中 | 本文件未发现 Rust 删除回滚计划文档；Gate J 仍未满足。 |

## 结论

Gate B 当前不通过。`blocked` 必须降为 0，或者逐项有明确 `retired`/`removed` 证据后，才允许进入 Rust 后端删除阶段。
