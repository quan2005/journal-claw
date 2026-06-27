# JournalClaw Architecture

日期：2026-06-27

## 总览

JournalClaw 现在是 **Electron + React 19 + TypeScript daemon** 的本地优先桌面应用。

```
┌──────────────────────────────────────────────────────────────┐
│ apps/web                                                     │
│ React UI · hooks · runtime client · host bridge              │
└───────────────┬───────────────────────────┬──────────────────┘
                │                           │
                ▼                           ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│ apps/daemon                  │   │ apps/desktop               │
│ HTTP + SSE business backend  │   │ Electron host              │
│ services · Agent Run · pi    │   │ window/menu/daemon lifecycle│
└──────────────────────────────┘   └───────────────────────────┘
```

`apps/desktop` 不承载业务语义。它只负责窗口、菜单、daemon 子进程、文件选择/打开、系统 Reveal、webview zoom/theme 和文件拖放。业务状态、文件读写、Agent Run、自动化和沉淀都在 `apps/daemon`。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面宿主 | Electron |
| Renderer | React 19 + TypeScript + Vite |
| Backend | TypeScript daemon（Express HTTP + SSE） |
| Agent 引擎 | pi 内建引擎 + Claude/Codex/OpenCode CLI adapters |
| 文件变更 | ChangeSet service |
| 打包 | electron-builder |
| 测试 | vitest + Playwright |

## 前端边界

前端分三类入口：

| 入口 | 文件 | 职责 |
|---|---|---|
| Runtime shim | `apps/web/src/lib/tauri.ts` | 保留旧函数名，委托 runtime/host bridge |
| Runtime client | `apps/web/src/lib/runtimeClient.ts`, `apps/web/src/lib/httpRuntimeClient.ts` | 业务 command 到 daemon HTTP/SSE |
| Host bridge | `apps/web/src/lib/hostBridge.ts` | Electron preload 白名单能力 |

组件不得直接调用 daemon URL 或 raw Electron IPC。新增业务能力优先落在 daemon service + route，再通过 runtime client 暴露给 UI。新增宿主能力必须先加入 Electron preload 白名单，再由 `hostBridge.ts` 包装。

## Daemon

`apps/daemon/src/server.ts` 是 daemon HTTP/SSE 入口。业务服务按能力分目录：

- `journal/`, `todos/`, `topics/`, `identity/`, `materials/`
- `settings/`, `config/`, `workspace/`, `files/`, `permissions/`
- `runs/`, `engine/`, `runtimes/`, `changeset/`, `sediment/`, `artifacts/`
- `automation/`, `work_queue/`, `ai_processor/`, `event_log/`

核心原则：

- service 层保存业务语义，route 层只做协议适配。
- 所有文件写入、移动、删除都生成 ChangeSet。
- authorization mode 在 daemon 执行：`read_only`、`workspace_write`、`full_access`。
- run events 统一为 `AgentRunEvent`，前端不感知 pi/CLI 原始事件格式。

## Agent Run

Agent Run 主路径：

1. `POST /runs` 创建 run。
2. daemon 根据 engine 选择 pi 内建引擎或 CLI adapter。
3. `GET /runs/:id/events` 通过 SSE 输出事件，并支持 cursor 恢复。
4. `POST /runs/:id/cancel` 取消运行。
5. run 完成后触发 artifact / memory / rule 沉淀。

事件至少覆盖 run lifecycle、thinking/text delta、tool call/result、change proposed、artifact、sedimentation、finish/fail。

## Electron Host

`apps/desktop` 负责：

- main/preload 构建。
- daemon 子进程启动、退出与日志转发。
- 原生菜单和窗口生命周期。
- 文件选择、系统打开、Reveal、dialog、zoom、theme、file drop。

Preload 只暴露 `window.electronAPI` 的白名单方法。Renderer 通过 `hostBridge.ts` 访问这些能力。

## 数据与恢复

- workspace 既有 Markdown、topics、todos、identity、skills、conversation、automation 数据保持可读。
- 新元数据写入跨平台路径，不把平台专属目录作为唯一真相。
- 删除与恢复走 ChangeSet / 项目内恢复路径。
- run summary、artifact index、memory/rules 和 JSONL event log 可被导出和备份。

## 已下线能力

默认跨平台主干不再包含本地音频/语音/转写能力：`journal-speech`、Apple SpeechAnalyzer、WhisperKit、speaker profiles 已删除。相关用户说明见 `docs/adr/rust-removal-release-note.md`。

## 参考

- `docs/adr/rust-removal-roadmap.md`
- `docs/adr/rust-api-parity.md`
- `docs/adr/rust-removal-acceptance.md`
