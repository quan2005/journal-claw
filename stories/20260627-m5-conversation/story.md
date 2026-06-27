---
status: verified
phase: M5
created: 2026-06-27
---

# M5 · Conversation（LLM 引擎 session 层，走 pi）

## 背景
ME 引擎集成完成（pi engine=builtin 可用）。M5 把 conversation.rs(13) 迁到 daemon，多轮会话走 pi 引擎（engine=builtin），在 AgentRunService 之上加 session 层。Rust conversation.rs：create/send/cancel/close/inject/truncate/retry/list/rename/delete/get_messages/get_stats/load。

## 目标
1. daemon ConversationService：多轮 session（pi Agent 持久化 messages + steering/followUp/continue/abort 语义）；create/send/cancel/close/inject/truncate/retry/list/rename/delete/get_messages/get_stats/load。
2. send 走 pi 引擎（engine builtin，经 AgentRunService 或直接 EngineService + 事件映射）；多轮 context 用 pi transformContext（compact 对齐 Rust truncate）。
3. 前端 tauri.ts conversation_* 经 runtime flag 走 daemon（现有 useConversation hook 的调用点）；Tauri 不回退。
4. 测试用 faux provider（无需真 key）：多轮 send（context 累积）、inject、truncate、retry、cancel。

## 约束
- 复用 ME 引擎 + AgentRunService/事件映射，不另起引擎。
- 会话状态持久化对齐 Rust（Gate G：现有 conversation history 可读）。
- 只动 apps/daemon + 前端 tauri.ts；不删 Rust；不碰范围外 dirty；勿装包。
- pi 依赖已装。

## 验收（Given-When-Then）
- 多轮 send：第一轮 user→assistant，第二轮 user 带上轮 context（faux 触发）。
- inject 插入消息；truncate 裁剪历史；retry 从末尾重试；cancel 中断。
- 现有 conversation history 可被 daemon load（Gate G）。
- daemon tsc clean；vitest ≥416 passed 无新失败；web tsc clean。
