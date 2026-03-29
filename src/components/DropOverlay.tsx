interface DropOverlayProps {
  visible: boolean
}

export function DropOverlay({ visible }: DropOverlayProps) {
  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,122,255,0.08)',
      border: '3px dashed #007aff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 36 }}>📥</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#007aff' }}>拖入即可添加</div>
      <div style={{ fontSize: 13, color: '#8e8e93' }}>支持 录音 / txt / md / pdf / docx</div>
    </div>
  )
}
