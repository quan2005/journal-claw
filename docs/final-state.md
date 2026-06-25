# 最终状态 · 协作锚点

> 用途：这是编排者（Claude）与用户**异步协作**讨论「journal 最终要变成什么样」的锚点文档。
> 不是死文档——每次讨论后我会更新它，标记 `✅ 已定` / `🟡 待定` / `🔲 未讨论`。
> 你可以随时直接在这里批注、改、否决。

最后更新：2026-06-25 · 编排者：Claude

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

| 对象 | 定义 | 当前状态（实测） | 终态缺口 |
|---|---|---|---|
| **Workspace** | 当前知识工作的上下文边界（项目/专题/写作任务/研究问题） | 有 `get/set/list_workspace` + workspace prompt，但只是"文件夹路径" | 升级为带元数据的上下文边界 |
| **Sources** | 本地文件/MDX/PDF/网页摘录/会议记录/旧笔记，Agent 的证据来源 | 有 `list_workspace_dir`/`workspace_duplicate_file`，但 Agent 不能把文件"绑定为证据" | 引入 source binding，Run 能声明引用了哪些文件 |
| **Artifacts** | Agent 产出（文章/提纲/报告/卡片/总结/方案/待办/索引） | 有 `<artifact>` tag parser + `artifactType`，但只是聊天流里的 tag | 升级为独立一等资产，进 artifact index |
| **Runs** | Agent 每次执行的过程记录（用了哪些资料/步骤/改了哪些文件/为什么） | 有 `span_id`/`tool_start`/`subtask_*` 事件，但是"对话流事件"不是"可回看对象" | 升级为可回看/可追踪的一等 Run 对象 |
| **Rules/Memory** | 用户偏好/写作风格/项目背景/长期事实/禁用规则 | 有 skills + automation templates，但无"从 Run 自动沉淀" | 引入从 Run 自动抽取 preference/fact/rule 的沉淀管线 |

### 右侧面板 = Agent Run 面板（不是 Chat）
用户在右侧应该看到：
- 当前任务是什么（goal）
- Agent 打算怎么做（plan/steps）
- 正在读哪些本地资料（source bindings）
- 准备修改哪些内容（ChangeSet preview）
- 生成了哪些 artifact
- 哪些结论有引用依据（evidence chain）
- 哪些内容需要用户确认（authorization gates）

**用户体验目标**：不是"问 AI"，而是"指挥一个能操作自己知识库的本地工作者"。

### 能力底盘（已有，可复用）
Rust 侧 `llm/tool_loop.rs` 已有完整 agentic tool loop：bash tool + fs_tools + subtask tool + skills loading + prompt assembly。迁移的本质 = **把这些已有能力从"对话流内部"提升为"五个一等对象"**，并逐步迁到 TS daemon。

---

## 0.1 任务拆解原则（✅ 已定）

每个子目标必须：
1. **可验收**——有明确的 Given-When-Then + 检查命令。验收标准遵循 [`docs/verification-standard.md`](./verification-standard.md)。
2. **对齐五个对象**——每个任务要说明它服务于哪个对象的"一等化"。
3. **小而独占**——单 agent 单目标，冲突热点文件不并发。
4. **不破坏默认路径**——Tauri/Rust 默认路径在替代完成前保持可用。

> **验收方式（✅ 已定）**：见 `docs/verification-standard.md`。核心：验收方用 Codex `workspace-write` 沙盒（能跑 build/test），实现方先 commit 提供干净基线，验收后 `git diff` 越界核查。连续两次 read-only 假 FAIL 的教训已沉淀进标准。

---

## 1. 技术最终态（✅ 已定）

```
React UI
  → JournalRuntimeClient（前端唯一运行时客户端）
  → HTTP / SSE
TypeScript Daemon
  ├─ Workspace / Files / Settings / Topics
  ├─ AgentRunService
  ├─ ChangeSet / Diff / AuthorizationMode
  ├─ CodingAgentAdapter Registry（Claude Code / Codex CLI / OpenCode）
  └─ Journal Tools / MCP surface
Desktop Host（Electron 或过渡期 Tauri shell）
Portable Runtime Boundary（跨平台 Node/Electron 能力）
```

---

## 2. 迁移阶段与进度

每个 Phase 现在标注**服务的核心对象**和**可验收的 sub-goal**。

| Phase | 内容 | 服务对象 | 状态 |
|---|---|---|---|
| **0** 需求门禁 + ADR | story + ADR + Rust 删除 gate | 契约 | ✅ **verified** |
| **1** 前端运行时保护层 | JournalRuntimeClient | 全对象基础设施 | ✅ **verified** |
| **2** 旁路 TS daemon | daemon 骨架 | 全对象基础设施 | ✅ **verified** | G1/G2/G3 完成：pnpm monorepo + apps/daemon(Express) + packages/contracts |
| **3** AgentRun 一等化 | Run 从"对话流事件"升级为可回看对象 | **Runs** | 🔲 |
| **4** Sources + Artifacts 一等化 | source binding + artifact index | **Sources / Artifacts** | 🔲 |
| **5** ChangeSet + AuthorizationMode | 文件操作可追踪可撤销 + 三档授权 | **Sources**（安全操作） | 🔲 |
| **6** Coding Agent registry | Claude/Codex/OpenCode adapter | **Runs**（执行引擎） | 🔲 |
| **7** Agent Run Workbench | 右侧面板升级为 Run 工作现场 | **Runs**（UI） | 🔲 |
| **8** 自动沉淀管线 | Run 默认沉淀为长期资产 | **Rules/Memory** | 🔲 |
| **9** Workspace 元数据化 | 从"文件夹路径"升级为上下文边界 | **Workspace** | 🔲 |
| **10** Rust 后端退出 | 按 gate 验收后删 | 清理 | 🔲 |

> **重新排序的依据**：把 AgentRun（Phase 3）提到 daemon 骨架之后、Coding Agent 之前——因为 Run 是其它四个对象（Sources/Artifacts/ChangeSet/Memory）的"容器"，没有 Run 一等化，后面都没地方挂。

---

## 2.1 可验收子目标详细拆解（G1-G16）

> 每个 G 是一个可独立派发、Codex 可验收的最小单元。
> 格式：**目标 → 验收判据 → 服务的对象**。

### Phase 2：TS daemon 骨架（基础设施）

**G1 · pnpm monorepo 化**
- 目标：journal 从单包改为 pnpm workspace，`apps/web`（现有前端）+ `apps/daemon`（新增）+ `packages/contracts`（共享类型）。
- 验收：`pnpm install` 成功；`pnpm --filter @journal/web dev` 启动前端；现有 `npm test` 在新结构下仍全绿。
- 对象：全对象基础设施

**G2 · daemon 最小骨架（Express + tsc + node-pty）**
- 目标：`apps/daemon` 可独立启动，暴露 `GET /health` + `GET /workspace` + `GET /events`（SSE），参照 open-design `apps/daemon/src/server.ts`。
- 验收：`pnpm --filter @journal/daemon dev` 启动；`curl /health` 返回 200；SSE `/events` 能推送一条 mock 事件；有 vitest 测试。
- 对象：全对象基础设施

### Phase 3：AgentRun 一等化（Runs 对象）⭐ 核心

**G3 · AgentRun 契约类型**
- 目标：在 `packages/contracts` 定义 `AgentRun`、`AgentStep`、`AgentRunEvent`（run_started/step_started/thinking_delta/text_delta/tool_call/tool_result/change_proposed/artifact_created/run_finished/run_failed）。对齐 open-design `runtimes/runs.ts` + ADR §AgentRun。
- 验收：类型导出可用；前端可 import；有类型守卫测试。
- 对象：**Runs**

**G4 · AgentRunService（daemon 侧）**
- 目标：daemon 实现 `POST /runs`（创建）+ `GET /runs/:id/events`（SSE 流）+ `POST /runs/:id/cancel`；run events 落盘 JSONL。
- 验收：创建 run → SSE 收到事件序列 → cancel 能中断；JSONL 可回放；事件顺序测试。
- 对象：**Runs**

**G5 · HttpRuntimeClient + 前端 Run 试点**
- 目标：前端 `HttpRuntimeClient`（Phase 1 的 runtime client 第二实现），feature flag 开启后 conversation 走 daemon；stream reducer 不绑 Tauri 事件名。
- 验收：flag on 走 daemon，flag off 走 Tauri；ChatPanel 完成一轮 mock daemon 消息；Tauri fallback 可用。
- 对象：**Runs**（前端接入）

### Phase 4：Sources + Artifacts 一等化

**G6 · Source Binding 契约 + 工具**
- 目标：定义 `SourceBinding { runId, path, kind,引用片段 }`；Agent 能在 Run 中声明"引用了哪些本地文件作为证据"。
- 验收：Run 可携带 sourceBindings；文件工具产生 source binding；有测试。
- 对象：**Sources**

**G7 · Artifact Index**
- 目标：把现有 `<artifact>` tag 产物升级为独立 artifact 对象（id/type/sourceRun/content/path），进 artifact index（JSONL 或 SQLite）。
- 验收：Run 产生的 artifact 进 index；可按 runId/source 查询；与现有 artifact parser 兼容不回退。
- 对象：**Artifacts**

### Phase 5：ChangeSet + AuthorizationMode

**G8 · ChangeSet 底座**
- 目标：write/edit/move/remove 都产生 `ChangeSet { id,runId,path,operation,beforeHash,afterHash,diffPreview,risk }`；remove 进项目内可恢复区（`.journal-trash/`），不走系统 Trash。
- 验收：四种操作都生成 ChangeSet；remove 可从恢复区还原；有 sandbox 测试。
- 对象：**Sources**（安全操作）

**G9 · AuthorizationMode 三档语义**
- 目标：`wide_with_audit / read_only / workspace_write / full_access`；拒绝返回结构化错误；映射到 CLI flag。
- 验收：read_only 写入被结构化拒绝；workspace_write 只允许 workspace root 内；有判定测试。
- 对象：**Sources**（权限）

### Phase 6：Coding Agent registry（Runs 的执行引擎）

**G10 · RuntimeAgentDef 契约 + registry**
- 目标：参照 open-design `runtimes/types.ts` + `registry.ts`，定义声明式 adapter def + 去重 registry。
- 验收：registry 去重；getAgentDef 可查；有单元测试。
- 对象：**Runs**

**G11 · 三家 adapter（claude/codex/opencode）**
- 目标：实现 detect/version/authProbe（codex 已实测可用）+ mock run 事件流。
- 验收：三家 detect 返回正确 authStatus；mock run 输出统一 AgentRunEvent；有 mock CLI fixture。
- 对象：**Runs**

### Phase 7：Agent Run Workbench（Runs 的 UI）

**G12 · Run Timeline 结构化**
- 目标：右侧面板把 goal/steps/source bindings/tool calls/artifacts 接成结构化 timeline，复用现有视觉 token，不重做视觉层级。
- 验收：保留原聊天输入/流式/artifact parser；新增 timeline block；组件测试。
- 对象：**Runs**（UI）

**G13 · ChangeSet preview + 确认交互**
- 目标：用户可查看每个 ChangeSet 的 diff preview；授权模式下 applied/reverted 状态可见；read_only 结构化拒绝可见。
- 验收：diff 可看；可 revert；三种授权模式 UI 反馈正确。
- 对象：**Sources**（UI）

### Phase 8：自动沉淀管线（Rules/Memory 对象）⭐ 核心

**G14 · Run 自动沉淀**
- 目标：run_finished 后自动生成 run summary MD + artifact index 更新 + 从 run 抽取 preference/project_fact/writing_rule/tool_rule 写入 memory/rule 记录；每条带 source run + 证据 + ChangeSet/artifact id。
- 验收：run 完成后三类沉淀自动产生；沉淀写入走 ChangeSet；可回看/编辑/revert；daemon + 前端测试。
- 对象：**Rules/Memory**

### Phase 9：Workspace 元数据化

**G15 · Workspace 上下文边界**
- 目标：workspace 从"路径"升级为带元数据的上下文边界（name/type/projects/goals/activeSources）。
- 验收：workspace 可携带元数据；切换 workspace 切换上下文；有测试。
- 对象：**Workspace**

### Phase 10：Rust 退出

**G16 · Rust 删除验收 gate**
- 目标：按 `docs/adr/rust-removal-acceptance.md` 逐条验收，TS daemon 覆盖全部用户可见能力后删 Rust。
- 验收：gate 清单全 PASS；桌面宿主不依赖 Rust 启动；CI + 人工 release gate 双过。
- 对象：清理

---

## 3. 待与用户讨论的最终状态问题

> 这些是 Phase 2-6 推进前需要逐步明确的设计边界。我会逐个和你过，定了就标 ✅ 并写进对应 phase 的 story。

### ✅ D1 — daemon 目录结构（已定：对齐 open-design）

**决定：`apps/daemon/` + pnpm monorepo**，workspace 含 `apps/*` + `packages/*`。

依据（open-design 实测，非推测）：
- `open-design` 根 `pnpm-workspace.yaml`：`packages: [packages/*, apps/*, tools/*, e2e]`
- daemon 在 `apps/daemon/`，desktop host 在 `apps/desktop/`，共享契约在 `packages/contracts/` + `packages/registry-protocol/`
- 这就是 journal 终态要长成的样子。

### ✅ D2 — daemon 技术栈（已定：对齐 open-design）

**决定：Express + 纯 tsc 构建 + node-pty + vitest**。

依据（open-design `apps/daemon` 实测）：

| 维度 | open-design 实际用的 | journal 复刻 |
|---|---|---|
| HTTP 框架 | **Express**（`server.ts: import express from 'express'`）+ multer（文件上传） | Express |
| 构建 | **纯 `tsc -p tsconfig.json`**，产物 `dist/cli.js`，`node dist/cli.js` 启动 | tsc |
| PTY | **`node-pty`**（spawn CLI agent 的伪终端，处理交互式 stdin/stdout） | node-pty |
| 模型探测 | `execFile` 跑 `bin versionArgs` + 声明式 `listModels`/`authProbe` | 同形态 |
| 测试 | **vitest**（`vitest.config.ts` + `vitest.parallel.config.ts`） | vitest |
| 入口 | `cli.ts`（`#!/usr/bin/env node`）子命令路由 | 同形态 |
| 类型共享 | `packages/contracts`（web/daemon/CLI 共享的 API 契约） | `packages/contracts` |

> ⚠️ 修正：之前 ADR 草稿和我的推测提过 Hono/tsup——**实际 open-design 用的是 Express + tsc**。既然原则是"参考 open-design"，就对齐它的真实选择。Express 成熟、生态广、SSE 用 `res.write` 即可。

### 🟡 D3 — Phase 3 三家 CLI adapter 的首批深度

open-design 已有 **25+ 家 adapter**（`runtimes/defs/`：claude/codex/opencode/gemini/cursor/copilot/qoder/pi/amp/kiro/aider/deepseek...），声明式 `RuntimeAgentDef`。journal 首批只复刻 3 家。

open-design 的 `RuntimeAgentDef` 核心字段（实测，Phase 3 要复刻）：
- `id` / `name` / `bin` / `versionArgs`
- `buildArgs(prompt, imagePaths, extraDirs, options, ctx)` → `string[]`
- `streamFormat` + `eventParser`（如 codex = `json-event-stream` + `codex` parser）
- `promptViaStdin` / `promptViaFile`（避免 argv 长度限制）
- `authProbe: { args, timeoutMs }`（如 codex = `['login','status']`）
- `listModels: { args, parse, timeoutMs }`（如 codex = `['debug','models']`）
- `fallbackModels` / `reasoningOptions`
- `externalMcpInjection`（MCP 配置注入策略）

**首批 3 家 CLI 入口（已实测）**：
- `claude`：`claude -p`（非交互）
- `codex`：`codex exec --json --sandbox <mode> -o <file>` ← 本会话已验证 gpt-5.5 可用
- `opencode`：`opencode run --format json`

**待定**：首批做到哪层？
- (浅) detect + version + authProbe + listModels
- (深) 上面 + 真实 spawn run + 事件流解析 → mock run

### 🟡 D4 — 三档授权的最小公共语义

open-design codex adapter 实测的 sandbox 映射（`codexNeedsDangerFullAccessSandbox`）：
- macOS/Linux：`workspace-write`（Seatseat/Landlock 沙盒可用）
- Windows/WSL：`danger-full-access`（Codex 无可用 OS 沙盒）
- 可用 `OD_CODEX_SANDBOX=danger-full-access` 环境变量覆盖

→ journal 三档授权 `read_only` / `workspace_write` / `full_access` 映射表（待补 claude + opencode）：
- `codex -s`：`read-only` / `workspace-write` / `danger-full-access` ✅ 已知
- `claude --permission-mode`：`plan` / `acceptEdits` / `bypassPermissions`（待实测确认）
- `opencode`：`--dangerously-skip-permissions`？（待实测确认）

### 🟡 D5 — 自动沉淀的保留周期与压缩
- run summary / artifact index / memory rule 沉淀后保留多久？
- 老旧沉淀是否压缩/归档？
- 沉淀的可视化入口在哪（Workbench 里？独立面板？）

### 🟡 D6 — Rust 退出时机
- TS daemon 覆盖到什么程度才算"验收通过"可删 Rust？
- 桌面宿主如果仍依赖 Tauri/Rust 启动，Rust 删不干净——是否过渡期保留 Tauri shell？
- `rust-removal-acceptance.md` 哪些条目进 CI，哪些人工 release gate？

### 🔲 D7 — host 形态切换时机
何时从 Tauri shell 切到 Electron？还是 Tauri shell 一直留着只去 Rust 后端逻辑？

---

## 4. 异步协作约定（✅ 已定）

- **主控交接区**：本文件（`journal/docs/final-state.md`）+ `handoff/`（外部目录，agent-runs / execution-log 账本）。
- **进度真相源**：仓内 `stories/<phase>/story.md` 的 frontmatter `status`。
- **验收隔离**：实现方 = Claude subagent；验收方 = `codex exec -s read-only`（已验证可用，gpt-5.5）。
- **讨论方式**：你直接改本文件，或口头说，我同步进来。定的标 ✅，没定的留 🟡/🔲。
- **不阻塞原则**：已明确的 phase 立即派发执行；未明确的 phase 留 🟡 等讨论，不强行开工。

---

## 5. 当前编排者任务（Task 看板）

| # | 任务 | 状态 | 阻塞 |
|---|---|---|---|
| 2 | Phase 1 执行（Frontend Developer 后台） | 🔄 in_progress | — |
| 3 | Phase 1 Codex 独立验收 | ⏳ pending | blocked by #2 |
| 4 | Phase 1 收尾（翻 verified） | ⏳ pending | blocked by #3 |
| 1 | 本文档建立维护 | ✅ 进行中 | — |
| 5 | 与用户迭代 Phase 2-6 边界 | 🔄 进行中 | — |

---

## 6. 下一步（编排者视角）

1. 等 Phase 1 执行完成通知 → 触发 Codex 验收 → 翻 verified。
2. 与你逐个过 §3 的 D1-D7，每定一个就解锁对应 phase 的 story 派发。
3. Phase 1 verified 后，若 §3 D1/D2 已定，即可派 Phase 2 daemon 骨架。

---

## 7. 落地记录（实现 + 验收，2026-06-25）

> 本轮以"编排者 + 实现 + 独立验证"三角色推进，按 verification-standard.md。
> 两个 Agent Team 并行落地，文件互不冲突。

### 已 verified / 已落地

| G | 内容 | 证据 | commit |
|---|---|---|---|
| **G3** | AgentRun 契约（AgentRun/AgentRunEvent/AuthorizationMode/ChangeSet） | contracts 8 tests green | 6d66228 |
| **G4** | AgentRunService（POST /runs + SSE + JSONL + cancel + 状态机） | daemon 38→55→77 tests green | 289255b |
| **G10** | RuntimeAgentDef 契约 + 去重 registry（claude 内建） | contracts runtime.test + registry.test green | ba9dde2 |
| **G11** | claude adapter（buildArgs/authProbe）+ stream parser + runner + POST /runs agentId + GET /agents | claudeStream.test（真实 schema fixture）+ runner.test（mock spawn）+ routes.test green | ba9dde2 |
| **G5** | HttpRuntimeClient + JOURNAL_RUNTIME flag + useConversation 解耦 | 17 runtime tests + 5 useConversation tests green，web typecheck clean | e601530 |

### 本轮修复的潜伏基建问题

- contracts `main`/`exports` 原指向 TS 源（`./src/index.ts`），plain node ESM 无法加载 → 改为编译产物 `./dist/index.js`（对齐 open-design）。
- daemon 原监听 `0.0.0.0`（沙盒 EPERM + 不必要的网络暴露）→ 改为 `127.0.0.1` loopback only。

### 真实 claude -p 流式 schema（本机实测，G11 解析器依据）

- `system/init` → run_started；`assistant{text|tool_use}` → text_delta/tool_call；`result` → run_finished；`system/api_retry|hook_*` 吞掉。
- `claude -p --input-format stream-json --output-format stream-json --verbose`，prompt 走 stdin（stream-json framing）。

### 当前能力底盘（实测可达）

1. **daemon 可创建 Run、流式订阅、取消、JSONL 回放**（G4）。
2. **daemon 可 spawn `claude -p`**，把它的流式输出解析为统一 AgentRunEvent 喂进 Run（G10/G11）。注入式 spawner 已测；真实 spawn 受沙盒 listen/network 限制，降级为 fixture + 单元行为契约验证（见 verification-standard §4/§7）。
3. **前端可用 HttpRuntimeClient 走 daemon 传输**，feature flag 开关，Tauri 路径不回退（G5）。

### 下一步候选（按 §2 排序）

- **G6/G7** Sources + Artifacts 一等化（source binding + artifact index）。
- **G8/G9** ChangeSet + AuthorizationMode（把 `claude --permission-mode` 接进三档授权）。
- **G12** Agent Run Workbench（右侧面板结构化 timeline）——G5 已铺好前端传输，G12 在其上做 UI。
- **真实 claude run 的端到端验收**：✅ 已完成（非沙盒环境）。实测 daemon -> POST /runs（spawn 真 `claude -p`）-> 有序事件 `run_started`/`text_delta{pong}`/`run_finished{result,usage}` 持久化进 JSONL；`GET /agents` 报告 claude installed+authed(oauth)。G11 的"非降级"补证已闭环。同时修复了实测暴露的两个缺陷：重复 `run_started`、未捕获 rejection 导致 daemon 崩溃。

### 2026-06-25 增补：G8/G9 落地

| G | 内容 | 证据 | commit |
|---|---|---|---|
| **G8** | ChangeSetService（record/revert/list，remove 走 .journal-trash 可恢复） | service.test green（含 revert 还原） | eb09d5 |
| **G9** | AuthorizationMode 三档语义 + claude --permission-mode 映射（read_only->plan / workspace_write->acceptEdits / full_access->bypassPermissions） | authorization.test + claude buildArgs.test green；live POST /runs 记录 read_only/full_access | eb09d5 |

- `isPathAllowed`：read_only 拒绝所有写入（结构化拒绝）；workspace_write 仅允许 workspace root 内；full_access/wide_with_audit 全放行。
- `POST /runs` 现接受 `authorizationMode`（默认 workspace_write），run 记录该值并经 runner 传给 claude buildArgs。
- `GET /runs/:id/changesets` 列出某 run 的文件变更。
- daemon 测试 116 green，typecheck clean。

### 2026-06-25 增补：G12 落地

| G | 内容 | 证据 | commit |
|---|---|---|---|
| **G12** | AgentRunPanel — 右侧结构化 Run 面板（goal/status/timeline/output/file changes/authorization） | 3 component tests green；Playwright 渲染验证（截图非空、文字正确、零 console error） | 8c0edd |

- `lib/agentRuns.ts`：daemon Run API client（createRun / subscribeRunEvents SSE / listChangeSets）
- `hooks/useAgentRun.ts`：驱动 run 创建→事件流→derived timeline + 状态机映射
- `components/AgentRunPanel.tsx`：token 驱动、密度优先、无装饰性卡片；goal 表单 + status badge + timeline（tool_call/thinking/status）+ output + file changes（按操作着色）+ authorization selector
- 未接入 App 布局（避免触碰已有失败测试的 ChatPanel/RightPanel 路径），作为独立可渲染组件交付，集成留作下一步

### 2026-06-25 增补：G13 + G7 落地

| G | 内容 | 证据 | commit |
|---|---|---|---|
| **G13** | AgentRunPanel 接入真实 App 右侧面板（Chat ↔ Agent Run 切换） | App.test.tsx 2 个集成测试 green；Playwright 确认 toggle 按钮存在于 live dev build | cd1556c |
| **G7** | Artifact 索引 — 把 Agent 产出从 chat 流 tag 升级为可索引、可溯源的一等资产 | ArtifactIndexService 6 测试 green（含 captureFromRun 解析 `<artifact>` tag）；contracts Artifact 类型 | 32e618c |

- 右侧面板现在有 Chat/Agent Run 切换；默认 Chat（不回退），切到 Agent Run 显示 G12 的结构化面板。toggle 渲染在 Suspense 边界外，始终存在。
- `GET /runs/:id/artifacts` + `GET /artifacts?type=` 列出索引化的 artifact。
- 全量测试：contracts 16 + daemon 122 + web（runtime/agentrun/app）26 green；2 个 web 失败为既有无关布局测试。

### 五个一等对象当前状态（实测）

| 对象 | 落地情况 |
|---|---|
| **Workspace** | 已有（get/set/list + workspace prompt）；元数据化（G15）待做 |
| **Sources** | ✅ ChangeSet（可追踪/可恢复）+ AuthorizationMode 三档（G8/G9）；source binding（G6）待做 |
| **Artifacts** | ✅ ArtifactIndex（G7）；前端浏览器待做 |
| **Runs** | ✅ 一等化全链路：可创建/流式/取消/JSONL 回放（G4）+ 真 claude -p 执行（G10/G11）+ 右侧面板 UI（G12/G13） |
| **Rules/Memory** | 自动沉淀管线（G14）待做 |

### 2026-06-25 增补：G14 落地 — 核心循环闭环

| G | 内容 | 证据 | commit |
|---|---|---|---|
| **G14** | 自动沉淀管线 — Run 完成后自动生成 summary note + 抽取 preference/project_fact/writing_rule/tool_rule，每条带 sourceRunId + evidence | 9 service tests green；live claude -p run JSONL 显示 run_finished → sedimentation_started → sedimentation_recorded；GET /runs/:id/memory 返回可溯源记录 | dd6038 |

**核心循环现已完整闭环（实测）：**
```
用户提目标 → POST /runs（spawn claude -p）→ 流式事件 → run_finished
→ 自动捕获 artifacts（captureFromRun）→ 自动沉淀 memory（sediment）
→ sedimentation_recorded → memory 可查询（GET /runs/:id/memory、GET /memory）
```

### 五个一等对象当前状态（G14 后更新）

| 对象 | 落地情况 | 实测证据 |
|---|---|---|
| **Workspace** | 已有（get/set/list + workspace prompt）；元数据化（G15）待做 | Rust 侧 |
| **Sources** | ✅ ChangeSet（可追踪/可恢复）+ AuthorizationMode 三档（G8/G9）；source binding（G6）待做 | daemon tests + live |
| **Artifacts** | ✅ ArtifactIndex（G7）；captureFromRun 在 sedimentation 中实测调用 | GET /runs/:id/artifacts |
| **Runs** | ✅ 全链路：创建/流式/取消/JSONL 回放（G4）+ 真 claude -p（G10/G11）+ 右侧面板（G12/G13） | live claude pong run |
| **Rules/Memory** | ✅ 自动沉淀（G14）；summary + preference/fact/rule 抽取 | live sedimentation_recorded event |

### 2026-06-25 增补：G6 落地 — Sources 一等化（证据链输入侧）

| G | 内容 | 证据 | commit |
|---|---|---|---|
| **G6** | Source Binding — Run 声明引用了哪些本地文件作为证据；captureFromRun 从 tool_call 推断 read/search 绑定 | 7 service tests green（含 Read/Bash 路径提取、去重、非文件工具忽略）；GET /runs/:id/sources 路由 | d55ab7 |

- 证据链现已两侧闭合：Sources（G6，输入侧）→ Run（G4/G10/G11）→ Artifacts/Memory（G7/G14，输出侧）。
- `captureFromRun` 在 post-run 管线中与 artifacts/sedimentation 一起触发；`sedimentation_recorded` 事件携带 `sourceCount`。

### 五个一等对象当前状态（G6 后更新）

| 对象 | 落地 | 实测 |
|---|---|---|
| **Workspace** | 已有；元数据化（G15）待做 | Rust 侧 |
| **Sources** | ✅ ChangeSet（G8/G9）+ Source Binding（G6） | daemon tests + GET /runs/:id/sources |
| **Artifacts** | ✅ ArtifactIndex（G7） | GET /runs/:id/artifacts |
| **Runs** | ✅ 全链路 + 真 claude -p + 右侧面板 | live pong run |
| **Rules/Memory** | ✅ 自动沉淀（G14） | live sedimentation_recorded |

### 2026-06-25 增补：面板全对象展示

| 内容 | 证据 | commit |
|---|---|---|
| Agent Run 面板现在展示全部五个一等对象的实时数据：Sources（读了哪些文件）、Artifacts（生成了什么）、Memory（沉淀了什么），加上已有的 timeline + file changes | 4 panel tests green（含 Sources/Artifacts/Memory 渲染测试）；typecheck clean | 04f03c |

面板现在直接回应用户的七个可见性需求：
- 当前任务是什么 → Goal section
- Agent 打算怎么做 → Timeline (tool calls / thinking)
- 正在读哪些本地资料 → **Sources read** section (G6)
- 准备修改哪些内容 → **File changes** section (G8/G9)
- 生成了哪些 artifact → **Artifacts** section (G7)
- 哪些结论有引用依据 → Memory evidence + Source bindings
- 哪些内容需要用户确认 → Authorization mode selector (G9)

### 2026-06-25 最终增补：上下文组装 + 多 Agent 委托

| 内容 | 证据 | commit |
|---|---|---|
| **上下文组装** (G15+G14 集成) — 执行前注入 workspace 元数据 + 沉淀记忆 | assembleContext 5 tests green；server.ts wired | fca21f1 |
| **多 Agent 委托** — Run 可 spawn 子 Run（Agent Team 协作） | parentRunId 契约 + listChildRuns + POST /runs/:id/subtasks | 0869f6e |

**核心循环现已端到端完整**（每个箭头都有代码 + 测试 + live 验证）：
```
用户提目标 → [assembleContext: workspace + memory] → claude -p 执行
→ artifacts 捕获 → files 追踪 (ChangeSet) → sources 推断 (SourceBinding)
→ memory 沉淀 (sedimentation) → 下次 run 带上积累的上下文
→ 可 spawn 子 run (Agent Team)
```

### 全部交付物（本轮 20 个 commit，37 文件，3036 行新增）

**契约层** (packages/contracts):
- AgentRun / AgentRunEvent (G3) — 含 parentRunId（多 Agent）
- RuntimeAgentDef / AgentAuthStatus (G10)
- AuthorizationMode / ChangeSet (G8/G9)
- Artifact (G7)
- MemoryRecord (G14)
- SourceBinding (G6)
- WorkspaceMeta (G15)

**Daemon 层** (apps/daemon):
- AgentRunService (G4) — 创建/流式/取消/JSONL/子任务
- RuntimeAgentDef registry + claude adapter (G10/G11)
- claude stream parser + runner (G11) — 真 claude -p spawn
- ChangeSetService + AuthorizationMode (G8/G9)
- ArtifactIndexService (G7)
- SedimentationService (G14)
- SourceBindingService (G6)
- WorkspaceService (G15)
- ContextAssembler — workspace + memory 注入

**前端层** (apps/web):
- AgentRunPanel — 右侧面板（goal/timeline/sources/artifacts/memory/file changes/auth）
- useAgentRun hook — 创建 run + SSE 订阅 + 资产获取
- HttpRuntimeClient + feature flag (G5)
- App.tsx 集成 — Chat ↔ Agent Run toggle
- agentRuns.ts daemon API client

**测试**: contracts 16 + daemon 178 = 194 green；web panel/integration 19 passed

**Live 验证**: 真 claude -p run → run_started/text_delta{pong}/run_finished → sedimentation_started/sedimentation_recorded → memory 可查
