import { Component, type ReactNode } from 'react'
import { createTranslator, detectLang } from '../lib/i18n'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

// Class component can't use hooks — resolve translation at render time
const getT = () => createTranslator(detectLang())

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const t = getT()
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg)', color: 'var(--item-text)', gap: 12,
      }}>
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--item-meta)' }}>{t('somethingWentWrong')}</span>
        <code style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', maxWidth: 400, textAlign: 'center', wordBreak: 'break-word' }}>
          {this.state.error?.message}
        </code>
        <button
          onClick={() => { this.setState({ hasError: false, error: null }) }}
          style={{
            marginTop: 8, fontSize: 'var(--text-xs)', padding: '4px 16px', borderRadius: 6,
            border: '1px solid var(--divider)', background: 'transparent', color: 'var(--item-text)', cursor: 'pointer',
          }}
        >
          {t('retry')}
        </button>
      </div>
    )
  }
}
