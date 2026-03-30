import { useState, useEffect } from 'react'
import { Cloud, Cpu, FolderOpen, Check } from 'lucide-react'
import { getAsrConfig, setAsrConfig, getWhisperkitModelsDir, checkWhisperkitModelDownloaded, type AsrConfig } from '../../lib/tauri'
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
  // track which whisper models are already downloaded
  const [downloadedModels, setDownloadedModels] = useState<Set<WhisperModel>>(new Set())

  useEffect(() => {
    Promise.all([
      getAsrConfig().then(setCfg),
      getWhisperkitModelsDir().then(dir => {
        setModelsDir(dir)
        // check all three models
        const models: WhisperModel[] = ['base', 'small', 'large-v3-turbo']
        return Promise.all(models.map(m =>
          checkWhisperkitModelDownloaded(m).then(ok => ok ? m : null)
        )).then(results => {
          setDownloadedModels(new Set(results.filter(Boolean) as WhisperModel[]))
        })
      }),
    ]).then(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    await setAsrConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleOpenModelsDir = () => {
    invoke('open_with_system', { path: modelsDir })
  }

  // DashScope is "ready" if API key is set
  const dashscopeReady = cfg.dashscope_api_key.trim().length > 0
  // WhisperKit is "ready" if the selected model is downloaded
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
                  onClick={() => setCfg(prev => ({ ...prev, asr_engine: id }))}
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
              <select
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as const }}
                value={cfg.whisperkit_model}
                onChange={e => setCfg(prev => ({ ...prev, whisperkit_model: e.target.value as WhisperModel }))}
              >
                {WHISPER_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {downloadedModels.has(m.id) ? '✓ ' : ''}{m.label} ({m.size})
                  </option>
                ))}
              </select>
              <div style={hintStyle}>
                {WHISPER_MODELS.find(m => m.id === cfg.whisperkit_model)?.hint}
              </div>

              {/* 模型下载区域 */}
              <div style={{
                marginTop: 12, background: 'var(--detail-case-bg)',
                border: '1px solid var(--divider)', borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 10, color: 'var(--item-meta)', marginBottom: 6 }}>
                  模型存放目录
                </div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 9,
                  color: 'var(--duration-text)', wordBreak: 'break-all', lineHeight: 1.5,
                  marginBottom: 8,
                }}>
                  {modelsDir}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
                </div>
                <div style={{ ...hintStyle, marginTop: 8 }}>
                  首次使用时自动从 HuggingFace 下载模型，之后离线可用。<br />
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
