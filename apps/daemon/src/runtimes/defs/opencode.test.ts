import { describe, it, expect } from 'vitest'
import { opencodeAgentDef } from './opencode.js'

describe('opencode buildArgs', () => {
  it('emits `run --format json` and promptViaStdin (no argv sentinel)', () => {
    const args = opencodeAgentDef.buildArgs('hi', [], [], {})
    expect(args).toContain('run')
    expect(args[args.indexOf('--format') + 1]).toBe('json')
    expect(opencodeAgentDef.promptViaStdin).toBe(true)
    expect(args.includes('-')).toBe(false)
    expect(args.some((a) => typeof a === 'string' && a.length > 10)).toBe(false)
  })

  it('passes model through as -m when set and not default', () => {
    const args = opencodeAgentDef.buildArgs('p', [], [], { model: 'anthropic/claude-sonnet-4-5' })
    expect(args[args.indexOf('-m') + 1]).toBe('anthropic/claude-sonnet-4-5')
  })

  it('omits -m when model is default', () => {
    const args = opencodeAgentDef.buildArgs('p', [], [], { model: 'default' })
    expect(args).not.toContain('-m')
  })

  it('declares opencode-json streamFormat and opencode bin/fallbacks', () => {
    expect(opencodeAgentDef.streamFormat).toBe('opencode-json')
    expect(opencodeAgentDef.bin).toBe('opencode')
    expect(opencodeAgentDef.fallbackBins).toContain('opencode-cli')
  })
})
