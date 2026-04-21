# 任务计划：LLM 多厂商兼容性深度优化

## 目标

彻底解决 journal LLM 引擎在多厂商（Anthropic / DashScope / DeepSeek / Kimi / 智谱）间的兼容性问题，参考 claw-code 的成熟实现进行系统性修复。

## 设计原则

- **tool_loop.rs 和 conversation.rs 零改动** — 所有兼容性处理封装在引擎层内部
- **内部类型不变** — 继续使用 `types.rs` 中的 Anthropic 格式类型
- **防御性编程** — 每层都有兜底，不依赖上游行为正确
- **参考 claw-code** — 已验证的模式直接复用

## 阶段划分

### 阶段 1：AssistantResponse.content 语义统一 [待开始]

**问题**：Anthropic 引擎的 `content_blocks` 不含 Text（文本通过 StreamEvent 累积），OpenAI 引擎却包含 Text block，导致 tool_loop/conversation 拼接时文本重复。

**改动文件**：
- `src-tauri/src/llm/openai_compat.rs`

**具体任务**：
- [ ] 1.1 `parse_openai_sse_stream` 返回的 `content_blocks` 中移除 Text block
- [ ] 1.2 确保文本只通过 `StreamEvent::TextDelta` 回调流出
- [ ] 1.3 验证 tool_loop.rs 和 conversation.rs 的拼接逻辑在两个引擎下行为一致

---

### 阶段 2：OpenAI 流式错误检测 [待开始]

**问题**：OpenAI 引擎遇到 mid-stream 错误 JSON 直接 `continue` 跳过，用户看到流突然中断无提示。

**改动文件**：
- `src-tauri/src/llm/openai_compat.rs`

**具体任务**：
- [ ] 2.1 SSE 解析中检测 `{"error": {...}}` 格式的错误响应
- [ ] 2.2 解析错误对象的 `message`、`type`、`code` 字段
- [ ] 2.3 映射为 `LlmError::Api { status, message }`，标记 retryable
- [ ] 2.4 JSON 解析失败时不再静默 continue，而是记录 warning 并发出 `StreamEvent::Error`

---

### 阶段 3：Model Quirks 检测层 [待开始]

**问题**：不同模型有硬性约束，当前代码没有统一的 quirk 检测。

**新增文件**：
- `src-tauri/src/llm/model_quirks.rs`

**具体任务**：
- [ ] 3.1 新增 `model_quirks.rs` 模块
- [ ] 3.2 实现 `rejects_is_error_field(model: &str) -> bool`（Kimi 系列）
- [ ] 3.3 实现 `is_reasoning_model(model: &str) -> bool`（o1/o3/o4/qwq/grok-mini/deepseek-reasoner/qwen3-thinking）
- [ ] 3.4 实现 `uses_max_completion_tokens(model: &str) -> bool`（GPT-5 系列）
- [ ] 3.5 实现 `strip_routing_prefix(model: &str) -> &str`（去除 openai/、dashscope/ 等前缀）
- [ ] 3.6 实现 `supports_thinking(model: &str) -> bool`（仅 Anthropic 和特定 reasoning 模型）
- [ ] 3.7 在 `mod.rs` 中注册模块

---

### 阶段 4：Kimi is_error 兼容 + Reasoning 模型参数剥离 [待开始]

**问题**：Kimi 拒绝 tool result 中的 `is_error` 字段；reasoning 模型拒绝 temperature/top_p。

**改动文件**：
- `src-tauri/src/llm/openai_compat.rs`

**具体任务**：
- [ ] 4.1 `translate_user_message` 中根据 `rejects_is_error_field()` 省略 is_error 字段
- [ ] 4.2 错误信息改为 content 前缀 `[ERROR] `（claw-code 做法）
- [ ] 4.3 `build_openai_request` 中根据 `is_reasoning_model()` 剥离 temperature/top_p/frequency_penalty/presence_penalty
- [ ] 4.4 根据 `uses_max_completion_tokens()` 使用 `max_completion_tokens` 替代 `max_tokens`
- [ ] 4.5 根据 `supports_thinking()` 决定是否发送 thinking 相关参数

---

### 阶段 5：Thinking Signature 跨引擎安全 [待开始]

**问题**：OpenAI 引擎产生的 Thinking block signature 为空，发送到 Anthropic 会被拒绝。

**改动文件**：
- `src-tauri/src/llm/anthropic.rs`
- `src-tauri/src/llm/openai_compat.rs`

**具体任务**：
- [ ] 5.1 Anthropic 引擎发送消息前，过滤掉 signature 为空的 Thinking block
- [ ] 5.2 将空 signature 的 Thinking 内容转为 `<thinking>...</thinking>` 包裹的 Text block
- [ ] 5.3 OpenAI 引擎发送消息前，同样过滤 Anthropic 来源的 Thinking block（有 signature 的）
- [ ] 5.4 确保跨引擎切换后对话可以正常继续

---

### 阶段 6：孤立 Tool Message 清理 [待开始]

**问题**：对话压缩、取消、错误恢复后可能出现孤立的 tool_result，API 会 400 拒绝。

**改动文件**：
- `src-tauri/src/llm/openai_compat.rs`
- `src-tauri/src/llm/anthropic.rs`（可选，Anthropic 也可能遇到）

**具体任务**：
- [ ] 6.1 新增 `sanitize_tool_message_pairing(messages: &mut Vec<...>)` 函数
- [ ] 6.2 扫描消息序列，收集所有 assistant tool_call ID
- [ ] 6.3 移除没有匹配 tool_call 的 tool_result 消息
- [ ] 6.4 移除有 tool_call 但没有对应 tool_result 的 assistant 消息尾部 tool_use block
- [ ] 6.5 在 `chat_stream` 发送前调用此函数作为最后防线
- [ ] 6.6 记录 warning 日志便于排查

---

### 阶段 7：统一 SSE 解析器 [待开始]

**问题**：两个引擎各自实现 SSE 解析，边界情况处理不一致。

**新增文件**：
- `src-tauri/src/llm/sse_parser.rs`

**改动文件**：
- `src-tauri/src/llm/anthropic.rs`
- `src-tauri/src/llm/openai_compat.rs`

**具体任务**：
- [ ] 7.1 新增 `sse_parser.rs`，实现 `SseParser` 结构体
- [ ] 7.2 支持 `\n\n` 和 `\r\n\r\n` 双分隔符
- [ ] 7.3 跳过 `:` 开头的注释行
- [ ] 7.4 处理 `[DONE]` 哨兵
- [ ] 7.5 不完整帧的缓冲续接
- [ ] 7.6 提供 `fn next_event(&mut self, chunk: &[u8]) -> Vec<SseEvent>` 接口
- [ ] 7.7 `SseEvent` 包含 `event_type: Option<String>` 和 `data: String`
- [ ] 7.8 重构 Anthropic 引擎使用 `SseParser`
- [ ] 7.9 重构 OpenAI 引擎使用 `SseParser`
- [ ] 7.10 单元测试：各种边界情况（混合换行、不完整帧、注释行、空 data）

---

### 阶段 8：验证 [待开始]

- [ ] 8.1 cargo fmt + clippy 零 warning
- [ ] 8.2 cargo test 全通过
- [ ] 8.3 npm run build + npm test 全通过
- [ ] 8.4 手动测试：Anthropic 引擎正常
- [ ] 8.5 手动测试：DashScope (qwen) 引擎正常
- [ ] 8.6 手动测试：Kimi 引擎 tool_use 正常

---

## 风险与注意事项

1. **阶段 1 影响面最大** — 改变 content_blocks 语义可能影响 conversation.rs 中直接读取 response.content 的代码，需仔细验证
2. **阶段 7 重构风险** — SSE 解析器替换需确保流式行为完全一致，建议先写测试再重构
3. **阶段 5 跨引擎切换** — 实际场景中用户可能中途换引擎，需要处理历史消息中的异构 block

## 当前状态

- [ ] 阶段 1：AssistantResponse.content 语义统一
- [ ] 阶段 2：OpenAI 流式错误检测
- [ ] 阶段 3：Model Quirks 检测层
- [ ] 阶段 4：Kimi is_error 兼容 + Reasoning 模型参数剥离
- [ ] 阶段 5：Thinking Signature 跨引擎安全
- [ ] 阶段 6：孤立 Tool Message 清理
- [ ] 阶段 7：统一 SSE 解析器
- [ ] 阶段 8：验证
