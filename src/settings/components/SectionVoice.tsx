import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Cloud, Cpu, FolderOpen, Check, Download } from 'lucide-react'
import { getAsrConfig, setAsrConfig, getWhisperkitModelsDir, checkWhisperkitModelDownloaded, downloadWhisperkitModel, type AsrConfig } from '../../lib/tauri'
import { invoke } from '@tauri-apps/api/core'
import SkeletonRow from './SkeletonRow'

type AsrEngineId = 'dashscope' | 'whisperkit'
type WhisperModel = 'base' | 'small' | 'large-v3-turbo'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none', boxSizing: 'border-box',
}

const WHISPER_MODELS: { id: WhisperModel; label: string; size: string; hint: string }[] = [
  { id: 'base',           label: 'Base',           size: '~74MB',  hint: '默认，下载快，中文效果一般' },
  { id: 'small',          label: 'Small',          size: '~244MB', hint: '中文效果好，适合会议记录' },
  { id: 'large-v3-turbo', label: 'Large v3 Turbo', size: '~809MB', hint: '最佳中文效果，首次下载较慢' },
]

export default function SectionVoice() {
  const [cfg, setCfg] = useState<AsrConfig>({
    asr_engine: 'whisperkit',
    dashscope_api_key: '',
    whisperkit_model: 'base',
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [modelsDir, setModelsDir] = useState('')
  const [downloadedModels, setDownloadedModels] = useState<Set<WhisperModel>>(new Set())
  // which model is currently downloading
  const [downloadingModel, setDownloadingModel] = useState<WhisperModel | null>(null)
  // last progress message from Rust stderr stream
  const [downloadMessage, setDownloadMessage] = useState('')

  const refreshDownloadedModels = () => {
    const models: WhisperModel[] = ['base', 'small', 'large-v3-turbo']
    Promise.all(models.map(m =>
      checkWhisperkitModelDownloaded(m).then(ok => ok ? m : null)
    )).then(results => {
      setDownloadedModels(new Set(results.filter(Boolean) as WhisperModel[]))
    })
  }

  useEffect(() => {
    Promise.all([
      getAsrConfig().then(setCfg),
      getWhisperkitModelsDir().then(setModelsDir),
    ]).then(() => {
      refreshDownloadedModels()
      setLoading(false)
    })

    // listen for download progress events from Rust
    let unlisten: (() => void) | null = null
    listen<{ model: WhisperModel; status: 'downloading' | 'done' | 'error'; message?: string }>(
      'whisperkit-download-progress',
      ({ payload }) => {
        if (payload.status === 'downloading' && payload.message) {
          setDownloadingModel(payload.model)
          setDownloadMessage(payload.message)
        } else if (payload.status === 'done') {
          setDownloadingModel(null)
          setDownloadMessage('')
          refreshDownloadedModels()
        } else if (payload.status === 'error') {
          setDownloadingModel(null)
          setDownloadMessage(payload.message ?? '下载失败')
        }
      }
    ).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  const handleSave = async () => {
    await setAsrConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleOpenModelsDir = () => {
    invoke('open_with_system', { path: modelsDir })
  }

  const handleDownload = (model: WhisperModel) => {
    setDownloadingModel(model)
    downloadWhisperkitModel(model).catch(() => setDownloadingModel(null))
  }

  const dashscopeReady = cfg.dashscope_api_key.trim().length > 0
  const whisperkitReady = downloadedModels.has(cfg.whisperkit_model as WhisperModel)

  const ENGINES: { id: AsrEngineId; label: string; vendor: string; icon: typeof Cloud; ready: boolean }[] = [
    { id: 'whisperkit', label: 'WhisperKit', vendor: 'Argmax · 本地',  icon: Cpu,   ready: whisperkitReady },
    { id: 'dashscope',  label: 'DashScope',  vendor: '阿里云 · 云端', icon: Cloud, ready: dashscopeReady  },
  ]

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 16, fontWeight: 500 }}>语音转写</div>

      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {ENGINES.map(({ id, label, vendor, icon: Icon, ready }) => {
              const isActive = cfg.asr_engine === id
              return (
                <div
                  key={id}
                  onClick={async () => {
                    const next = { ...cfg, asr_engine: id }
                    setCfg(next)
                    await setAsrConfig(next)
                  }}
                  style={{
                    background: isActive ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                    border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                    borderRadius: 10, padding: '14px 12px 12px',
                    textAlign: 'center' as const, cursor: 'pointer', position: 'relative',
                  }}
                >
                  {ready && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 16, height: 16, background: '#27c93f', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={9} strokeWidth={2.5} color="#fff" />
                    </div>
                  )}
                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
                    <Icon size={22} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--record-btn)' : 'var(--item-meta)' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 2 }}>{vendor}</div>
                </div>
              )
            })}
          </div>

          <div style={{ height: 1, background: 'var(--divider)', margin: '0 0 14px' }} />

          {/* WhisperKit 配置 */}
          {cfg.asr_engine === 'whisperkit' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>转写模型</label>
              {/* 模型选择行：下拉框 + 下载按钮 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <select
                  style={{ ...inputStyle, flex: 1, cursor: 'pointer', appearance: 'none' as const }}
                  value={cfg.whisperkit_model}
                  onChange={async e => {
                    const next = { ...cfg, whisperkit_model: e.target.value as WhisperModel }
                    setCfg(next)
                    await setAsrConfig(next)
                  }}
                >
                  {WHISPER_MODELS.map(m => (
                    <option key={m.id} value={m.id}>
                      {downloadedModels.has(m.id) ? '✓ ' : ''}{m.label} ({m.size})
                    </option>
                  ))}
                </select>
                {/* 下载按钮 */}
                {downloadedModels.has(cfg.whisperkit_model as WhisperModel) ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, flexShrink: 0,
                    background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
                    borderRadius: 6, color: '#27c93f',
                  }}>
                    <Check size={14} strokeWidth={2} />
                  </div>
                ) : downloadingModel === cfg.whisperkit_model ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, flexShrink: 0,
                    background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
                    borderRadius: 6,
                  }}>
                    <div style={{
                      width: 12, height: 12,
                      border: '2px solid var(--divider)', borderTopColor: 'var(--record-btn)',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                  </div>
                ) : (
                  <button
                    onClick={() => handleDownload(cfg.whisperkit_model as WhisperModel)}
                    title="下载模型"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, flexShrink: 0,
                      background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
                      borderRadius: 6, cursor: 'pointer', color: 'var(--item-meta)',
                    }}
                  >
                    <Download size={13} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <div style={hintStyle}>
                {WHISPER_MODELS.find(m => m.id === cfg.whisperkit_model)?.hint}
                {downloadingModel === cfg.whisperkit_model && (
                  <div style={{ marginTop: 4, color: 'var(--item-meta)', fontFamily: 'ui-monospace, monospace', fontSize: 9, lineHeight: 1.6 }}>
                    {downloadMessage || '下载中，请稍候…'}
                  </div>
                )}
              </div>

              {/* 模型存放目录 */}
              <div style={{
                marginTop: 12, background: 'var(--detail-case-bg)',
                border: '1px solid var(--divider)', borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 10, color: 'var(--item-meta)', marginBottom: 6 }}>模型存放目录</div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9,
                  color: 'var(--duration-text)', wordBreak: 'break-all', lineHeight: 1.5,
                  marginBottom: 8,
                }}>
                  {modelsDir}
                </div>
                <button
                  onClick={handleOpenModelsDir}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: '1px solid var(--divider)',
                    borderRadius: 4, padding: '4px 10px', fontSize: 10,
                    color: 'var(--item-meta)', cursor: 'pointer',
                  }}
                >
                  <FolderOpen size={11} strokeWidth={1.5} />
                  在 Finder 中打开
                </button>
                <div style={{ ...hintStyle, marginTop: 8 }}>
                  点击下载按钮自动从 HuggingFace 下载，之后离线可用。<br />
                  也可手动将模型文件放入上方目录。
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
                onChange={e => setCfg(prev => ({ ...prev, dashscope_api_key: e.target.value }))}
              />
              <div style={hintStyle}>配置后，录音将自动上传至阿里云转写</div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
            <button onClick={handleSave} style={{
              background: 'var(--record-btn)', border: 'none', borderRadius: 5,
              padding: '6px 18px', fontSize: 12, fontWeight: 600,
              color: 'var(--bg)', cursor: 'pointer',
            }}>保存</button>
          </div>
        </div>
      )}
    </div>
  )
}
