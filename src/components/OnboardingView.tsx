import { useState, useCallback, useRef, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from '../contexts/I18nContext'
import {
  getEngineConfig,
  setEngineConfig,
  setWorkspacePath,
  pickFolder,
  listModels,
  BUILTIN_PRESETS,
  type EngineConfig,
} from '../lib/tauri'
import type { OnboardingStep } from '../hooks/useOnboarding'
import '../styles/onboarding.css'

interface Props {
  defaultWorkspacePath: string
  onComplete: () => void
}

type TestStatus =
  | 'idle'
  | 'testing'
  | 'success'
  | 'error_auth'
  | 'error_network'
  | 'error_quota'
  | 'error_not_found'

// Provider URL mappings for protocol switching
const providerUrlMap: Record<string, Record<string, string>> = {
  deepseek: {
    anthropic: 'https://api.deepseek.com/anthropic',
    openai: 'https://api.deepseek.com/v1',
  },
}

export default function OnboardingView({ defaultWorkspacePath, onComplete }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState<OnboardingStep>(0)
  const [dismissing, setDismissing] = useState(false)
  const [wsPath, setWsPath] = useState(defaultWorkspacePath)
  const [wsError, setWsError] = useState('')

  // AI Engine state
  const [engineCfg, setEngineCfg] = useState<EngineConfig | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState('deepseek')
  const [protocol, setProtocol] = useState('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testLatency, setTestLatency] = useState<number | null>(null)
  const [testErrorDetail, setTestErrorDetail] = useState('')

  // Model dropdown
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const modelWrapperRef = useRef<HTMLDivElement>(null)

  // Close model dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelWrapperRef.current && !modelWrapperRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch models with debounce when apiKey/provider changes
  const fetchModels = useCallback(() => {
    if (!apiKey?.trim()) {
      setModelOptions([])
      return
    }
    setFetchingModels(true)
    listModels(selectedPresetId, apiKey, baseUrl)
      .then((list) => {
        setModelOptions(list)
        setFetchingModels(false)
      })
      .catch(() => {
        setModelOptions([])
        setFetchingModels(false)
      })
  }, [selectedPresetId, apiKey, baseUrl])

  useEffect(() => {
    if (!apiKey?.trim()) {
      setModelOptions([])
      return
    }
    const timer = setTimeout(fetchModels, 500)
    return () => clearTimeout(timer)
  }, [fetchModels, apiKey])

  // Load existing engine config
  useEffect(() => {
    getEngineConfig()
      .then((cfg) => {
        setEngineCfg(cfg)
        let active = cfg.providers.find((p) => p.id === cfg.active_provider)
        const dsPreset = BUILTIN_PRESETS.find((p) => p.id === 'deepseek')
        if (!active && dsPreset) {
          active = cfg.providers.find((p) => p.base_url === dsPreset.defaultBaseUrl)
          if (active) cfg.active_provider = active.id
        }
        if (active) {
          if (active.protocol) setProtocol(active.protocol)
          if (active.api_key) setApiKey(active.api_key)
          if (active.base_url) setBaseUrl(active.base_url)
          if (active.model) setModel(active.model)
          const preset = BUILTIN_PRESETS.find(
            (bp) =>
              bp.id === active!.id ||
              bp.defaultBaseUrl === active!.base_url ||
              bp.label === active!.label,
          )
          if (preset) setSelectedPresetId(preset.id)
        } else {
          if (dsPreset) {
            setBaseUrl(dsPreset.defaultBaseUrl)
            setModel(dsPreset.defaultModel)
          }
        }
      })
      .catch(() => {
        const ds = BUILTIN_PRESETS.find((p) => p.id === 'deepseek')
        if (ds) {
          setBaseUrl(ds.defaultBaseUrl)
          setModel(ds.defaultModel)
        }
      })
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissing(true)
    setTimeout(() => onComplete(), 250)
  }, [onComplete])

  // Step 0
  const handleConfirmWorkspace = useCallback(async () => {
    try {
      await setWorkspacePath(wsPath)
      setStep(1)
    } catch {
      setWsError(t('onboarding.welcome.errorPermission'))
    }
  }, [wsPath, t])

  const handleBrowseWorkspace = useCallback(async () => {
    try {
      const folder = await pickFolder()
      if (folder) {
        setWsPath(folder)
        setWsError('')
      }
    } catch {
      /* cancelled */
    }
  }, [])

  const handleProtocolChange = useCallback(
    (newProtocol: string) => {
      setProtocol(newProtocol)
      resetTest()
      const mapping = providerUrlMap[selectedPresetId]
      if (mapping?.[newProtocol]) setBaseUrl(mapping[newProtocol])
    },
    [selectedPresetId],
  )

  const handleSelectPreset = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId)
      resetTest()
      const preset = BUILTIN_PRESETS.find((p) => p.id === presetId)
      if (preset) {
        const mapping = providerUrlMap[presetId]
        if (mapping?.[protocol]) {
          setBaseUrl(mapping[protocol])
        } else {
          setBaseUrl(preset.defaultBaseUrl)
          setProtocol(preset.defaultProtocol)
        }
        setModel(preset.defaultModel)
      }
      setModelOptions([])
      setModelDropdownOpen(false)
    },
    [protocol],
  )

  // Build engine config
  const buildEngineConfig = useCallback((): EngineConfig => {
    const cfg: EngineConfig = engineCfg
      ? { ...engineCfg, providers: engineCfg.providers.map((p) => ({ ...p })) }
      : { active_provider: '', providers: [] }
    const preset = BUILTIN_PRESETS.find((p) => p.id === selectedPresetId)

    const existing = cfg.providers.find((p) => {
      if (preset)
        return (
          p.id === preset.id ||
          p.base_url === preset.defaultBaseUrl ||
          (p.label === preset.label && p.protocol === preset.defaultProtocol)
        )
      return p.id === selectedPresetId
    })

    if (existing) {
      existing.protocol = protocol
      existing.api_key = apiKey
      existing.base_url = baseUrl
      existing.model = model
      cfg.active_provider = existing.id
    } else if (preset) {
      const duplicate = cfg.providers.find((p) => p.base_url === preset.defaultBaseUrl)
      if (duplicate) {
        duplicate.protocol = protocol
        duplicate.api_key = apiKey
        duplicate.base_url = baseUrl
        duplicate.model = model
        cfg.active_provider = duplicate.id
      } else {
        cfg.providers.push({
          id: preset.id,
          protocol,
          label: preset.label,
          api_key: apiKey,
          base_url: baseUrl,
          model,
        })
        cfg.active_provider = preset.id
      }
    }
    return cfg
  }, [engineCfg, selectedPresetId, protocol, apiKey, baseUrl, model])

  // Test connection
  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing')
    setTestLatency(null)
    setTestErrorDetail('')
    const cfg = buildEngineConfig()
    const active = cfg.providers.find((p) => p.id === cfg.active_provider)
    if (!active?.api_key?.trim()) {
      setTestStatus('error_auth')
      return
    }
    try {
      await setEngineConfig(cfg)
      const start = performance.now()
      await listModels(selectedPresetId, apiKey, baseUrl)
      setTestLatency(Math.round(performance.now() - start))
      setTestStatus('success')
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : String(err)
      console.error('[onboarding] test connection error:', msg)
      setTestErrorDetail(msg)
      if (
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('invalid') ||
        msg.includes('Unauthorized')
      )
        setTestStatus('error_auth')
      else if (msg.includes('404') || msg.includes('not found') || msg.includes('Not Found'))
        setTestStatus('error_not_found')
      else if (msg.includes('429') || msg.includes('quota') || msg.includes('insufficient'))
        setTestStatus('error_quota')
      else setTestStatus('error_network')
    }
  }, [buildEngineConfig, selectedPresetId, apiKey, baseUrl])

  // Confirm AI → save and dismiss
  const handleConfirmAi = useCallback(async () => {
    try {
      await setEngineConfig(buildEngineConfig())
    } catch {
      /* continue */
    }
    handleDismiss()
  }, [buildEngineConfig, handleDismiss])

  // Skip AI → dismiss
  const handleSkipAi = useCallback(() => {
    handleDismiss()
  }, [handleDismiss])

  const resetTest = () => {
    setTestStatus('idle')
    setTestLatency(null)
    setTestErrorDetail('')
  }

  const testResultText = () => {
    switch (testStatus) {
      case 'testing':
        return t('onboarding.ai.testing')
      case 'success':
        return t('onboarding.ai.testSuccess').replace('{latency}', String(testLatency ?? 0))
      case 'error_auth':
        return t('onboarding.ai.testAuthFailed')
      case 'error_network':
        return (
          t('onboarding.ai.testNetworkError') + (testErrorDetail ? ` — ${testErrorDetail}` : '')
        )
      case 'error_quota':
        return t('onboarding.ai.testQuotaExceeded')
      case 'error_not_found':
        return t('onboarding.ai.testModelNotFound')
      default:
        return ''
    }
  }

  const filteredModels = model
    ? modelOptions.filter((m) => m.toLowerCase().includes(model.toLowerCase()))
    : modelOptions
  const showModelDropdown = modelDropdownOpen && (fetchingModels || filteredModels.length > 0)

  const steps = [t('onboarding.stepIndicator.workspace'), t('onboarding.stepIndicator.ai')]

  return (
    <div className={`onboarding-overlay${dismissing ? ' onboarding-overlay--dismissing' : ''}`}>
      <div className="onboarding-container">
        {/* Step indicator — 2 steps */}
        <div className="ob-step-indicator ob-step-indicator--2">
          {steps.map((label, i) => {
            let cls = 'ob-step'
            if (i < step) cls += ' ob-step--done'
            else if (i === step) cls += ' ob-step--active'
            return (
              <div
                key={i}
                className={cls}
                onClick={() => {
                  if (i < step) {
                    setStep(i as OnboardingStep)
                    resetTest()
                  }
                }}
                role="button"
                tabIndex={i < step ? 0 : -1}
                aria-current={i === step ? 'step' : undefined}
              >
                <div className="ob-step__dot">{i < step ? '✓' : i + 1}</div>
                <span className="ob-step__label">{label}</span>
              </div>
            )
          })}
        </div>

        {/* Step 0: Workspace */}
        {step === 0 && (
          <div className="ob-content">
            <h1 className="ob-title">{t('onboarding.welcome.title')}</h1>
            <p className="ob-subtitle">{t('onboarding.welcome.subtitle')}</p>
            <div className="ob-workspace-card">
              <label className="ob-input-label">{t('onboarding.welcome.workspaceLabel')}</label>
              <div className="ob-workspace-path">{wsPath}</div>
              <div
                style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}
              >
                <button className="ob-btn ob-btn--secondary" onClick={handleBrowseWorkspace}>
                  {t('onboarding.welcome.customPath')}
                </button>
                <button className="ob-btn ob-btn--primary" onClick={handleConfirmWorkspace}>
                  {t('onboarding.welcome.confirm')}
                </button>
              </div>
              {wsError && <div className="ob-error">{wsError}</div>}
            </div>
            <div className="ob-footer">
              <button className="ob-btn ob-btn--ghost" onClick={handleDismiss}>
                {t('onboarding.welcome.skip')}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: AI Engine */}
        {step === 1 && (
          <div className="ob-content">
            <h2 className="ob-section-title">{t('onboarding.ai.title')}</h2>
            <p className="ob-subtitle">{t('onboarding.ai.subtitle')}</p>

            <div className="ob-card-grid ob-card-grid--2">
              {BUILTIN_PRESETS.map((bp) => (
                <div
                  key={bp.id}
                  className={`ob-card${selectedPresetId === bp.id ? ' ob-card--selected' : ''}`}
                  onClick={() => handleSelectPreset(bp.id)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedPresetId === bp.id}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSelectPreset(bp.id)
                  }}
                >
                  <div className="ob-card__icon">🤖</div>
                  <div className="ob-card__body">
                    <div className="ob-card__title">{bp.label}</div>
                    <div className="ob-card__desc">{bp.defaultModel}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="ob-input-group">
              <label className="ob-input-label">{t('onboarding.ai.apiKeyLabel')}</label>
              <div className="ob-input-wrap">
                <input
                  className="ob-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-…"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    resetTest()
                  }}
                />
                <button
                  className="ob-input-toggle"
                  onClick={() => setShowKey((v) => !v)}
                  type="button"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="ob-input-group">
              <label className="ob-input-label">Protocol</label>
              <select
                className="ob-input"
                style={{ appearance: 'auto' }}
                value={protocol}
                onChange={(e) => handleProtocolChange(e.target.value)}
              >
                <option value="anthropic">Anthropic Messages</option>
                <option value="openai">OpenAI Compatible</option>
              </select>
            </div>

            <div className="ob-input-group">
              <label className="ob-input-label">Base URL</label>
              <input
                className="ob-input"
                type="text"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value)
                  resetTest()
                }}
              />
            </div>

            <div className="ob-input-group">
              <label className="ob-input-label">Model</label>
              <div ref={modelWrapperRef} style={{ position: 'relative' }}>
                <input
                  className="ob-input"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={model}
                  placeholder="e.g. deepseek-chat"
                  onChange={(e) => {
                    setModel(e.target.value)
                    resetTest()
                    setModelDropdownOpen(true)
                  }}
                  onFocus={() => {
                    if (modelOptions.length > 0 || apiKey?.trim()) setModelDropdownOpen(true)
                  }}
                />
                {showModelDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 2,
                      maxHeight: 180,
                      overflowY: 'auto',
                      background: 'var(--detail-case-bg)',
                      border: '1px solid var(--divider)',
                      borderRadius: 8,
                      zIndex: 10,
                    }}
                  >
                    {fetchingModels ? (
                      <div
                        style={{
                          padding: '8px 12px',
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
                        Loading models…
                      </div>
                    ) : (
                      filteredModels.map((m) => (
                        <div
                          key={m}
                          onClick={() => {
                            setModel(m)
                            setModelDropdownOpen(false)
                            resetTest()
                          }}
                          style={{
                            padding: '7px 12px',
                            fontSize: 13,
                            fontFamily: 'ui-monospace, monospace',
                            color: m === model ? 'var(--record-btn)' : 'var(--item-text)',
                            cursor: 'pointer',
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
            </div>

            {testStatus !== 'idle' && (
              <div
                className={`ob-test-result ob-test-result--${testStatus === 'success' ? 'success' : testStatus === 'error_network' || testStatus === 'testing' ? 'warn' : 'error'}`}
              >
                {testResultText()}
              </div>
            )}

            <div className="ob-btn-row">
              <button
                className="ob-btn ob-btn--secondary"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing'
                  ? t('onboarding.ai.testing')
                  : t('onboarding.ai.testConnection')}
              </button>
              <button className="ob-btn ob-btn--primary" onClick={handleConfirmAi}>
                {t('onboarding.ai.confirm')}
              </button>
            </div>

            <div className="ob-footer">
              <button className="ob-btn ob-btn--ghost" onClick={handleSkipAi}>
                {t('onboarding.ai.skip')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
