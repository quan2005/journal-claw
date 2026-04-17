# CLAUDE.md

谨迹（JournalClaw）维护指南。面向 AI 编码助手和人类开发者。

## 用户画像

知识工作者：频繁参与会议、整理文档，每天产生多条日志。核心任务是**高效浏览 + 沉浸阅读**，不是创作。情感期望：打开即平静，阅读时忘记工具的存在。

## 设计基调

**克制 · 沉静 · 专业**（Intentional · Quiet · Precise）

- 参考：Bear App（阅读沉浸）、Things 3（交互精度）、Linear（信息密度）、Aesop（克制的高级感）
- 反参考：Notion 彩色 banner / 卡片阴影；AI slop（紫蓝渐变、霓虹、玻璃态、bounce 缓动）
- 主题优先级：深色模式为主要质量基准；浅色同等打磨
- 主 accent：琥珀金 `#B8782A`（light）/ `#C8933B`（dark）— 按钮、选中态、活跃状态
- 录音红：`#ff3b30` / `#ff375f` — 仅用于录音中状态
- 灰色系带微妙冷青 tint（ink-cyan neutrals），不是死灰
- 完整设计规范见 `.impeccable.md`

### 设计原则速查

1. **留白即信息** — 紧密 8–12px 组内，宽松 32–48px 章节间
2. **层级靠字号 + 字重** — 不靠颜色
3. **单一 accent** — 全局只有琥珀金。录音红仅限录音态
4. **动效有纪律** — 只动 transform + opacity，≤300ms，ease-out，尊重 prefers-reduced-motion
5. **Anti-slop** — 拒绝紫蓝渐变、bounce 缓动、装饰性模糊、渐变文字、卡片套卡片

---

## 常用命令

```bash
# Dev（同时启动 Vite + Tauri）
npm run tauri dev

# 仅前端（Vite at localhost:1420）
npm run dev

# 前端测试
npm test                    # vitest run（单次）
npm run test:watch          # watch 模式
npx vitest run src/tests/JournalItem.test.tsx   # 单文件

# 前端构建检查
npm run build               # tsc + vite build

# Lint & Format
npm run lint                # eslint
npm run format:check        # prettier

# Rust 测试
cd src-tauri && cargo test

# E2E 测试
npm run test:e2e            # playwright

# 生产构建
npm run tauri build
```

---

## 技术栈

**Tauri v2 + React 19 + TypeScript + Rust**，macOS 桌面应用。

两个 webview 窗口：`index.html`（主界面）、`settings.html`（设置面板）。

外部二进制：`journal-speech`（Swift CLI sidecar，Apple SpeechAnalyzer / SFSpeechRecognizer）。

---

## 数据流

```
用户操作（拖入文件 / 录音 / 粘贴文本）
  → 前端调用 invoke() — src/lib/tauri.ts
  → Rust command 处理
  → 原始素材写入 workspace/yyMM/raw/
  → 内置 LLM 引擎（src-tauri/src/llm/）调用 Anthropic Messages API
  → 生成 .md 日志写入 workspace/yyMM/
  → Rust emit Tauri 事件
  → 前端 hooks 监听并刷新 UI
```

### Workspace 目录结构（用户配置，默认 `~/Documents/journal/`）

```
workspace/
  yyMM/              # 如 "2603" = 2026年3月
    raw/             # 原始素材：.m4a, .txt, .pdf, .docx, ...
    DD-title.md      # 日志条目（YAML frontmatter: summary, tags）
  identities/        # 身份画像 .md 文件
  todos.md           # 待办事项
  done.md            # 已完成待办
  .claude/           # workspace 级 AI 配置（CLAUDE.md, skills/）
```

### 日志条目格式

```markdown
---
summary: 一句话摘要
tags: [tag1, tag2]
---

# Title

Body content...
```

文件名：`DD-title.md`（如 `28-AI平台产品会议纪要.md`），`DD` 前缀决定排序。

---

## 前端架构（`src/`）

### 核心文件

| 文件 | 职责 |
|---|---|
| `App.tsx` | 根布局：左侧列表（可调宽）+ 分割线 + 右侧详情 + 底部 CommandDock |
| `src/lib/tauri.ts` | **IPC 边界** — 所有 `invoke()` 调用集中于此，新增命令必须在此添加 |
| `src/types.ts` | 共享 TS 类型：`JournalEntry`, `IdentityEntry`, `TodoItem`, `QueueItem`, `ConversationMessage` 等 |
| `src/contexts/I18nContext.tsx` | i18n：`detectLang()` → `useTranslation()` → `t(key)` |
| `src/locales/en.ts`, `zh.ts` | 中英文字符串 |

### Hooks

| Hook | 职责 |
|---|---|
| `useJournal.ts` | 按月分页加载日志（每批 3 个月），监听 `ai-processing` / `ai-log` / `journal-updated` / `recording-processed` / `audio-ai-material-ready` / `recording-discarded` / `audio-pipeline-failed` / `conversation-stream` 事件，管理处理队列状态 |
| `useRecorder.ts` | 录音状态机：idle → recording → idle |
| `useTheme.ts` | light/dark/system 主题，通过 `workspace_settings` Rust 命令持久化 |
| `useIdentity.ts` | 加载身份画像，3s 轮询，监听 `speakers-updated` / `identity-updated` |
| `useTodos.ts` | 待办 CRUD，3s 轮询，监听 `todos-updated` |
| `useConversation.ts` | 会话管理：streaming text/thinking/tool/web_search blocks，create/send/cancel/close/load |

### 组件

| 组件 | 职责 |
|---|---|
| `JournalList.tsx` | 日志列表，月份分组，分页加载 |
| `JournalItem.tsx` | 单条日志行 |
| `DetailPanel.tsx` | 右侧日志详情，Markdown 渲染 |
| `IdentityList.tsx` | 身份画像列表 |
| `IdentityDetail.tsx` | 身份画像详情 |
| `CommandDock.tsx` | 底栏：录音按钮、文件拖放、粘贴、斜杠命令输入 |
| `ConversationDialog.tsx` | 浮动会话面板（chat/agent 模式） |
| `ConversationInput.tsx` | 会话输入框 |
| `SessionList.tsx` | 会话历史列表 |
| `ProcessingQueue.tsx` | AI 处理队列浮层 |
| `TodoSidebar.tsx` | 右侧待办面板 |
| `TitleBar.tsx` | 自定义标题栏：拖拽区域、主题切换、待办/会话按钮 |
| `AiStatusPill.tsx` | AI 处理状态指示器 |
| `MarkdownRenderer.tsx` | Markdown 渲染（syntax highlighting） |
| `SlashCommandMenu.tsx` | 斜杠命令自动补全 |
| `SidebarTabs.tsx` | 标签切换：日志 / 画像 |
| `FindBar.tsx` | Cmd+F 页内搜索 |

### 设置面板（`src/settings/`）

`SettingsLayout.tsx` → 各 Section 组件：`SectionGeneral`, `SectionAiEngine`, `SectionVoice`, `SectionSpeakers`, `SectionAutomation`, `SectionFeishu`, `SectionPermissions`, `SectionPlugins`, `SectionAbout`

---

## Rust 后端架构（`src-tauri/src/`）

### 模块总览

| 模块 | 职责 |
|---|---|
| `main.rs` | Tauri setup，菜单（Cmd+Q/,/H），窗口状态保存/恢复，invoke_handler 注册（50+ 命令） |
| `config.rs` | `Config` 结构体；`app_data_dir/config.json` 读写；vendor 配置（volcengine/zhipu/dashscope/anthropic）、ASR 配置、WhisperKit 模型管理、飞书配置 |
| `llm/` | **内置 LLM 引擎**：`mod.rs`（trait）、`anthropic.rs`（Messages API 客户端）、`bash_tool.rs`（工具调用）、`prompt.rs`（提示词）、`tool_loop.rs`（工具循环）、`types.rs` |
| `conversation.rs` | 会话系统：chat/agent/observe 模式，streaming via `conversation-stream` 事件，持久化 |
| `ai_processor.rs` | AI 处理队列消费者，workspace `.claude/` 初始化，事件发射 |
| `journal.rs` | 日志条目文件系统扫描，YAML frontmatter 解析，`list_journal_entries_by_months`，`list_available_months` |
| `workspace.rs` | 路径工具：`year_month_dir`，`raw_dir`，`ensure_dirs` |
| `materials.rs` | `import_file`（复制到 raw/）、`import_text`（保存为 .txt） |
| `recorder.rs` | cpal 音频采集，WAV → M4A（afconvert），中断录音恢复 |
| `audio_pipeline.rs` | 音频预处理管线（为 AI 准备） |
| `audio_process.rs` | 降噪（nnnoiseless）、重采样（rubato）、静音移除 |
| `transcription.rs` | 语音转文字（Apple STT / DashScope / WhisperKit），`.transcript.json` sidecar |
| `speaker_profiles.rs` | 设备端声纹识别，档案 CRUD，合并 |
| `identity.rs` | 身份画像管理（人物、项目、概念） |
| `todos.rs` | 待办事项，workspace 路径分组，到期日，会话关联 |
| `auto_lint.rs` | 定时知识库维护（矛盾检测、缺口填补），调度器 + `trigger_lint_now` |
| `skills.rs` | 技能插件发现（项目级 + 全局 `~/.claude/skills/`），`SKILL.md` frontmatter 解析 |
| `feishu_bridge.rs` | 飞书 WebSocket 客户端 |
| `permissions.rs` + `permissions_ffi.m` | macOS 麦克风/语音识别权限检查 |
| `workspace_settings.rs` | 每 workspace 的 `settings.json`（主题、auto-lint 配置） |

---

## Tauri IPC 约定

- 所有 Tauri 命令在 `main.rs` 的 `invoke_handler![]` 注册
- 前端封装在 `src/lib/tauri.ts` — 新增命令**必须**同步添加
- Rust → 前端事件（`app.emit`）：

| 事件名 | 来源 | 用途 |
|---|---|---|
| `ai-processing` | `ai_processor.rs` | 处理状态更新（queued/processing/completed/failed） |
| `ai-log` | `ai_processor.rs` | AI 处理日志行 |
| `journal-updated` | `ai_processor.rs`, `auto_lint.rs` | 日志条目变更，触发列表刷新 |
| `todos-updated` | `ai_processor.rs` | 待办变更 |
| `recording-processed` | `ai_processor.rs` | 录音处理完成 |
| `recording-processing` | `recorder.rs` | 录音正在处理 |
| `recording-discarded` | `ai_processor.rs` | 录音被丢弃 |
| `audio-ai-material-ready` | `audio_pipeline.rs` | 音频素材就绪 |
| `audio-pipeline-failed` | `audio_pipeline.rs` | 音频管线失败 |
| `conversation-stream` | `conversation.rs` | 会话 streaming 数据 |
| `transcription-progress` | `transcription.rs` | 转写进度 |
| `speakers-updated` | `speaker_profiles.rs`, `transcription.rs` | 声纹档案变更 |
| `identity-updated` | `identity.rs`, `speaker_profiles.rs` | 身份画像变更 |
| `feishu-config-changed` | `config.rs` | 飞书配置变更 |
| `feishu-status-changed` | `feishu_bridge.rs` | 飞书连接状态变更 |
| `auto-lint-status` | `auto_lint.rs` | 自动整理状态 |
| `whisperkit-download-progress` | `config.rs` | WhisperKit 模型下载进度 |

- 前端 DOM 事件（`window.dispatchEvent`）：`journal-entry-deleted`（DetailPanel / JournalList）

---

## 版本管理

版本号在三个文件中必须一致，由 release-please 自动同步，**不要手动修改**：
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package].version`
- `src-tauri/tauri.conf.json` → `version`

Commit message 遵循 **Conventional Commits**：

| 格式 | 版本变化 | 示例 |
|---|---|---|
| `fix: ...` | patch | `fix: 修复跨文件夹链接跳转` |
| `feat: ...` | minor | `feat: 新增标签筛选功能` |
| `feat!: ...` 或 body 含 `BREAKING CHANGE:` | major | `feat!: 重构存储格式` |
| `chore:` / `docs:` / `refactor:` / `test:` 等 | 无变化 | `chore: 更新依赖` |

合并到 master 后，release-please 自动维护 Release PR；合并该 PR 即完成打 tag + GitHub Release。

---

## CI/CD

| Workflow | 触发 | 内容 |
|---|---|---|
| `ci.yml` | PR / push to master | 前端：tsc + eslint + prettier + vitest；Rust：cargo fmt + clippy + test |
| `release.yml` | `v*.*.*` tag | 选择最新 Xcode（需 macOS 26 SDK），构建 Swift sidecar，`tauri build`，上传 .dmg 到 GitHub Release |
| `release-please.yml` | push to master | 自动管理 Release PR |

---

## 关键约束

1. **视觉一致性**：`JournalList` ↔ `IdentityList`、`DetailPanel` ↔ `IdentityDetail` 表现保持一致。修改其中一个时同步修改另一个。
2. **Context menu**：使用 Tauri v2 `@tauri-apps/api/menu`（`Menu`, `MenuItem`）。`tauri-plugin-context-menu` 是 v1 专用，不要使用。
3. **Theme**：通过 `workspace_settings` Rust 命令持久化，不用 localStorage（面板宽度除外）。
4. **AI 引擎**：内置 LLM 引擎通过 Anthropic Messages API 直接调用（`src-tauri/src/llm/`），不再使用 Claude CLI。支持 4 个 vendor：volcengine、zhipu、dashscope、anthropic。
5. **Swift sidecar**：`journal-speech` 二进制处理 Apple SpeechAnalyzer API（macOS 26+）和 SFSpeechRecognizer（旧版）。
6. **IPC 单一入口**：所有前端 → Rust 调用必须经过 `src/lib/tauri.ts`，不允许在组件中直接 `invoke()`。
