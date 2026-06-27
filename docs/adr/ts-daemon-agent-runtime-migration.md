# ADR: TypeScript Daemon 与 Coding Agent Runtime 迁移

状态：Proposed

日期：2026-06-25

相关 story：

- `stories/20260625-ts-daemon-agent-runtime-migration/story.md`
- `stories/20260625-agent-runtime-contract-docs/story.md`
- `stories/20260625-runtime-client-protection/story.md`

## 背景

`journal` 当前是 Tauri v2 + React 19 + TypeScript + Rust 的本地桌面应用。Rust 后端承担本地文件系统、AI engine、agentic tool loop、conversation stream、settings、workspace、automation 等责任。

产品方向已经从“带 AI 的笔记软件”收束为本地优先的个人知识 Agent 工作台。Agent 可以读取、写入、修改、移动、组织、执行和沉淀本地知识资产。迁移目标是：

- 去掉 Rust 主干，迁移到更纯粹的 TypeScript 架构。
- 适配多个 Coding Agent CLI，而不是绑定单一内置模型循环。
- 保持本地-only、多平台一致，不把云同步或远端运行时作为默认路径。
- 不把 Apple Speech、Whisper、ffmpeg、系统 Trash 或平台专属 API 放入默认主干。
- 初期默认 `workspace_write` 并完整审计；`wide_with_audit` 保留为显式迁移/审计模式。
- 首批只支持 Claude Code、Codex CLI、OpenCode。
- Agent Run 结束后默认自动沉淀运行摘要、输出产物、memory/rule 记录。

`open-design` 的 Electron host + Node/TS daemon + runtime registry 形态是主要参考，但 `journal` 的产品定位仍是本地个人知识工作台。

## 决策

采用分阶段迁移：

```text
React UI
  -> JournalRuntimeClient
  -> TauriRuntimeClient | HttpRuntimeClient
  -> TypeScript Daemon
     -> WorkspaceService
     -> AgentRunService
     -> CodingAgentAdapterRegistry
     -> ChangeSetService
     -> SedimentationService
     -> AuthorizationModeMapper
     -> EventLog(JSONL)
Desktop Host
  -> Electron 或过渡期 Tauri shell
Portable Runtime Boundary
  -> 默认只依赖跨平台 Node/Electron 能力
```

迁移期默认 Tauri 路径继续工作；TS daemon 先旁路落地。TS daemon 覆盖核心能力并通过独立验收后，Rust 后端不保留为长期并行主干。

## 核心领域对象

### JournalRuntimeClient

前端唯一运行时客户端。组件不直接知道 Tauri、HTTP、SSE 或 WebSocket。

```ts
type JournalRuntimeClient = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  subscribe<T>(event: string, handler: (payload: T) => void): () => void
}
```

过渡期实现：

- `TauriRuntimeClient`：封装现有 `invoke()` 和 `listen()`。
- `HttpRuntimeClient`：调用 TS daemon HTTP API，并用 SSE 接收事件。

### AgentRun

一次可追踪的 Agent 工作，而不是一段普通聊天。

关键字段：

- `id`
- `sessionId`
- `goal`
- `mode`
- `status`
- `authorizationMode`
- `contextBindings`
- `steps`
- `toolCalls`
- `changeSets`
- `artifacts`
- `memoryUpdates`

### AgentRunEvent

UI 消费统一事件，不暴露具体 CLI 差异。

最小事件集：

- `run_started`
- `step_started`
- `step_finished`
- `thinking_delta`
- `text_delta`
- `tool_call`
- `tool_result`
- `change_proposed`
- `artifact_created`
- `sedimentation_started`
- `sedimentation_recorded`
- `run_finished`
- `run_failed`

现有 `ConversationStreamPayload` 的 `span_id` / `parent_span_id` 可作为 timeline 层级基础。

### CodingAgentAdapter

adapter 只处理 CLI 差异，不承载产品 UI 语义。

```ts
type CodingAgentAdapter = {
  id: string
  displayName: string
  detect(): Promise<AgentDetection | null>
  buildArgs(input: AgentRunInput): string[]
  run(input: AgentRunInput): AsyncIterable<AgentRunEvent>
  cancel(runId: string): Promise<void>
  resume?(runId: string, message: string): AsyncIterable<AgentRunEvent>
}
```

首批 adapter：

- Claude Code
- Codex CLI
- OpenCode

暂不支持 Gemini、Cursor Agent、ACP-family 等其它运行时。

### ChangeSet

所有写、改、移动、删除操作的结构化变更记录。

```ts
type ChangeSet = {
  id: string
  runId: string
  path: string
  operation: 'create' | 'edit' | 'move' | 'remove'
  beforeHash?: string
  afterHash?: string
  beforePath?: string
  afterPath?: string
  diffPreview: string
  risk: 'low' | 'medium' | 'high'
  authorizationMode: AuthorizationMode
  status: 'recorded' | 'blocked' | 'applied' | 'reverted' | 'failed'
}
```

删除和撤销使用项目内恢复机制，例如 `.journal-trash/`、run snapshot 或 ChangeSet before/after 内容，不依赖系统 Trash。

### AuthorizationMode

第一阶段不做复杂细粒度权限系统。

```ts
type AuthorizationMode =
  | 'wide_with_audit'
  | 'read_only'
  | 'workspace_write'
  | 'full_access'
```

- `wide_with_audit`：显式迁移/审计模式。允许执行，但记录工具调用、文件访问、ChangeSet、artifact 和错误。
- `read_only`：不允许写、改、移动、删除或破坏性命令。
- `workspace_write`：默认模式。允许 workspace root 内读写，禁止越界路径。
- `full_access`：交给 CLI 的全放开模式，但仍保留产品侧审计事件。

不同 CLI 的授权 flag 只在 adapter 层映射，产品 UI 面向统一三档语义。

### SedimentationRecord

Run 结束后的自动沉淀记录。它不是黑盒记忆，每条记录都必须能追溯到 source run、证据片段和写入 ChangeSet。

```ts
type SedimentationRecord = {
  id: string
  runId: string
  kind: 'run_summary' | 'artifact_index' | 'preference' | 'project_fact' | 'writing_rule' | 'tool_rule'
  path: string
  evidence: Array<{ sourcePath?: string; quote?: string; eventId?: string }>
  relatedArtifactIds?: string[]
  relatedChangeSetIds?: string[]
  status: 'auto_recorded' | 'edited' | 'reverted' | 'rejected'
  createdAt: string
}
```

## 迁移阶段

1. **Phase 0：需求门禁与 ADR**  
   完成 story、design、ADR、Rust 删除验收清单落仓。

2. **Phase 1：前端运行时保护层**  
   新增 `JournalRuntimeClient`。默认仍走 Tauri；组件 API 保持兼容；`useConversation` 不直接绑定 Tauri event API。

3. **Phase 2：旁路 TypeScript daemon**  
   新增 daemon 骨架，提供 health/workspace/events/run events 最小接口，不接管生产路径。

4. **Phase 3：Coding Agent registry**  
   接入 Claude Code、Codex CLI、OpenCode 的 detect/version/auth/run 基础能力。

5. **Phase 4：AgentRun、ChangeSet、AuthorizationMode**  
   让高权限 Agent 的运行、文件变更和授权模式可追踪、可恢复。

6. **Phase 5：Agent Run Workbench 和自动沉淀**  
   复用现有 Run 面板视觉优先级，接入结构化 run 数据、ChangeSet preview、artifact、自动沉淀状态。

7. **Phase 6：Rust 后端退出**  
   只有通过 `docs/adr/rust-removal-acceptance.md` 后，才允许删除已替代的 Rust 后端能力。

## 复用

- `src/lib/tauri.ts` 的 API 面。
- `src/types.ts` 的 `ConversationStreamPayload` 基础事件。
- `src/hooks/useConversation.ts` 的消息缓存、artifact parser 与 pending queue。
- `open-design/apps/daemon/src/runtimes` 的 adapter registry 思路。
- `open-design/apps/daemon/src/runtimes/runs.ts` 的 SSE run service 与 JSONL 事件日志思路。

## 不做项

- 不在 Phase 1 删除 Rust。
- 不先切 Electron。
- 不一次性重写 `ChatPanel`。
- 不重做 Run 面板当前视觉优先级。
- 不让业务组件感知具体 Coding Agent CLI。
- 不在 adapter 层实现产品语义。
- 不规划 Apple Speech、Whisper、ffmpeg、系统原生回收站等平台绑定能力。
- 不规划云同步、远端运行时或外部 provider 作为默认产品路径。
- 不在首批支持 Claude Code、Codex CLI、OpenCode 之外的其它 CLI。
- 不把自动沉淀做成 UI 手动按钮；它必须是 daemon run lifecycle 的默认阶段。

## 验收

- Phase 1 后，现有 Tauri 默认路径保持可用。
- daemon 可以旁路启动，并完成 mock run。
- Claude Code、Codex CLI、OpenCode adapter 都具备 detect/version/auth 基础探测。
- Agent Run 事件能被前端 reducer 渲染为统一 timeline/block。
- 所有写改移动删除都生成 ChangeSet，并有恢复路径。
- `read_only`、`workspace_write`、`full_access` 三档授权语义可测试。
- run 完成后自动写 summary、artifact index、memory/rule 记录，并保留 source run 与 ChangeSet 证据链。
- 默认 build/test 不依赖 Apple Speech、Whisper、ffmpeg、系统 Trash 或平台专属二进制。
- 删除 Rust 前必须通过 `docs/adr/rust-removal-acceptance.md`。
