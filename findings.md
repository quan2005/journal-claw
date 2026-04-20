# 研究发现

## 调研日期：2026-04-19

### 问题背景

用户配置了阿里云百炼（DashScope）作为 AI 引擎，API Key 和端点均有效（手动 curl 测试通过），但应用内"没任何反应"。

### 根因分析

当前架构所有 provider 统一走 Anthropic Messages API 协议（`/v1/messages`），百炼的 `/apps/anthropic` 端点虽然兼容 Anthropic 格式，但：
1. 百炼的 Anthropic 兼容端点可能在 tool_use + thinking 场景下行为不完全一致
2. 百炼原生推荐的是 OpenAI Chat Completions 兼容端点 `/compatible-mode/v1`
3. 其他 OpenAI 兼容 provider（DeepSeek、Moonshot、OpenRouter 等）也只支持 OpenAI 格式

### 方案调研

| 方案 | 优点 | 缺点 |
|---|---|---|
| rust-genai | 16 provider 自动路由 | 0.6.0-beta，不支持 server-side tools/PauseTurn |
| Rig | 成熟 agent 框架，内置 tool loop | 太重（87KB+），丢失 web_search/PauseTurn，需重写 tool_loop |
| Claw Code 翻译层 | 轻量，已验证 DashScope 可用，内部类型不变 | 需自己实现翻译逻辑（~800行） |

### Claw Code 关键架构发现

`ultraworkers/claw-code` 的 `rust/crates/api/src/providers/openai_compat.rs`：

- **内部类型统一用 Anthropic 格式** — 上层 tool_loop 完全不感知底层协议
- **`OpenAiCompatClient`** 做双向翻译：
  - 请求：Anthropic `InputMessage` → OpenAI `messages` 格式
  - 响应：OpenAI `ChatCompletionResponse` → Anthropic `MessageResponse`
  - 流式：OpenAI SSE delta → Anthropic `StreamEvent`
- **DashScope 配置**：`DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"`
- **Provider 路由**：`ProviderClient` enum 按 model 前缀自动选择 Anthropic 或 OpenAI 兼容

### 翻译层核心映射

**请求翻译（Anthropic → OpenAI）：**
- `system` 顶层字段 → `messages[0].role = "system"`
- `InputContentBlock::Text` → `content: "text"`
- `InputContentBlock::ToolUse` → assistant message with `tool_calls[]`
- `InputContentBlock::ToolResult` → `role: "tool"` message
- `tools[]` → `tools[].type = "function"` 格式
- `max_tokens` → `max_tokens`（或 `max_completion_tokens` for reasoning models）

**响应翻译（OpenAI → Anthropic）：**
- `choices[0].message.content` → `OutputContentBlock::Text`
- `choices[0].message.tool_calls` → `OutputContentBlock::ToolUse`
- `finish_reason: "tool_calls"` → `stop_reason: "tool_use"`
- `finish_reason: "stop"` → `stop_reason: "end_turn"`
- `usage.prompt_tokens` → `usage.input_tokens`
- `usage.completion_tokens` → `usage.output_tokens`

**流式翻译（OpenAI SSE → Anthropic StreamEvent）：**
- 需要维护 `StreamState` 跟踪当前 content block index
- `delta.content` → `TextDelta`
- `delta.tool_calls[].function.arguments` → `InputJsonDelta`（增量拼接）
- `delta.reasoning_content` → `ThinkingDelta`（部分模型支持）

### 当前代码结构

```
src-tauri/src/llm/
├── mod.rs          — LlmEngine trait + create_anthropic_engine()
├── anthropic.rs    — AnthropicEngine（直接调 /v1/messages）
├── types.rs        — Message/ContentBlock/StreamEvent/StopReason 等
├── tool_loop.rs    — Agent 循环（provider-agnostic）
├── bash_tool.rs    — bash 工具实现
├── enable_skill.rs — skill 加载工具
├── prompt.rs       — system prompt 构建
└── output_compress.rs — 输出压缩
```

### 决策

采用 **Claw Code 翻译层方案**：新增 `openai_compat.rs` 实现 `LlmEngine` trait，内部做格式翻译。
