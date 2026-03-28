export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--bg)',
        flexShrink: 0,
        paddingLeft: 70,
      }}
    />
  )
}
