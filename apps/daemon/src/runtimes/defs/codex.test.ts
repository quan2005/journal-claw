import { describe, it, expect } from 'vitest'
import { codexAgentDef } from './codex.js'

describe('codex buildArgs', () => {
  it('emits `exec --json` and passes prompt via argv', () => {
    const args = codexAgentDef.buildArgs('hi', [], [], {})
    expect(args).toContain('exec')
    expect(args).toContain('--json')
    expect(args.at(-1)).toBe('hi')
    expect(codexAgentDef.promptViaStdin).toBe(false)
  })

  it('maps authorization modes to codex sandbox names', () => {
    expect(codexAgentDef.buildArgs('p', [], [], { authorizationMode: 'read_only' })).toContain(
      'read-only',
    )
    expect(
      codexAgentDef.buildArgs('p', [], [], { authorizationMode: 'workspace_write' }),
    ).toContain('workspace-write')
    expect(codexAgentDef.buildArgs('p', [], [], { authorizationMode: 'full_access' })).toContain(
      'danger-full-access',
    )
  })

  it('passes model through as --model when set and not default', () => {
    const args = codexAgentDef.buildArgs('p', [], [], { model: 'gpt-5.5' })
    expect(args[args.indexOf('--model') + 1]).toBe('gpt-5.5')
  })

  it('omits --model when model is default', () => {
    const args = codexAgentDef.buildArgs('p', [], [], { model: 'default' })
    expect(args).not.toContain('--model')
  })

  it('declares codex-jsonl streamFormat and codex bin/auth probe', () => {
    expect(codexAgentDef.streamFormat).toBe('codex-jsonl')
    expect(codexAgentDef.bin).toBe('codex')
    expect(codexAgentDef.authProbe?.args).toEqual(['login', 'status'])
  })
})
