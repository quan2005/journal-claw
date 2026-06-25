import { describe, it, expect, beforeEach } from 'vitest'
import { registerAgentDef, getAgentDef, listAgentDefs, ensureBuiltinsRegistered, __resetRegistryForTests } from './registry.js'
import type { RuntimeAgentDef } from '@journal/contracts'

const stub = (id: string): RuntimeAgentDef => ({ id, name: id, bin: id, version: { args: ['--version'] }, buildArgs: () => [], promptViaStdin: true, streamFormat: id })

describe('runtime registry', () => {
  beforeEach(() => __resetRegistryForTests())
  it('looks up built-in claude', () => { ensureBuiltinsRegistered(); const c = getAgentDef('claude'); expect(c).not.toBeNull(); expect(c!.id).toBe('claude') })
  it('null for unknown', () => { expect(getAgentDef('nope')).toBeNull() })
  it('lists at least claude', () => { expect(listAgentDefs().length).toBeGreaterThanOrEqual(1); expect(listAgentDefs().some((d) => d.id === 'claude')).toBe(true) })
  it('rejects duplicate ids', () => { registerAgentDef(stub('custom')); expect(() => registerAgentDef(stub('custom'))).toThrow(/Duplicate agent definition id/) })
  it('idempotent builtin register', () => { ensureBuiltinsRegistered(); ensureBuiltinsRegistered(); expect(listAgentDefs().filter((d) => d.id === 'claude').length).toBe(1) })
})
