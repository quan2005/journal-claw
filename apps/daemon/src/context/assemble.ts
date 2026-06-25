/**
 * Context assembler — the "Agent 组装上下文" step of the core loop.
 *
 * Before the Agent executes, its prompt is wrapped with workspace context
 * (goals, active sources, type) and recent sedimented memory (preferences,
 * project facts, writing rules). This is what makes the Agent a *knowledge
 * worker* rather than a context-free chat: it starts with the workspace's
 * accumulated state instead of re-deriving everything each turn.
 *
 * The assembled prompt is:
 *   [workspace context block]
 *   [memory: preferences/facts/rules]
 *   ---
 *   User goal: <prompt>
 */
import type { WorkspaceMeta, MemoryRecord } from '@journal/contracts'

export function assembleContext(
  prompt: string,
  workspace: WorkspaceMeta | null,
  memory: MemoryRecord[],
): string {
  const parts: string[] = []

  // Workspace context block
  if (workspace) {
    parts.push(`# Workspace: ${workspace.name}`)
    if (workspace.type !== 'general') parts.push(`Type: ${workspace.type}`)
    if (workspace.description) parts.push(workspace.description)
    if (workspace.goals.length > 0) {
      parts.push('## Goals')
      for (const g of workspace.goals) parts.push(`- ${g}`)
    }
    if (workspace.activeSources.length > 0) {
      parts.push('## Active sources')
      for (const s of workspace.activeSources) parts.push(`- ${s}`)
    }
  }

  // Memory block: only durable, reusable knowledge (not run summaries)
  const durable = memory.filter(
    (m) => m.kind === 'preference' || m.kind === 'project_fact' || m.kind === 'writing_rule' || m.kind === 'tool_rule',
  )
  if (durable.length > 0) {
    parts.push('## Known preferences, facts, and rules')
    for (const m of durable.slice(0, 20)) {
      parts.push(`- [${m.kind}] ${m.summary}`)
    }
  }

  // Separator + user goal
  parts.push('---')
  parts.push(`User goal: ${prompt}`)
  return parts.join('\n')
}
