# 验收报告 · 独立 subAgent · R2

- 故事：STORY-20260625-runtime-client-protection（前端运行时保护层）
- 契约：`story.md`（`status: verified`）；本任务无 `design.md`
- 核对范围：`apps/web/src/hooks/useConversation.ts`（1102 行）
- 轮次：1
- 方法：仅读取指定文件 + 必要关联文件取证（runtimeClient.ts / tauri.ts 仅作上下文，不在裁决范围内）+ 运行测试

---

## 总结论

**result: pass（范围内核对通过）**

- fail 项数：0
- 待用户裁决项数：1（AC-2 字面条款「底层默认实现仍走 Tauri」已被后续 story 超越，超出本次核对范围）

---

## 逐条 AC 核对

### AC-1 — 现有对话路径保持可用 → PASS（范围相关部分）

**条款**：创建会话 / 发送 / 取消 / 重试行为保持一致；不要求启动 TS daemon。

**证据**：
- `useConversation.ts:5-14` 仍从 `'../lib/tauri'` 导入 `conversationCreate / conversationSend / conversationCancel / conversationClose / conversationGetMessages / conversationTruncate / conversationRetry / conversationGetStats`，命令调用面未变。
- `useConversation.ts:838-952`（`send`）、`:954-987`（`retry`）、`:989-999`（`cancel`）、`:795-809`（`createTab`）业务逻辑结构完整，事件处理 reducer（`:141-605`）未拆分。
- 测试 `useConversation.test.ts` 5/5 通过（`npx vitest run src/hooks/useConversation.test.ts` → `Tests 5 passed (5)`），覆盖订阅、text_delta 路由、done 置 streaming=false、unmount 退订。
- 「不要求启动 TS daemon」：hook 把传输选择委托给 `selectRuntimeClient()`（`:146`），自身不感知 daemon 是否启动；传输默认值属 `runtimeClient.ts` 范畴（出范围）。

**结论**：范围相关部分 PASS。

---

### AC-2 — 组件不再直接绑定 Tauri event 订阅 → PASS（范围内核对通过；字面第二条款待裁决）

**条款 a**：`useConversation` 通过统一 runtime client 订阅 `conversation-stream`。

**证据**：
- `useConversation.ts:2` `import { selectRuntimeClient } from '../lib/runtimeClient'`。
- `useConversation.ts:146-147`：
  ```
  const client = selectRuntimeClient()
  const off = client.subscribe<ConversationStreamPayload>('conversation-stream', (payload) => { ... })
  ```
- `useConversation.ts:595-597` effect cleanup 调用 `off()` 同步退订。
- 静态取证：`rg "@tauri-apps" apps/web/src/hooks/useConversation.ts` → 0 匹配（exit 1）；`rg "listen\(|invoke\(|emit\(" 同文件` → 0 匹配（exit 1）。文件内**无**直接 Tauri event / invoke 绑定。
- 回归测试：
  - `useConversation.test.ts:52-56` 断言源码不含 `'@tauri-apps/api/event'` → PASS。
  - `:58-63` 断言经 runtime client 订阅 `conversation-stream` → PASS。
  - `:105-110` 断言 unmount 调用 `off()` 一次 → PASS。

**条款 b（字面）**：「底层默认实现仍走 Tauri」。

**证据**：该条款针对 `runtimeClient.ts` 的默认实现，**不在本次核对范围**。仅作上下文记录：当前 `apps/web/src/lib/runtimeClient.ts:36-41` `selectRuntimeClient()` 返回 `httpRuntimeClient`（`HttpRuntimeClient`），Tauri fallback 已被后续 commit 移除（`d26f89e` M8-a、`83cd73c` M7-b）。

**结论**：范围内核对（hook 经统一 runtime client 订阅、无直接 Tauri 绑定）PASS。字面第二条款与现状不符，但属后续 story 超越本 story Phase-1 意图的产物，且该判断点位于范围外文件 → **待用户裁决**是否追溯。

---

### AC-3 — 外部 API 不破坏 → 范围内部分 PASS；tauri.ts 签名部分出范围

**条款**：`src/lib/tauri.ts` 对外导出的既有函数签名保持兼容；不引入 HTTP daemon 作为默认路径。

**证据**：
- 范围内：`useConversation.ts` 作为消费方，仍以原签名调用 `conversationCreate(context, contextFiles)`、`conversationSend(sid, text, images)`、`conversationCancel(sid)`、`conversationRetry(sid)`、`conversationTruncate(sid, idx)`、`conversationGetMessages(id)`、`conversationGetStats(id)`、`conversationClose(id)`（见 `:798, :762, :768, :929, :967, :993, :1014, :626, :742`）。消费侧无破坏。
- `src/lib/tauri.ts` 本体出核对范围，签名兼容性的直接证据无法从范围内取得。

**结论**：范围内（消费侧无破坏）PASS；tauri.ts 导出面兼容性留待范围外核验。

---

### AC-4 — 小范围独占修改 → PASS（范围内）

**条款**：允许范围限于 `src/lib/runtimeClient.ts`、`src/lib/tauri.ts`、`src/hooks/useConversation.ts` 及必要测试；不改 Rust、不新增 daemon、不改 ChatPanel。

**证据**：
- 本次核对文件 `useConversation.ts` 的导入仅来自：`react`、`../lib/runtimeClient`、`../types`、`../lib/tauri`、`./useEventCallback`、`../artifacts/parser` —— 均为既有的同层或工具模块，无越界依赖。
- 文件内无 Rust / daemon / ChatPanel 视觉或业务结构改写痕迹（reducer 与 tab 管理逻辑保持原结构）。
- 测试 `useConversation.test.ts` 属「必要测试」允许项。

**结论**：PASS。

---

## Won't 边界核对

| Won't 条款 | 范围内核对 | 证据 |
|---|---|---|
| 不启用 HTTP daemon 默认路径 | 未违反（范围内） | hook 未设默认传输，委托 `selectRuntimeClient()`；默认翻转为 `runtimeClient.ts`（出范围）后续 story 行为 |
| 不新增 TS daemon | 未违反 | `useConversation.ts` 无 daemon 实体引入 |
| 不接入 CLI adapter | 未违反 | 无 CLI 相关引用 |
| 不实现 AgentRunEvent / ChangeSet / AuthorizationMode / 自动沉淀 | 未违反 | 文件仅处理 `ConversationStreamPayload` 事件族 |
| 不重写 ChatPanel | 未违反 | ChatPanel 不在范围内，本文件结构未变 |
| 不删除 Rust | 未违反 | 范围内无 Rust 触及 |

---

## 越界 / 偏差清单

无（范围内未发现越界改动）。

---

## 待用户裁决项

| # | 事项 | 现状 | 建议 |
|---|---|---|---|
| 1 | AC-2 字面条款「底层默认实现仍走 Tauri」 | `runtimeClient.ts` 现返回 `HttpRuntimeClient`，Tauri fallback 已由后续 story（M7-b `83cd73c`、M8-a `d26f89e`）移除 | 本 story 已 `verified` 且属 Phase-1 保护层，其历史使命（让 hook 经抽象层订阅）已由范围内代码兑现；传输默认值的演进归属后续 story。建议**不追溯**，仅记录演进事实 |

---

## 摘要

result: pass | fail 项数: 0 | 待裁决项数: 1
