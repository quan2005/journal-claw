import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AiChatPanelProps {
  messages: ChatMessage[]
  loading: boolean
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const msgDate = new Date(d)
  msgDate.setHours(0, 0, 0, 0)
  if (msgDate.getTime() === today.getTime()) return '今天'
  if (msgDate.getTime() === yesterday.getTime()) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function AiChatPanel({ messages, loading }: AiChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Group messages by date
  const groups: { date: string; msgs: ChatMessage[] }[] = []
  for (const msg of messages) {
    const date = formatDate(msg.timestamp)
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.msgs.push(msg)
    } else {
      groups.push({ date, msgs: [msg] })
    }
  }

  if (messages.length === 0 && !loading) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>✦</div>
          <div style={{ fontSize: 12, color: 'var(--item-meta)', lineHeight: 1.6 }}>
            向 AI 发送指令或提问
          </div>
          <div style={{ fontSize: 11, color: 'var(--duration-text)', marginTop: 4 }}>
            切换「当前文件 / 全局」调整上下文范围
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {groups.map(group => (
        <div key={group.date}>
          {/* Date divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--chat-date-line)' }} />
            <span style={{ fontSize: 10, color: 'var(--chat-date-text)', flexShrink: 0, letterSpacing: '0.04em' }}>{group.date}</span>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--chat-date-line)' }} />
          </div>

          {group.msgs.map(msg => (
            <div key={msg.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 8,
            }}>
              <div style={{
                maxWidth: '85%',
                padding: msg.role === 'user' ? '6px 10px' : '8px 10px',
                borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                background: msg.role === 'user' ? 'var(--chat-user-bg)' : 'var(--chat-ai-bg)',
                border: msg.role === 'user'
                  ? '0.5px solid var(--chat-user-border)'
                  : '0.5px solid var(--divider)',
                color: msg.role === 'user' ? 'var(--chat-user-text)' : 'var(--chat-ai-text)',
                fontSize: 12,
                lineHeight: 1.6,
                wordBreak: 'break-word',
              }}>
                {msg.role === 'user' ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                ) : (
                  <div className="ai-chat-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 9, color: 'var(--duration-text)', marginTop: 2, paddingInline: 2 }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
          ))}
        </div>
      ))}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{
            maxWidth: '85%', padding: '8px 12px', borderRadius: '10px 10px 10px 3px',
            background: 'var(--chat-ai-bg)', border: '0.5px solid var(--divider)',
            fontSize: 12, color: 'var(--duration-text)',
          }}>
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
              <span style={{ animation: 'blink 1s step-start infinite' }}>●</span>
              <span style={{ animation: 'blink 1s step-start 0.33s infinite' }}>●</span>
              <span style={{ animation: 'blink 1s step-start 0.66s infinite' }}>●</span>
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
