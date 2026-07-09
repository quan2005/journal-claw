import { useState, useEffect, useCallback, useRef } from 'react'
import { selectRuntimeClient } from '../../lib/runtimeClient'
import { hostOpenWithSystem } from '../../lib/hostBridge'
import {
  BUILTIN_PRESETS,
  newProviderId,
  type ProviderEntry,
  type EngineConfig,
} from '../../lib/apiTypes'

const getEngineConfig = () => selectRuntimeClient().invoke<EngineConfig>('get_engine_config')
const setEngineConfig = (cfg: EngineConfig) =>
  selectRuntimeClient().invoke<void>('set_engine_config', { config: cfg })
const listModels = (
  engine: string,
  apiKey: string,
  baseUrl: string,
  protocol?: string,
): Promise<string[]> =>
  selectRuntimeClient().invoke<string[]>('list_models', { engine, apiKey, baseUrl, protocol })
import { Check, ExternalLink, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import SkeletonRow from './SkeletonRow'
import { useTranslation } from '../../contexts/I18nContext'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const sectionStyle: React.CSSProperties = {
  padding: '34px 40px 48px',
  borderBottom: '1px solid var(--divider)',
}
const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 22,
}
const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--month-label)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
  fontWeight: 500,
}
const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--item-meta)',
  maxWidth: 620,
}
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--item-meta)',
  marginBottom: 5,
  display: 'block',
}
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--duration-text)',
  marginTop: 4,
  lineHeight: 1.5,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 14,
  color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace',
  outline: 'none',
  boxSizing: 'border-box',
}
const panelStyle: React.CSSProperties = {
  background: 'var(--detail-case-bg)',
  border: '1px solid var(--divider)',
  borderRadius: 8,
}
const mutedButtonStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  color: 'var(--item-meta)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

function isEngineConfigEqual(a: EngineConfig, b: EngineConfig) {
  if (a.active_provider !== b.active_provider) return false
  if (a.providers.length !== b.providers.length) return false
  for (let i = 0; i < a.providers.length; i++) {
    const pa = a.providers[i]
    const pb = b.providers[i]
    if (
      pa.id !== pb.id ||
      pa.protocol !== pb.protocol ||
      pa.label !== pb.label ||
      pa.api_key !== pb.api_key ||
      pa.base_url !== pb.base_url
    )
      return false
    if (pa.models.length !== pb.models.length) return false
    for (let j = 0; j < pa.models.length; j++) {
      if (pa.models[j] !== pb.models[j]) return false
    }
  }
  return true
}

function ModelListManager({
  providerId,
  apiKey,
  baseUrl,
  protocol,
  models,
  onAdd,
  onRemove,
  onSaveStatusReset,
}: {
  providerId: string
  apiKey: string
  baseUrl: string
  protocol: string
  models: string[]
  onAdd: (model: string) => void
  onRemove: (model: string) => void
  onSaveStatusReset: () => void
}) {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  const fetchModels = useCallback(() => {
    if (!apiKey?.trim()) {
      setCandidates([])
      return
    }
    setFetching(true)
    listModels(providerId, apiKey, baseUrl, protocol)
      .then((list) => {
        setCandidates(list)
        setFetching(false)
      })
      .catch(() => {
        setCandidates([])
        setFetching(false)
      })
  }, [providerId, apiKey, baseUrl, protocol])

  useEffect(() => {
    if (!apiKey?.trim()) {
      setCandidates([])
      return
    }
    const timer = setTimeout(fetchModels, 500)
    return () => clearTimeout(timer)
  }, [fetchModels, apiKey])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addModel = (model: string) => {
    const trimmed = model.trim()
    if (!trimmed) return
    onAdd(trimmed)
    onSaveStatusReset()
    setCustomInput('')
    setOpen(false)
  }

  // Suggested models: from the daemon probe, minus the ones already configured.
  const suggested = candidates.filter((m) => !models.includes(m))
  const filteredSuggestions = customInput
    ? suggested.filter((m) => m.toLowerCase().includes(customInput.toLowerCase()))
    : suggested
  // Always show the panel once opened (not just when suggestions/fetching/typed
  // text exist) — the manual model-id input lives inside it, so gating on
  // "something to show" trapped users with no visible way to type a model.
  const showDropdown = open

  return (
    <div>
      <label style={labelStyle}>{t('modelLabel')}</label>
      <div style={{ marginBottom: 8 }}>
        {models.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--divider)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 12,
              color: 'var(--duration-text)',
            }}
          >
            {t('leaveBlankModel')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {models.map((m) => (
              <span
                key={m}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--bg)',
                  border: '1px solid var(--divider)',
                  borderRadius: 999,
                  padding: '3px 8px 3px 10px',
                  fontSize: 12,
                  color: 'var(--item-text)',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {m}
                <button
                  type="button"
                  onClick={() => {
                    onRemove(m)
                    onSaveStatusReset()
                  }}
                  aria-label={t('confirmDeleteProvider', { name: m })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--item-meta)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    lineHeight: 1,
                    fontSize: 14,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            if (apiKey?.trim() && candidates.length === 0) fetchModels()
          }}
          style={mutedButtonStyle}
        >
          <Plus size={13} /> {t('addModel')}
        </button>
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 2,
              maxHeight: 240,
              overflowY: 'auto',
              background: 'var(--detail-case-bg)',
              border: '1px solid var(--divider)',
              borderRadius: 6,
              zIndex: 10,
              padding: 4,
            }}
          >
            <input
              style={inputStyle}
              placeholder={t('modelInputPlaceholder')}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addModel(customInput)
                }
              }}
              autoFocus
            />
            {fetching ? (
              <div
                style={{
                  padding: '8px 10px',
                  fontSize: 13,
                  color: 'var(--duration-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: '1.5px solid var(--divider)',
                    borderTopColor: 'var(--item-meta)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    flexShrink: 0,
                  }}
                />
                {t('loadingModels')}
              </div>
            ) : (
              filteredSuggestions.map((m) => (
                <div
                  key={m}
                  onClick={() => addModel(m)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 13,
                    color: 'var(--item-text)',
                    cursor: 'pointer',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--divider)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {m}
                </div>
              ))
            )}
            {customInput.trim() && !candidates.includes(customInput.trim()) && (
              <div
                onClick={() => addModel(customInput)}
                style={{
                  padding: '6px 10px',
                  fontSize: 13,
                  color: 'var(--record-btn)',
                  cursor: 'pointer',
                  borderTop: '1px solid var(--divider)',
                  marginTop: 2,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--divider)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                + “{customInput.trim()}”
              </div>
            )}
          </div>
        )}
      </div>
      <div style={hintStyle}>{t('leaveBlankModel')}</div>
    </div>
  )
}

function presetForId(id: string) {
  return BUILTIN_PRESETS.find((p) => p.id === id)
}

function presetForProvider(provider?: ProviderEntry) {
  if (!provider) return undefined
  return (
    BUILTIN_PRESETS.find((p) => p.id === provider.id) ||
    BUILTIN_PRESETS.find(
      (p) =>
        p.label === provider.label ||
        Boolean(provider.base_url && p.defaultBaseUrl === provider.base_url),
    )
  )
}

function protocolLabel(protocol: string) {
  return protocol === 'anthropic' ? 'Anthropic' : 'OpenAI'
}

function ProviderChip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'active' | 'warning' | 'success'
}) {
  const palette: Record<
    NonNullable<typeof tone>,
    { color: string; background: string; border: string }
  > = {
    neutral: {
      color: 'var(--duration-text)',
      background: 'transparent',
      border: 'var(--divider)',
    },
    active: {
      color: 'var(--record-btn)',
      background: 'color-mix(in srgb, var(--record-btn) 10%, transparent)',
      border: 'color-mix(in srgb, var(--record-btn) 30%, transparent)',
    },
    warning: {
      color: 'var(--status-warning)',
      background: 'var(--status-warning-bg)',
      border: 'color-mix(in srgb, var(--status-warning) 28%, transparent)',
    },
    success: {
      color: 'var(--status-success)',
      background: 'var(--status-success-bg)',
      border: 'color-mix(in srgb, var(--status-success) 28%, transparent)',
    },
  }
  const selected = palette[tone]

  return (
    <span
      style={{
        border: `1px solid ${selected.border}`,
        borderRadius: 999,
        padding: '2px 7px',
        fontSize: 11,
        lineHeight: 1.4,
        color: selected.color,
        background: selected.background,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export default function SectionAiEngine() {
  const { t } = useTranslation()
  const defaultConfig: EngineConfig = {
    active_provider: 'deepseek',
    providers: [],
  }
  const [cfg, setCfg] = useState<EngineConfig>(defaultConfig)
  const [persistedCfg, setPersistedCfg] = useState<EngineConfig>(defaultConfig)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    getEngineConfig().then((loadedConfig) => {
      setCfg(loadedConfig)
      setPersistedCfg(loadedConfig)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await setEngineConfig(cfg)
      setPersistedCfg(cfg)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((current) => (current === 'saved' ? 'idle' : current)), 2000)
    } catch (error) {
      console.error('[settings/ai-engine] save failed', error)
      setSaveStatus('error')
    }
  }

  const activeProvider = cfg.providers.find((p) => p.id === cfg.active_provider)
  const preset = presetForProvider(activeProvider)

  const setProviderField = (
    field: 'protocol' | 'id' | 'label' | 'api_key' | 'base_url',
    value: string,
  ) => {
    setCfg((prev) => ({
      ...prev,
      providers: prev.providers.map((p) =>
        p.id === prev.active_provider ? { ...p, [field]: value } : p,
      ),
    }))
    setSaveStatus('idle')
  }

  const addProviderModel = (model: string) => {
    setCfg((prev) => ({
      ...prev,
      providers: prev.providers.map((p) =>
        p.id === prev.active_provider && !p.models.includes(model)
          ? { ...p, models: [...p.models, model] }
          : p,
      ),
    }))
  }

  const removeProviderModel = (model: string) => {
    setCfg((prev) => ({
      ...prev,
      providers: prev.providers.map((p) =>
        p.id === prev.active_provider ? { ...p, models: p.models.filter((m) => m !== model) } : p,
      ),
    }))
  }

  const addProvider = (presetId?: string) => {
    const bp = presetId ? presetForId(presetId) : undefined
    const entry: ProviderEntry = {
      protocol: bp?.defaultProtocol ?? 'openai',
      id: newProviderId(),
      label: bp?.label ?? t('customProvider'),
      api_key: '',
      base_url: bp?.defaultBaseUrl ?? '',
      // Seed the credential with the preset's default model when available so
      // adding "DeepSeek" still lands on deepseek-chat out of the box; the user
      // can then append more models under the same credential without
      // re-entering the API key.
      models: bp?.defaultModel ? [bp.defaultModel] : [],
    }
    setCfg((prev) => ({
      ...prev,
      providers: [...prev.providers, entry],
      active_provider: entry.id,
    }))
    setSaveStatus('idle')
  }

  const removeProvider = (id: string) => {
    const target = cfg.providers.find((p) => p.id === id)
    const name = target?.label || t('customProvider')
    if (!window.confirm(t('confirmDeleteProvider', { name }))) return

    setCfg((prev) => {
      const next = prev.providers.filter((p) => p.id !== id)
      const stillActive = next.some((p) => p.id === prev.active_provider)
      return {
        ...prev,
        providers: next,
        active_provider: stillActive ? prev.active_provider : (next[0]?.id ?? ''),
      }
    })
    setSaveStatus('idle')
  }

  const hasUnsavedChanges = !isEngineConfigEqual(cfg, persistedCfg)
  const saveHint =
    saveStatus === 'saving'
      ? t('savingDots')
      : saveStatus === 'saved'
        ? t('saved')
        : saveStatus === 'error'
          ? t('saveFailedMsg')
          : hasUnsavedChanges
            ? t('unsavedChanges')
            : ''
  const canSave = hasUnsavedChanges && saveStatus !== 'saving'

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={eyebrowStyle}>{t('aiEngineSection')}</div>
        <div style={subtitleStyle}>{t('aiEngineSubtitle')}</div>
      </div>

      {loading ? (
        <div className="settings-ai-grid">
          <div style={{ ...panelStyle, padding: 14 }}>
            <SkeletonRow height={18} width={120} mb={14} />
            <SkeletonRow height={70} mb={8} />
            <SkeletonRow height={70} mb={8} />
            <SkeletonRow height={32} width={140} mb={0} />
          </div>
          <div style={{ ...panelStyle, padding: 20 }}>
            <SkeletonRow height={18} width={180} mb={16} />
            <SkeletonRow height={32} mb={12} />
            <SkeletonRow height={32} mb={12} />
            <SkeletonRow height={32} mb={12} />
            <SkeletonRow height={1} width="100%" mb={14} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SkeletonRow height={32} width={70} mb={0} />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="settings-ai-grid"
          style={{ animation: 'section-fadein 160ms ease-out both' }}
        >
          <aside style={{ ...panelStyle, padding: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--item-text)' }}>
                {t('providersTitle')}
              </div>
              <ProviderChip>{t('providerCount', { count: cfg.providers.length })}</ProviderChip>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cfg.providers.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed var(--divider)',
                    borderRadius: 8,
                    padding: 14,
                    color: 'var(--item-meta)',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {t('noProvidersDesc')}
                </div>
              ) : (
                cfg.providers.map((p) => {
                  const isActive = p.id === cfg.active_provider
                  const hasApiKey = p.api_key.trim().length > 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        if (!isActive) {
                          setCfg((prev) => ({ ...prev, active_provider: p.id }))
                          setSaveStatus('idle')
                        }
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: isActive
                          ? 'color-mix(in srgb, var(--record-btn) 8%, var(--detail-case-bg))'
                          : 'var(--bg)',
                        border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                        borderRadius: 8,
                        padding: 12,
                        cursor: 'pointer',
                        transition: 'border-color 140ms ease-out, background 140ms ease-out',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 14,
                            fontWeight: 600,
                            color: isActive ? 'var(--record-btn)' : 'var(--item-text)',
                          }}
                        >
                          {p.label}
                        </span>
                        {isActive && (
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--record-btn)',
                              color: 'var(--record-btn-icon)',
                              flexShrink: 0,
                            }}
                          >
                            <Check size={11} strokeWidth={2.4} />
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          marginTop: 9,
                        }}
                      >
                        <ProviderChip tone={hasApiKey ? 'success' : 'warning'}>
                          {hasApiKey ? t('configured') : t('notConfigured')}
                        </ProviderChip>
                        <ProviderChip>{protocolLabel(p.protocol)}</ProviderChip>
                        {p.models.length > 0 ? (
                          <span
                            title={p.models.join(', ')}
                            style={{
                              minWidth: 0,
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: 11,
                              color: 'var(--duration-text)',
                              fontFamily: 'ui-monospace, monospace',
                            }}
                          >
                            {p.models.length === 1 ? p.models[0] : `${p.models.length} models`}
                          </span>
                        ) : (
                          <ProviderChip tone="warning">{t('modelMissing')}</ProviderChip>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <AddProviderMenu onAdd={addProvider} />
            </div>
          </aside>

          <div style={{ ...panelStyle, padding: 20 }}>
            {activeProvider ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--item-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activeProvider.label || t('customProvider')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--duration-text)', marginTop: 4 }}>
                      {t('activeProviderHint')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <ProviderChip tone="active">{t('activeProviderLabel')}</ProviderChip>
                    <button
                      type="button"
                      onClick={() => removeProvider(activeProvider.id)}
                      style={{
                        ...mutedButtonStyle,
                        color: 'var(--item-meta)',
                        padding: '6px 9px',
                      }}
                    >
                      <Trash2 size={14} strokeWidth={1.6} />
                      {t('deleteProvider')}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                  <ProviderChip tone={activeProvider.api_key.trim() ? 'success' : 'warning'}>
                    {activeProvider.api_key.trim() ? t('apiKeyConfigured') : t('apiKeyMissing')}
                  </ProviderChip>
                  <ProviderChip>{protocolLabel(activeProvider.protocol)}</ProviderChip>
                  {activeProvider.models.length > 0 ? (
                    activeProvider.models.slice(0, 3).map((m) => (
                      <ProviderChip key={m}>{m}</ProviderChip>
                    ))
                  ) : (
                    <ProviderChip tone="warning">{t('modelMissing')}</ProviderChip>
                  )}
                  {activeProvider.models.length > 3 && (
                    <ProviderChip>+{activeProvider.models.length - 3}</ProviderChip>
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--divider)', marginBottom: 18 }} />

                <div className="settings-form-grid">
                  <div>
                    <label style={labelStyle}>{t('providerLabel')}</label>
                    <input
                      style={inputStyle}
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={activeProvider.label}
                      onChange={(e) => setProviderField('label', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>{t('protocolLabel')}</label>
                    <select
                      style={{ ...inputStyle, appearance: 'auto' }}
                      value={activeProvider.protocol || 'openai'}
                      onChange={(e) => setProviderField('protocol', e.target.value)}
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI Compatible</option>
                    </select>
                    <div style={hintStyle}>{t('protocolHint')}</div>
                  </div>

                  <div className="settings-form-grid-full">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        marginBottom: 5,
                      }}
                    >
                      <label style={{ ...labelStyle, marginBottom: 0 }}>API Key</label>
                      {preset?.apiKeyUrl && (
                        <button
                          type="button"
                          onClick={() => hostOpenWithSystem(preset.apiKeyUrl)}
                          style={{ ...mutedButtonStyle, padding: '4px 8px', fontSize: 12 }}
                        >
                          {t('getApiKey')}
                          <ExternalLink size={12} strokeWidth={1.6} />
                        </button>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showKey ? 'text' : 'password'}
                        style={{ ...inputStyle, paddingRight: 36 }}
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder={preset?.apiKeyPlaceholder || 'API Key'}
                        value={activeProvider.api_key}
                        onChange={(e) => setProviderField('api_key', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          padding: 2,
                          cursor: 'pointer',
                          color: 'var(--item-meta)',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <div style={hintStyle}>{t('apiKeyHelp')}</div>
                  </div>

                  <div>
                    <label style={labelStyle}>{t('baseUrlLabel')}</label>
                    <input
                      style={inputStyle}
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder={preset?.defaultBaseUrl || t('leaveBlankDefault')}
                      value={activeProvider.base_url}
                      onChange={(e) => setProviderField('base_url', e.target.value)}
                    />
                    <div style={hintStyle}>{t('customEndpoint')}</div>
                  </div>

                  <div>
                    <ModelListManager
                      providerId={activeProvider.id}
                      apiKey={activeProvider.api_key}
                      baseUrl={activeProvider.base_url}
                      protocol={activeProvider.protocol || 'openai'}
                      models={activeProvider.models}
                      onAdd={addProviderModel}
                      onRemove={removeProviderModel}
                      onSaveStatusReset={() => setSaveStatus('idle')}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderTop: '1px solid var(--divider)',
                    marginTop: 20,
                    paddingTop: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color:
                        saveStatus === 'error'
                          ? 'var(--status-warning)'
                          : saveStatus === 'saved'
                            ? 'var(--status-success)'
                            : 'var(--duration-text)',
                      minHeight: 16,
                    }}
                  >
                    {saveHint}
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={!canSave}
                    style={{
                      background: canSave ? 'var(--record-btn)' : 'var(--divider)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 18px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: canSave ? 'var(--record-btn-icon)' : 'var(--duration-text)',
                      cursor: canSave ? 'pointer' : 'not-allowed',
                      flexShrink: 0,
                    }}
                  >
                    {saveStatus === 'saving' ? t('savingDots') : t('saveBtn')}
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: 'var(--item-meta)',
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--item-text)' }}>
                  {t('noProvidersTitle')}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6, maxWidth: 360 }}>
                  {t('noProvidersDesc')}
                </div>
                <div style={{ marginTop: 16 }}>
                  <AddProviderMenu onAdd={addProvider} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AddProviderMenu({ onAdd }: { onAdd: (presetId?: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--divider)',
          borderRadius: 6,
          padding: '7px 12px',
          fontSize: 13,
          color: 'var(--item-meta)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Plus size={13} /> {t('addProvider')}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            minWidth: 220,
            background: 'var(--detail-case-bg)',
            border: '1px solid var(--divider)',
            borderRadius: 8,
            zIndex: 20,
            padding: 4,
          }}
        >
          {BUILTIN_PRESETS.map((bp) => (
            <button
              key={bp.id}
              type="button"
              onClick={() => {
                onAdd(bp.id)
                setOpen(false)
              }}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                color: 'var(--item-text)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--divider)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {bp.label}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
          <button
            type="button"
            onClick={() => {
              onAdd()
              setOpen(false)
            }}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 13,
              color: 'var(--item-meta)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--divider)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {t('customProvider')}
          </button>
        </div>
      )}
    </div>
  )
}
