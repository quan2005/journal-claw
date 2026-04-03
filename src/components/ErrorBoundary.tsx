import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

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

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg)', color: 'var(--item-text)', gap: 12,
      }}>
        <span style={{ fontSize: 14, color: 'var(--item-meta)' }}>出了点问题</span>
        <code style={{ fontSize: 12, color: 'var(--item-meta)', maxWidth: 400, textAlign: 'center', wordBreak: 'break-word' }}>
          {this.state.error?.message}
        </code>
        <button
          onClick={() => { this.setState({ hasError: false, error: null }) }}
          style={{
            marginTop: 8, fontSize: 12, padding: '4px 16px', borderRadius: 6,
            border: '1px solid var(--divider)', background: 'transparent', color: 'var(--item-text)', cursor: 'pointer',
          }}
        >
          重试
        </button>
      </div>
    )
  }
}
