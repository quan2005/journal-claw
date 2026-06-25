/**
 * RuntimeAgentDef registry — dedup by id, lookup by id, list all.
 *
 * Mirrors open-design runtimes/registry.ts shape. The daemon's runner asks
 * getAgentDef(agentId) to find the adapter for a run; server.ts GET /agents
 * lists them for the UI.
 */
import type { RuntimeAgentDef } from '@journal/contracts'
import { claudeAgentDef } from './defs/claude.js'

const BUILT_IN: RuntimeAgentDef[] = [claudeAgentDef]

const defs = new Map<string, RuntimeAgentDef>()

/** Register one def. Duplicate id throws (mirrors open-design invariant). */
export function registerAgentDef(def: RuntimeAgentDef): void {
  if (defs.has(def.id)) {
    throw new Error(`Duplicate agent definition id: ${def.id}`)
  }
  defs.set(def.id, def)
}

/** Register all built-ins once. Safe to call multiple times. */
export function ensureBuiltinsRegistered(): void {
  for (const def of BUILT_IN) {
    if (!defs.has(def.id)) defs.set(def.id, def)
  }
}

export function getAgentDef(id: string): RuntimeAgentDef | null {
  ensureBuiltinsRegistered()
  return defs.get(id) ?? null
}

export function listAgentDefs(): RuntimeAgentDef[] {
  ensureBuiltinsRegistered()
  return [...defs.values()]
}

/** Test-only: clear the registry (not exported to consumers). */
export function __resetRegistryForTests(): void {
  defs.clear()
}
