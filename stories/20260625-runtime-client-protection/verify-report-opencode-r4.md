# 验收报告 — STORY-20260625-runtime-client-protection（轮次 4）

- **核对范围（严格限定）**：`apps/web/src/hooks/useConversation.ts`
- **design.md**：本任务无
- **证据来源**：范围文件静态阅读 + grep + 测试运行 + 范围外佐证文件（`apps/web/src/lib/runtimeClient.ts`，仅用于关闭 AC 的 transport-default 子项，已标注越界）
- **独立 subAgent**：是。结论仅基于输入契约与指定范围取证，未采纳实现者自述。

> 路径说明：story.md frontmatter 引用 `src/hooks/useConversation.ts` / `src/lib/tauri.ts` 是 monorepo 化（commit `6d66228 refactor!: monorepo 化`）之前的旧路径，当前真实位置为 `apps/web/src/...`。本次核对以 `apps/web/src/hooks/useConversation.ts` 为准。

---

## result: pass

---

## 逐项核对

### AC-1 — 现有对话路径保持可用 → PASS（范围证据充分）

| 子项                        | 结论                               | 证据                                                                                                                                                                                                                    |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 创建/发送/取消/重试行为一致 | PASS                               | `useConversation.ts:5-15` 仍导入 `conversationCreate/Send/Cancel/Close/GetMessages/Truncate/Retry/GetStats`（来自 `../lib/tauri`）；`createTab:795-809`、`send:838-952`、`retry:954-987`、`cancel:989-999` 调用形态未变 |
| 事件处理保持一致            | PASS                               | 事件 reducer 完整保留：`turn_start/text_delta/thinking_delta/tool_start/tool_end/web_search_result/done/error/truncated/loop_warning/subtask_*/title/usage`，见 `useConversation.ts:150-592`                            |
| 不要求启动 TS daemon        | PASS（范围）／ 待裁决（transport） | 范围文件内未直接 invoke daemon；subscription 经 `selectRuntimeClient()` 解耦。但 **当前 HEAD 的 `runtimeClient.ts` 已默认走 HTTP daemon**（见下方"待裁决 #1"），这是本 story 之后的 M8-a 迁移所致，非本 story 引入      |

### AC-2 — 组件不再直接绑定 Tauri event 订阅 → PASS（核心交付达成）

| 子项                                                                 | 结论   | 证据                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useConversation` 通过统一 runtime client 订阅 `conversation-stream` | PASS   | `useConversation.ts:2` `import { selectRuntimeClient } from '../lib/runtimeClient'`；`:146` `const client = selectRuntimeClient()`；`:147` `client.subscribe<ConversationStreamPayload>('conversation-stream', ...)`；unsubscribe 在 `:595-597` 同步释放 |
| 无直接 Tauri event API 绑定                                          | PASS   | grep `@tauri-apps/api`、`tauri.*listen`、`invoke(` 在范围内文件 **0 命中**；测试 `useConversation.test.ts:52-56` 静态断言源码不含 `@tauri-apps/api/event`                                                                                                |
| 订阅路径可测且通过                                                   | PASS   | `npx vitest run src/hooks/useConversation.test.ts` → **5/5 passed**；含 `subscribes to conversation-stream via runtime client`（`:58-63`）、`unsubscribes on unmount`（`:105-110`）                                                                      |
| 底层默认实现仍走 Tauri                                               | 待裁决 | 见"待裁决 #1"——当前 HEAD 默认为 HTTP daemon（后置 M8-a 迁移）。**本 story 的保护层目标（解耦）已 100% 达成**；transport 默认值的变更归属后续 story                                                                                                       |

### AC-3 — 外部 API 不破坏 → PASS（范围内可验证部分）

| 子项                                          | 结论                 | 证据                                                                                            |
| --------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `../lib/tauri` 既有导出在 hook 内仍被兼容消费 | PASS                 | `useConversation.ts:4-15` 导入的函数/类型签名均按原形态调用（见 AC-1 第一行证据），无破坏性用法 |
| `tauri.ts` 对外函数签名保持兼容               | 越界（不在本次范围） | 本次范围仅 useConversation.ts。`apps/web/src/lib/tauri.ts`（25KB）签名核对超出指定范围，未核    |
| 不引入 HTTP daemon 作为默认路径               | 待裁决               | useConversation.ts 本身未引入；transport 默认值由 runtimeClient.ts 决定（后置迁移已变，见 #1）  |

### AC-4 — 小范围独占修改 → PASS（范围内）

| 子项                                         | 结论         | 证据                                                                                                                                                                               |
| -------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 范围文件改动自洽、无越界                     | PASS         | useConversation.ts 改动仅落在订阅接线（`:2`、`:142-147`、`:595-605`），其余 reducer 与会话管理逻辑无结构性重写                                                                     |
| 未修改 Rust / 未新增 daemon / 未改 ChatPanel | PASS（范围） | 范围文件为前端 hook，无 Rust、无 daemon 创建、无 ChatPanel 视觉/业务结构改动                                                                                                       |
| 全仓范围合规性                               | 越界         | 单文件核对无法判定全仓 diff；git log 显示本 story 对应 commit `4d973c8 feat: agent runtime migration — phase 0 contracts + phase 1 runtime client`，后续 `e601530`（G5）为独立迁移 |

---

## 越界 / 偏差清单

1. **越界取证（已标注）**：为关闭 AC-2「底层默认实现仍走 Tauri」子项，阅读了范围外文件 `apps/web/src/lib/runtimeClient.ts`。结论记录于"待裁决 #1"，未据此改动范围结论。
2. **未发现范围文件内的实现越界**：无 AgentRunEvent / ChangeSet / AuthorizationMode / 自动沉淀 / ChatPanel 重写等 Won't 项的痕迹。

---

## 待用户裁决

### #1 — AC-1/AC-2 的「默认 transport = Tauri」在当前 HEAD 已不成立

- **事实**：`apps/web/src/lib/runtimeClient.ts:6,36-41` 注释明确 "M8-a removes the Tauri IPC fallback: runtime calls now always use the TS daemon over HTTP + SSE"；`selectRuntimeClient()` 返回 `HttpRuntimeClient`，`readRuntimeKind()` 返回 `'http'`。
- **归属**：本 story（commit `4d973c8`，2026-06-25）完成时默认确为 Tauri；HTTP daemon 默认化由后续 M8-a（commit `e601530`，ADR `docs/adr/rust-removal-roadmap.md`，M8-b 2026-06-27 删除 Rust/Tauri）引入。
- **本 story 立场**：保护层（解耦）目标已完整达成——useConversation.ts 不再耦合任何具体 transport，transport 切换是 runtimeClient.ts 单点变更，未触及 hook。这正是本 story 的设计意图。
- **裁决点**：本 story 的 AC 字面「仍走 Tauri」是否需按"完成时快照"判定（PASS），还是按"当前 HEAD"判定（与字面不符）？独立 subAgent 倾向前者（按完成时快照 + 后置迁移已独立追踪），但最终由用户裁决。

### #2 — AC-3「tauri.ts 签名兼容」未在本次范围内核对

- 本次范围仅 useConversation.ts。如需闭环 AC-3 第二子项，需追加核对 `apps/web/src/lib/tauri.ts` 对外导出签名。是否扩展范围由用户决定。

---

## 摘要

`result: pass | fail 项: 0 | 待裁决项: 2`
