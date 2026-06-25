import { describe, it, expect } from 'vitest'
import { isAgentRunEvent, type AgentRunEvent } from './index.js'

describe('contracts', () => {
  it('isAgentRunEvent validates a well-formed event', () => {
    const event: AgentRunEvent = {
      type: 'run_started',
      runId: 'run-1',
      sessionId: 'sess-1',
      data: '',
      timestamp: new Date().toISOString(),
    }
    expect(isAgentRunEvent(event)).toBe(true)
  })

  it('isAgentRunEvent rejects malformed input', () => {
    expect(isAgentRunEvent(null)).toBe(false)
    expect(isAgentRunEvent({})).toBe(false)
    expect(isAgentRunEvent({ type: 'run_started' })).toBe(false)
  })

  it('exports all core domain types', async () => {
    const mod = await import('./index.js')
    expect(typeof mod.isAgentRunEvent).toBe('function')
    // 类型存在性（编译期保证，运行期只查导出）
    expect(mod).toBeDefined()
  })
})
