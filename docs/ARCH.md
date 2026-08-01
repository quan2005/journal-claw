# JournalClaw Architecture — 唯一架构真相

更新：2026-08-01（维护治理 Phase 0 · 外部 CLI engine 退休状态同步）

## 总览

JournalClaw 是 **Electron + React 19 + TypeScript daemon** 的本地优先桌面应用。

```
┌──────────────────────────────────────────────────────────────┐
│ apps/web                                                     │
│ React UI · hooks · runtimeClient · hostBridge                │
└───────────────┬───────────────────────────┬──────────────────┘
                │ HTTP/SSE                  │ preload 白名单
                ▼                           ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│ apps/daemon                  │   │ apps/desktop               │
│ HTTP + SSE business backend  │   │ Electron host              │
│ services · Agent Run · pi    │   │ window/menu/daemon lifecycle│
└──────────────┬───────────────┘   └───────────────────────────┘
               │
        packages/contracts（跨端契约类型，web 与 daemon 共同依赖）
```

## 依赖方向规则（硬性）

| 规则                            | 允许                                           | 禁止（违反示例）                                     |
| ------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| web → daemon 只经 runtimeClient | `selectRuntimeClient().invoke('journal_list')` | 组件内 `fetch('http://localhost:4517/journal')`      |
| web → Electron 只经 hostBridge  | `hostRevealInFileManager(p)`                   | 组件 import `electron` 或直接摸 `window.electronAPI` |
| desktop 零业务语义              | 窗口/菜单/daemon 子进程/文件对话框             | 在 desktop main 里解析 journal 数据                  |
| 契约类型只放 contracts          | web/daemon 都 import `@journal/contracts`      | daemon 里复制一份 `AgentRun` 类型                    |
| 业务状态持久化在 daemon         | settings 经 `/settings`                        | 组件用 localStorage 存业务状态（面板宽度白名单除外） |

新增业务能力路径：daemon service + route → runtimeClient 方法 → UI。新增宿主能力路径：Electron preload 白名单 → `hostBridge.ts` 包装 → UI。

## 技术栈

| 层         | 技术                                                       |
| ---------- | ---------------------------------------------------------- |
| 桌面宿主   | Electron（electron-builder 打包）                          |
| Renderer   | React 19 + TypeScript + Vite                               |
| Backend    | TypeScript daemon（Express HTTP + SSE）                    |
| Agent 引擎 | pi 内建引擎（唯一，外部 CLI adapter 已于 2026-07-08 移除） |
| 文件变更   | ChangeSet service                                          |
| 测试       | vitest + Playwright                                        |

## 前端边界

| 入口           | 文件                                                        | 职责                            |
| -------------- | ----------------------------------------------------------- | ------------------------------- |
| Runtime client | `apps/web/src/lib/runtimeClient.ts`, `httpRuntimeClient.ts` | 业务 command 到 daemon HTTP/SSE |
| Host bridge    | `apps/web/src/lib/hostBridge.ts`                            | Electron preload 白名单能力     |

> 历史注记：`apps/web/src/lib/` 下的 `tauri.ts` 兼容 shim（保留旧 Tauri 函数名的转发层）已于 2026-07-03 拆除，调用方直接消费 runtimeClient / hostBridge。

## Daemon

`apps/daemon/src/server.ts` 是 HTTP/SSE 入口。业务服务按能力分目录：

- `journal/`, `todos/`, `topics/`, `identity/`, `materials/`
- `settings/`, `config/`, `workspace/`, `files/`, `permissions/`
- `runs/`, `engine/`, `changeset/`, `sediment/`, `artifacts/`
- `automation/`, `work_queue/`, `ai_processor/`, `event_log/`

核心原则：

- service 层保存业务语义，route 层只做协议适配。
- Agent 对用户资产的写入、移动、删除走 ChangeSet；其他写入必须保留在 daemon 的受控 service/store 内，不得从 route、组件或 Electron handler 直接写用户资产。用户直改、系统元数据和迁移的分级通道由维护治理 Phase 1 固化。
- authorization mode 在 daemon 执行：`read_only`、`workspace_write`、`full_access`。
- run events 统一为 `AgentRunEvent`，前端不感知引擎内部原始事件格式。

## Agent Run

1. `POST /runs` 创建 run（engine 固定为 builtin，无其他可选值）。
2. daemon 统一走 pi 内建引擎。
3. `GET /runs/:id/events` SSE 输出事件，支持 cursor 恢复。
4. `POST /runs/:id/cancel` 取消。
5. run 完成后触发 artifact / memory / rule 沉淀。

事件覆盖 run lifecycle、thinking/text delta、tool call/result、change proposed、artifact、sedimentation、finish/fail。

### 对话面

右侧面板使用统一的对话 shell 和 composer。所有对话与 run 都由 daemon 内建 pi 引擎执行，经 runtimeClient 使用 HTTP/SSE；renderer 只消费统一事件和用户可见状态。

> 历史注记：外部 CLI engine/adapter、本地 Agent 检测和 EngineSwitcher 已于 2026-07-08 删除，见 `stories/20260708-remove-cli-engines/story.md`。

## Electron Host

`apps/desktop`：main/preload 构建、daemon 子进程生命周期与日志转发、原生菜单与窗口、文件选择/系统打开/Reveal/dialog/zoom/theme/file drop。Preload 只暴露 `window.electronAPI` 白名单方法。

启动时序（`src/startup.ts`）：窗口创建同步先行、daemon 并行启动互不阻塞；窗口 `show:false` + `ready-to-show`（3s 兜底）+ 主题感知背景色防白屏；renderer 侧 `BootGate` 以指数退避探测 daemon 就绪后进入正常界面。

## 数据与恢复

- workspace 既有 Markdown、topics、todos、identity、skills、conversation、automation 数据保持可读。
- 新元数据写入跨平台路径，不把平台专属目录作为唯一真相。
- 删除与恢复走 ChangeSet / 项目内恢复路径。
- run summary、artifact index、memory/rules、JSONL event log 可导出备份。

## 已下线能力

音频/语音/转写（journal-speech、SpeechAnalyzer、WhisperKit、speaker profiles）与 Rust/Tauri 后端已于 M8-b（2026-06-27）删除。见 `docs/adr/rust-removal-release-note.md`。

## 参考

- 工程规范：`docs/CONVENTIONS.md` · 设计规范：`docs/DESIGN.md` · 产品北极星：`docs/final-state.md`
- ADR：`docs/adr/rust-removal-roadmap.md` 等（只增不改）
