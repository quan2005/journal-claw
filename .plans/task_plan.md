# 对话框六大特性 · 执行计划

> 状态：📋 待审批
> 创建：2026-04-14
> 分支：`builtin-ai-engine`

---

## 总览

将对话框从「一次性纯文本弹窗」升级为「功能完整的会话管理器」。六个特性分三个 Phase 递进实现，每个 Phase 内部按依赖顺序排列。

```
Phase 1 — 基础体验（渲染层）
  ├─ F1: Markdown 富文本渲染
  └─ F2: 思考过程 & 工具折叠
Phase 2 — 智能上下文（交互层）
  ├─ F3: 上下文自动注入
  ├─ F4: 斜杠快捷命令
  └─ M1: AI 输出中途干预（跨特性机制）
Phase 3 — 深度体验（体验层）
  ├─ F5: 富输入框（含转写非阻塞发送）
  └─ F6: 会话持久化与历史
```

---

## Phase 1 — 基础体验

### F1: Markdown 富文本渲染
> 优先级：P0 · 预估：中等 · 依赖：无

**目标**：assistant 消息从 `pre-wrap` 纯文本升级为完整 Markdown 渲染，流式输出时实时渲染。

**涉及文件**：
| 文件 | 变更类型 | 说明 |
|---|---|---|
| `package.json` | 修改 | 新增 `marked` + `highlight.js` 依赖 |
| `src/components/ConversationDialog.tsx` | 修改 | `MessageBubble` 组件改用 MD 渲染 |
| `src/components/MarkdownRenderer.tsx` | 新建 | 封装 marked 配置、sanitize、代码高亮 |
| `src/styles/markdown.css` | 新建 | MD 元素样式（遵循设计规范） |

**实现步骤**：
1. 安装依赖：`marked`（轻量 MD 解析）+ `highlight.js`（语法高亮，按需加载语言包）
2. 创建 `MarkdownRenderer` 组件：
   - 接收 `content: string`，输出 sanitized HTML
   - 配置 marked：启用 GFM、breaks
   - 代码块用 highlight.js 渲染，行内代码用 `<code>` 样式
   - 使用 `dangerouslySetInnerHTML`（内容来自 LLM，非用户输入，安全可控）
3. 修改 `MessageBubble`：
   - `role === 'assistant'` 时使用 `<MarkdownRenderer>`
   - `role === 'user'` 时保持纯文本气泡
4. 编写 `markdown.css`：
   - 标题：字号差 + 字重差建立层级（h1 1.25rem/600, h2 1.125rem/600, h3 1rem/600）
   - 列表：左缩进 1rem，项间距 0.25rem
   - 代码块：`var(--font-mono)`，背景 `var(--segment-bg)`，圆角 6px，padding 12px
   - 行内代码：背景 `var(--segment-bg)`，padding 2px 6px
   - 链接：`var(--item-text)` + 下划线
   - 表格：边框 `var(--queue-border)`，交替行背景
   - 深色/浅色模式均适配
5. 流式渲染：marked 对不完整 MD 有容错能力，每次 `text_delta` 追加后重新渲染整个 content（性能可接受，因为 marked 解析速度极快）

**验收标准**：
- [ ] 标题、列表、加粗、斜体、行内代码正确渲染
- [ ] 代码块带语法高亮（至少支持 JS/TS/Python/Rust/Bash）
- [ ] 流式输出时实时渲染，无闪烁
- [ ] 深色/浅色模式样式一致
- [ ] 用户消息保持纯文本气泡不变

---

### F2: 思考过程 & 工具调用折叠
> 优先级：P0 · 预估：中等 · 依赖：F1（共享渲染基础）

**目标**：thinking 区域和 tool_use 调用默认折叠，减少视觉噪音，可展开查看详情。

**涉及文件**：
| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src-tauri/src/conversation.rs` | 修改 | 新增 `thinking_delta` 事件类型 |
| `src/types.ts` | 修改 | `ConversationStreamPayload.event` 增加 `thinking_delta` |
| `src/hooks/useConversation.ts` | 修改 | 处理 thinking 事件，存入 message 的 `thinking` 字段 |
| `src/components/ConversationDialog.tsx` | 修改 | 新增 `ThinkingBlock` 和改进 `ToolBlock` 组件 |

**Rust 层变更**：
- `conversation.rs` 的 `stream_callback` 中，检测 Anthropic 的 `thinking` content block
- 新增事件类型 `thinking_delta`，payload 为思考文本增量
- 注意：OpenAI 兼容引擎可能不支持 thinking，需要条件处理

**前端变更**：
1. `ConversationMessage` 类型扩展：
   ```typescript
   interface ConversationMessage {
     role: 'user' | 'assistant'
     content: string
     thinking?: string  // 新增
     tools?: { name: string; label: string; output?: string; isError?: boolean }[]
   }
   ```
2. `ThinkingBlock` 组件：
   - 默认折叠：显示 `▸ 思考中…` 或 `▸ 已思考`（附摘要：取前 30 字）
   - 展开：左边框 2px `var(--queue-border)` + 斜体 + `var(--item-meta)` 色
   - 流式输出时展开显示，`done` 后自动折叠
3. `ToolBlock` 组件改进（替换现有简单 div）：
   - 折叠态：pill 徽章 `▸ bash: ls -la`
   - 展开态：显示命令 + 输出（输出限高 120px，可滚动）
   - 错误态：pill 边框变红
   - 点击切换折叠/展开

**验收标准**：
- [ ] thinking 流式输出时展开显示，完成后自动折叠
- [ ] 折叠态显示摘要文字
- [ ] tool pill 可点击展开/折叠
- [ ] 错误的 tool 调用有红色视觉区分
- [ ] 无 thinking 支持的引擎（OpenAI）不显示 thinking 区域

---

## Phase 2 — 智能上下文

### F3: 上下文自动注入
> 优先级：P1 · 预估：中等 · 依赖：无（可与 Phase 1 并行开发）

**目标**：打开对话时自动将当前选中日志作为上下文，输入框上方显示 context chip，可移除/追加。

**涉及文件**：
| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src-tauri/src/conversation.rs` | 修改 | `conversation_create` 接受 `context_files: Vec<String>` |
| `src/lib/tauri.ts` | 修改 | `conversationCreate` 参数扩展 |
| `src/hooks/useConversation.ts` | 修改 | 管理 context files 状态 |
| `src/components/ConversationDialog.tsx` | 修改 | 新增 ContextBar 区域 |
| `src/components/ContextChip.tsx` | 新建 | 上下文文件 chip 组件 |
| `src/App.tsx` | 修改 | 传递 selectedEntry 给对话框 |

**Rust 层变更**：
- `conversation_create` 新增 `context_files: Option<Vec<String>>` 参数
- 读取每个文件内容，拼接到 system prompt 的 `## 当前上下文` 段落
- 文件内容截断策略：单文件 ≤ 8000 字，总计 ≤ 20000 字

**前端变更**：
1. `App.tsx`：打开对话框时，如果有 `selectedEntry`，自动将其 `path` 作为初始 context
2. `ContextBar`（输入框上方）：
   - 显示 context chip 列表：`📄 14-AI平台会议.md ×`
   - 支持拖拽文件到 ContextBar 追加
   - 点击 × 移除
   - 空状态：`+ 拖拽添加上下文` 虚线提示
3. `conversationCreate` IPC 调用传入 context_files 数组

**验收标准**：
- [ ] 选中日志后打开对话，自动注入该日志为上下文
- [ ] context chip 可移除
- [ ] 可拖拽文件追加上下文
- [ ] system prompt 中包含文件内容
- [ ] 无选中日志时打开对话，无默认上下文

---

### F4: 斜杠快捷命令
> 优先级：P1 · 预估：小 · 依赖：F3（命令需要上下文才有意义）

**目标**：输入 `/` 弹出命令面板，预置命令注入 prompt 模板。

**涉及文件**：
| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/components/SlashCommandMenu.tsx` | 新建 | 命令面板组件 |
| `src/components/ConversationDialog.tsx` | 修改 | 输入框集成斜杠检测 |
| `src/lib/slashCommands.ts` | 新建 | 命令定义和 prompt 模板 |
| `src/locales/en.ts` | 修改 | 命令名称和描述 i18n |
| `src/locales/zh.ts` | 修改 | 同上 |

**命令定义**：
```typescript
interface SlashCommand {
  name: string        // "summarize"
  icon: string        // "📝"
  description: string // "总结当前日志"
  prompt: string      // "请总结以下内容的要点，提取关键决策和待办事项：\n\n{context}"
}
```

**预置命令**：
| 命令 | 说明 | Prompt 模板 |
|---|---|---|
| `/summarize` | 总结当前日志 | 提取要点、关键决策、待办 |
| `/todos` | 提取待办事项 | 提取所有待办，输出 checkbox 格式 |
| `/translate` | 翻译为英文 | 将内容翻译为英文，保持格式 |
| `/rewrite` | 改写润色 | 改写为更专业的表达 |
| `/tags` | 重新生成标签 | 分析内容，生成 3-5 个标签 |

**交互逻辑**：
1. 输入框检测到 `/` 开头时，弹出命令面板（定位在输入框上方）
2. 继续输入进行模糊过滤
3. 键盘 ↑↓ 选择，Enter 确认，Esc 关闭
4. 确认后：清空输入框，将 prompt 模板（替换 `{context}` 为当前上下文）作为 user message 发送

**验收标准**：
- [ ] 输入 `/` 弹出命令面板
- [ ] 模糊搜索过滤
- [ ] 键盘导航 + Enter 确认
- [ ] 命令执行后正确注入 prompt
- [ ] 无上下文时命令仍可用（prompt 中 `{context}` 替换为空）

---

## 跨特性机制 — 异步非阻塞对话

> 贯穿 F5 和核心对话架构的关键机制。两个核心能力：
> 1. 转写未完成时允许发送（消息自动合并）
> 2. AI 输出过程中允许发送（中途干预）

### M1: AI 输出中途干预
> 优先级：P1 · 预估：中等 · 依赖：无（可独立于 F5 实现）

**目标**：AI 在多轮工具循环中输出时，用户可以随时发送消息，消息在当前 turn 结束后注入，实现中途干预。

**核心原理**：
```
AI 工具循环（最多 30 轮）：
  Turn 1: LLM → tool_use → tool_result → 
  Turn 2: LLM → tool_use → tool_result →
  ──── 用户发送 "别查了，直接告诉我结论" ────
  Turn 3: LLM 收到 [tool_result + 用户干预消息] → end_turn
```

Agent 模式下 `conversation.rs` 的 `run_conversation_turn` 是一个循环：每轮 LLM 调用 → 执行工具 → 拼接 tool_result → 下一轮。用户的干预消息可以在 tool_result 之后、下一轮 LLM 调用之前注入。

**涉及文件**：
| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src-tauri/src/conversation.rs` | 修改 | 新增 pending_user_messages 队列 + 注入逻辑 |
| `src/hooks/useConversation.ts` | 修改 | streaming 期间 send 走不同路径 |
| `src/components/ConversationDialog.tsx` | 修改 | streaming 期间输入框保持可用 |
| `src/lib/tauri.ts` | 修改 | 新增 `conversationInject` IPC |

**Rust 层变更**：
1. `ConversationSession` 新增字段：
   ```rust
   pub(crate) struct ConversationSession {
       // ... 现有字段 ...
       pending_user_messages: Vec<String>,  // 新增：用户在 AI 输出期间发送的消息
   }
   ```
2. 新增 `conversation_inject` 命令：
   ```rust
   #[tauri::command]
   pub async fn conversation_inject(
       store: State<'_, ConversationStore>,
       session_id: String,
       message: String,
   ) -> Result<(), String>
   ```
   - 将消息 push 到 `pending_user_messages`
   - 前端同时 emit `conversation-stream` 事件显示用户气泡
3. 修改 `run_conversation_turn` 的工具循环：
   ```rust
   // 在每轮 tool_result 拼接后、下一轮 LLM 调用前：
   {
       let mut sessions = store.lock()...;
       let session = sessions.get_mut(&sid)...;
       let pending = std::mem::take(&mut session.pending_user_messages);
       if !pending.is_empty() {
           // 将所有 pending 消息合并为一条 user message 追加到 messages
           let combined = pending.join("\n\n");
           messages.push(Message {
               role: Role::User,
               content: vec![ContentBlock::Text(format!(
                   "[用户补充指令]\n{}", combined
               ))],
           });
       }
   }
   ```
4. 注入时机：在 `ToolUse` 分支的 tool_result push 之后、下一次 `engine.chat_stream` 之前

**前端变更**：
1. `useConversation.send()` 改为条件路由：
   - `isStreaming === false` → 调用 `conversationSend`（现有逻辑）
   - `isStreaming === true` → 调用 `conversationInject`（新增）
2. 输入框在 streaming 期间保持可用（移除现有的 disabled 逻辑）
3. 用户在 streaming 期间发送的消息，气泡显示时带一个小标记（如虚线边框或 `↳ 干预` 标签），表示这是中途插入的

**Chat 模式处理**：
- Chat 模式是单轮（无工具循环），AI 输出期间发送的消息排队等待当前轮结束
- 当前轮 `done` 后，自动将排队消息作为新一轮发送

**验收标准**：
- [ ] AI 输出期间输入框可用
- [ ] Agent 模式：用户消息在下一个 tool turn 边界注入
- [ ] Chat 模式：用户消息在当前轮结束后自动发送
- [ ] 干预消息在对话中有视觉区分
- [ ] 多条干预消息正确合并

---

## Phase 3 — 深度体验

### F5: 富输入框
> 优先级：P2 · 预估：大 · 依赖：F3（上下文 chip 机制）、M1（非阻塞发送机制）

**目标**：输入框支持文件附件、粘贴、多行自适应、语音文件先转写再注入（转写期间不阻塞发送）。

**涉及文件**：
| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/components/ConversationDialog.tsx` | 修改 | 输入区域重构 |
| `src/components/ConversationInput.tsx` | 新建 | 独立的富输入组件 |
| `src/components/AttachmentChip.tsx` | 新建 | 附件 chip（复用 FileCard 逻辑） |
| `src/hooks/useConversation.ts` | 修改 | 新增附件管理和转写状态 |
| `src-tauri/src/conversation.rs` | 修改 | `conversation_send` 支持附件 |
| `src/lib/tauri.ts` | 修改 | 新增 `conversationSendWithAttachments` |

**输入框能力矩阵**：
| 能力 | 实现方式 |
|---|---|
| 多行自适应 | textarea `rows` 动态计算，maxHeight 120px |
| 拖拽文件 | `onDragOver` / `onDrop` 事件 |
| ⌘V 粘贴文件 | 复用 CommandDock 的 clipboard 路由逻辑 |
| 附件预览 | chip 列表（文件名 + 类型图标 + × 移除） |
| + 按钮选文件 | Tauri `dialog.open()` |

**语音文件转写流程（异步非阻塞）**：
1. 检测附件是否为音频（`.m4a` / `.wav` / `.mp3`）
2. 检查是否已有 `.transcript.json` sidecar → 有则直接读取
3. 无则调用 `retry_transcription` 触发 ASR
4. 转写期间：chip 显示 spinner + 进度，**发送按钮始终可用**
5. 转写完成前发送的消息进入「待合并队列」（前端 state）
6. 转写完成后：所有待合并消息 + 转写文本自动合并为一条 user message 发送给 AI
7. 合并格式：
   ```
   [音频转写: 会议录音.m4a]
   Speaker A (0:00): ...
   Speaker B (1:23): ...
   [/音频转写]

   用户消息 1: 帮我总结关键决策
   用户消息 2: 特别关注预算部分
   ```

**待合并队列设计**：
- 前端维护 `pendingMessages: string[]` 状态
- 每次用户点击发送：消息追加到队列，输入框清空，消息气泡正常显示（带「等待转写」标记）
- 转写完成时：触发 `flushPendingMessages()`，将队列中所有消息 + 转写文本合并为一条发送
- 如果用户在转写完成前移除了音频附件：队列中的消息立即逐条发送（不再等待）

**Rust 层变更**：
- 新增 `conversation_send_with_attachments` 命令
- 接受 `attachments: Vec<AttachmentInfo>`（path + kind + transcript_text）
- 将附件内容拼接到 user message 前

**验收标准**：
- [ ] 拖拽文件到输入框显示附件 chip
- [ ] ⌘V 粘贴文件/图片
- [ ] + 按钮选择文件
- [ ] 音频文件自动触发转写
- [ ] **转写期间可以发送消息（不阻塞）**
- [ ] **转写完成前发送的多条消息自动合并**
- [ ] 转写完成后可预览文本
- [ ] 发送时附件内容正确注入
- [ ] 多行输入自适应高度

---

### F6: 会话持久化与历史
> 优先级：P2 · 预估：大 · 依赖：F1-F5（所有特性稳定后持久化才有意义）

**目标**：对话历史持久化，左右分栏布局，会话标题 LLM 动态总结。

**涉及文件**：
| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src-tauri/src/conversation.rs` | 大改 | 持久化读写 + 标题生成 + 多会话管理 |
| `src/components/ConversationDialog.tsx` | 大改 | 分栏布局重构 |
| `src/components/SessionList.tsx` | 新建 | 左栏会话列表 |
| `src/components/SessionItem.tsx` | 新建 | 会话列表项 |
| `src/hooks/useConversation.ts` | 大改 | 多会话切换 + 持久化加载 |
| `src/types.ts` | 修改 | 新增 Session 相关类型 |
| `src/lib/tauri.ts` | 修改 | 新增会话管理 IPC |

**存储设计**：
```
workspace/.conversations/
  {session_id}.json
  index.json          # 会话索引（id, title, mode, linked_entry, created_at, updated_at, status）
```

**单个会话文件结构**：
```json
{
  "id": "conv-xxxx",
  "title": "Q3 规划会议分析",
  "title_locked": false,
  "mode": "chat",
  "linked_entry": "2604/14-AI平台会议.md",
  "created_at": 1713100000,
  "updated_at": 1713100300,
  "status": "done",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "...", "thinking": "...", "tools": [...] }
  ]
}
```

**Rust 层变更**：
1. 新增 `conversation_list` 命令 — 返回 index.json 内容
2. 新增 `conversation_load` 命令 — 加载指定会话到内存 + 返回 messages
3. 修改 `conversation_send` — 每轮完成后写入文件
4. 新增 `conversation_rename` 命令 — 手动修改标题
5. 新增 `conversation_delete` 命令 — 删除会话文件
6. 标题生成：首轮 `done` 后，异步发起独立 LLM 调用
   - System: `"用≤8个中文字总结主题，只输出标题"`
   - Messages: 仅首轮 user + assistant
   - 新增 `conversation-title` 事件：`{ session_id, title }`
   - 失败 fallback：用户首条消息前 15 字

**前端分栏布局**：
- 对话框宽度从 560px → 720px
- 左栏 200px：`SessionList` 组件
  - 顶部：`+ 新建会话 ⌘N` 按钮
  - 「输出中」分组：绿色脉冲圆点，按时间倒序
  - 分隔线
  - 「已完成」分组：灰色圆点，按时间倒序
  - 会话项：标题 + meta（时间 · 关联日志）
  - 新建会话时标题显示 shimmer 骨架屏
  - 标题双击可编辑（设置 `title_locked: true`）
- 右栏自适应：现有对话内容区域
- 右栏 header：显示当前会话标题 + 状态 badge

**多会话并行**：
- 切换会话时，正在输出的会话继续后台流式
- `ConversationStore` 已是 HashMap，天然支持
- 前端维护 `activeSessionId`，切换时只改变渲染的 messages

**验收标准**：
- [ ] 关闭对话框后重新打开，历史会话可见
- [ ] 左栏按状态分组显示
- [ ] 点击切换会话，右栏内容更新
- [ ] 新建会话后标题自动生成
- [ ] 标题双击可编辑
- [ ] 正在输出的会话切走后继续输出
- [ ] 删除会话功能正常

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| Markdown 渲染性能（长消息流式更新） | 卡顿 | marked 解析极快（<1ms/次），必要时加 debounce |
| highlight.js 包体积 | 构建产物变大 | 按需加载语言包，仅注册常用 5-6 种 |
| 音频转写延迟阻塞发送 | 用户等待 | **不阻塞** — 转写期间允许发送，消息自动合并，转写完成后统一注入 |
| AI 输出期间用户无法干预 | 体验僵硬 | M1 机制：用户消息在 tool turn 边界注入，实现中途干预 |
| 多条干预消息时序混乱 | 语义错乱 | 合并为单条 `[用户补充指令]`，保持时序 |
| 多会话并行内存占用 | 内存增长 | 非活跃会话只保留 index 信息，messages 按需加载 |
| Anthropic thinking API 变更 | 兼容性 | thinking 作为可选特性，无则不显示 |

---

## 决策记录

| # | 决策 | 理由 |
|---|---|---|
| D1 | 使用 `marked` 而非 `react-markdown` | marked 更轻量，纯函数调用，适合流式场景 |
| D2 | 语音附件全文注入而非摘要注入 | 会议录音通常 2000-8000 字，现代 LLM context window 可控 |
| D3 | 会话存储为独立 JSON 文件而非 SQLite | 与现有 workspace 文件结构一致，可 git 追踪 |
| D4 | 标题生成用独立 LLM 调用而非从对话中提取 | 更可控，不依赖对话内容格式 |
| D5 | 左栏按状态分组而非 tab 切换 | 两组需同时可见，用户可能边等输出边查看历史 |
| D6 | 转写期间允许发送，消息自动合并 | 不阻塞用户思路，转写是后台任务不应冻结交互 |
| D7 | AI 输出中途干预在 tool turn 边界注入 | 利用现有多轮循环的天然间隙，无需中断流式输出 |
| D8 | 干预消息合并为单条而非逐条注入 | 避免 LLM 收到碎片化指令，保持语义完整性 |
