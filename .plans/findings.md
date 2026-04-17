# 研究发现

## 现有架构分析

### 对话框前端 (`ConversationDialog.tsx`, 380 行)
- 模态弹窗形态，固定宽度 560px，高度 70vh
- 三种模式：chat / agent / observe
- 消息渲染为纯文本 `pre-wrap`，无 Markdown 支持
- 工具调用显示为简单的 `<div>` 块，无折叠能力
- 输入框为单行 `<textarea>`，仅支持纯文本
- 无会话历史，关闭即销毁

### 对话 Hook (`useConversation.ts`, 111 行)
- 监听 `conversation-stream` 事件，处理 5 种事件类型：text_delta / tool_start / tool_end / done / error
- `ConversationMessage` 类型包含 `role`, `content`, `tools[]`
- 无持久化逻辑，状态全在 React state 中

### Rust 对话层 (`conversation.rs`, 423 行)
- `ConversationStore` 是 `Mutex<HashMap<String, ConversationSession>>`，纯内存
- `ConversationSession` 包含 messages, system_prompt, mode, cancel token, workspace
- `conversation_create` 构建 system prompt（复用 `llm::prompt::build_system_prompt`）
- `conversation_send` 启动异步 LLM 调用，通过事件流式返回
- Agent 模式支持最多 30 轮工具循环
- 已有 `conversation-stream` 事件协议，payload: `{ session_id, event, data }`

### LLM 引擎层 (`src-tauri/src/llm/`)
- `LlmEngine` trait 定义了 `chat_stream` 接口
- 支持 Anthropic 和 OpenAI 兼容引擎
- `bash_tool.rs` 是唯一的工具实现
- `prompt.rs` 构建 system prompt，包含 workspace CLAUDE.md、近期摘要、skills 列表、用户档案
- `tool_loop.rs` 是独立的 agent 循环（用于 ai_processor），与 conversation.rs 的循环是平行实现

### ASR 管道 (`transcription.rs`)
- 支持 DashScope / WhisperKit / SFSpeechRecognizer 三种引擎
- 生成 `.transcript.json` sidecar 文件
- `transcript_json_path_for_audio()` 可检查已有转写
- `format_diarized_markdown()` 可将转写格式化为带说话人标注的文本

### CommandDock (`CommandDock.tsx`)
- 支持拖拽文件、⌘V 粘贴（文件/文本路由）、FileCard 附件预览
- 长文本（>300字）自动 import 为临时文件
- 有完整的 idle → active 状态机
- `FileCard` 和 `fileKindFromName` 可复用

### App 层集成
- `conversationState` 状态管理：`{ mode, context?, observePath?, observeLogs? }`
- 通过 `setConversationState(null)` 关闭对话框
- DetailPanel 和 ProcessingQueue 都可以触发打开对话框

### 前端依赖
- 当前无 Markdown 渲染库（需新增）
- 无语法高亮库（需新增）

## 关键约束
- 项目设计规范：克制沉静、单一 accent（红色）、anti-slop
- 深色模式为主要质量基准
- 动效 ≤300ms，ease-out 家族，尊重 prefers-reduced-motion
- Neutrals 带墨水青调
