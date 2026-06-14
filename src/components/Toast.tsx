import type { ToastItem } from '../contexts/ToastContext'

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItemView key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItemView({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: (id: number) => void
}) {
  const bg = BG[toast.level]
  const border = BORDER[toast.level]
  const color = COLOR[toast.level]

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 8,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.4,
        maxWidth: 400,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'toast-in 250ms ease-out',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => onDismiss(toast.id)}
    >
      <span style={{ flexShrink: 0, fontSize: 15 }}>{ICON[toast.level]}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  )
}

const ICON: Record<string, string> = {
  success: '✓',
  warning: '⚠',
  error: '✕',
}

// Use CSS variables for theme compatibility; fallbacks for safety.
const BG: Record<string, string> = {
  success: 'var(--status-success-bg, rgba(91,166,122,0.12))',
  warning: 'var(--status-warning-bg, rgba(217,119,6,0.12))',
  error: 'var(--status-danger-bg, rgba(224,108,96,0.12))',
}

const BORDER: Record<string, string> = {
  success: 'var(--status-success, #16a34a)',
  warning: 'var(--status-warning, #d97706)',
  error: 'var(--status-danger, #dc2626)',
}

const COLOR: Record<string, string> = {
  success: 'var(--status-success, #16a34a)',
  warning: 'var(--status-warning, #d97706)',
  error: 'var(--status-danger, #dc2626)',
}
