import { describe, it, expect } from 'vitest'
import {
  isRuntimeAgentDef,
  isAgentAuthStatus,
  type RuntimeAgentDef,
  type AgentAuthStatus,
} from './runtime.js'

const validDef: RuntimeAgentDef = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  version: { args: ['--version'] },
  buildArgs: () => ['-p'],
  promptViaStdin: true,
  streamFormat: 'claude-stream-json',
}

describe('runtime contracts', () => {
  it('isRuntimeAgentDef accepts a valid def', () => {
    expect(isRuntimeAgentDef(validDef)).toBe(true)
  })
  it('isRuntimeAgentDef rejects malformed', () => {
    expect(isRuntimeAgentDef(null)).toBe(false)
    expect(isRuntimeAgentDef({})).toBe(false)
    expect(isRuntimeAgentDef({ id: 'x' })).toBe(false)
  })
  it('isAgentAuthStatus accepts valid', () => {
    expect(
      isAgentAuthStatus({
        id: 'c',
        installed: true,
        version: '2',
        authed: true,
      } as AgentAuthStatus),
    ).toBe(true)
  })
  it('isAgentAuthStatus rejects malformed', () => {
    expect(isAgentAuthStatus(null)).toBe(false)
  })
  it('re-exported from index', async () => {
    const m = await import('./index.js')
    expect(typeof m.isRuntimeAgentDef).toBe('function')
  })
})
