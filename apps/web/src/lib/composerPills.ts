import type { EngineConfig } from './apiTypes'
import type { ThinkingLevel } from '../hooks/useComposerSelection'

export const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

/** Groups provider entries by their display label, so a credential that
 * carries several models renders as one group with multiple selectable rows
 * instead of one row per (provider, model) pair. */
export function groupProvidersByLabel<T extends { label: string }>(
  providers: T[],
): Array<{ label: string; entries: T[] }> {
  const groups = new Map<string, T[]>()
  for (const p of providers) {
    if (!groups.has(p.label)) groups.set(p.label, [])
    groups.get(p.label)!.push(p)
  }
  return [...groups.entries()].map(([label, entries]) => ({ label, entries }))
}

/** Resolves the model id shown in the composer pill: the persisted
 * `composer_selected_model_id` when it still belongs to the active provider,
 * otherwise the active provider's first configured model. Keeps the pill in
 * sync with the credential list even if a model was removed in settings. */
export function activePillModelId(
  engineConfig: EngineConfig,
  providerId: string | null,
  modelId: string | null,
): string {
  const active = engineConfig.providers.find(
    (p) => p.id === (providerId ?? engineConfig.active_provider),
  )
  if (!active || active.models.length === 0) return engineConfig.active_provider
  if (modelId && active.models.includes(modelId)) return modelId
  return active.models[0]
}
