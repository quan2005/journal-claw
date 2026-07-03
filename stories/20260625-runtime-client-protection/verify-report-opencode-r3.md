# 验收报告 — STORY-20260625-runtime-client-protection（R3）

- **轮次**：1（独立 subAgent，opencode-r3）
- **核对范围**：`apps/web/src/hooks/useConversation.ts`（仅此一个文件，由提示词指定）
- **契约**：`story.md`（本任务无 design.md）
- **日期**：2026-07-01

## 范围声明

本次核对**仅**审查 `apps/web/src/hooks/useConversation.ts`。story.md 中多条 AC 的完整判定依赖 `src/lib/runtimeClient.ts` 与 `src/lib/tauri.ts`，二者**不在本次核对范围**。凡结论需要这两个文件支撑的，一律标注「待用户裁决」，不臆断。

另：仓库已演进至 M8-a/M8-b 终局（AGENTS.md：「Tauri/Rust 后端已删除」），当前 `runtimeClient.ts` 默认已切到 HTTP daemon。这与 story 写作时（Phase 1，默认仍走 Tauri）的语境不同。本报告只就被指定文件的事实作证，不替用户裁决「应以 story 原意还是以当前终局架构为基准」。

---

## AC 逐项核对

### AC-1 — 现有对话路径保持可用

| 子句 | 结论 | 证据 |
|---|---|---|
| 创建/发送/取消/重试路径保留 | **pass（文件内）** | `useConversation.ts:5-14` 仍从 `../lib/tauri` 导入 `conversationCreate/Send/Cancel/Retry/Close/GetMessages/Truncate/GetStats`；`send` (838)、`retry` (954)、`cancel` (989)、`createTab` (795)、`openTab` (610) 均调用这些函数，行为链路完整 |
| 前端事件处理保持一致 | **pass（文件内）** | reducer 对 `turn_start/text_delta/thinking_delta/tool_start/tool_end/web_search_result/done/error/truncated/loop_warning/subtask_*/title/usage` 的处理逻辑完整保留（148-592） |
| 不要求启动 TS daemon | **待用户裁决** | useConversation 本身不启动任何 daemon，仅调用 `selectRuntimeClient()`（146）做传输解耦。但「是否需要 daemon」由 `runtimeClient.ts` 的默认选择决定，**超出本文件范围**。注：范围外观察——当前 `runtimeClient.ts:36-38` 默认返回 `HttpRuntimeClient`，与 story Phase-1「默认仍走 Tauri」语境不一致（疑为后续 M8-a 演进所致） |

### AC-2 — 组件不再直接绑定 Tauri event 订阅（本 story 核心）

| 子句 | 结论 | 证据 |
|---|---|---|
| `useConversation` 通过统一 runtime client 订阅 `conversation-stream` | **pass** | `useConversation.ts:2` `import { selectRuntimeClient } from '../lib/runtimeClient'`；`146` `const client = selectRuntimeClient()`；`147` `client.subscribe<ConversationStreamPayload>('conversation-stream', …)` |
| 不再直接绑定 Tauri event API | **pass** | `rg "@tauri-apps/api/event\|listen(\|emit(\|@tauri-apps/api"` → `NO_MATCH`；全文无 `@tauri-apps/api` 导入，唯一订阅点为 147 行的 `client.subscribe` |
| unsubscribe 正确释放 | **pass** | `147` `const off = client.subscribe(...)`；`595-597` effect cleanup `return () => { off() }`，与 runtimeClient 契约「subscribe 返回同步 unsubscribe」一致（runtimeClient.ts:8-11,16） |
| 底层默认实现仍走 Tauri | **待用户裁决** | 此句判定对象是 `runtimeClient.ts` 的默认实现，**不在指定核对范围**。范围外观察：`runtimeClient.ts:36-38` 当前默认为 `HttpRuntimeClient`（非 Tauri）。这与 story 原意相悖，但符合 AGENTS.md 所述 M8-a/M8-b 终局。以 story 原意为准则 fail，以当前终局为准则属预期——需用户裁决基准 |

### AC-3 — 外部 API 不破坏

| 子句 | 结论 | 证据 |
|---|---|---|
| `src/lib/tauri.ts` 既有导出签名保持兼容 | **待用户裁决** | 判定对象是 `src/lib/tauri.ts`，**不在指定核对范围**。仅能从消费侧旁证：useConversation.ts:5-15 对 `conversationCreate/Send/Cancel/Close/GetMessages/Truncate/Retry/GetStats` 及类型 `ImageAttachment/SessionStats` 的导入与原签名一致，未发现消费侧破坏 |
| 不引入 HTTP daemon 作为默认路径 | **待用户裁决** | 同 AC-2，判定对象在 runtimeClient.ts（范围外）。范围外观察：当前默认已是 HTTP daemon |

### AC-4 — 小范围独占修改

| 子句 | 结论 | 证据 |
|---|---|---|
| useConversation.ts 属于允许修改范围 | **pass** | story AC-4 明列 `src/hooks/useConversation.ts` 在允许范围内 |
| 本文件未越界改 Rust / 新增 daemon / 改 ChatPanel | **pass** | 文件为纯 React hook，无 Rust、无 daemon 启动代码、无 ChatPanel 视觉/业务结构改动 |
| 完整范围合规性（含 runtimeClient.ts/tauri.ts） | **待用户裁决** | 另两个允许文件不在本次核对范围，无法下结论 |

---

## Won't 边界核对（仅就被指定文件）

| Won't 项 | 结论 | 证据 |
|---|---|---|
| 不为最终用户新增功能 | pass | 本文件为迁移保护层，无新功能入口 |
| 不启用 HTTP daemon 默认路径 / 不新增 TS daemon / 不接 CLI adapter | 待用户裁决 | 文件内未启用/新增/接入，但默认路径开关在范围外 runtimeClient.ts |
| 不实现 AgentRunEvent/ChangeSet/AuthorizationMode/自动沉淀 | pass | 文件内无相关实现 |
| 不重写 ChatPanel / 不删除 Rust | pass | 文件内无相关动作 |

---

## 越界 / 偏差清单

被指定文件本身**未发现越界**。唯一值得记录的偏差属于范围外观察（不作为本文件 fail 依据）：

- 范围外 `runtimeClient.ts` 默认已切 HTTP daemon，与 story Phase-1「默认仍走 Tauri / 不要求启动 TS daemon」原意不一致。此为 M8-a/M8-b 终局演进结果（见 AGENTS.md、docs/adr/rust-removal-roadmap.md），非本文件实现缺陷。

## 待用户裁决项

1. **基准选择**：AC-1「不要求启动 TS daemon」、AC-2「底层默认实现仍走 Tauri」、AC-3「不引入 HTTP daemon 作为默认路径」三处，在当前终局代码中均呈现「默认 = HTTP daemon」。若以 **story 写作时的 Phase-1 原意** 为基准 → 这三条应判 fail（但责任在 runtimeClient.ts，非本文件）；若以 **M8-a/M8-b 终局架构** 为基准 → 属预期演进，本文件无责。**需用户明确以哪个为验收基准。**
2. **范围外两文件**：`src/lib/runtimeClient.ts`、`src/lib/tauri.ts` 未纳入本次核对，其 AC-3 签名兼容性与 AC-4 范围合规性需另派核对。

## 结论

就被指定的 **`apps/web/src/hooks/useConversation.ts`** 而言：

- 本 story 的**核心目标——「组件不再直接绑定 Tauri event 订阅，改为经统一 runtime client 订阅 conversation-stream」——在本文件中完全落实且实现正确**（AC-2 消费侧 pass，unsubscribe 正确）。
- 文件内对话主路径行为保留（AC-1 文件内 pass）、范围合规（AC-4 文件内 pass）、Won't 边界文件内无违反。
- 涉及「默认实现是否走 Tauri」「是否要求 daemon」等传输层默认值问题，判定对象不在本文件，均转「待用户裁决」。

---

result: pass | fail 项（文件内）：0 | 待裁决项：5（基准选择 1 + 范围外文件 2 + Won't 默认路径 1 + AC-3 签名 1，部分重叠）
