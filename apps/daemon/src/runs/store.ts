/**
 * Run event JSONL persistence.
 *
 * 每个 run 一个文件：<dataDir>/runs/<runId>.jsonl，每行一个 AgentRunEvent JSON。
 * 参照 open-design apps/daemon/src/runtimes/runs.ts 的 eventsLogPath 形态，
 * 但简化为同步追加 + 整文件回放（G4 不接长生命周期 child process）。
 */

import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { isAgentRunEvent, type AgentRunEvent } from '@journal/contracts'

export class RunStore {
  private readonly runsDir: string

  constructor(private readonly dataDir: string) {
    this.runsDir = join(dataDir, 'runs')
  }

  private filePath(runId: string): string {
    return join(this.runsDir, `${runId}.jsonl`)
  }

  /**
   * 追加一个事件到该 run 的 JSONL 日志。文件或目录不存在会自动创建。
   * 写盘失败被吞掉——内存 + SSE 仍可继续（参照 open-design ensureLogStream 的容错策略）。
   */
  appendEvent(runId: string, event: AgentRunEvent): void {
    try {
      const file = this.filePath(runId)
      mkdirSync(dirname(file), { recursive: true })
      appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8')
    } catch {
      // best-effort: 持久化失败不影响内存 + SSE
    }
  }

  /**
   * 回放该 run 的全部事件，按追加顺序返回。文件不存在返回 []。
   * 每行 JSON.parse 后用 isAgentRunEvent 校验；非法行被跳过。
   */
  readEvents(runId: string): AgentRunEvent[] {
    const file = this.filePath(runId)
    if (!existsSync(file)) return []
    const content = readFileSync(file, 'utf8')
    const out: AgentRunEvent[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed)
        if (isAgentRunEvent(parsed)) out.push(parsed)
      } catch {
        // 跳过损坏行
      }
    }
    return out
  }
}
