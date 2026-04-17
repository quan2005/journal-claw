# 进度日志

## 2026-04-14 · 规划阶段

### 完成
- [x] 深入研究现有对话框架构（ConversationDialog, useConversation, conversation.rs）
- [x] 分析 LLM 引擎层（LlmEngine trait, bash_tool, prompt builder, tool_loop）
- [x] 分析 ASR 管道（transcription.rs — DashScope/WhisperKit/SFSpeech）
- [x] 分析 CommandDock 交互模式（文件拖拽、剪贴板路由、FileCard）
- [x] 分析 App 层集成方式（conversationState 状态管理）
- [x] 与用户完成 ideate 讨论，确认六大特性方向
- [x] 生成可视化探索稿（v1 总览 + v2 会话持久化分栏 + v2 标题动态总结 + v1 语音转写流程）
- [x] 编写完整执行计划（task_plan.md）
- [x] 编写研究发现（findings.md）

### 关键决策
- Markdown 渲染选用 `marked` + `highlight.js`（轻量、适合流式）
- 语音附件采用全文注入（非摘要），因为会议录音通常 2000-8000 字
- 会话存储为独立 JSON 文件（与 workspace 文件结构一致）
- 标题生成用独立 LLM 调用（≤8 字中文，异步不阻塞）
- 左栏按状态分组（输出中/已完成），非 tab 切换
- **转写期间不阻塞发送** — 用户可持续发送消息，转写完成后自动合并为一条发送给 AI
- **AI 输出中途干预** — 新增 M1 跨特性机制，用户消息在 tool turn 边界注入，利用多轮循环天然间隙
- 干预消息合并为单条 `[用户补充指令]`，避免碎片化指令

### 待确认
- [ ] 用户审批执行计划
- [ ] 确认实现顺序是否需要调整

---

## 探索稿索引
| 文件 | 内容 |
|---|---|
| `2604/raw/conversation-features/14-ideate-conversation-features-v2.html` | 六大特性总览画布 |
| `2604/raw/conversation-features/14-ideate-conversation-history-v1.html` | 会话持久化分栏布局 |
| `2604/raw/conversation-features/14-ideate-conversation-history-v2.html` | 会话标题动态总结 |
| `2604/raw/conversation-features/14-ideate-audio-transcribe-v1.html` | 语音附件转写流程 |
