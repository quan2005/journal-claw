import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  AlertTriangle,
  Check,
  Cloud,
  Cpu,
  Download,
  FolderOpen,
  Mic,
  RefreshCw,
} from 'lucide-react'
import {
  getAsrConfig,
  setAsrConfig,
  getWhisperkitModelsDir,
  checkWhisperkitModelDownloaded,
  downloadWhisperkitModel,
  checkWhisperkitCliInstalled,
  installWhisperkitCli,
  getAppleSttVariant,
  checkSpeakerEmbedder,
  type AsrConfig,
} from '../../lib/tauri'
import { invoke } from '@tauri-apps/api/core'
import SkeletonRow from './SkeletonRow'
import { useTranslation } from '../../contexts/I18nContext'
import { createTranslator, detectLang } from '../../lib/i18n'
const getT = () => createTranslator(detectLang())

type AsrEngineId = 'apple' | 'dashscope' | 'whisperkit' | 'siliconflow' | 'zhipu'
type WhisperModel = 'base' | 'small' | 'large-v3-turbo'
type WhisperDownloadPanelStatus = 'starting' | 'downloading' | 'success' | 'error'
type WhisperDownloadEventStatus = 'downloading' | 'done' | 'error'

type WhisperDownloadSession = {
  model: WhisperModel
  status: WhisperDownloadPanelStatus
  latestMessage: string
  history: string[]
}

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

type WhisperModelMeta = {
  id: WhisperModel
  label: string
  size: string
  hintKey: 'baseModelHint' | 'smallModelHint' | 'largeModelHint'
  bundled?: boolean
}

const WHISPER_MODELS: WhisperModelMeta[] = [
  { id: 'base', label: 'Base', size: '~142MB', hintKey: 'baseModelHint' },
  { id: 'small', label: 'Small', size: '~244MB', hintKey: 'smallModelHint' },
  { id: 'large-v3-turbo', label: 'Large v3 Turbo', size: '~809MB', hintKey: 'largeModelHint' },
]

const DOWNLOAD_HISTORY_LIMIT = 6

function getModelMeta(model: WhisperModel) {
  return WHISPER_MODELS.find((item) => item.id === model)
}

function getModelDisplayLabel(model: WhisperModel) {
  return getModelMeta(model)?.label ?? model
}

function appendHistory(history: string[], message: string) {
  if (!message.trim()) {
    return history
  }
  if (history[history.length - 1] === message) {
    return history
  }
  return [...history, message].slice(-DOWNLOAD_HISTORY_LIMIT)
}

function resolvePanelStatus(message?: string): WhisperDownloadPanelStatus {
  if (!message) {
    return 'downloading'
  }
  return /启动|准备|检查|starting|preparing|checking/i.test(message) ? 'starting' : 'downloading'
}

function panelStatusCopy(status: WhisperDownloadPanelStatus) {
  const t = getT()
  if (status === 'starting') {
    return {
      label: t('downloading'),
      color: 'var(--record-btn)',
      background: 'rgba(200,147,58,0.12)',
    }
  }
  if (status === 'downloading') {
    return {
      label: t('downloading'),
      color: 'var(--record-btn)',
      background: 'rgba(200,147,58,0.12)',
    }
  }
  if (status === 'success') {
    return {
      label: t('downloaded'),
      color: 'var(--status-success)',
      background: 'rgba(39,201,63,0.12)',
    }
  }
  return {
    label: t('downloadFailed'),
    color: 'var(--status-warning)',
    background: 'var(--status-warning-bg)',
  }
}

function isAsrConfigEqual(a: AsrConfig, b: AsrConfig) {
  return (
    a.asr_engine === b.asr_engine &&
    a.dashscope_api_key === b.dashscope_api_key &&
    a.whisperkit_model === b.whisperkit_model &&
    a.dashscope_asr_model === b.dashscope_asr_model &&
    a.siliconflow_asr_api_key === b.siliconflow_asr_api_key &&
    a.zhipu_asr_api_key === b.zhipu_asr_api_key
  )
}

export default function SectionVoice() {
  const { t } = useTranslation()
  const defaultConfig: AsrConfig = {
    asr_engine: 'whisperkit',
    dashscope_api_key: '',
    whisperkit_model: 'base',
    dashscope_asr_model: 'qwen3-asr-flash',
    volcengine_asr_api_key: '',
    volcengine_asr_resource_id: 'volc.seedasr.auc',
    siliconflow_asr_api_key: '',
    zhipu_asr_api_key: '',
  }
  const [cfg, setCfg] = useState<AsrConfig>(defaultConfig)
  const [persistedCfg, setPersistedCfg] = useState<AsrConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [modelsDir, setModelsDir] = useState('')
  const [downloadedModels, setDownloadedModels] = useState<Set<WhisperModel>>(new Set())
  const [downloadSession, setDownloadSession] = useState<WhisperDownloadSession | null>(null)
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null)
  const [cliInstalling, setCliInstalling] = useState(false)
  const [cliInstallLog, setCliInstallLog] = useState<string[]>([])
  const [appleSttVariant, setAppleSttVariant] = useState<string>('')
  const [embedderAvailable, setEmbedderAvailable] = useState<boolean | null>(null)

  const refreshDownloadedModels = () => {
    const models: WhisperModel[] = ['base', 'small', 'large-v3-turbo']
    Promise.all(
      models.map((m) => checkWhisperkitModelDownloaded(m).then((ok) => (ok ? m : null))),
    ).then((results) => {
      setDownloadedModels(new Set(results.filter(Boolean) as WhisperModel[]))
    })
  }

  useEffect(() => {
    Promise.all([
      getAsrConfig().then((loadedConfig) => {
        setCfg(loadedConfig)
        setPersistedCfg(loadedConfig)
      }),
      getWhisperkitModelsDir().then(setModelsDir),
      checkWhisperkitCliInstalled().then(setCliInstalled),
      getAppleSttVariant().then(setAppleSttVariant),
      checkSpeakerEmbedder()
        .then((r) => setEmbedderAvailable(r.available))
        .catch(() => setEmbedderAvailable(false)),
    ]).then(() => {
      setLoading(false)
      refreshDownloadedModels()
    })

    // listen for download progress events from Rust
    let unlisten: (() => void) | null = null
    listen<{ model: WhisperModel; status: WhisperDownloadEventStatus; message?: string }>(
      'whisperkit-download-progress',
      ({ payload }) => {
        if (payload.status === 'downloading') {
          const latestMessage =
            payload.message?.trim() ||
            t('downloadingModel', { model: getModelDisplayLabel(payload.model) })
          setDownloadSession((prev) => {
            const history = appendHistory(
              prev?.model === payload.model ? prev.history : [],
              latestMessage,
            )
            return {
              model: payload.model,
              status: resolvePanelStatus(latestMessage),
              latestMessage,
              history,
            }
          })
        } else if (payload.status === 'done') {
          refreshDownloadedModels()
          setDownloadSession((prev) => {
            const successMessage = t('downloadSuccess', {
              model: getModelDisplayLabel(payload.model),
            })
            const history = appendHistory(
              prev?.model === payload.model ? prev.history : [],
              successMessage,
            )
            return {
              model: payload.model,
              status: 'success',
              latestMessage: successMessage,
              history,
            }
          })
        } else if (payload.status === 'error') {
          const errorMessage = payload.message?.trim() || t('downloadErrorFallback')
          setDownloadSession((prev) => {
            const history = appendHistory(
              prev?.model === payload.model ? prev.history : [],
              errorMessage,
            )
            return {
              model: payload.model,
              status: 'error',
              latestMessage: errorMessage,
              history,
            }
          })
        }
      },
    ).then((fn) => {
      unlisten = fn
    })

    // listen for whisperkit-cli install events
    let unlistenCliInstall: (() => void) | null = null
    listen<{ engine: string; line: string; done: boolean; success: boolean }>(
      'engine-install-log',
      ({ payload }) => {
        if (payload.engine !== 'whisperkit-cli') return
        if (payload.done) {
          setCliInstalling(false)
          if (payload.success) {
            setCliInstalled(true)
            setCliInstallLog((prev) => [...prev, payload.line])
          } else {
            setCliInstallLog((prev) => [...prev, payload.line])
          }
        } else {
          if (payload.line.trim()) {
            setCliInstallLog((prev) => [...prev.slice(-20), payload.line.trim()])
          }
        }
      },
    ).then((fn) => {
      unlistenCliInstall = fn
    })

    return () => {
      unlisten?.()
      unlistenCliInstall?.()
    }
  }, [])

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await setAsrConfig(cfg)
      setPersistedCfg(cfg)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((current) => (current === 'saved' ? 'idle' : current)), 2000)
    } catch (error) {
      console.error('[settings/voice] save failed', error)
      setSaveStatus('error')
    }
  }

  const handleOpenModelsDir = () => {
    invoke('open_with_system', { path: modelsDir })
  }

  const handleInstallCli = async () => {
    if (cliInstalling) return
    setCliInstalling(true)
    setCliInstallLog([])
    try {
      await installWhisperkitCli()
      // Command returned immediately (fire-and-forget).
      // cliInstalling stays true until engine-install-log done event arrives.
    } catch (e) {
      console.error('[install-whisperkit-cli]', e)
      setCliInstallLog((prev) => [...prev, t('installError', { err: String(e) })])
      setCliInstalling(false)
    }
  }

  const handleDownload = (model: WhisperModel) => {
    if (WHISPER_MODELS.find((item) => item.id === model)?.bundled) {
      return
    }
    if (downloadSession && ['starting', 'downloading'].includes(downloadSession.status)) {
      return
    }

    const startMessage = t('downloadingModel', { model: getModelDisplayLabel(model) })
    setDownloadSession({
      model,
      status: 'downloading',
      latestMessage: startMessage,
      history: [startMessage],
    })

    downloadWhisperkitModel(model).catch((error: unknown) => {
      const fallback = t('downloadErrorFallback')
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : fallback

      setDownloadSession((prev) => {
        const history = appendHistory(prev?.model === model ? prev.history : [], message)
        return {
          model,
          status: 'error',
          latestMessage: message,
          history,
        }
      })
    })
  }

  const dashscopeReady = cfg.dashscope_api_key.trim().length > 0
  const siliconflowReady = cfg.siliconflow_asr_api_key.trim().length > 0
  const zhipuReady = cfg.zhipu_asr_api_key.trim().length > 0
  const whisperkitReady =
    cliInstalled === true && downloadedModels.has(cfg.whisperkit_model as WhisperModel)
  const selectedWhisperModel = WHISPER_MODELS.find((model) => model.id === cfg.whisperkit_model)
  const isBundledModel = Boolean(selectedWhisperModel?.bundled)
  const activeDownloadModel =
    downloadSession && ['starting', 'downloading'].includes(downloadSession.status)
      ? downloadSession.model
      : null
  const hasActiveDownload = activeDownloadModel !== null
  const isCurrentModelDownloading = activeDownloadModel === cfg.whisperkit_model
  const panelCopy = downloadSession ? panelStatusCopy(downloadSession.status) : null
  const hasUnsavedChanges = !isAsrConfigEqual(cfg, persistedCfg)
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

  const appleReady = true // Apple STT is always ready on macOS ≥ 13
  const appleVendor =
    appleSttVariant === 'speech_analyzer' ? t('appleVendorSpeechAnalyzer') : t('appleVendorDefault')

  const ENGINES: {
    id: AsrEngineId
    label: string
    vendor: string
    icon: typeof Cloud
    ready: boolean
  }[] = [
    {
      id: 'apple',
      label: t('appleEngineLabel'),
      vendor: appleVendor,
      icon: Mic,
      ready: appleReady,
    },
    {
      id: 'whisperkit',
      label: 'WhisperKit',
      vendor: t('whisperkitVendor'),
      icon: Cpu,
      ready: whisperkitReady,
    },
    {
      id: 'dashscope',
      label: 'DashScope',
      vendor: t('dashscopeVendor'),
      icon: Cloud,
      ready: dashscopeReady,
    },
    {
      id: 'siliconflow',
      label: t('siliconflowEngineLabel'),
      vendor: t('siliconflowVendor'),
      icon: Cloud,
      ready: siliconflowReady,
    },
    {
      id: 'zhipu',
      label: t('zhipuEngineLabel'),
      vendor: t('zhipuVendor'),
      icon: Cloud,
      ready: zhipuReady,
    },
  ]

  return (
    <>
      <div style={sectionStyle}>
        <div
          style={{
            fontSize: 13,
            color: 'var(--month-label)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          {t('voiceSection')}
        </div>

        {loading ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <SkeletonRow height={90} mb={0} />
              <SkeletonRow height={90} mb={0} />
              <SkeletonRow height={90} mb={0} />
            </div>
            <SkeletonRow height={32} mb={14} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SkeletonRow height={30} width={60} mb={0} />
            </div>
          </>
        ) : (
          <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
            {/* 引擎选择卡片 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
                marginBottom: 18,
              }}
            >
              {ENGINES.map(({ id, label, vendor, icon: Icon, ready }) => {
                const isActive = cfg.asr_engine === id
                return (
                  <div
                    key={id}
                    onClick={() => {
                      setCfg((prev) => ({ ...prev, asr_engine: id }))
                      setSaveStatus('idle')
                    }}
                    style={{
                      background: isActive ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                      border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                      borderRadius: 10,
                      padding: '14px 12px 12px',
                      textAlign: 'center' as const,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {ready && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 16,
                          height: 16,
                          background: 'var(--status-success)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={9} strokeWidth={2.5} color="var(--status-on-fill)" />
                      </div>
                    )}
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
                      <Icon size={22} strokeWidth={1.5} />
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: isActive ? 'var(--record-btn)' : 'var(--item-meta)',
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--duration-text)', marginTop: 2 }}>
                      {vendor}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ height: 1, background: 'var(--divider)', margin: '0 0 14px' }} />

            {/* 声纹模型状态 */}
            {embedderAvailable === false && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255,159,10,0.08)',
                  border: '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)',
                  fontSize: 11,
                  color: 'var(--item-meta)',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={13} strokeWidth={1.8} color="var(--status-warning)" />
                  <span style={{ fontWeight: 600, color: 'var(--status-warning)' }}>
                    {t('speakerEmbedderUnavailable')}
                  </span>
                </div>
                <div style={{ color: 'var(--duration-text)', fontSize: 10 }}>
                  {t('speakerEmbedderHint')}
                </div>
              </div>
            )}

            {/* WhisperKit 配置 */}
            {cfg.asr_engine === 'whisperkit' && (
              <div style={{ marginBottom: 16 }}>
                {cliInstalled === false && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(255,159,10,0.08)',
                      border:
                        '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)',
                      fontSize: 11,
                      color: 'var(--item-meta)',
                      lineHeight: 1.6,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--status-warning)' }}>
                        {t('whisperNotFound')}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => checkWhisperkitCliInstalled().then(setCliInstalled)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 600,
                            border: '1px solid var(--divider)',
                            background: 'transparent',
                            color: 'var(--item-meta)',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <RefreshCw size={10} strokeWidth={1.8} />
                          {t('reDetect')}
                        </button>
                        <button
                          onClick={handleInstallCli}
                          disabled={cliInstalling}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 5,
                            fontSize: 11,
                            fontWeight: 600,
                            border: '1px solid rgba(255,159,10,0.4)',
                            background: cliInstalling
                              ? 'rgba(255,159,10,0.06)'
                              : 'rgba(255,159,10,0.14)',
                            color: cliInstalling
                              ? 'color-mix(in srgb, var(--status-warning) 50%, transparent)'
                              : 'var(--status-warning)',
                            cursor: cliInstalling ? 'default' : 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {cliInstalling ? (
                            <>
                              <div
                                style={{
                                  width: 10,
                                  height: 10,
                                  border:
                                    '1.5px solid color-mix(in srgb, var(--status-warning) 30%, transparent)',
                                  borderTopColor: 'var(--status-warning)',
                                  borderRadius: '50%',
                                  animation: 'spin 0.8s linear infinite',
                                }}
                              />
                              {t('installingDots')}
                            </>
                          ) : (
                            <>
                              <Download size={11} strokeWidth={1.8} />
                              {t('installBtn')}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    {!cliInstalling && cliInstallLog.length === 0 && (
                      <div style={{ color: 'var(--duration-text)', fontSize: 10 }}>
                        {t('requiresHomebrew')}
                        <code
                          style={{
                            display: 'block',
                            marginTop: 5,
                            padding: '4px 8px',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: 4,
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: 10,
                            color: 'var(--item-text)',
                            userSelect: 'text' as const,
                          }}
                        >
                          brew install whisperkit-cli
                        </code>
                      </div>
                    )}
                    {cliInstallLog.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: '6px 8px',
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: 5,
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: 9,
                          color: 'var(--item-meta)',
                          lineHeight: 1.6,
                          maxHeight: 80,
                          overflowY: 'auto',
                        }}
                      >
                        {cliInstallLog.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label style={labelStyle}>{t('transcriptionModel')}</label>
                {/* 平铺式模型选择卡片 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {WHISPER_MODELS.map((m) => {
                    const isSelected = cfg.whisperkit_model === m.id
                    const isDownloaded = downloadedModels.has(m.id)
                    const isThisDownloading = activeDownloadModel === m.id
                    const canDownload = !isDownloaded && !isThisDownloading && !hasActiveDownload

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setCfg((prev) => ({ ...prev, whisperkit_model: m.id }))
                          setSaveStatus('idle')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(200,147,58,0.08)'
                            : 'var(--detail-case-bg)',
                          border: `1px solid ${isSelected ? 'var(--record-btn)' : 'var(--divider)'}`,
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        {/* 选中指示点 */}
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: `2px solid ${isSelected ? 'var(--record-btn)' : 'var(--divider)'}`,
                            background: isSelected ? 'var(--record-btn)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected && (
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: '#fff',
                              }}
                            />
                          )}
                        </div>

                        {/* 模型信息 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: isSelected ? 'var(--record-btn)' : 'var(--item-text)',
                            }}
                          >
                            {m.label}
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                fontWeight: 400,
                                color: 'var(--duration-text)',
                              }}
                            >
                              {m.size}
                            </span>
                          </div>
                          <div
                            style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 1 }}
                          >
                            {t(m.hintKey)}
                          </div>
                        </div>

                        {/* 下载状态 / 按钮 */}
                        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
                          {isDownloaded ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                color: 'var(--status-success)',
                                fontSize: 10,
                              }}
                            >
                              <Check size={12} strokeWidth={2.5} />
                              {t('alreadyDownloaded')}
                            </span>
                          ) : isThisDownloading ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                color: 'var(--record-btn)',
                                fontSize: 10,
                              }}
                            >
                              <div
                                style={{
                                  width: 10,
                                  height: 10,
                                  border: '1.5px solid var(--divider)',
                                  borderTopColor: 'var(--record-btn)',
                                  borderRadius: '50%',
                                  animation: 'spin 0.8s linear infinite',
                                }}
                              />
                              {t('downloadingBtn')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDownload(m.id)}
                              disabled={!canDownload}
                              title={
                                hasActiveDownload && !isThisDownloading
                                  ? t('downloadConflict', {
                                      model: getModelDisplayLabel(
                                        activeDownloadModel as WhisperModel,
                                      ),
                                    })
                                  : t('downloadBtn')
                              }
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '3px 9px',
                                borderRadius: 5,
                                fontSize: 10,
                                border: '1px solid var(--divider)',
                                background: 'var(--bg)',
                                color: canDownload ? 'var(--item-meta)' : 'var(--duration-text)',
                                cursor: canDownload ? 'pointer' : 'not-allowed',
                                opacity: canDownload ? 1 : 0.5,
                              }}
                            >
                              <Download size={10} strokeWidth={1.8} />
                              {t('downloadBtn')}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {isCurrentModelDownloading && (
                  <div style={{ ...hintStyle, color: 'var(--item-meta)', marginTop: 8 }}>
                    {t('downloadInBackground')}
                  </div>
                )}

                {downloadSession && panelCopy && (
                  <div style={{ position: 'sticky', bottom: 16, zIndex: 2, marginTop: 14 }}>
                    <div
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255,255,255,0.02), transparent), var(--detail-case-bg)',
                        border: '1px solid var(--divider)',
                        borderRadius: 10,
                        padding: '12px 14px',
                        boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--item-meta)', marginBottom: 4 }}>
                            {t('modelDownloadTask')}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--item-text)' }}>
                            {getModelDisplayLabel(downloadSession.model)}
                          </div>
                        </div>
                        <div
                          style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '5px 10px',
                            borderRadius: 999,
                            background: panelCopy.background,
                            color: panelCopy.color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {panelCopy.label}
                        </div>
                      </div>

                      <div
                        aria-live="polite"
                        style={{
                          borderRadius: 8,
                          border: '1px solid var(--divider)',
                          background: 'rgba(0,0,0,0.08)',
                          padding: '9px 10px',
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{ fontSize: 10, color: 'var(--duration-text)', marginBottom: 4 }}
                        >
                          {t('latestStatus')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--item-text)', lineHeight: 1.6 }}>
                          {downloadSession.latestMessage}
                        </div>
                      </div>

                      <div style={{ fontSize: 10, color: 'var(--duration-text)', marginBottom: 6 }}>
                        {t('recentLogs')}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gap: 5,
                          maxHeight: 110,
                          overflowY: 'auto',
                          paddingRight: 4,
                          marginBottom: 10,
                        }}
                      >
                        {downloadSession.history.map((line, index) => (
                          <div
                            key={`${downloadSession.model}-${index}-${line}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '12px minmax(0, 1fr)',
                              gap: 8,
                              alignItems: 'start',
                              fontSize: 10,
                              color: 'var(--item-meta)',
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ color: panelCopy.color, fontSize: 12, lineHeight: 1 }}>
                              •
                            </span>
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                      >
                        {downloadSession.status === 'error' && (
                          <button
                            onClick={() => handleDownload(downloadSession.model)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              border: '1px solid var(--divider)',
                              borderRadius: 6,
                              background: 'var(--bg)',
                              padding: '6px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--item-text)',
                              cursor: 'pointer',
                            }}
                          >
                            <RefreshCw size={12} strokeWidth={1.8} />
                            {t('reDownload')}
                          </button>
                        )}
                        <button
                          onClick={handleOpenModelsDir}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            border: '1px solid var(--divider)',
                            borderRadius: 6,
                            background: 'var(--bg)',
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--item-text)',
                            cursor: 'pointer',
                          }}
                        >
                          <FolderOpen size={12} strokeWidth={1.7} />
                          {t('openModelDir')}
                        </button>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: 'var(--duration-text)',
                            fontSize: 10,
                          }}
                        >
                          {downloadSession.status === 'error' ? (
                            <>
                              <AlertTriangle size={12} strokeWidth={1.7} />
                              {t('retryHint')}
                            </>
                          ) : (
                            <>
                              <Check
                                size={12}
                                strokeWidth={1.8}
                                color={
                                  downloadSession.status === 'success'
                                    ? 'var(--status-success)'
                                    : 'currentColor'
                                }
                              />
                              {t('switchModelHint')}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 模型存放目录 */}
                <div
                  style={{
                    marginTop: 12,
                    background: 'var(--detail-case-bg)',
                    border: '1px solid var(--divider)',
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--item-meta)', marginBottom: 6 }}>
                    {t('modelStoreDir')}
                  </div>
                  <div
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 9,
                      color: 'var(--duration-text)',
                      wordBreak: 'break-all',
                      lineHeight: 1.5,
                      marginBottom: 8,
                    }}
                  >
                    {modelsDir}
                  </div>
                  <button
                    onClick={handleOpenModelsDir}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: '1px solid var(--divider)',
                      borderRadius: 4,
                      padding: '4px 10px',
                      fontSize: 10,
                      color: 'var(--item-meta)',
                      cursor: 'pointer',
                    }}
                  >
                    <FolderOpen size={11} strokeWidth={1.5} />
                    {t('openInFinder')}
                  </button>
                  <div style={{ ...hintStyle, marginTop: 8 }}>
                    {isBundledModel ? t('baseModelBundled') : t('downloadFromHF')}
                  </div>
                </div>
              </div>
            )}

            {/* DashScope 配置 */}
            {cfg.asr_engine === 'dashscope' && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>DashScope API Key</label>
                <input
                  type="password"
                  style={inputStyle}
                  placeholder="sk-…"
                  value={cfg.dashscope_api_key}
                  onChange={(e) => {
                    setCfg((prev) => ({ ...prev, dashscope_api_key: e.target.value }))
                    setSaveStatus('idle')
                  }}
                />
                <div style={hintStyle}>{t('dashscopeHint')}</div>

                <label style={{ ...labelStyle, marginTop: 16 }}>{t('asrModel')}</label>
                <select
                  value={cfg.dashscope_asr_model || 'qwen3-asr-flash'}
                  onChange={(e) => {
                    setCfg((prev) => ({ ...prev, dashscope_asr_model: e.target.value }))
                    setSaveStatus('idle')
                  }}
                  style={{
                    ...inputStyle,
                    fontFamily: 'inherit',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M3 4.5l3 3 3-3'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    paddingRight: 28,
                  }}
                >
                  <option value="qwen3-asr-flash">Qwen3 ASR Flash</option>
                  <option value="qwen3-asr-flash-filetrans">Qwen3 ASR Flash (File Trans)</option>
                </select>
                <div style={hintStyle}>{t('asrModelHint')}</div>
              </div>
            )}

            {cfg.asr_engine === 'siliconflow' && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('siliconflowApiKeyLabel')}</label>
                <input
                  type="password"
                  style={inputStyle}
                  placeholder="sk-…"
                  value={cfg.siliconflow_asr_api_key}
                  onChange={(e) => {
                    setCfg((prev) => ({ ...prev, siliconflow_asr_api_key: e.target.value }))
                    setSaveStatus('idle')
                  }}
                />
                <div style={hintStyle}>{t('siliconflowApiKeyHint')}</div>
              </div>
            )}

            {cfg.asr_engine === 'zhipu' && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('zhipuApiKeyLabel')}</label>
                <input
                  type="password"
                  style={inputStyle}
                  placeholder="API Key"
                  value={cfg.zhipu_asr_api_key}
                  onChange={(e) => {
                    setCfg((prev) => ({ ...prev, zhipu_asr_api_key: e.target.value }))
                    setSaveStatus('idle')
                  }}
                />
                <div style={hintStyle}>{t('zhipuApiKeyHint')}</div>
                <div style={{ ...hintStyle, marginTop: 8, color: 'var(--record-btn)' }}>
                  {t('zhipuLimitHint')}
                </div>
              </div>
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
                disabled={saveStatus === 'saving' || !hasUnsavedChanges}
                style={{
                  background:
                    saveStatus === 'saving' || !hasUnsavedChanges
                      ? 'var(--divider)'
                      : 'var(--record-btn)',
                  border: 'none',
                  borderRadius: 5,
                  padding: '6px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  color:
                    saveStatus === 'saving' || !hasUnsavedChanges
                      ? 'var(--duration-text)'
                      : 'var(--bg)',
                  cursor: saveStatus === 'saving' || !hasUnsavedChanges ? 'not-allowed' : 'pointer',
                }}
              >
                {saveStatus === 'saving' ? t('savingDots') : t('save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
