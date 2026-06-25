import { FileText } from 'lucide-react'
import { useMdxAsset } from './runtimeContext'

export function ImageViewer({
  src,
  alt = '',
  caption,
  width,
}: {
  src: string
  alt?: string
  caption?: string
  width?: string
}) {
  const resolvedSrc = useMdxAsset(src)

  return (
    <figure className="mdx-image">
      <img src={resolvedSrc} alt={alt} style={width ? { width } : undefined} />
      {caption && <figcaption className="mdx-image-caption">{caption}</figcaption>}
    </figure>
  )
}

export function FileCard({ path, label }: { path: string; label?: string }) {
  return (
    <a className="mdx-file-card" data-filepath={path} style={{ cursor: 'pointer' }}>
      <FileText className="mdx-file-icon" aria-hidden="true" size={15} strokeWidth={1.8} />
      <span>{label ?? path}</span>
    </a>
  )
}
