import { FileText, Film, Volume2 } from 'lucide-react'

export function AudioCard({ src, title }: { src: string; title?: string }) {
  return (
    <div className="mdx-media-card">
      <div className="mdx-media-header">
        <Volume2 className="mdx-media-icon" aria-hidden="true" size={14} strokeWidth={1.8} />
        <span>{title ?? 'Audio'}</span>
      </div>
      <div className="mdx-media-body">
        <audio controls src={src} />
      </div>
    </div>
  )
}

export function VideoCard({
  src,
  title,
  poster,
}: {
  src: string
  title?: string
  poster?: string
}) {
  return (
    <div className="mdx-media-card">
      <div className="mdx-media-header">
        <Film className="mdx-media-icon" aria-hidden="true" size={14} strokeWidth={1.8} />
        <span>{title ?? 'Video'}</span>
      </div>
      <div className="mdx-media-body">
        <video controls src={src} poster={poster} />
      </div>
    </div>
  )
}

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
  return (
    <figure className="mdx-image">
      <img src={src} alt={alt} style={width ? { width } : undefined} />
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
