import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { buildSrcdoc } from '../lib/sandbox/buildSrcdoc'

interface SandboxPreviewProps {
  html: string
  title?: string
  style?: React.CSSProperties
}

function getCurrentTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' ? 'dark' : 'light'
}

export const SandboxPreview = React.memo(function SandboxPreview({
  html,
  title,
  style,
}: SandboxPreviewProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(getCurrentTheme)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeKeyRef = useRef(0)

  // Bump key on html change to force iframe remount (avoids stale srcdoc)
  const srcdocKey = useMemo(() => {
    iframeKeyRef.current += 1
    return iframeKeyRef.current
  }, [html])

  const srcdoc = useMemo(() => buildSrcdoc(html, theme), [html, theme])

  // Theme observer: watch host page's data-theme and sync to iframe
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = getCurrentTheme()
      setTheme(newTheme)
      // Also push to existing iframe via postMessage (live sync)
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'journal:theme', theme: newTheme },
          '*',
        )
      } catch {
        // cross-origin — iframe may have been navigated away
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  // Sync initial theme to iframe on load
  const handleLoad = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'journal:theme', theme },
        '*',
      )
    } catch {
      // ignore
    }
  }, [theme])

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      <iframe
        key={srcdocKey}
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        title={title ?? 'Preview'}
        onLoad={handleLoad}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
      />
    </div>
  )
})
