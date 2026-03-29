import { Spinner } from './Spinner'

interface InboxStripProps {
  processingPaths: string[]
}

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

export function InboxStrip({ processingPaths }: InboxStripProps) {
  if (processingPaths.length === 0) return null

  return (
    <div style={{
      padding: '8px 16px', background: '#fafafa',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11, color: 'var(--item-meta)', flexShrink: 0 }}>整理中</span>
      {processingPaths.map(p => (
        <div key={p} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'white', border: '1px solid var(--divider)',
          borderRadius: 6, padding: '3px 7px', fontSize: 11, color: '#636366',
          maxWidth: 160,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortName(p)}
          </span>
          <Spinner size={10} borderWidth={1.5} />
        </div>
      ))}
    </div>
  )
}
