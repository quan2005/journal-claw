export function AudioCard({ src, title: _title }: { src: string; title?: string }) {
  return <div><audio controls src={src} /></div>
}

export function VideoCard({ src, title: _title, poster: _poster }: { src: string; title?: string; poster?: string }) {
  return <div><video controls src={src} /></div>
}

export function ImageViewer({ src, alt = '', caption: _caption, width: _width }: { src: string; alt?: string; caption?: string; width?: string }) {
  return <figure><img src={src} alt={alt} /></figure>
}

export function FileCard({ path, label }: { path: string; label?: string }) {
  return <a data-filepath={path}>{label ?? path}</a>
}
