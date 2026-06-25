# Rust 后端删除前验收清单

日期：2026-06-25

用途：作为 `journal` 从 Tauri/Rust 后端迁到 TypeScript daemon 后，删除 Rust 后端前的 release gate。

## 0. 基本结论

Rust 删除不是“TS daemon 能启动”就成立，而是以下条件同时成立：

- 用户可见的本地知识工作台能力已经由 TS/Node 主干覆盖，或明确下线并从 UI/文档中移除。
- Agent Run、三家 Coding Agent CLI、ChangeSet、自动沉淀、授权模式和事件流都不再依赖 Rust 后端。
- 桌面宿主不再需要 Tauri/Rust 才能启动。如果仍使用 Tauri shell，Rust 删除 gate 不通过，只能删除已替代的 Rust 后端模块。
- 没有 Apple Speech、Whisper、ffmpeg、系统 Trash 或平台专属二进制被重新引入默认路径。
- 回滚方案、迁移说明、测试矩阵和真实任务验收均已完成。

## 1. 删除范围定义

当前 Rust 后端至少承担这些职责：

- Tauri command 注册与前端 IPC。
- workspace、settings、topics、todos、journal entries、identity 等本地数据命令。
- conversation stream、chat/agent 模式、cancel/retry/truncate/load 等会话生命周期。
- `llm/tool_loop.rs`、bash tool、fs tools、subtask tool、skills loading、prompt assembly。
- automation runner/store/schedule/templates。
- recording/transcription/speaker/audio 相关能力。
- workspace 文件读写、移动、删除、复制、导入等工具。

删除前，每个职责必须进入三类之一：

| 类别 | 条件 | 例子 |
|---|---|---|
| TS 替代 | TS daemon 提供同等或更好的用户可见能力，并有测试 | conversation/run events、file tools、settings |
| 产品下线 | 用户已确认不再支持，UI/文档/测试均移除入口 | 平台绑定音频/语音路径 |
| 保留但非 Rust | 迁到跨平台 Electron/Node 或其它纯 TS 路径 | desktop host、local daemon lifecycle |

任何仍由 Rust 提供且用户仍能触达的能力，都阻止 Rust 删除。

## 2. Gate A：Host 与 Runtime

- 应用可以在无 Tauri/Rust 后端的情况下启动主窗口和设置入口。
- 前端不再 import `@tauri-apps/api/*` 作为产品默认路径。
- `src/lib/tauri.ts` 要么被删除，要么只保留兼容 shim，且默认实现指向 `JournalRuntimeClient` / `HttpRuntimeClient`。
- package scripts 不再要求 `tauri dev` 或 `tauri build` 才能运行默认桌面应用。
- 若迁移到 Electron host，Electron 只负责窗口、菜单和本地 daemon lifecycle，不承载产品业务语义。
- `rg "@tauri-apps|invoke\\(|listen\\(|src-tauri" src package.json` 只允许出现迁移说明、测试 fixture 或已标注 deprecated 的兼容层。

验收方式：

- `npm run build`
- `npm test`
- 默认桌面 dev 命令启动成功
- 人工 smoke：打开主界面、设置、文件树、右侧 Run 面板

## 3. Gate B：API Parity

建立 `rust-api-parity.md` 矩阵，逐项映射现有 Rust command 到 TS daemon API、下线决策或删除说明。

至少覆盖：

- Conversation：create/send/cancel/close/inject/truncate/retry/list/rename/delete/load。
- Workspace FS：list/duplicate/rename/move/delete/import。
- Journal entries：list months/list by month/list all/paginated/get content/delete。
- Topics：list/create/delete/import file。
- Todos：list/add/toggle/delete/set due/set path/remove path/set session/update text。
- Settings：workspace path、theme、AI engine、skills、automation settings。
- Identity / rules / memory：profile、archive、merge、read/write。
- Automation：run manifest、schedule、runner、store。
- Recording / transcription / speaker / audio：如果不再支持，必须从 UI 和文档中明确下线。

每一项必须写明：

- Rust source command。
- TS daemon route 或 service。
- 前端调用点。
- 测试文件。
- 状态：`replaced | retired | removed | blocked`。

`blocked` 为 0 时才允许进入 Rust 删除阶段。

## 4. Gate C：Agent Run 主路径

- `POST /runs` 创建 run。
- `GET /runs/:id/events` 通过 SSE 输出事件。
- `POST /runs/:id/cancel` 可以取消。
- run events 以 JSONL 落盘并可按 cursor 恢复。
- 事件至少覆盖 `run_started`、`step_started`、`thinking_delta`、`text_delta`、`tool_call`、`tool_result`、`change_proposed`、`artifact_created`、`sedimentation_started`、`sedimentation_recorded`、`run_finished`、`run_failed`。
- 前端 reducer 只消费统一 `AgentRunEvent`，不依赖 Tauri event name。
- ChatPanel / AgentRunWorkbench 能完成 mock run、真实 CLI run、cancel run、failed run。

验收方式：

- daemon run service 单元测试。
- SSE reconnect after cursor 测试。
- 前端组件测试。
- 一轮手工真实任务：让 Agent 读取 workspace 中两份资料，生成一份 Markdown 输出，并看到 timeline、tool calls、artifact、自动沉淀状态。

## 5. Gate D：三家 Coding Agent CLI

首批只支持：

- Claude Code
- Codex CLI
- OpenCode

每家 adapter 必须通过：

- binary detection。
- version probe。
- auth probe。
- prompt via stdin 或等价非交互输入。
- stream parser fixture。
- run/cancel 基础能力。
- 三档授权映射：`read_only`、`workspace_write`、`full_access`。
- 统一输出 `AgentRunEvent`，adapter 不输出产品 UI 专属结构。

不通过的情况：

- 只有 Claude 可跑，Codex/OpenCode 只是占位。
- adapter 把 CLI 原始事件直接泄漏给 UI。
- 授权 flag 如 `bypassPermissions` 直接暴露成产品心智。
- Gemini、Cursor、ACP 等其它 CLI 被半成品加入首批路径。

## 6. Gate E：ChangeSet 与恢复

- `create/edit/move/remove` 有 `beforeHash`、`afterHash`、`diffPreview` 或路径前后记录。
- 删除使用项目内恢复区或 run snapshot，不调用系统 Trash。
- symlink、`..`、绝对路径、workspace 越界写入都有测试。
- `read_only` 下写操作结构化拒绝。
- `workspace_write` 只允许 workspace root 内操作。
- `full_access` 允许更宽本地操作，但仍记录工具调用和 ChangeSet。
- 每个 ChangeSet 可回看、revert，并关联 source run。

验收方式：

- sandbox 单元测试。
- diff/hash 单元测试。
- remove/recover 测试。
- 前端 diff preview 与 revert 状态测试。
- 真实任务：编辑一份笔记、移动一份文件、删除并恢复一份文件。

## 7. Gate F：自动沉淀

自动沉淀是默认 run lifecycle，不能只是 UI 按钮。

每次 run 结束后：

- 自动写 run summary Markdown。
- 自动更新 artifact index。
- 自动写 memory/rule 记录，类型至少覆盖 `preference`、`project_fact`、`writing_rule`、`tool_rule`。
- 每条沉淀记录包含 source run、证据片段、相关 ChangeSet 或 artifact id。
- 沉淀写入本身也走 ChangeSet/AuthorizationMode。
- 用户可回看、编辑、拒绝、revert。

验收方式：

- daemon sedimentation service 单元测试。
- run_finished 后触发 sedimentation 的集成测试。
- 前端显示“已自动沉淀到哪些文件”的状态测试。
- 真实任务：让 Agent 总结一组资料并生成输出，确认 summary、artifact index、memory/rule 记录都出现且可回滚。

## 8. Gate G：数据与文件迁移

- 现有 workspace 文件格式保持可读，不需要用户重新导入。
- `.setting.json`、topics、todos、identity、skills、conversation history、automation manifest 的新旧路径有迁移说明。
- 如果某类数据因产品决策下线，必须有用户可读的迁移/删除说明。
- 所有新元数据写入 workspace 内的跨平台路径，不写入平台专属目录作为唯一真相。
- JSONL event log、run summaries、artifact index、memory/rules 都能被导出和备份。

## 9. Gate H：测试矩阵

最低测试：

- `npm test`
- `npm run lint`
- `npm run build`
- daemon 单元测试和集成测试
- 前端组件测试
- adapter fixture tests
- API parity contract tests
- Playwright smoke：主界面、设置、打开文件、运行 Agent、查看 ChangeSet、查看自动沉淀

跨平台矩阵：

- macOS
- Windows
- Linux

CI 必须验证：

- 默认测试不依赖 Apple Speech、Whisper、ffmpeg、系统 Trash 或平台专属二进制。
- 路径分隔符、换行符、权限错误、文件锁定行为都有覆盖。
- 不需要 Rust toolchain 才能完成默认 build/test。

删除前额外检查：

- 删除 `src-tauri` 后，默认 build/test 仍通过。
- `rg "src-tauri|@tauri-apps|tauri::|invoke_handler|#[tauri::command]"` 只在历史文档或迁移说明中出现。
- 若 package 仍包含 `@tauri-apps/*` 或 `src-tauri`，必须解释为何不阻止 Rust 删除；默认视为阻止项。

## 10. Gate I：真实任务验收

至少跑这些 end-to-end 任务：

1. 只读任务：Agent 读取 workspace 中多份资料，输出摘要，不产生文件变更。
2. 写入任务：Agent 基于资料生成一份 Markdown 草稿，ChangeSet 记录 create，自动沉淀 summary 与 artifact index。
3. 编辑任务：Agent 修改一份现有笔记，diff preview 正确，revert 后文件恢复。
4. 删除恢复任务：Agent 删除一份测试文件，文件进入项目内恢复路径或 snapshot，revert 后恢复。
5. 三家 CLI 任务：Claude Code、Codex CLI、OpenCode 各完成一轮 mock 或真实 run，输出统一事件。
6. 取消任务：长 run 被 cancel 后，事件终态正确，未留下 half-applied ChangeSet。
7. 失败任务：CLI auth 或 command 失败时，UI 显示结构化错误，run log 可追踪。
8. 自动沉淀任务：run 完成后无需用户点击，summary、artifact index、memory/rule 记录出现，并可回滚。

任何真实任务失败，都不允许删除 Rust。

## 11. Gate J：回滚与发布

删除 Rust 前必须准备：

- 迁移 ADR。
- API parity 矩阵。
- Rust 删除 PR 说明。
- 回滚步骤：如何切回最后一个 Rust-backed release 或恢复分支。
- 数据迁移回滚说明。
- 用户可读 release note：明确哪些旧能力被替代、哪些能力下线。
- 一次完整 dry-run：在临时分支删除 Rust 后跑完整测试矩阵。

发布策略：

- 不长期保留 TS/Rust 双主干。
- 可以保留一个短期 fallback release，但不能在主分支继续新增 Rust 后端能力。
- Rust 删除 PR 合并后，新增功能只能走 TS daemon。

## 12. 一票否决项

出现任意一项，Rust 删除 gate 失败：

- 仍需要 Rust/Tauri 才能启动默认桌面应用。
- 用户可见能力仍只存在于 Rust command。
- Agent Run 主路径仍经过 Rust conversation/tool_loop。
- Claude Code、Codex CLI、OpenCode 任一首批 adapter 没有基础验收。
- ChangeSet 或自动沉淀缺少恢复路径。
- 删除仍依赖系统 Trash。
- 默认 build/test 需要 Apple Speech、Whisper、ffmpeg 或平台专属二进制。
- 没有 API parity 矩阵。
- 没有真实任务验收记录。
- 没有回滚计划。

