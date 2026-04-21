# 研究发现

## 调研日期：2026-04-21

### 问题背景

journal LLM 引擎在多厂商间存在系统性兼容问题，通过深度分析 claw-code 源码（`/Users/yanwu/Projects/github/claw-code/rust/crates/api/`）发现 10 个关键差异点。

### claw-code 关键架构模式

**1. 统一事件模型**
所有厂商响应归一化到 Anthropic 的 StreamEvent 枚举，差异在 provider 层内部消化。

**2. Model Quirks 检测**
`model_rejects_is_error_field()`、`is_reasoning_model()`、`uses_max_completion_tokens()` 等函数根据模型名前缀动态调整请求体。

**3. sanitize_tool_message_pairing()**
发送前扫描消息序列，移除孤立的 tool 消息，作为最后防线防止 400 错误。

**4. 统一 SSE 解析器**
`OpenAiSseParser` 处理 `\n\n`/`\r\n\r\n` 双分隔符、注释行、`[DONE]` 哨兵、mid-stream 错误检测。

**5. 请求体预检**
DashScope 6MB、xAI 50MB、OpenAI 100MB 大小限制；token 预估避免超限。

### journal 当前问题清单

| # | 问题 | 严重度 | 用户可见症状 |
|---|---|---|---|
| 1 | OpenAI content_blocks 含 Text，Anthropic 不含 | 高 | 文本重复显示 |
| 2 | OpenAI mid-stream 错误静默跳过 | 高 | 流突然中断无提示 |
| 3 | 无 model quirks 检测层 | 中 | 特定模型 400 错误 |
| 4 | Kimi 拒绝 is_error 字段 | 高 | Kimi tool_use 全部失败 |
| 5 | Thinking signature 空值跨引擎 | 中 | 切换引擎后对话断裂 |
| 8 | 孤立 tool_result 无清理 | 中 | 恢复对话时 400 |
| 10 | SSE 解析器各自实现 | 低 | 边界情况不一致 |

### 关键代码位置

| 文件 | 关注点 |
|---|---|
| `openai_compat.rs:506-510` | Text block 被放入 content_blocks（应移除） |
| `openai_compat.rs` SSE 循环 | JSON 解析失败 → `continue`（应检测错误） |
| `anthropic.rs` 发送前 | 无 thinking block 过滤 |
| `openai_compat.rs` build_request | 无 reasoning model 参数剥离 |
| `openai_compat.rs` translate_user_message | 无条件发送 is_error 字段 |
