import React from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { MarkdownLi } from '../lib/markdownLi'
import { resolveRelativePath, extractCodeText } from './markdownUtils'

function CodeBlock({
  className,
  rawText,
  children,
}: {
  className?: string
  rawText: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = React.useState(false)
  const lang = className?.replace('language-', '') ?? ''
  return (
    <div style={{ position: 'relative', margin: '10px 0' }}>
      {lang && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 10,
            fontSize: '0.65rem',
            color: 'var(--md-code-lang)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        >
          {lang}
        </div>
      )}
      <button
        onClick={() => {
          navigator.clipboard.writeText(rawText)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          color: 'var(--item-meta)',
          opacity: copied ? 1 : 0.4,
          transition: 'opacity 0.15s',
        }}
        title="Copy"
      >
        {copied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-success)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      <pre
        style={{
          background: 'var(--md-code-bg)',
          borderRadius: 6,
          padding: '24px 14px 14px',
          overflowX: 'auto',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
        }}
      >
        {children}
      </pre>
    </div>
  )
}

export interface MarkdownComponentsOptions {
  entryPath: string
  imgResolver?: (src: string, baseDir: string) => string
}

export function createMarkdownComponents(opts: string | MarkdownComponentsOptions) {
  const entryPath = typeof opts === 'string' ? opts : opts.entryPath
  const imgResolver = typeof opts === 'string' ? undefined : opts.imgResolver
  const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/'))

  return {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--md-h1)',
          margin: '0 0 16px',
          lineHeight: 1.4,
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--md-h2)',
          margin: '28px 0 10px',
          lineHeight: 1.5,
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--md-h3)',
          margin: '20px 0 6px',
          lineHeight: 1.5,
        }}
      >
        {children}
      </h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--md-h3)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          margin: '14px 0 5px',
        }}
      >
        {children}
      </h4>
    ),
    h5: ({ children }: { children?: React.ReactNode }) => (
      <h5
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--md-h3)',
          margin: '12px 0 4px',
        }}
      >
        {children}
      </h5>
    ),
    h6: ({ children }: { children?: React.ReactNode }) => (
      <h6
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
          color: 'var(--md-h3)',
          margin: '10px 0 4px',
        }}
      >
        {children}
      </h6>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p
        style={{
          fontSize: 'var(--text-md)',
          color: 'var(--md-text)',
          lineHeight: 1.9,
          margin: '0 0 10px',
        }}
      >
        {children}
      </p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul
        style={{
          paddingLeft: 0,
          margin: '6px 0 10px',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 3,
          listStyle: 'none',
        }}
      >
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol
        style={{
          paddingLeft: 20,
          margin: '6px 0 10px',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 3,
        }}
      >
        {children}
      </ol>
    ),
    li: MarkdownLi,
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong style={{ fontWeight: 'var(--font-semibold)', color: 'var(--md-strong)' }}>
        {children}
      </strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em style={{ fontStyle: 'italic', color: 'var(--md-em)' }}>{children}</em>
    ),
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
      <code className={className} style={className ? undefined : { color: 'var(--md-code-text)' }}>
        {children}
      </code>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => {
      const codeEl = children as React.ReactElement<{
        className?: string
        children?: React.ReactNode
      }>
      const rawText = extractCodeText(codeEl?.props?.children)
      return (
        <CodeBlock className={codeEl?.props?.className} rawText={rawText}>
          {children}
        </CodeBlock>
      )
    },
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      const isMdLink = href && /\.md$/i.test(href) && !href.startsWith('http')
      return (
        <a
          href={isMdLink ? undefined : href}
          target={isMdLink ? undefined : '_blank'}
          rel={isMdLink ? undefined : 'noopener noreferrer'}
          className="md-link"
          onClick={
            isMdLink
              ? (e: React.MouseEvent) => {
                  e.preventDefault()
                  const decodedHref = decodeURIComponent(href!)
                  const targetPath = resolveRelativePath(entryDir, decodedHref)
                  const targetFilename = targetPath.substring(targetPath.lastIndexOf('/') + 1)
                  window.dispatchEvent(
                    new CustomEvent('journal-entry-navigate', {
                      detail: { path: targetPath, filename: targetFilename },
                    }),
                  )
                }
              : undefined
          }
          style={{ cursor: 'pointer' }}
        >
          {children}
        </a>
      )
    },
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      if (!src) return null
      let resolvedSrc = src
      if (!src.startsWith('http')) {
        if (imgResolver) {
          resolvedSrc = imgResolver(src, entryDir)
        } else {
          const absPath = src.startsWith('/')
            ? src
            : resolveRelativePath(entryDir, decodeURIComponent(src))
          resolvedSrc = convertFileSrc(absPath)
        }
      }
      return (
        <img
          src={resolvedSrc}
          alt={alt || ''}
          style={{ maxWidth: '100%', height: 'auto', borderRadius: 6, margin: '8px 0' }}
        />
      )
    },
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote
        style={{
          borderLeft: '3px solid var(--md-quote-bar)',
          paddingLeft: 12,
          margin: '8px 0',
          color: 'var(--md-quote-text)',
        }}
      >
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr style={{ border: 'none', borderTop: '1px solid var(--divider)', margin: '16px 0' }} />
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <div style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse' as const,
            fontSize: 'var(--text-base)',
          }}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th
        style={{
          padding: '6px 10px',
          textAlign: 'left' as const,
          fontWeight: 'var(--font-semibold)',
          fontSize: 'var(--text-sm)',
          color: 'var(--md-h3)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          borderBottom: '2px solid var(--divider)',
          whiteSpace: 'nowrap' as const,
          minWidth: 72,
        }}
      >
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td
        style={{
          padding: '5px 10px',
          color: 'var(--md-text)',
          lineHeight: 1.6,
          verticalAlign: 'top',
          borderBottom: '1px solid var(--divider)',
          minWidth: 72,
        }}
      >
        {children}
      </td>
    ),
  }
}
