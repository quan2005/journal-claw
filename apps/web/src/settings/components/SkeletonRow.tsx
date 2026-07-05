export default function SkeletonRow({
  width = '100%',
  height = 28,
  mb = 14,
}: {
  width?: string | number
  height?: number
  mb?: number
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        marginBottom: mb,
        background:
          'linear-gradient(90deg, var(--detail-case-bg) 25%, var(--divider) 50%, var(--detail-case-bg) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}
