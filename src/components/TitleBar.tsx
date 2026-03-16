export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--titlebar-bg)',
        borderBottom: '1px solid var(--divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 16,
      }}
    >
    </div>
  )
}
