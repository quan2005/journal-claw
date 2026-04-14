interface SpinnerProps {
  size?: number
  borderWidth?: number
}

export function Spinner({ size = 14, borderWidth = 2 }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid currentColor`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}
