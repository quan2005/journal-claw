# 谨迹（JournalClaw）架构文档

## 技术栈

**Tauri v2 + React 19 + TypeScript + Rust** — macOS 桌面应用

两个 webview 窗口：主界面（`index.html`）、设置面板（`settings.html`）
外部二进制：`journal-speech`（Swift sidecar，Apple SpeechRecognizer）

---

## 系统分层

```
┌──────────────────────────────────────────────────────────────────┐
│  前端 (React 19 / TypeScript)          ~50 组件 · 13 Hooks       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ UIContext │ │ I18nCtx  │ │ ToastCtx │ │  TodoContext      │  │
│  └─────┬────┘ └──────────┘ └──────────┘ └───────────────────┘  │
│        │                                                        │
│  App.tsx (根布局)                                               │
│  ├─ TitleBar        自定义标题栏                                │
│  ├─ TreeSidebar     左侧树导航（日志/画像/主题）                │
│  ├─ DetailView      中心内容区（MDX 渲染）                      │
│  ├─ RightPanel      右侧面板（AI 聊天）                         │
│  └─ SettingsPanel   设置覆盖层（React.lazy 懒加载）             │
├──────────────────────────────────────────────────────────────────┤
│  IPC 边界 — src/lib/tauri.ts                                    │
│  100+ 类型化 invoke() 封装，组件禁止直接调用 invoke              │
├──────────────────────────────────────────────────────────────────┤
│  Rust 后端 (src-tauri/src/)            25 模块 · 78+ 命令       │
│  ┌────────┐ ┌────────┐ ┌─────────┐ ┌────────────┐             │
│  │ llm/   │ │ audio  │ │ storage │ │ integration│             │
│  │ AI引擎 │ │ 管线   │ │ 文件系统│ │ 飞书桥接   │             │
│  │ 14文件 │ │ 5引擎  │ │ 无数据库│ │ WebSocket  │             │
│  └────────┘ └────────┘ └─────────┘ └────────────┘             │
│  事件总线 → app.emit() → 前端 hooks listen() 自动刷新          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 核心设计决策

| 决策 | 实现 |
|---|---|
| **文件系统即数据库** | 所有用户数据存为 Markdown + YAML frontmatter，无 SQLite/IndexedDB |
| **事件驱动同步** | Rust 后端 `emit()` 事件，前端 hooks 监听后 `refresh()`，不轮询 |
| **IPC 单一入口** | 所有 `invoke()` 集中在 `tauri.ts`，铁律执行 |
| **自定义 MDX 引擎** | 轻量解析器 0.5–5ms，替代 `@mdx-js/mdx`（500ms–2s） |
| **无路由器** | 状态机导航：`view` + `treeSelection`，无 React Router |
| **纯 Context 状态** | 无 Redux/Zustand，4 个 Context + 13 个 Hooks |
| **内联样式** | 无 CSS-in-JS / Tailwind，CSS 变量做主题 |

---

## 前端架构

### 组件树

```
main.tsx
  I18nProvider
    ToastProvider
      UIProvider
        TodoProvider
          ErrorBoundary
            App
              TitleBar (38px)
              OnboardingView (条件渲染)
              SettingsPanel (position:absolute 覆盖层)
              ┌─ 左栏 ──────────────────────────────────┐
              │  TreeSidebar (文件树，可调宽)              │
              │  设置按钮（固定底部）                       │
              └──────────────────────────────────────────┘
              │ 分割线 (7px，可拖拽) │
              ┌─ 中栏 ──────────────────────────────────┐
              │  DetailView                               │
              │    journal → MDX/Markdown 渲染            │
              │    identity → 画像内容                    │
              │    topic-file → 代码/文本预览             │
              │    ideas → TodoSidebar                    │
              └──────────────────────────────────────────┘
              │ 分割线 (7px，可拖拽) │
              ┌─ 右栏 ──────────────────────────────────┐
              │  RightPanel                               │
              │    ChatPanel (AI 对话，76KB 大组件)       │
              │      ├─ 会话标签页管理                     │
              │      ├─ 消息列表（流式渲染）               │
              │      ├─ @引用 / 图片附件 / 斜杠命令       │
              │      └─ 工具调用展示                       │
              └──────────────────────────────────────────┘
```

### Hooks 层

| Hook | 职责 | IPC 关键调用 |
|---|---|---|
| `useJournal` | 按月分页加载日志，处理队列，监听 10+ 事件 | listMonths, listByMonths, enqueueWork |
| `useConversation` | 多标签页 AI 会话管理，流式渲染 | create, send, cancel, close, retry |
| `useRecorder` | 录音状态机：idle → recording → idle | startRecording, stopRecording |
| `useTheme` | light/dark/system，workspace_settings 持久化 | get/set_workspace_theme |
| `useIdentity` | 身份画像列表，事件监听刷新 | listIdentities |
| `useTodos` | 待办 CRUD，事件监听刷新 | list, add, toggle, delete, setDue |
| `usePinned` | 收藏条目 CRUD + 排序 | getPinnedItems, setPinnedItems |
| `useTopics` | workspace 目录树浏览 | listTopicsDir |
| `useOnboarding` | 首次引导向导状态 | getStatus, complete, setStep |
| `useSmoothStream` | 流式文本打字动画 (requestAnimationFrame) | — |
| `useEventCallback` | 稳定回调引用 | — |
| `useDelayedAnimated` | 延迟 true→false 过渡 | — |
| `useTextOverflow` | 文本溢出检测 (ResizeObserver) | — |

### Contexts

| Context | 管理的状态 |
|---|---|
| `UIContext` | view, selectedEntry, treeSelection, sidebarWidth, rightPanelOpen/Width, drag 状态 |
| `I18nContext` | lang, t(key), s (原始字符串) |
| `ToastContext` | showToast(level, message), 自动 4s 消失 |
| `TodoContext` | useTodos() 的透传包装，避免 prop drilling |

### MDX 渲染管线

```
content string
  │
  └─ stripFrontmatter()
      │
      ├─ .mdx 文件 → MdxRenderer
      │     parseMdx() → MdxNode[] (0.5–5ms)
      │       markdown 块 → ReactMarkdown + markdownComponents
      │       component 块 → createElement(40+ 自定义组件)
      │
      ├─ >100KB → MarkdownRenderer (Marked + highlight.js + DOMPurify)
      │
      └─ 默认 → ReactMarkdown + markdownComponents
```

MDX 组件分 8 类（`src/components/mdx/`）：

| 类别 | 组件 |
|---|---|
| Layout | Split, Columns, Column, Mockup, Placeholder, DeviceShowcase |
| Display | ProsCons, Pros, Cons, Stat, StatGroup, Table, Timeline, TagList, Progress, Avatar, AvatarGroup |
| Callout | Callout, Quote, RelatedEntry, RelatedIdentity |
| Cards | Cards, Card, Options, Option, Kanban, Checklist, Counter, RatingBar, Stack |
| Media | AudioCard, VideoCard, ImageViewer, FileCard |
| Charts | BarChart, LineChart, PieChart, RadarChart (懒加载) |
| Canvas | CanvasDiagram, Mermaid (懒加载) |
| Typography | Section, Subtitle, Label, Divider, Grid, Col, Flow |

### 设置面板

`SettingsLayout.tsx` — 148px 左侧导航 + 滚动内容区，scroll-spy 自动追踪。

| Section | 职责 |
|---|---|
| SectionGeneral | workspace 路径配置 |
| SectionAiEngine | 多供应商 AI 引擎配置（协议/API Key/模型选择） |
| SectionVoice | ASR 引擎选择 + WhisperKit 安装/下载 |
| SectionPermissions | 麦克风/语音识别权限 |
| SectionAutomation | auto-lint 配置（频率/时间/阈值） |
| SectionPlugins | 技能列表 + 全局技能开关 |
| SectionFeishu | 飞书集成配置 |
| SectionAbout | 版本信息/重置引导/链接 |

---

## Rust 后端架构

### 模块依赖

```
main.rs (入口 · 120 命令注册 · 9 个 Managed State)
│
├── llm/ — AI 引擎 (14 文件，核心)
│   ├── mod.rs             LlmEngine trait + 工厂函数
│   ├── anthropic.rs       Anthropic Messages API (652 行)
│   ├── openai_compat.rs   OpenAI 兼容层 (868 行)
│   ├── tool_loop.rs       Agentic 循环 (60 轮上限)
│   ├── prompt.rs          系统提示词组装
│   ├── bash_tool.rs       Shell 工具
│   ├── task_tool.rs       子代理工具
│   ├── fs_tools/          10 种文件系统工具 (read/write/edit/glob/grep/...)
│   ├── output_compress/   Bash 输出压缩
│   ├── compact.rs         上下文窗口压缩 (>100K tokens)
│   ├── retry.rs           指数退避重试 (8 次)
│   ├── loop_detector.rs   循环检测 (重复/乒乓/无进展)
│   ├── sse_parser.rs      SSE 流解析
│   └── model_quirks.rs    供应商特定行为适配
│
├── conversation.rs (1997 行) — 会话系统
│   chat/agent/observe 三模式
│   多标签页 · 流式事件 (18 种) · 上下文注入 · 持久化
│
├── ai_processor.rs (1010 行) — AI 队列消费
│   MPSC 单线程串行 · 取消支持 · panic 安全
│   workspace .claude/ 初始化 (脚本 + 技能 + 提示词)
│
├── journal.rs (874 行) — 日志条目扫描/解析
├── identity.rs (365 行) — 身份画像 CRUD
├── todos.rs (942 行) — 待办事项 (GFM task list)
│
├── 录音管线
│   recorder.rs (514 行)      cpal 采集 → WAV → M4A
│   audio_pipeline.rs (189 行) 编排转写+AI处理
│   transcription.rs          5 种 ASR 引擎
│   audio_process.rs          降噪/重采样/静音移除
│   speaker_profiles.rs       声纹识别
│
├── 辅助系统
│   config.rs              应用配置 (v1→v2→v3 迁移)
│   workspace_settings.rs  每 workspace 设置
│   skills.rs              技能插件发现
│   auto_lint.rs           定时知识库维护
│   work_queue.rs          后台任务队列
│   feishu_bridge.rs       飞书 WebSocket 桥接
│   materials.rs           文件导入
│   permissions.rs         macOS 权限管理
│   onboarding.rs          首次引导
│   topics.rs              目录树导航
```

### LLM 引擎

**Trait 设计**

```rust
#[async_trait]
pub trait LlmEngine: Send + Sync {
    async fn chat_stream(
        &self,
        messages: &[Message],
        tools: &[ToolDefinition],
        system: &str,
        event_tx: mpsc::UnboundedSender<StreamEvent>,
    ) -> Result<AssistantResponse, LlmError>;
}
```

**工厂函数** `create_engine_for_provider(api_key, base_url, model, protocol)`:
- `"openai"` → `OpenAiCompatEngine`（所有非 Anthropic 供应商）
- 其他 → `AnthropicEngine`

**供应商适配**（`openai_compat.rs`）:
- 消息格式转换：Anthropic 风格 ↔ OpenAI 风格
- 供应商特定处理：DashScope 6MB 限制、Kimi `is_error` 拒绝、o1/o3 推理模型 `max_completion_tokens`
- SSE 流转换：`reasoning_content` → ThinkingDelta

**Agentic 循环**（`tool_loop.rs`）:
1. 扫描可用技能
2. 构建工具列表：bash + load_skill + 10 种 fs_tools
3. 调用 LLM，收集流式事件
4. `ToolUse` 停止时执行工具调用
5. 循环检测：重复/乒乓/无进展，三级严重度（Warning/Block/Break）
6. 最多 60 轮

**系统提示词**（`prompt.rs`）组装：
1. 环境信息（workspace 路径、macOS 版本、当前时间）
2. 内置 agent 指令（编译时 `include_str!`）
3. 用户 workspace/CLAUDE.md
4. 最近 15 条日志摘要
5. 可用技能列表
6. 用户身份画像

### 会话系统（conversation.rs）

三种模式共享同一代码路径：
- **Agent 模式**：通过 `ai_processor` / `work_queue`，调用 `tool_loop::run_agent()`
- **Chat 模式**：通过 `conversation_*` 命令，独立的工具循环+前端事件流

关键设计：
- `ConversationStore`：Mutex<HashMap> 管理活跃会话
- 模块级单例缓存：globalCache / globalStreamingSessions / globalPendingQueue
- 持久化：`.sessions/{session_id}.json`
- 上下文注入：context_files 限制 8K/文件、20K 总量
- 异步标题生成：首轮交换后 LLM 生成 ≤8 字中文标题

### AI 队列消费（ai_processor.rs）

```
素材入队 (mpsc::channel)
  → 检查取消集
  → 构建引擎 + 提示词
  → tool_loop::run_agent()
  → 创建日志条目 {day}-{title}.md
  → emit journal-updated / todos-updated
```

Workspace 初始化（`ensure_workspace_dot_claude()`）：
- 4 个 Shell 脚本：journal-create, recent-summaries, identity-create, fix-frontmatter
- 6 个内置技能：ideate, identity-profiling, meeting-minutes, lint, self-improvement, visual-design-book

### 文件系统工具（fs_tools/）

10 种工具，全部沙箱化到 workspace：

| 工具 | 功能 |
|---|---|
| read | 读取文件（分页 30K、行号、图片→base64） |
| write | 创建新文件 |
| edit | 字符串替换（上下文匹配防歧义） |
| glob | 模式匹配文件查找 |
| grep | 内容搜索 |
| mkdir | 目录创建 |
| move | 移动/重命名 |
| copy | 复制 |
| remove | 删除 |
| stat | 文件元数据 |

安全措施：`sandbox_resolve()` 验证路径、规范化防 `..` 逃逸、符号链接检查。

---

## IPC 规模

| 域 | 命令数 | 关键操作 |
|---|---|---|
| Conversation | 15 | create/send/cancel/close/inject/truncate/retry/list/rename/delete/load |
| Todos | 10 | list/add/toggle/delete/setDue/setPath/removePath/setSessionId/updateText |
| Settings | 12 | theme/autoLint/globalSkills/pinnedItems |
| Workspace FS | 6 | listDir/duplicate/rename/move/delete |
| Identity | 7 | list/get/save/delete/create/merge |
| Journal | 7 | listMonths/listByMonth/listAll/paginated/getContent/delete |
| Recording | 6 | list/start/stop/delete/play/reveal |
| AI Processing | 6 | trigger/cancel/prompt/queue |
| ASR/WhisperKit | 8 | config/install/download/model |
| Materials | 5 | importFile/importText/importAudio/importImage |
| Topics | 4 | listDir/create/delete/importFile |
| Feishu | 3 | getConfig/setConfig/getStatus |
| Permissions | 3 | check/request/openSettings |
| **合计** | **~100+** | |

### Rust → 前端事件

| 事件名 | 来源模块 | 用途 |
|---|---|---|
| `ai-processing` | ai_processor | 处理状态（queued/processing/completed/failed） |
| `ai-log` | ai_processor | AI 处理日志行 |
| `journal-updated` | ai_processor, auto_lint | 日志条目变更 |
| `todos-updated` | ai_processor | 待办变更 |
| `recording-processed` | recorder | 录音处理完成 |
| `recording-processing` | recorder | 录音正在处理 |
| `recording-discarded` | recorder | 录音被丢弃 |
| `audio-ai-material-ready` | audio_pipeline | 音频素材就绪 |
| `audio-ai-material-failed` | audio_pipeline | 音频管线失败 |
| `conversation-stream` | conversation | 会话流式数据（18 种子事件） |
| `transcription-progress` | transcription | 转写进度 |
| `speakers-updated` | speaker_profiles, transcription | 声纹档案变更 |
| `identity-updated` | identity, speaker_profiles | 身份画像变更 |
| `work-queue-updated` | work_queue | 工作队列变更 |
| `feishu-status-changed` | feishu_bridge | 飞书连接状态 |
| `feishu-config-changed` | config | 飞书配置变更 |
| `auto-lint-status` | auto_lint | 自动整理状态 |
| `audio-level` | recorder | 录音音量（~10次/秒） |
| `open-settings` | main (菜单) | 打开设置面板 |
| `open-settings-about` | main (菜单) | 打开关于页 |
| `whisperkit-download-progress` | config | 模型下载进度 |
| `engine-install-log` | config | 引擎安装日志 |

### conversation-stream 子事件

`text_delta`, `thinking_delta`, `tool_start`, `tool_end`, `web_search_result`, `done`, `error`, `loop_warning`, `truncated`, `compacted`, `user_inject`, `title`, `turn_start`, `usage`, `subtask_start`, `subtask_delta`, `subtask_end`

---

## 典型数据流

### 录音 → AI → 日志条目

```
用户点击录音
  │
  ▼ useRecorder.startRecording()
  │ invoke('start_recording') → recorder.rs 启动采集
  │ 录音中：emits 'audio-level' (~10次/秒)
  │
用户点击停止
  │ invoke('stop_recording') → WAV → M4A 转换
  │ emits 'recording-processing'
  │ spawns audio_pipeline
  │
  ▼ 转写阶段
  │ transcription.rs → ASR 引擎 (Apple/DashScope/WhisperKit/SiliconFlow/Zhipu)
  │ emits 'transcription-progress'
  │ 写入 raw/{day}-rec-{time}.md
  │ emits 'audio-ai-material-ready'
  │
  ▼ 前端监听 → enqueueWork()
  │ work_queue.rs 创建 WorkItem
  │ emits 'work-queue-updated'
  │
  ▼ AI 队列消费 (串行)
  │ ai_processor.rs 从 MPSC channel 取任务
  │ emits 'ai-processing': "processing"
  │ llm/tool_loop::run_agent() 执行：
  │   读素材 → 构建提示词 → 调用 LLM → 使用文件工具写日志
  │   创建 {day}-{title}.md (YAML frontmatter + Markdown)
  │ emits 'ai-processing': "completed"
  │ emits 'journal-updated' → 前端刷新列表
  │ emits 'todos-updated'  → 前端刷新待办
```

### AI 会话

```
用户输入消息
  │
  ▼ useConversation.send()
  │ 乐观更新：本地追加用户消息
  │ conversationCreate() → conversation.rs 创建会话
  │ conversationSend() → 异步任务启动
  │
  ▼ Rust 会话处理
  │ 构建 system prompt（懒加载）
  │ run_conversation_turn() → LLM API 调用
  │ 流式 emit conversation-stream 事件
  │ 工具调用：bash/fs_tools/task（子代理并行）
  │ 循环检测 + 重试
  │
  ▼ 前端监听 conversation-stream
  │ text_delta → 流式文本追加
  │ thinking_delta → 思考块追加
  │ tool_start/end → 工具调用展示
  │ done → 完成标记，刷新标题
  │
  ▼ 持久化
  │ 保存 .sessions/{id}.json
  │ 异步生成标题（≤8 字中文）
```

---

## 文件系统数据模型

```
~/Documents/journal/              ← workspace 根目录
├── 2603/                         ← 年月目录 (YYMM)
│   ├── 28-AI平台产品会议纪要.md   ← 日志条目 (YAML frontmatter)
│   ├── 15-dashboard.html         ← HTML 格式条目
│   └── raw/                      ← 原始素材
│       ├── rec-1402.m4a          ← 录音文件
│       └── 28-paste-143022.txt   ← 粘贴文本
├── identity/                     ← 身份画像
│   ├── README.md                 ← "关于我" (自动创建)
│   └── 广州-张三.md              ← {region}-{name}.md
├── todos.md                      ← 待办 (GFM task list + HTML 注释元数据)
├── todos.done.md                 ← 已完成待办
├── .setting.json                 ← workspace 级设置
├── .claude/                      ← AI 配置 (自动生成)
│   ├── CLAUDE.md                 ← 系统提示词
│   ├── scripts/                  ← Shell 脚本 (journal-create 等)
│   └── skills/                   ← 技能插件
└── .sessions/                    ← 会话持久化
    └── {session-id}.json
```

### 元数据格式

**日志条目** — YAML frontmatter：
```yaml
---
summary: 一句话摘要
tags: [tag1, tag2]
---
```

**身份画像** — YAML frontmatter：
```yaml
---
summary: 人物描述
tags: [tag]
speaker_id: abc123
---
```

**待办事项** — GFM task list + HTML 注释：
```markdown
- [ ] 完成报告 <!-- due:2026-05-30 --> <!-- source:28-周会.md --> <!-- path:~/project -->
- [x] 修复bug <!-- done:2026-05-28 -->
```

---

## 架构特点

1. **极简存储** — 纯 Markdown + YAML，无数据库，文件可直接用任何编辑器打开
2. **AI 深度集成** — 内置完整 Agent 系统（工具循环、10 种文件系统工具、循环检测、上下文压缩）
3. **多供应商抽象** — LlmEngine trait 统一接口，4 个供应商（anthropic / volcengine / zhipu / dashscope）热插拔
4. **自定义 MDX 引擎** — 比 `@mdx-js/mdx` 快 100 倍，支持 40+ 富文本组件
5. **事件驱动** — Rust 后端主动推送，前端 hooks 响应式更新
6. **macOS 原生集成** — AVFoundation 录音、Apple STT、权限管理、飞书桥接
