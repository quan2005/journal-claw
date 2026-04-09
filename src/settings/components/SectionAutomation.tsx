import { useState, useEffect, useCallback } from 'react'
import { getAutoDreamConfig, setAutoDreamConfig, getAutoDreamStatus, triggerDreamNow } from '../../lib/tauri'
import type { AutoDreamConfig, AutoDreamStatus } from '../../lib/tauri'
import { listen } from '@tauri-apps/api/event'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }

type SegmentOption<T> = { value: T; label: string }

function Segment<T extends string | number>({ options, value, onChange }: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 14px',
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: value === opt.value ? 500 : 400,
            background: value === opt.value ? 'rgba(200,147,58,0.15)' : 'rgba(200,210,220,0.06)',
            color: value === opt.value ? 'var(--record-btn)' : 'var(--item-meta)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function SectionAutomation() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AutoDreamConfig>({
    enabled: false,
    frequency: 'daily',
    time: '03:00',
    min_entries: 10,
  })
  const [status, setStatus] = useState<AutoDreamStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAutoDreamConfig(), getAutoDreamStatus()]).then(([cfg, st]) => {
      setConfig(cfg)
      setStatus(st)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const unlisten = listen<AutoDreamStatus>('auto-dream-status', (event) => {
      setStatus(event.payload)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const updateConfig = useCallback(async (patch: Partial<AutoDreamConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    try {
      await setAutoDreamConfig(next)
      // Refresh status after config change
      const st = await getAutoDreamStatus()
      setStatus(st)
    } catch (e) {
      console.error('[SectionAutomation] save failed', e)
    }
  }, [config])

  const handleRunNow = useCallback(async () => {
    try {
      await triggerDreamNow()
    } catch (e) {
      console.error('[SectionAutomation] trigger failed', e)
    }
  }, [])

  const isRunning = status?.state === 'running'

  const freqOptions: SegmentOption<AutoDreamConfig['frequency']>[] = [
    { value: 'daily', label: t('freqDaily') },
    { value: 'weekly', label: t('freqWeekly') },
    { value: 'monthly', label: t('freqMonthly') },
  ]

  const timeOptions: SegmentOption<AutoDreamConfig['time']>[] = [
    { value: '03:00', label: '03:00' },
    { value: '12:00', label: '12:00' },
    { value: '22:00', label: '22:00' },
  ]

  const entryOptions: SegmentOption<AutoDreamConfig['min_entries']>[] = [
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: 30, label: '30' },
  ]

  if (loading) {
    return (
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>{t('automation')}</div>
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>{t('automation')}</div>

      <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
        <div style={{
          background: 'var(--detail-case-bg)',
          border: '1px solid var(--divider)',
          borderRadius: 8,
          padding: 16,
        }}>
          {/* Header: icon + title + toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(200,147,58,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>🗂</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--item-text)' }}>{t('autoDreamTitle')}</div>
              <div style={{ fontSize: 11, color: 'var(--duration-text)', marginTop: 2 }}>{t('autoDreamDesc')}</div>
            </div>
            {/* Toggle */}
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
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

              {/* Frequency */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 6 }}>{t('frequency')}</div>
                <Segment options={freqOptions} value={config.frequency} onChange={v => updateConfig({ frequency: v })} />
              </div>

              {/* Time */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 6 }}>{t('execTime')}</div>
                <Segment options={timeOptions} value={config.time} onChange={v => updateConfig({ time: v })} />
              </div>

              {/* Min entries */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 6 }}>{t('minEntries')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Segment options={entryOptions} value={config.min_entries} onChange={v => updateConfig({ min_entries: v })} />
                  <span style={{ fontSize: 11, color: 'var(--duration-text)' }}>{t('entries')} · {t('skipIfInsufficient')}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--divider)', marginBottom: 14 }} />

              {/* Status + Run now */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  {status?.state === 'running' ? (
                    <div style={{ fontSize: 11, color: 'var(--record-btn)' }}>{t('dreamRunning')}</div>
                  ) : status?.state === 'error' ? (
                    <div style={{ fontSize: 11, color: '#ff9f0a' }}>{t('dreamFailed')}: {status.error}</div>
                  ) : status?.state === 'never_run' ? (
                    <div style={{ fontSize: 11, color: 'var(--duration-text)' }}>{t('neverRun')}</div>
                  ) : (
                    <>
                      {status?.last_run && (
                        <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 3 }}>
                          {t('lastRun')}: {status.last_run}
                          {status.last_run_entries != null && ` · ${t('organized')} ${status.last_run_entries} ${t('entries')}`}
                        </div>
                      )}
                      {status?.next_check && (
                        <div style={{ fontSize: 11, color: 'var(--record-btn)' }}>
                          {t('nextCheck')}: {status.next_check} · {t('currentNew')} {status.current_new_entries} {t('entries')}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={handleRunNow}
                  disabled={isRunning}
                  style={{
                    background: isRunning ? 'var(--divider)' : 'rgba(200,147,58,0.12)',
                    border: isRunning ? 'none' : '1px solid rgba(200,147,58,0.2)',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    color: isRunning ? 'var(--duration-text)' : 'var(--record-btn)',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isRunning ? t('dreamRunning') : t('runNow')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
