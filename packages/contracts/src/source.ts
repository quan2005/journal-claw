/**
 * SourceBinding — the "Sources" first-class object's run-level binding (G6).
 *
 * Declares which local files a Run used as evidence. A Run reads files (via
 * its tool calls), and each binding records the path + how it was used + the
 * excerpt that justified a conclusion. This is what makes the Run panel show
 * "正在读哪些本地资料" and "哪些结论有引用依据" — the evidence chain
 * (Sources → Run → Artifacts/Memory) becomes explicit and auditable.
 */
export type SourceBindingKind = 'read' | 'reference' | 'search' | 'cite'

export interface SourceBinding {
  id: string
  /** Run that used this source. */
  runId: string
  /** Workspace-relative or absolute path of the source file. */
  path: string
  /** How the Agent used it. */
  kind: SourceBindingKind
  /** Optional excerpt/snippet that served as evidence. */
  excerpt?: string
  /** The tool-call span id that produced this binding, if any. */
  sourceSpanId?: string
  /** Free-text note on why this source was relevant. */
  note?: string
  createdAt: string
}

export function isSourceBinding(value: unknown): value is SourceBinding {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.runId === 'string' &&
    typeof v.path === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.createdAt === 'string'
  )
}
