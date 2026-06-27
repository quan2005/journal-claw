---
status: verified
phase: ME-c
created: 2026-06-27
---

# ME-c · pi 引擎接入 AgentRunService（事件映射 + prompt/skills）

## 背景
ME-a（引擎骨架+vendor）+ ME-b（工具+授权）已就绪。ME-c 把 pi 引擎接入现有 Run 基础设施，使一个 Run 能用 pi 内建引擎执行（与 CLI adapter 并存）。

## 目标
1. **事件映射**：pi Agent 事件 → 统一 AgentRunEvent。映射：
   - agent_start → run_started；turn_start → step_started
   - message_update(text_delta) → text_delta；(thinking) → thinking_delta
   - tool_execution_start → tool_call；tool_execution_end → tool_result
   - afterToolCall 记录的 ChangeSet → change_proposed（如适用）
   - agent_end → run_finished；错误 → run_failed
2. **接入 AgentRunService**：新增 pi-engine 执行路径（runner 侧），POST /runs 可选 engine='builtin'(pi) vs CLI adapter；事件落 JSONL、可 SSE 订阅、可 cancel（agent.abort）。
3. **prompt/skills**：复用/扩展 apps/daemon/src/context/assemble.ts（assembleContext，workspace meta + memory 注入），构造 pi systemPrompt + transformContext；skills 加载对齐 Rust（systemPrompt 注入已启用 skills）。

## 范围
- apps/daemon/src/engine/ 事件映射器 + AgentRunService 接入。
- 复用 ContextAssembler、AgentRunService（创建/JSONL/SSE/cancel）、ME-b 工具。
- 不接前端（前端走既有 AgentRun 通道，事件统一即可；前端改动留后）。

## 约束
- 不破坏现有 CLI adapter 路径（claude/codex/opencode）；pi 为新增并存引擎。
- 复用现有 AgentRunService/ContextAssembler，不另起 Run 存储。
- 只动 apps/daemon；faux provider 测试；不删 Rust。

## 验收（Given-When-Then）
- Given POST /runs engine=builtin + faux provider，Then SSE 收到 run_started→text_delta→(tool_call/tool_result)→run_finished 有序事件，JSONL 落盘可回放。
- Given cancel，Then agent.abort 中断、终态正确。
- Given workspace meta + memory，Then systemPrompt 含注入上下文。
- daemon tsc clean；vitest ≥400 passed 无新失败。
