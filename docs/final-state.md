# 最终状态 · 协作锚点

> 用途：这是编排者（Claude）与用户**异步协作**讨论「journal 最终是什么样、现在到了哪」的锚点文档。
> 它反映 **2026-06-27 M8-b 终局** 的真实状态，不再是规划态。
> 你可以随时直接在这里批注、改、否决；每次讨论后我会更新它。

最后更新：2026-06-27（M8-b 终局）· 编排者：Claude

---

## 0. 产品北极星（✅ 已定 · 用户 2026-06-25 重新定调）

`journal` = **本地优先的个人 Agentic Knowledge Workspace**。

**第一原则**：文件是长期资产，Agent 是工作执行者，输出是核心结果。

不是"带 AI 的笔记软件"。区别：
- Notion/Obsidian = 人管理知识
- ChatGPT = 人和模型对话
- Moxt = 云端团队 AI workspace
- **journal = 本地优先的个人 Agent 能操作的知识工作台**

### 核心循环（产品的灵魂）
```
用户提出目标 → Agent 组装上下文 → 制定执行计划 → 操作本地资料
→ 生成可编辑输出 → 沉淀为笔记/规则/记忆
```

### 五个一等对象（不是"页面"，是 Agent 的工作对象）

> 以下为 **M8-b 终局实测状态**（contract + daemon service + HTTP route + 前端渲染）。详见 §6 历史落地记录与 `docs/ARCH.md`。

| 对象 | 定义 | 当前状态（M8-b 实测） | 仍有后续债 |
|---|---|---|---|
| **Workspace** | 当前知识工作的上下文边界（项目/专题/写作任务/研究问题） | ✅ `WorkspaceMeta` 契约 + `WorkspaceService`（name/type/goals/activeSources）+ `GET/PUT /workspace/meta`；上下文组装（`assembleContext`）已注入 prompt | 前端无 meta 编辑 UI；只读展示 |
| **Sources** | 本地文件/网页摘录/会议记录/旧笔记，Agent 的证据来源 | ✅ `SourceBinding` 契约 + `SourceBindingService`（`captureFromRun` 从 tool_call 推断 read/search 绑定）+ `ChangeSet`（可追踪/可恢复）+ `GET /runs/:id/sources` | 仅 run 完成后自动推断，无用户手动声明入口；前端 Sources section 只读 |
| **Artifacts** | Agent 产出（文章/提纲/报告/卡片/总结/方案/待办/索引） | ✅ `Artifact` 契约 + `ArtifactIndexService`（`captureFromRun` 解析产物进 index）+ `GET /runs/:id/artifacts` + `/artifacts?type=` | 前端 Artifacts section 只读，无独立浏览器/管理面板 |
| **Runs** | Agent 每次执行的过程记录（用了哪些资料/步骤/改了哪些文件/为什么） | ✅ 全链路：`AgentRun`/`AgentRunEvent` 契约 + `AgentRunService`（创建/流式/取消/JSONL 回放/子任务委托）+ `POST /runs engine=builtin\|claude\|codex` + SSE；前端 Agent Run 面板 ✅ | `useAgentRun` 缺专门测试；冷启动回放/列表化未做 |
| **Rules/Memory** | 用户偏好/写作风格/项目背景/长期事实/禁用规则 | ✅ `MemoryRecord` 契约 + `SedimentationService`（run 完成自动沉淀 summary + preference/project_fact/writing_rule/tool_rule，每条带 sourceRunId + evidence）+ `GET /runs/:id/memory` + `/memory` | 前端 Memory section 只读，无 reject/edit UI |

### 右侧面板 = Agent Run 面板（不是 Chat）
用户在右侧能看到（七个可见性需求均已闭环）：
- 当前任务是什么 → Goal section
- Agent 打算怎么做 → Timeline（tool calls / thinking）
- 正在读哪些本地资料 → Sources read section（SourceBinding）
- 准备修改哪些内容 → File changes section（ChangeSet，按操作着色）
- 生成了哪些 artifact → Artifacts section
- 哪些结论有引用依据 → Memory evidence + Source bindings
- 哪些内容需要用户确认 → Authorization mode selector（三档）

**用户体验目标**：不是"问 AI"，而是"指挥一个能操作自己知识库的本地工作者"。

### 能力底盘（M8-b 终局）
内建 Agent 引擎采用 [`pi`](https://github.com/earendil-works/pi)（`pi-agent-core` + `pi-ai`，MIT、纯 TS、可嵌入），运行在 `apps/daemon/src/engine/`。pi 提供 agentic 循环 / 多轮 session / `transformContext` / 多 vendor（anthropic、openai 原生；volcengine、zhipu、dashscope 走 OpenAI-compatible baseURL）/ `beforeToolCall`·`afterToolCall` 授权钩子。daemon 工具（bash / fs 经 ChangeSet / subtask）经授权门接入 pi。CLI adapter（claude/codex）保留作 Agent Team 委派路径。

> 历史注记：早期规划曾以 Rust `llm/tool_loop.rs` 作为迁移底盘。Rust 后端已于 M8-b（2026-06-27）整体删除，该迁移路径不再适用；pi 内建引擎替代了从零移植 tool loop 的方案（见 §3 决策 1）。

---

## 0.1 任务拆解原则（✅ 已定）

每个子目标必须：
1. **可验收**——有明确的 Given-When-Then + 检查命令。验收标准遵循 [`docs/verification-standard.md`](./verification-standard.md)。
2. **对齐五个对象**——每个任务要说明它服务于哪个对象的"一等化"。
3. **小而独占**——单 agent 单目标，冲突热点文件不并发。
4. **不破坏默认路径**——业务能力默认走 daemon HTTP/SSE + Electron host bridge；旧 Tauri/Rust 路径已删除，不再保留双路径。

> **验收方式（✅ 已定）**：见 `docs/verification-standard.md`。核心：验收方用独立沙盒（能跑 build/test），实现方先 commit 提供干净基线，验收后 `git diff` 越界核查。

---

## 1. 技术最终态（✅ 已定 · M8-b 落地）

```
React UI（apps/web）
  → tauri.ts shim → runtimeClient → httpRuntimeClient
  → HTTP / SSE
TypeScript Daemon（apps/daemon）
  ├─ journal / todos / topics / identity / materials（本地数据 CRUD）
  ├─ settings / config / workspace / files / permissions（地基）
  ├─ runs + engine（pi 内建引擎）+ runtimes（CLI adapter registry）
  ├─ changeset / artifacts / sediment（文件变更 / 产物 / 沉淀）
  ├─ automation / work_queue / ai_processor / conversation
  └─ skills / event_log / onboarding
Desktop Host（apps/desktop · Electron）
  └─ 窗口 / 菜单 / daemon 子进程生命周期 / 文件选择 / Reveal / 打开 / zoom / theme / file drop
Host Bridge（apps/web/src/lib/hostBridge.ts）
  └─ Electron preload 白名单能力
```

**事实**：Tauri shell / Rust 后端 / Swift sidecar 已删除（M7 + M8-b，2026-06-27）。桌面宿主固定为 Electron，业务后端固定为 TypeScript daemon，Agent 引擎固定为 pi 内建引擎（+ CLI adapter 委派）。前端通过 `runtimeClient`（业务）与 `hostBridge.ts`（宿主能力）两类入口访问能力，组件不得直接接触 raw Electron IPC 或 daemon URL。

---

## 2. 迁移历程（M0–M8 + ME，✅ 全部完成）

Rust 后端退出按 9 个阶段推进（详见 `docs/adr/rust-removal-roadmap.md`），现全部 verified：

| 阶段 | 内容 | 状态 |
|---|---|---|
| **M0** | 下线音频/语音/转写（录音、WhisperKit、Apple SpeechAnalyzer、speaker profiles） | ✅ 264581d |
| **M1** | 地基：Settings + Config（API key 加密）+ Workspace FS（读/写/导入/移动/删除） | ✅ M1a f04ca1d · M1b+c 882b87f · M1a-2 1ec5152 |
| **M2** | 本地数据 CRUD：journal / todos / topics / identity / materials | ✅ b285293 |
| **M3** | skills / onboarding / permissions / auto_lint / event_log / directive migration | ✅ 0664f00 |
| **ME** | pi 内建引擎集成（ME-a 骨架+vendor 配置 · ME-b 工具+授权钩子 · ME-c 事件映射+AgentRun 接入） | ✅ 16d2673 · 919a03c · 68f9398 |
| **M4** | AI 处理 + work queue（走 pi 引擎） | ✅ db8e5c8 |
| **M5** | Conversation 多轮 session（走 pi 引擎） | ✅ 8aec03f |
| **M6** | Automation / routines（走 pi 引擎经 ConversationService） | ✅ efca99c |
| **M7** | Electron host（M7-a 骨架 · M7-b 前端默认走 daemon · M7-c host 层 reveal/open/dialog/zoom/file-drop） | ✅ 522762c · 83cd73c · 971655d |
| **M8** | 删除 Rust 后端 + MDX 下线 + Gate A–J 收尾 | ✅ M8-a d26f89e（清前端 @tauri-apps 硬依赖）· M8-b 3c9622f（删 src-tauri + @tauri-apps 依赖）· MDX 下线 5020ca9 |

**下线能力（已完成事实）**：
- **Rust/Tauri 删除**：`apps/web/src-tauri/` 已删；`@tauri-apps/*` npm 依赖已移除；`rg "src-tauri\|@tauri-apps\|tauri::"` 仅余历史/迁移说明。
- **音频/语音/Swift sidecar 下线**：`journal-speech` 二进制、Apple SpeechAnalyzer、WhisperKit、speaker profiles 已从默认跨平台主干移除。
- **MDX 下线**：MDX 渲染链（MdxRenderer / components/mdx/* / journal-blocks / mdx.css）已删；日志详情改用纯 Markdown 渲染；既有 MDX 笔记降级为 Markdown 可读，不做迁移脚本（用户 2026-06-27 选 b 彻底移除）。

> 历史注记：早期 §2 曾用 Phase 0–10 + G1–G16 看板组织。该看板已被 M0–M8/ME 实际施工路径取代，原 G1–G16 的落地证据见 §6 与各 ADR。

---

## 3. 已定决策记录（原 D1–D7 全部结案）

> 以下决策在 M0–M8 推进中已全部敲定并落地。保留为历史决策记录，便于回溯。

### ✅ 决策 1 · LLM 引擎（原 D-引擎，用户 2026-06-27 定为 A′）
采用第三方 [`pi`](https://github.com/earendil-works/pi)（`pi-agent-core` + `pi-ai`，MIT、纯 TS、可嵌入）作 daemon 内建引擎，替代从零移植 Rust `tool_loop.rs`。pi 覆盖 agentic 循环 / 多轮 session / transformContext / 多 vendor（含 OpenAI-compatible baseURL → volcengine/zhipu/dashscope）/ before-afterToolCall 授权钩子。CLI adapter 保留作 Agent Team 委派。国产三家 chat+tool_call 配置面已就绪，真实 vendor 验证由用户自测。

### ✅ 决策 2 · API key 存储
简单加密存储（用户配置目录，非 workspace，纯 TS 跨平台），不落明文。已在 M1a-2 落地（ConfigService）。

### ✅ 决策 3 · 切换节奏
逐能力 feature flag 渐进（便于验证），某能力 Tauri 路径空转后即删该路径；全部空转 → M7/M8 删 Tauri。现已全部空转并删除。

### ✅ 决策 4 · CI 矩阵
M1–M6 保持 macOS CI；M7/M8 补 Win/Linux 三平台矩阵。

### ✅ 原 D1 · daemon 目录结构（已定：对齐 open-design）
`apps/daemon/` + pnpm monorepo，workspace 含 `apps/*` + `packages/*`。

### ✅ 原 D2 · daemon 技术栈（已定：对齐 open-design）
Express + 纯 tsc 构建 + node-pty + vitest。入口 `cli.ts`，类型共享 `packages/contracts`。

### ✅ 原 D3 · CLI adapter 首批深度（已定：深）
首批 claude / codex / opencode 三家做到 detect + version + authProbe + listModels + 真实 spawn run + 事件流解析；pi 内建引擎为默认 engine。

### ✅ 原 D4 · 三档授权语义（已定）
`read_only` / `workspace_write` / `full_access` 三档为用户可理解语义；`wide_with_audit` 为显式迁移/审计模式。daemon `isPathAllowed` 实现：read_only 拒绝所有写入，workspace_write 仅允许 workspace root 内，full_access/wide_with_audit 全放行。CLI 映射：codex `-s read-only/workspace-write/danger-full-access`，claude `--permission-mode plan/acceptEdits/bypassPermissions`。

### ✅ 原 D5 · 自动沉淀保留周期（已定：先落地，压缩策略后续）
run summary / artifact index / memory rule 沉淀已落地（SedimentationService）；保留周期与压缩策略、独立可视化入口列为后续产品债。

### ✅ 原 D6 · Rust 删除决策（已定：M8-b 已删）
TS daemon 覆盖全部用户可见能力后删除 Rust。桌面宿主迁移到 Electron（不保留 Tauri shell）。`apps/web/src-tauri/` 已删除，Gate A–J 验收见 `docs/adr/rust-removal-acceptance.md`。

### ✅ 原 D7 · host 形态（已定：Electron）
桌面宿主固定为 Electron（`apps/desktop`），仅承载窗口/菜单/daemon 生命周期/宿主能力，零业务语义。已无 Tauri shell。

### ✅ 下线 MDX（用户 2026-06-27 选 b 彻底移除）
后续不再支持 MDX，所有 MDX 支持彻底清理；日志详情改用纯 Markdown 渲染。图表/mermaid/公式/callout 块消失，阅读体验退化（用户接受）。

---

## 4. 异步协作约定（✅ 已定）

- **主控交接区**：本文件（`journal/docs/final-state.md`）+ 各 `stories/<phase>/story.md`。
- **进度真相源**：仓内 `stories/<phase>/story.md` 的 frontmatter `status`，与 `docs/adr/` 下 ADR 互相印证。
- **讨论方式**：你直接改本文件，或口头说，我同步进来。定的标 ✅，没定的留 🟡。
- **不阻塞原则**：已明确的阶段立即派发执行；未明确的留 🟡 等讨论，不强行开工。
- **安全闸门在验收**：执行用沙盒，Leader 逐单元独立验收（重跑 test/build + 越界核查 + 真实行为验证）。

---

## 5. 后续债与下一步（M8-b 之后）

> M0–M8/ME 迁移已全部完成。以下为已知后续产品/技术债，按需开独立 story，不混入本终局收尾。

**五个一等对象的后续债**：
- **Workspace**：前端 meta 编辑 UI（当前只读）。
- **Sources**：用户手动声明 source binding 入口（当前仅 run 后自动推断）。
- **Artifacts**：独立 artifact 浏览器/管理面板（当前只读展示于 Run 面板）。
- **Runs**：`useAgentRun` 专门测试；冷启动回放 / 列表化。
- **Rules/Memory**：前端 reject/edit UI；沉淀保留周期与压缩策略。

**文档与验证债（由本 story 20260627-final-state-cleanup 收尾）**：
- README / 用户指南 / 应用文案中已下线能力（录音、WhisperKit、SpeechAnalyzer、speaker profiles）的宣传清理。
- `apps/desktop/package.json` 与 `pnpm-lock.yaml` 的 Electron 依赖分类漂移、pnpm build approval 配置入库。
- web vitest 既有失败基线记录。

---

## 6. 历史落地记录

> 本节为 M8-b 终局前的关键落地里程碑摘要。完整 commit 历史见 `git log`，逐项验收见各 `docs/adr/*` 与 `stories/*`。

### G 里程碑（AgentRun 一等化 → 五对象闭环，2026-06-25）
- **G3/G4**：AgentRun 契约（AgentRun/AgentRunEvent/AuthorizationMode/ChangeSet）+ AgentRunService（POST /runs + SSE + JSONL + cancel + 状态机）。
- **G10/G11**：RuntimeAgentDef 契约 + 去重 registry + claude adapter（buildArgs/authProbe）+ stream parser + runner；真实 `claude -p` spawn 验证通过。
- **G5**：HttpRuntimeClient + `JOURNAL_RUNTIME` flag + useConversation 解耦。
- **G8/G9**：ChangeSetService（record/revert/list，remove 走 `.journal-trash`）+ AuthorizationMode 三档 + claude `--permission-mode` 映射。
- **G12/G13**：AgentRunPanel（右侧结构化 Run 面板）+ 接入 App 右侧面板（Chat ↔ Agent Run toggle）。
- **G7**：ArtifactIndexService（`captureFromRun` 解析 `<artifact>` tag 进 index）。
- **G14**：SedimentationService（run 完成自动沉淀 summary + preference/project_fact/writing_rule/tool_rule）。
- **G6**：SourceBindingService（`captureFromRun` 从 tool_call 推断 read/search 绑定）。
- **G15 + Context Assembly + Multi-Agent**：WorkspaceMeta（context boundary）+ `assembleContext`（workspace meta + memory 注入 prompt）+ codex adapter + subtask delegation（Agent Teams）。

至此五个一等对象全部具备 contract + daemon service + HTTP route + 前端渲染。

### M8-b 终局（2026-06-27）
- M7-a/b/c：Electron host 骨架 → 前端默认走 daemon → host 层 reveal/open/dialog/zoom/file-drop。
- M8-a：清理前端 `@tauri-apps` 硬依赖。
- M8-b：删除 `apps/web/src-tauri/` + `@tauri-apps/*` 依赖，默认 runtime 固定为 daemon HTTP/SSE + Electron host bridge。
- MDX 下线：删除 MDX 渲染链，日志详情改纯 Markdown。

**M8-b 后技术栈定型**：Electron（host）+ React 19（renderer）+ TypeScript daemon（Express HTTP/SSE backend）+ pi 内建引擎（+ CLI adapter 委派）+ ChangeSet（文件变更）+ electron-builder（打包）+ vitest/Playwright（测试）。

### 参考
- `docs/ARCH.md` — 完整架构与前端边界。
- `docs/adr/rust-removal-roadmap.md` — M0–M8/ME 施工计划与执行看板。
- `docs/adr/rust-removal-acceptance.md` — Gate A–J 验收记录。
- `docs/adr/rust-removal-release-note.md` — 用户可读 release note。
- `docs/adr/rust-removal-rollback.md` — 回滚说明。
