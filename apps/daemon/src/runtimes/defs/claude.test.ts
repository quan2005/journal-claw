import { describe, it, expect } from 'vitest'
import { claudeAgentDef } from './claude.js'

describe('claude buildArgs authorization mapping', () => {
  it('emits --permission-mode acceptEdits for workspace_write (default)', () => {
    const args = claudeAgentDef.buildArgs('p', [], [], {})
    expect(args).toContain('--permission-mode')
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits')
  })

  it('maps read_only -> plan', () => {
    const args = claudeAgentDef.buildArgs('p', [], [], { authorizationMode: 'read_only' })
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan')
  })

  it('maps full_access -> bypassPermissions', () => {
    const args = claudeAgentDef.buildArgs('p', [], [], { authorizationMode: 'full_access' })
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('bypassPermissions')
  })

  it('still includes -p and stream-json output', () => {
    const args = claudeAgentDef.buildArgs('p', [], [], {})
    expect(args).toContain('-p')
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json')
  })
})
