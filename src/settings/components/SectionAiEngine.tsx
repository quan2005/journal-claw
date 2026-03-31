import { useState, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  checkEngineInstalled, installEngine,
  getEngineConfig, setEngineConfig,
  type EngineConfig,
} from '../../lib/tauri'
import { Terminal, Sparkles, Check, type LucideIcon } from 'lucide-react'
import SkeletonRow from './SkeletonRow'

type InstallStatus = 'checking' | 'installed' | 'not_installed' | 'installing'
type EngineId = 'claude' | 'qwen'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none', boxSizing: 'border-box',
}

const ENGINES: { id: EngineId; label: string; vendor: string; icon: LucideIcon }[] = [
  { id: 'claude', label: 'Claude Code', vendor: 'Anthropic', icon: Terminal },
  { id: 'qwen',   label: 'Qwen Code',   vendor: '阿里云',     icon: Sparkles },
]

function isEngineConfigEqual(a: EngineConfig, b: EngineConfig) {
  return (
    a.active_ai_engine === b.active_ai_engine &&
    a.claude_code_api_key === b.claude_code_api_key &&
    a.claude_code_base_url === b.claude_code_base_url &&
    a.claude_code_model === b.claude_code_model &&
    a.qwen_code_api_key === b.qwen_code_api_key &&
    a.qwen_code_base_url === b.qwen_code_base_url &&
    a.qwen_code_model === b.qwen_code_model
  )
}

export default function SectionAiEngine() {
  const [status, setStatus] = useState<Record<EngineId, InstallStatus>>({
    claude: 'checking', qwen: 'checking',
  })
  const [installLogs, setInstallLogs] = useState<Record<EngineId, string[]>>({
    claude: [], qwen: [],
  })
  const defaultConfig: EngineConfig = {
    active_ai_engine: 'claude',
    claude_code_api_key: '', claude_code_base_url: '', claude_code_model: '',
    qwen_code_api_key: '', qwen_code_base_url: '', qwen_code_model: '',
  }
  const [cfg, setCfg] = useState<EngineConfig>(defaultConfig)
  const [persistedCfg, setPersistedCfg] = useState<EngineConfig>(defaultConfig)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      ...ENGINES.map(({ id }) =>
        checkEngineInstalled(id).then(installed => {
          setStatus(prev => ({ ...prev, [id]: installed ? 'installed' : 'not_installed' }))
        })
      ),
      getEngineConfig().then(loadedConfig => {
        setCfg(loadedConfig)
        setPersistedCfg(loadedConfig)
      }),
    ]).then(() => setLoading(false))
  }, [])

  useEffect(() => {
    let unlistenFn: (() => void) | null = null
    listen<{ engine: EngineId; line: string; done: boolean; success: boolean }>(
      'engine-install-log',
      ({ payload }) => {
        setInstallLogs(prev => ({
          ...prev,
          [payload.engine]: [...prev[payload.engine], payload.line],
        }))
        if (payload.done) {
          setStatus(prev => ({
            ...prev,
            [payload.engine]: payload.success ? 'installed' : 'not_installed',
          }))
        }
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    ).then(fn => { unlistenFn = fn })
    return () => { unlistenFn?.() }
  }, [])

  const handleInstall = (engine: EngineId) => {
    setStatus(prev => ({ ...prev, [engine]: 'installing' }))
    setInstallLogs(prev => ({ ...prev, [engine]: [] }))
    installEngine(engine)
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await setEngineConfig(cfg)
      setPersistedCfg(cfg)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(current => current === 'saved' ? 'idle' : current), 2000)
    } catch (error) {
      console.error('[settings/ai-engine] save failed', error)
      setSaveStatus('error')
    }
  }

  const active = cfg.active_ai_engine as EngineId
  const hasUnsavedChanges = !isEngineConfigEqual(cfg, persistedCfg)
  const saveHint = saveStatus === 'saving'
    ? '保存中…'
    : saveStatus === 'saved'
      ? '已保存'
      : saveStatus === 'error'
        ? '保存失败，请重试'
        : hasUnsavedChanges
          ? '有未保存修改'
          : ''
  const canSave = hasUnsavedChanges && saveStatus !== 'saving'

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>AI 引擎</div>

      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <SkeletonRow height={90} mb={0} />
            <SkeletonRow height={90} mb={0} />
          </div>
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
          {/* Engine cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {ENGINES.map(({ id, label, vendor, icon: Icon }) => {
              const s = status[id]
              const isActive = active === id
              const isComingSoon = id === 'qwen'
              return (
                <div
                  key={id}
                  onClick={() => {
                    if (!isComingSoon && s === 'installed') {
                      setCfg(prev => ({ ...prev, active_ai_engine: id }))
                      setSaveStatus('idle')
                    }
                  }}
                  title={isComingSoon ? '开发中，敬请期待' : undefined}
                  style={{
                    background: isActive ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                    border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                    borderRadius: 10, padding: '14px 12px 12px',
                    textAlign: 'center', position: 'relative',
                    cursor: isComingSoon ? 'not-allowed' : s === 'installed' ? 'pointer' : 'default',
                    opacity: isComingSoon ? 0.4 : s === 'checking' ? 0.6 : 1,
                    pointerEvents: isComingSoon ? 'none' : undefined,
                  }}
                >
                  {isComingSoon && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      fontSize: 9, color: 'var(--duration-text)',
                      background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
                      borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em',
                    }}>开发中</div>
                  )}
                  {!isComingSoon && s === 'checking' && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 14, height: 14, border: '2px solid var(--divider)',
                      borderTopColor: 'var(--record-btn)', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                  )}
                  {!isComingSoon && s === 'installed' && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 16, height: 16, background: '#27c93f', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Check size={9} strokeWidth={2.5} color="#fff" /></div>
                  )}
                  <div style={{ marginBottom: 6, opacity: (!isComingSoon && (s === 'not_installed' || s === 'installing')) ? 0.5 : 1, display: 'flex', justifyContent: 'center' }}>
                    <Icon size={22} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--record-btn)' : 'var(--item-meta)' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 2 }}>{vendor}</div>
                  {!isComingSoon && s === 'not_installed' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleInstall(id) }}
                      style={{
                        position: 'absolute', bottom: 8, right: 8,
                        background: 'var(--record-btn)', border: 'none', borderRadius: 4,
                        padding: '3px 8px', fontSize: 10, color: 'var(--bg)',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >安装</button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Install progress */}
          {ENGINES.filter(({ id }) => status[id] === 'installing').map(({ id, label }) => (
            <div key={id} style={{
              background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
              borderRadius: 8, padding: '12px 14px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--record-btn)', animation: 'pulse 1s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, color: 'var(--item-meta)' }}>正在安装 {label}…</span>
              </div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                color: 'var(--item-meta)', maxHeight: 120, overflowY: 'auto', lineHeight: 1.7,
              }}>
                {installLogs[id].map((line, i) => <div key={i}>{line}</div>)}
                <div ref={logsEndRef} />
              </div>
            </div>
          ))}

          {/* Config fields for active installed engine */}
          {status[active] === 'installed' && (
            <>
              <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

              {active === 'claude' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>API Key</label>
                    <input type="password" style={inputStyle} placeholder="sk-ant-…"
                      value={cfg.claude_code_api_key}
                      onChange={e => {
                        setCfg(prev => ({ ...prev, claude_code_api_key: e.target.value }))
                        setSaveStatus('idle')
                      }} />
                    <div style={hintStyle}>留空则使用 CLI 默认配置</div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Base URL</label>
                    <input style={inputStyle} placeholder="https://api.anthropic.com"
                      value={cfg.claude_code_base_url}
                      onChange={e => {
                        setCfg(prev => ({ ...prev, claude_code_base_url: e.target.value }))
                        setSaveStatus('idle')
                      }} />
                    <div style={hintStyle}>自定义 API 端点，留空使用默认值（代理场景）</div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Model</label>
                    <input style={inputStyle} placeholder="claude-sonnet-4-6"
                      value={cfg.claude_code_model}
                      onChange={e => {
                        setCfg(prev => ({ ...prev, claude_code_model: e.target.value }))
                        setSaveStatus('idle')
                      }} />
                    <div style={hintStyle}>留空使用 CLI 默认模型</div>
                  </div>
                </>
              )}

              {active === 'qwen' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>API Key</label>
                    <input type="password" style={inputStyle} placeholder="sk-…"
                      value={cfg.qwen_code_api_key}
                      onChange={e => {
                        setCfg(prev => ({ ...prev, qwen_code_api_key: e.target.value }))
                        setSaveStatus('idle')
                      }} />
                    <div style={hintStyle}>阿里云 DashScope API Key（独立于语音转写配置）</div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Base URL</label>
                    <input style={inputStyle} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                      value={cfg.qwen_code_base_url}
                      onChange={e => {
                        setCfg(prev => ({ ...prev, qwen_code_base_url: e.target.value }))
                        setSaveStatus('idle')
                      }} />
                    <div style={hintStyle}>自定义 API 端点，留空使用默认值</div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Model</label>
                    <input style={inputStyle} placeholder="qwen-coder-plus"
                      value={cfg.qwen_code_model}
                      onChange={e => {
                        setCfg(prev => ({ ...prev, qwen_code_model: e.target.value }))
                        setSaveStatus('idle')
                      }} />
                    <div style={hintStyle}>留空使用默认模型</div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <span style={{
                  fontSize: 11,
                  color: saveStatus === 'error'
                    ? '#ff9f0a'
                    : saveStatus === 'saved'
                      ? '#34c759'
                      : 'var(--duration-text)',
                  minHeight: 16,
                }}>
                  {saveHint}
                </span>
                <button onClick={handleSave} disabled={!canSave} style={{
                  background: canSave ? 'var(--record-btn)' : 'var(--divider)', border: 'none', borderRadius: 5,
                  padding: '6px 18px', fontSize: 12, fontWeight: 600,
                  color: canSave ? 'var(--bg)' : 'var(--duration-text)', cursor: canSave ? 'pointer' : 'not-allowed',
                }}>{saveStatus === 'saving' ? '保存中…' : '保存'}</button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
