/**
 * AgentRunService — Run 一等化的服务层。
 *
 * 内存 Map 存活跃 run；事件同时落 JSONL（RunStore）+ 推送给 SSE 订阅者。
 * 状态机由 AgentRunEvent 驱动：
 *   run_started   → running
 *   run_finished  → succeeded
 *   run_failed    → failed
 *   cancelRun     → canceled（终态，后续 appendEvent 不再改状态）
 *
 * 参照 open-design apps/daemon/src/runtimes/runs.ts，简化掉 child process / RPC 部分
 * （G4 只做服务层骨架，不接真实 Coding Agent CLI——那是 G11）。
 */

import { randomUUID } from 'node:crypto'
import {
  type AgentRun,
  type AgentRunEvent,
  type AgentRunMode,
  type AgentRunStatus,
  type AuthorizationMode,
} from '@journal/contracts'
import { RunStore } from './store.js'

const TERMINAL_STATUSES: ReadonlySet<AgentRunStatus> = new Set([
  'succeeded',
  'failed',
  'canceled',
])

type SseSubscriber = (event: AgentRunEvent) => void

interface RunState extends AgentRun {
  /** 活跃 SSE 订阅者回调集合。 */
  subscribers: Set<SseSubscriber>
}

export interface CreateRunInput {
  goal: string
  mode: AgentRunMode
  authorizationMode?: AuthorizationMode
  parentRunId?: string
}

export class AgentRunService {
  private readonly runs = new Map<string, RunState>()
  private readonly store: RunStore

  constructor(dataDir: string) {
    this.store = new RunStore(dataDir)
  }

  createRun(input: CreateRunInput): AgentRun {
    const now = new Date().toISOString()
    const id = randomUUID()
    const state: RunState = {
      id,
      sessionId: randomUUID(),
      goal: input.goal,
      mode: input.mode,
      status: 'queued',
      authorizationMode: input.authorizationMode ?? 'workspace_write',
      contextBindings: [],
     steps: [],
      parentRunId: input.parentRunId,
     createdAt: now,
      updatedAt: now,
      subscribers: new Set(),
    }
    this.runs.set(id, state)
    return this.toAgentRun(state)
  }

  getRun(runId: string): AgentRun | null {
    const state = this.runs.get(runId)
    return state ? this.toAgentRun(state) : null
  }

  /**
   * 追加事件：驱动状态机 → 持久化 → 推送 SSE 订阅者。
   * 已进入终态（succeeded/failed/canceled）的 run 不再改变状态。
   */
  appendEvent(runId: string, event: AgentRunEvent): void {
    const state = this.runs.get(runId)
    if (!state) return

    if (!TERMINAL_STATUSES.has(state.status)) {
      this.applyEvent(state, event)
    }
    state.updatedAt = new Date().toISOString()

    this.store.appendEvent(runId, event)
    for (const sub of state.subscribers) {
      try {
        sub(event)
      } catch {
        // 单个订阅者抛错不影响其他订阅者
      }
    }
  }

  /**
   * 取消 run：状态 → canceled（终态）。后续 appendEvent 不再改变状态。
   * 对未创建的 run 是 no-op。
   */
  cancelRun(runId: string): AgentRun | null {
    const state = this.runs.get(runId)
    if (!state) return null
    if (!TERMINAL_STATUSES.has(state.status)) {
      state.status = 'canceled'
      state.updatedAt = new Date().toISOString()
    }
    return this.toAgentRun(state)
  }

  /**
   * 订阅某个 run 的事件流。立刻回放已有事件，之后每次 appendEvent 都触发回调。
   * 返回 unsubscribe 函数。
   */
  subscribe(runId: string, onEvent: SseSubscriber): () => void {
    const state = this.runs.get(runId)
    if (!state) {
      // run 不存在：回放为空，订阅也无效。返回 no-op disposer。
      return () => {}
    }
    state.subscribers.add(onEvent)
    // 立刻回放历史事件
    for (const past of this.store.readEvents(runId)) {
      try {
        onEvent(past)
      } catch {
        // ignore
      }
    }
    return () => {
      state.subscribers.delete(onEvent)
    }
  }

  /** 暴露给 server.ts 在 SSE handler 里读取 runId 是否存在。 */
 hasRun(runId: string): boolean {
   return this.runs.has(runId)
 }

  /** List child runs spawned by a parent (multi-agent subtask delegation). */
  listChildRuns(parentRunId: string): AgentRun[] {
    return [...this.runs.values()]
      .filter((s) => s.parentRunId === parentRunId)
      .map((s) => this.toAgentRun(s))
  }

  /** 透传到 store 的回放（供测试 + 后续 cold-restart 场景使用）。 */
  readEvents(runId: string): AgentRunEvent[] {
    return this.store.readEvents(runId)
  }

  // ── internal ──────────────────────────────────────────────────────────────

  private applyEvent(state: RunState, event: AgentRunEvent): void {
    switch (event.type) {
      case 'run_started':
        state.status = 'running'
        break
      case 'run_finished':
        state.status = 'succeeded'
        break
      case 'run_failed':
        state.status = 'failed'
        break
      default:
        // 非状态事件（text_delta / tool_call / ...）不改状态
        break
    }
  }

  private toAgentRun(state: RunState): AgentRun {
    // 剥离内部字段，返回纯 AgentRun 形态
    const { subscribers, ...run } = state
    void subscribers
    return run
  }
}
