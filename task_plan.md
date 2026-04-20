# 任务计划：新增 OpenAI 兼容 Provider 支持

## 目标

为 JournalClaw 新增 OpenAI Chat Completions 兼容协议支持，使百炼（DashScope）、DeepSeek、Moonshot、OpenRouter 等 provider 可以通过原生 OpenAI 格式通信，而非强制走 Anthropic 兼容端点。

## 设计原则

- **tool_loop.rs 和 conversation.rs 零改动** — 翻译层完全封装在 engine 内部
- **内部类型不变** — 继续使用 `types.rs` 中的 Anthropic 格式类型
- **最大复用** — 参考 Claw Code 的 `openai_compat.rs` 翻译逻辑
- **向后兼容** — 现有 Anthropic 协议 provider 行为不变

## 阶段划分

### 阶段 1：Config 层扩展 [待开始]

**目标**：让 ProviderEntry 支持 protocol 字段，区分 Anthropic 和 OpenAI 协议。

**改动文件**：
- `src-tauri/src/config.rs`

**具体任务**：
- [ ] 1.1 `ProviderEntry` 新增 `protocol: String` 字段（`"anthropic"` | `"openai"`），默认 `"anthropic"`
- [ ] 1.2 `BuiltinPreset` 新增 `default_protocol` 字段
- [ ] 1.3 更新 `BUILTIN_PRESETS`：
  - `anthropic` → protocol: `"anthropic"`
  - `zhipu` → protocol: `"openai"`（智谱走 OpenAI 兼容）
  - `dashscope` → protocol: `"openai"`，base_url 改为 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- [ ] 1.4 `sanitize_engine_config` 中处理 protocol 字段缺失的迁移逻辑
- [ ] 1.5 `active_vendor_config()` 返回值增加 protocol 信息（改为返回结构体或 4-tuple）

---

### 阶段 2：OpenAI 兼容引擎实现 [待开始]

**目标**：实现 `OpenAiCompatEngine`，内部做 Anthropic ↔ OpenAI 格式双向翻译。

**新增文件**：
- `src-tauri/src/llm/openai_compat.rs`

**具体任务**：
- [ ] 2.1 定义 `OpenAiCompatEngine` 结构体（client, api_key, base_url, model）
- [ ] 2.2 实现请求翻译：`build_openai_request()`
  - system prompt → system message
  - `Message` + `ContentBlock` → OpenAI messages 格式
  - `ToolDefinition` → OpenAI function tools 格式
  - Thinking 配置处理（部分模型不支持，需跳过）
- [ ] 2.3 实现响应翻译：`normalize_response()`
  - OpenAI `ChatCompletionResponse` → `AssistantResponse`
  - tool_calls → `ContentBlock::ToolUse`
  - finish_reason 映射
  - usage 映射
- [ ] 2.4 实现流式翻译：`parse_openai_sse_stream()`
  - 维护 `StreamState`（当前 block index、tool call 累积）
  - delta.content → `StreamEvent::TextDelta`
  - delta.tool_calls → `StreamEvent::ToolUseStart/Delta/End`
  - delta.reasoning_content → `StreamEvent::ThinkingDelta`（如有）
  - 流结束时组装完整 `AssistantResponse`
- [ ] 2.5 实现 `LlmEngine` trait 的 `chat_stream` 方法
  - 构建请求 → 发送 → 解析流式响应 → 回调 on_event → 返回 AssistantResponse
- [ ] 2.6 实现重试逻辑（参考现有 AnthropicEngine 的 MAX_RETRIES + 指数退避）

---

### 阶段 3：Engine 路由集成 [待开始]

**目标**：根据 provider 的 protocol 字段选择正确的 engine 实现。

**改动文件**：
- `src-tauri/src/llm/mod.rs`

**具体任务**：
- [ ] 3.1 新增 `pub mod openai_compat;`
- [ ] 3.2 新增 `create_openai_compat_engine(api_key, base_url, model)` 构造函数
- [ ] 3.3 新增 `create_engine_for_provider(api_key, base_url, model, protocol)` 统一入口
  - protocol == "openai" → `OpenAiCompatEngine`
  - protocol == "anthropic" 或其他 → `AnthropicEngine`

---

### 阶段 4：调用点适配 [待开始]

**目标**：让 ai_processor 和 conversation 使用新的 engine 路由。

**改动文件**：
- `src-tauri/src/ai_processor.rs`
- `src-tauri/src/conversation.rs`

**具体任务**：
- [ ] 4.1 修改 `ai_processor.rs` 中 `process_material_builtin`：
  - 从 config 获取 protocol
  - 调用 `create_engine_for_provider` 替代 `create_anthropic_engine`
- [ ] 4.2 修改 `conversation.rs` 中 `create_engine`：
  - 同样使用 `create_engine_for_provider`
- [ ] 4.3 确保 `active_vendor_config()` 返回 protocol 信息

---

### 阶段 5：前端设置面板适配 [待开始]

**目标**：让用户在设置面板中看到并可选择 protocol。

**改动文件**：
- `src/settings/components/SectionAiEngine.tsx`
- `src/lib/tauri.ts`（如有新 IPC 命令）
- `src/locales/zh.ts`、`src/locales/en.ts`

**具体任务**：
- [ ] 5.1 Provider 编辑区域新增 protocol 下拉选择（Anthropic / OpenAI 兼容）
- [ ] 5.2 根据 BuiltinPreset 自动填充默认 protocol
- [ ] 5.3 新增 provider 时根据 preset 自动设置 protocol 和 base_url
- [ ] 5.4 i18n 字符串补充

---

### 阶段 6：测试与验证 [待开始]

**具体任务**：
- [ ] 6.1 单元测试：请求翻译（Anthropic → OpenAI 格式）
- [ ] 6.2 单元测试：响应翻译（OpenAI → Anthropic 格式）
- [ ] 6.3 单元测试：流式翻译（OpenAI SSE → StreamEvent）
- [ ] 6.4 单元测试：tool_calls 多轮对话翻译
- [ ] 6.5 集成测试：DashScope qwen3.6-plus 端到端
- [ ] 6.6 集成测试：DeepSeek 端到端
- [ ] 6.7 回归测试：Anthropic provider 行为不变
- [ ] 6.8 `cargo test` + `cargo clippy` 全通过

---

## 风险与注意事项

1. **Thinking blocks**：OpenAI 格式没有标准的 thinking 支持。部分模型（如 DeepSeek-R1、qwen3.6-plus）通过 `reasoning_content` 字段返回思考过程，需要特殊处理。对于不支持的模型，thinking 配置应被静默忽略。

2. **Server-side tools (web_search)**：OpenAI 兼容 provider 不支持 Anthropic 的 server-side web_search tool。在 OpenAI 模式下，`build_request_body` 中的 `web_search_20250305` 工具定义应被跳过。

3. **PauseTurn**：OpenAI 格式没有 `pause_turn` stop_reason。不影响，因为这是 Anthropic 特有行为。

4. **Token 计数差异**：OpenAI 的 `prompt_tokens` 包含 system，Anthropic 的 `input_tokens` 也包含。映射应该是直接的。

5. **Tool call ID 格式**：OpenAI 用 `call_xxx` 格式，Anthropic 用 `toolu_xxx`。翻译层需要保持 ID 透传，不做转换。

## 当前状态

- [x] 调研完成
- [x] 阶段 1：Config 层扩展
- [x] 阶段 2：OpenAI 兼容引擎实现
- [x] 阶段 3：Engine 路由集成
- [x] 阶段 4：调用点适配
- [x] 阶段 5：前端设置面板适配
- [x] 阶段 6：测试与验证
