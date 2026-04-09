import { useState, useEffect, useCallback } from 'react'
import { getFeishuConfig, setFeishuConfig, getFeishuStatus } from '../../lib/tauri'
import type { FeishuConfig, FeishuStatus } from '../../lib/tauri'
import { listen } from '@tauri-apps/api/event'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 40px', borderBottom: '1px solid var(--divider)' }

const STATUS_COLOR: Record<FeishuStatus['state'], string> = {
  idle: 'var(--duration-text)',
  connecting: '#ff9f0a',
  connected: '#30d158',
  error: '#ff453a',
}

export default function SectionFeishu() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<FeishuConfig>({ enabled: false, app_id: '', app_secret: '' })
  const [status, setStatus] = useState<FeishuStatus>({ state: 'idle', error: null })
  const [draft, setDraft] = useState({ app_id: '', app_secret: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getFeishuConfig(), getFeishuStatus()]).then(([cfg, st]) => {
      setConfig(cfg)
      setDraft({ app_id: cfg.app_id, app_secret: cfg.app_secret })
      setStatus(st)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const unlisten = listen<FeishuStatus>('feishu-status-changed', (event) => {
      setStatus(event.payload)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const handleToggle = useCallback(async () => {
    const next = { ...config, ...draft, enabled: !config.enabled }
    setConfig(next)
    try {
      await setFeishuConfig(next)
    } catch (e) {
      console.error('[SectionFeishu] toggle failed', e)
    }
  }, [config, draft])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const next = { ...config, ...draft }
    try {
      await setFeishuConfig(next)
      setConfig(next)
    } catch (e) {
      console.error('[SectionFeishu] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [config, draft])

  const statusLabel = () => {
    switch (status.state) {
      case 'idle': return t('feishuStatusIdle')
      case 'connecting': return t('feishuStatusConnecting')
      case 'connected': return t('feishuStatusConnected')
      case 'error': return `${t('feishuStatusError')}: ${status.error ?? ''}`
    }
  }

  const dirty = draft.app_id !== config.app_id || draft.app_secret !== config.app_secret

  if (loading) {
    return (
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>{t('feishu')}</div>
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>{t('feishu')}</div>

      <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
        <div style={{
          background: 'var(--detail-case-bg)',
          border: '1px solid var(--divider)',
          borderRadius: 8,
          padding: 16,
        }}>
          {/* Header: icon + title + toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: config.enabled ? 16 : 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(100,160,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>💬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--item-text)' }}>{t('feishuTitle')}</div>
              <div style={{ fontSize: 11, color: 'var(--duration-text)', marginTop: 2 }}>{t('feishuDesc')}</div>
            </div>
            <button
              onClick={handleToggle}
              style={{
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: config.enabled ? 'var(--record-btn)' : 'var(--divider)',
                position: 'relative', flexShrink: 0, padding: 0,
                transition: 'background 200ms ease-out',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: config.enabled ? 20 : 2,
                transition: 'left 200ms ease-out',
              }} />
            </button>
          </div>

          {config.enabled && (
            <>
              <div style={{ borderTop: '1px solid var(--divider)', marginBottom: 14 }} />

              {/* App ID */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 5 }}>{t('feishuAppId')}</div>
                <input
                  value={draft.app_id}
                  onChange={e => setDraft(d => ({ ...d, app_id: e.target.value }))}
                  placeholder={t('feishuAppIdPlaceholder')}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--input-bg, rgba(200,210,220,0.06))',
                    border: '1px solid var(--divider)',
                    borderRadius: 6, padding: '7px 10px',
                    fontSize: 12, color: 'var(--item-text)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* App Secret */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 5 }}>{t('feishuAppSecret')}</div>
                <input
                  type="password"
                  value={draft.app_secret}
                  onChange={e => setDraft(d => ({ ...d, app_secret: e.target.value }))}
                  placeholder={t('feishuAppSecretPlaceholder')}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--input-bg, rgba(200,210,220,0.06))',
                    border: '1px solid var(--divider)',
                    borderRadius: 6, padding: '7px 10px',
                    fontSize: 12, color: 'var(--item-text)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--divider)', marginBottom: 14 }} />

              {/* Status + Save */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: STATUS_COLOR[status.state] }}>
                  {t('feishuStatus')}: {statusLabel()}
                </div>
                {dirty && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: 'rgba(100,160,255,0.12)',
                      border: '1px solid rgba(100,160,255,0.2)',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      color: '#64a0ff',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {t('feishuSave')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
