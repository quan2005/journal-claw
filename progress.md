# 进度日志

## 2026-04-19 — 调研与规划

### 完成事项
- 确认百炼 API 端点可用（curl 测试 streaming 正常返回）
- 调研 rust-genai、Rig、Claw Code 三个方案
- 选定 Claw Code 翻译层方案，创建 task_plan.md

## 2026-04-19 — 实施完成

### 阶段 1：Config 层扩展
- `ProviderEntry` 新增 `protocol` 字段（默认 `"anthropic"`）
- `BuiltinPreset` 新增 `default_protocol` 字段
- 所有预设更新：DeepSeek/火山方舟/智谱/百炼 → `"openai"` + 原生 OpenAI 兼容 URL
- `active_vendor_config()` 返回 4-tuple 含 protocol
- 迁移逻辑处理旧配置无 protocol 字段的情况

### 阶段 2：OpenAI 兼容引擎实现
- 新增 `src-tauri/src/llm/openai_compat.rs`（~530 行）
- 请求翻译：Anthropic ContentBlock → OpenAI messages 格式
- 流式响应翻译：OpenAI SSE delta → Anthropic StreamEvent
- 支持 reasoning_content（DeepSeek/qwen3.6-plus thinking）
- 支持 tool_calls 增量拼接
- 重试逻辑（指数退避，5 次）
- 4 个单元测试

### 阶段 3+4：Engine 路由集成 + 调用点适配
- `llm/mod.rs` 新增 `create_engine_for_provider()` 统一入口
- `ai_processor.rs`、`conversation.rs`、`auto_lint.rs` 全部切换到新路由

### 阶段 5：前端设置面板适配
- `ProviderEntry` 接口新增 `protocol` 字段
- `BuiltinPreset` 接口新增 `defaultProtocol` 字段
- 所有预设 URL 更新为 OpenAI 兼容端点
- `SectionAiEngine` 新增 protocol 下拉选择器
- i18n 中英文补充

### 阶段 6：最终验证
- cargo fmt ✓
- cargo clippy 零 warning ✓
- cargo test 215 passed ✓
- npm run build ✓
- npm test 179 passed ✓
