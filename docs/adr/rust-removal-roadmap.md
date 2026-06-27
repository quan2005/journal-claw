# Rust 退出总路线图（Phase 10 施工计划）

日期：2026-06-26 · 编排者：Claude（Leader）

> 依据：`rust-api-parity.md`（134 命令，blocked ≈133）+ `rust-removal-acceptance.md`（Gate A–J）。
> 已定产品决策（用户 2026-06-26）：
> 1. **音频/语音/转写 → 下线（retire）**，不迁移、不进默认跨平台主干。
> 2. **宿主 → 迁移到 Electron**，目标彻底删除 Rust（不保留 Tauri shell）。
> 3. **顺序 → 地基优先**：settings/FS → CRUD → AI/会话 → 自动化 → host → 删 Rust。
> 4. **节奏 → 全自主连续推进**，仅分叉决策或验收失败时打断用户。

---

## 总览：9 个迁移阶段（M0–M8）

| 阶段 | 内容 | blocked 消化 | 依赖 | 风险 |
|---|---|---|---|---|
| **M0** | 下线音频/语音/转写 | ~18 | — | 低（纯移除） |
| **M1** | 地基：Settings + Config + Workspace FS | ~28 | M0 | 中 |
| **M2** | 本地数据 CRUD：journal/todos/topics/identity/materials | ~35 | M1 | 低 |
| **M3** | Skills + MDX + onboarding + 杂项 | ~18 | M1 | 低 |
| **M4** | AI 处理 + work queue | ~12 | M1,M2 | 中 |
| **M5** | Conversation（LLM 引擎，核心最难） | 13 | M1,M4 | 高 |
| **M6** | Automation / routines | ~10 | M5 | 中 |
| **M7** | Electron host（去 Tauri） | Gate A | M1–M6 | 高 |
| **M8** | 删除 Rust + Gate A–J 收尾 | 归零 | 全部 | 中 |

每个 M 阶段进入编码前走 `requirements-gate` 产 story，完成走 `verification-gate` 由我独立验收，按 Leader 模式派 codex 执行。

---

## M0 · 下线音频/语音/转写（先做，最大幅简化）

**目标**：从默认跨平台主干移除录音/转写/说话人识别，UI + 文档明确下线，直接扫清 Gate H 一票否决项。

**涉及命令**（标 `retired`）：
- `transcription.rs`(2)、`speaker_profiles.rs`(5)、`audio_files.rs`(1)、`audio_pipeline.rs`(1)、`audio_process`
- config 内：`get/set_asr_config`、`get_apple_stt_variant`、`check_whisperkit_cli_installed`、`install_whisperkit_cli`、`download_whisperkit_model`、`get_whisperkit_models_dir`、`check_whisperkit_model_downloaded`、`check_speaker_embedder`、`prepare_audio_for_ai`

**验收**：前端无录音/转写入口；`rg` 默认 build/test 不依赖 Apple Speech/WhisperKit/ffmpeg；parity 矩阵对应行翻 `retired`；用户可读下线说明。

**为何先做**：纯移除、零迁移成本，砍掉最难啃的平台绑定块，blocked 一次降 ~18，Gate H 否决项清除。

**用户可见变化**：设置中不再提供语音转写与声纹管理入口；导入音频不会再触发转写、模型下载或说话人识别。

---

## M1 · 地基：Settings + Config + Workspace FS

被几乎所有功能依赖，必须先行。拆 3 个可独立验收子单元：

- **M1a · Settings 服务**：workspace path、theme、AI engine config、API keys、skills 开关、auto_lint config、feishu config、platform capabilities、app version → daemon `/settings/*`。注意 API key 安全存储（不落明文到 workspace）。
- **M1b · Workspace FS 读**：`list_workspace_dir`、`list_at_mention_candidates` → `/files`（树/候选）。
- **M1c · Workspace FS 写**：`workspace_duplicate/rename/move/delete_file`、`import_file/text/image` → **复用现有 `ChangeSetService`（G8）**，delete 走 `.journal-trash`。

**验收**：设置读写经 daemon 持久化；文件树/导入/移动/删除可用且可恢复；前端切到 daemon 路径不回退 Tauri。

---

## M2 · 本地数据 CRUD（低风险，可并行）

文件型 CRUD，各自独立、可并行派发：
- **journal**(10)：list months/by-month/all/paginated、get/save/delete content、sample entry
- **todos**(9)：list/add/toggle/delete/set due/set path/set session/remove path/update text
- **topics**(4)：list/create/delete/import file
- **identity**(8)：list/get/save/delete/archive/unarchive/create/merge
- **materials**(4)

**验收**：每类 daemon service + 路由 + 前端接入 + 测试；现有 workspace 文件格式保持可读（Gate G）。

---

## M3 · Skills + MDX + onboarding + 杂项

- **skills**(10)：list/get content/enabled 开关/dirs
- **mdx**(1)：`compile_mdx`（MDX→HTML，纯 TS 可做）
- **onboarding**(4)、**permissions**(3，去掉 Apple 权限后多为 noop/下线)、**auto_lint**(2)、**event_log**(1)、**directive_migration**(2)

---

## ME · 引擎集成（pi）⭐ 关键路径（决策 1 = A′，用户 2026-06-27 定）

采用 [`pi`](https://github.com/earendil-works/pi)（`pi-agent-core` + `pi-ai`，MIT）作 daemon 内建引擎。插在 M4 前，M4/M5/M6 都建于其上。3 子单元：
- **ME-a**：加 pi 依赖（锁版本）+ 引擎 service 骨架 + vendor/model 配置（anthropic/openai 原生；volcengine/zhipu/dashscope 走 openai-completions provider + 自定义 baseURL；接 ConfigService 加密 key + engine config）+ 用 pi `faux` provider 写测试（无需真 key）。
- **ME-b**：AgentTools（bash / fs 经 ChangeSet / subtask）+ 授权钩子（beforeToolCall→AuthorizationMode 门，afterToolCall→ChangeSet 记录）。
- **ME-c**：pi 事件 → AgentRunEvent 映射；接入 AgentRunService（Run 可用 pi 引擎）；prompt 组装 + skills 加载（从 Rust 移植，systemPrompt + transformContext）。
- **真实 vendor 验证（用户自测，2026-06-27）**：国产三家 chat+tool_call 由用户自行验证；配置面已就绪。CLI adapter 保留作 Agent Team 委派。

## M4 · AI 处理 + work queue（建于 ME 引擎，整体在 ME 后做）

- **ai_processor**(7) + `ai_plan`：触发/取消 AI 处理 → 走 ME 的 pi 引擎
- **work_queue**(5)：enqueue/list/cancel/retry/dismiss
- **digest / compact**（compact 可复用 pi transformContext）

---

## M5 · Conversation（核心，最难）⭐

`conversation.rs`(13)：create/send/cancel/close/inject/truncate/retry/list/rename/delete/get_messages/get_stats/load。

**关键架构决策（M5 启动前的子分叉，届时再过用户）**：Rust 现用**内建 LLM 引擎**（Anthropic Messages API 直连 + `llm/tool_loop.rs`，CLAUDE.md 约束4），daemon 现走 **CLI adapter**。两条路：
- (A) 把内建 tool loop 移植到 daemon（TS），保留 4 vendor 直连；
- (B) conversation 改走 CLI adapter 统一到 AgentRun。

需在 M5 启动时决策。conversation 多轮 session 模型需在 AgentRun 之上加 session 层。

**为何最后**：依赖地基 + AI 引擎稳定，是迁移最大风险点。

---

## M6 · Automation / routines

`automation_commands.rs`(10) + runner/store/schedule/templates。依赖 M5 的 run 引擎。

---

## M7 · Electron host（去 Tauri）

- 新建 `apps/desktop`（Electron）：仅窗口、菜单、daemon 生命周期，不承载业务语义。
- 前端停止 import `@tauri-apps/api/*`；`src/lib/tauri.ts` 降为 shim，默认指向 `HttpRuntimeClient`。
- package scripts 移除 `tauri dev/build` 默认依赖。
- **过 Gate A**：应用无 Tauri/Rust 可启动主窗口 + 设置。

---

## M8 · 删除 Rust + Gate 收尾

- 确认 blocked = 0（全部 replaced/retired）。
- 删除 `apps/web/src-tauri`；`rg "src-tauri|@tauri-apps|tauri::"` 仅余历史/迁移说明。
- Gate A–J 全过：测试矩阵（macOS/Win/Linux）、回滚说明、迁移 ADR、release note。
- 临时分支 dry-run 删 Rust 跑完整测试矩阵。

---

## 决策 · 下线 MDX（用户 2026-06-27，选 b 彻底移除）

后续不再支持 MDX，所有 MDX 支持彻底清理。执行排在 M6 之后（避免与 M5/M6 的 tauri.ts 改动冲突）：
- **删**：daemon mdx/（M3 迁的 compile_mdx）+ 前端 MdxRenderer + components/mdx/*（20+ 文件）+ journal-blocks/ + styles mdx.css/mdx-errors.css + 前端 tauri.ts 的 compile_mdx 封装 + MDX 相关依赖（@mdx-js 等）。
- **保留**：Rust mdx.rs 留 M8 删；markdown.css（纯 Markdown 样式）。
- **渲染替代**：日志详情改用 MarkdownRenderer（纯 Markdown）。
- **Gate G**：现有 MDX 笔记降级为纯 Markdown 渲染（MDX 特有 `<Component>` 块退化为文本/忽略，frontmatter + 正文保留可读），不做迁移脚本。
- **已知代价**：图表/mermaid/公式/callout 块消失，阅读体验退化（用户接受）。

## 补充决策（用户 2026-06-27）

- **决策 1 · LLM 引擎（🟡 暂定 A′，待国产 vendor 冒烟确认）**：评估采用第三方 [`pi`](https://github.com/earendil-works/pi)（`pi-agent-core` + `pi-ai`，MIT、纯 TS、可嵌入）作为 daemon 内建引擎，替代从零移植 Rust `tool_loop.rs`。pi 覆盖 agentic 循环/多轮 session/transformContext/多 vendor（含 OpenAI-compatible baseURL → volcengine/zhipu/dashscope）/before-afterToolCall 授权钩子。**采用前必须实测国产三家 chat+tool_call 兼容性**。CLI adapter 保留作 Agent Team 委派。
- **决策 2 · API key 存储**：简单加密存储（用户配置目录，非 workspace，纯 TS 跨平台），不落明文。M1a-2 落地。
- **决策 3 · 切换节奏**：逐能力 feature flag 渐进（便于验证），某能力 Tauri 路径空转后即删该路径；全部空转 → M7/M8 删 Tauri。
- **决策 4 · CI 矩阵**：M1–M6 保持 macOS CI；M7/M8 补 Win/Linux 三平台矩阵。

## 跨阶段约束（每单元都遵守）

- **Gate G**：现有 workspace 文件格式保持可读，不要求用户重新导入。
- **不破坏默认路径**：每单元前端切 daemon 后，Tauri 路径在该能力上不回退（feature flag 渐进）；空转后删除该 Tauri 路径。
- **安全闸门在验收**：codex 执行用 workspace-write 沙盒，我（Leader）逐单元独立验收（重跑 test/build + 越界核查 + 真实行为验证）。
- **codex 后台派发用 stdin 管道喂 prompt**（见教训沉淀），不用 argv。

---

## 执行状态看板

| 阶段 | 状态 |
|---|---|
| M0 下线音频 | ✅ 264581d |
| M1 地基 | ✅ M1a f04ca1d · M1b+c 882b87f · M1a-2 1ec5152 |
| M2 CRUD | ✅ |
| M3 skills/杂项 | ✅ 0664f00 |
| ME 引擎集成(pi) | ✅ ME-a 16d2673 · ME-b 919a03c · ME-c |
| M4 AI/queue | ✅ |
| M5 conversation | ✅ |
| M6 automation | 🔲 |
| M7 Electron host | 🔲 |
| M8 删 Rust | 🔲 |
