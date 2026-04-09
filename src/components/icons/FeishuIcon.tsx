interface Props {
  size?: number
  strokeWidth?: number
  className?: string
}

// Feishu (Lark) logo — stylized bird silhouette
export function FeishuIcon({ size = 16 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {/* Left wing */}
      <path d="M11.5 4C9 4 6.5 5.5 5 8c-.8 1.4-1 3-1 4 0 .3 0 .6.1.9L7.5 11l1.5 3 2.5-1V4z" opacity="0.55" />
      {/* Right wing / body */}
      <path d="M12.5 4v9l2.5 1 1.5-3 3.4 1.9c.1-.3.1-.6.1-.9 0-1-.2-2.6-1-4C17.5 5.5 15 4 12.5 4z" />
      {/* Tail */}
      <path d="M7.5 11l-1.4 1.9C7.2 16.4 9.8 18.5 12 19c2.2-.5 4.8-2.6 5.9-6.1L16.5 11 15 14l-3 1-3-1-1.5-3z" opacity="0.75" />
    </svg>
  )
}
