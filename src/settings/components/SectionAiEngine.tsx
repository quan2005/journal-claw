import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getEngineConfig,
  setEngineConfig,
  listModels,
  BUILTIN_PRESETS,
  newProviderId,
  type EngineConfig,
  type ProviderEntry,
} from '../../lib/tauri'
import { openFile } from '../../lib/tauri'
import { Check, ExternalLink, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import SkeletonRow from './SkeletonRow'
import { useTranslation } from '../../contexts/I18nContext'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const sectionStyle: React.CSSProperties = {
  padding: '28px 28px 180px',
  borderBottom: '1px solid var(--divider)',
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
  background: 'var(--detail-case-bg)',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 14,
  color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace',
  outline: 'none',
  boxSizing: 'border-box',
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
      pa.base_url !== pb.base_url ||
      pa.model !== pb.model
    )
      return false
  }
  return true
}

function ModelSelect({
  providerId,
  apiKey,
  baseUrl,
  value,
  onChange,
  onSaveStatusReset,
}: {
  providerId: string
  apiKey: string
  baseUrl: string
  value: string
  onChange: (model: string) => void
  onSaveStatusReset: () => void
}) {
  const { t } = useTranslation()
  const [models, setModels] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const fetchModels = useCallback(() => {
    if (!apiKey?.trim()) {
      setModels([])
      return
    }
    setFetching(true)
    listModels(providerId, apiKey, baseUrl)
      .then((list) => {
        setModels(list)
        setFetching(false)
      })
      .catch(() => {
        setModels([])
        setFetching(false)
      })
  }, [providerId, apiKey, baseUrl])

  useEffect(() => {
    if (!apiKey?.trim()) {
      setModels([])
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

  const filtered = value
    ? models.filter((m) => m.toLowerCase().includes(value.toLowerCase()))
    : models
  const showDropdown = open && (fetching || filtered.length > 0)

  return (
    <div>
      <label style={labelStyle}>Model</label>
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <input
          style={inputStyle}
          placeholder={t('modelInputPlaceholder')}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            onSaveStatusReset()
            setOpen(true)
          }}
          onFocus={() => {
            if (models.length > 0 || apiKey?.trim()) setOpen(true)
          }}
        />
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 2,
              maxHeight: 200,
              overflowY: 'auto',
              background: 'var(--detail-case-bg)',
              border: '1px solid var(--divider)',
              borderRadius: 6,
              zIndex: 10,
            }}
          >
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
              filtered.map((m) => (
                <div
                  key={m}
                  onClick={() => {
                    onChange(m)
                    onSaveStatusReset()
                    setOpen(false)
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: 13,
                    color: m === value ? 'var(--record-btn)' : 'var(--item-text)',
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
  const preset = activeProvider ? presetForId(activeProvider.id) : undefined

  const setProviderField = (field: keyof ProviderEntry, value: string) => {
    setCfg((prev) => ({
      ...prev,
      providers: prev.providers.map((p) =>
        p.id === prev.active_provider ? { ...p, [field]: value } : p,
      ),
    }))
    setSaveStatus('idle')
  }

  const addProvider = (presetId?: string) => {
    const bp = presetId ? presetForId(presetId) : undefined
    const entry: ProviderEntry = {
      protocol: bp?.defaultProtocol ?? 'openai',
      id: newProviderId(),
      label: bp?.label ?? t('customProvider'),
      api_key: '',
      base_url: bp?.defaultBaseUrl ?? '',
      model: bp?.defaultModel ?? '',
    }
    setCfg((prev) => ({
      ...prev,
      providers: [...prev.providers, entry],
      active_provider: entry.id,
    }))
    setSaveStatus('idle')
  }

  const removeProvider = (id: string) => {
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
      <div
        style={{
          fontSize: 13,
          color: 'var(--month-label)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 16,
          fontWeight: 500,
        }}
      >
        {t('aiEngineSection')}
      </div>
      {loading ? (
        <>
          <SkeletonRow height={40} mb={8} />
          <SkeletonRow height={40} mb={8} />
          <SkeletonRow height={40} mb={8} />
          <SkeletonRow height={1} width="100%" mb={14} />
          <SkeletonRow height={11} width={60} mb={5} />
          <SkeletonRow height={32} mb={4} />
          <SkeletonRow height={10} width={160} mb={14} />
          <SkeletonRow height={11} width={60} mb={5} />
          <SkeletonRow height={32} mb={4} />
          <SkeletonRow height={10} width={140} mb={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonRow height={30} width={60} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          {/* Provider list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {cfg.providers.map((p) => {
              const isActive = p.id === cfg.active_provider
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isActive) {
                      setCfg((prev) => ({ ...prev, active_provider: p.id }))
                      setSaveStatus('idle')
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: isActive ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                    border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'border-color 120ms ease-out',
                  }}
                >
                  {isActive && (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        background: 'var(--status-success)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={8} strokeWidth={2.5} color="var(--status-on-fill)" />
                    </div>
                  )}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isActive ? 'var(--record-btn)' : 'var(--item-text)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.label}
                  </span>
                  {p.model && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--duration-text)',
                        fontFamily: 'ui-monospace, monospace',
                        flexShrink: 0,
                      }}
                    >
                      {p.model}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeProvider(p.id)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 2,
                      cursor: 'pointer',
                      color: 'var(--item-meta)',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.5'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add provider */}
          <AddProviderMenu onAdd={addProvider} />

          {/* Config fields for active provider */}
          {activeProvider && (
            <>
              <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

              <div style={{ marginBottom: 14 }}>
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

              <div style={{ marginBottom: 14 }}>
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

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>API Key</label>
                  {preset?.apiKeyUrl && (
                    <span
                      onClick={() => openFile(preset.apiKeyUrl)}
                      style={{
                        fontSize: 11,
                        color: 'var(--link-color, #4a9eff)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      {t('getApiKey')} <ExternalLink size={10} />
                    </span>
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
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Base URL</label>
                <input
                  style={inputStyle}
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={preset?.defaultBaseUrl || 'https://api.example.com'}
                  value={activeProvider.base_url}
                  onChange={(e) => setProviderField('base_url', e.target.value)}
                />
                <div style={hintStyle}>{t('customEndpoint')}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <ModelSelect
                  providerId={activeProvider.id}
                  apiKey={activeProvider.api_key}
                  baseUrl={activeProvider.base_url}
                  value={activeProvider.model}
                  onChange={(model) => setProviderField('model', model)}
                  onSaveStatusReset={() => setSaveStatus('idle')}
                />
              </div>
            </>
          )}

          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}
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
                borderRadius: 5,
                padding: '6px 18px',
                fontSize: 14,
                fontWeight: 600,
                color: canSave ? 'var(--bg)' : 'var(--duration-text)',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {saveStatus === 'saving' ? t('savingDots') : t('saveBtn')}
            </button>
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
          background: 'none',
          border: '1px dashed var(--divider)',
          borderRadius: 6,
          padding: '6px 14px',
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
            marginTop: 4,
            minWidth: 200,
            background: 'var(--detail-case-bg)',
            border: '1px solid var(--divider)',
            borderRadius: 8,
            zIndex: 20,
            padding: '4px 0',
          }}
        >
          {BUILTIN_PRESETS.map((bp) => (
            <div
              key={bp.id}
              onClick={() => {
                onAdd(bp.id)
                setOpen(false)
              }}
              style={{
                padding: '7px 12px',
                fontSize: 13,
                color: 'var(--item-text)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--divider)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {bp.label}
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
          <div
            onClick={() => {
              onAdd()
              setOpen(false)
            }}
            style={{
              padding: '7px 12px',
              fontSize: 13,
              color: 'var(--item-meta)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--divider)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {t('customProvider')}
          </div>
        </div>
      )}
    </div>
  )
}
