import { useState, useCallback, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { ConversationMessage, ConversationStreamPayload, SessionMode } from '../types'
import {
  conversationCreate,
  conversationSend,
  conversationCancel,
  conversationClose,
  conversationGetMessages,
  conversationTruncate,
  conversationRetry,
} from '../lib/tauri'

export function useConversation() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [title, setTitle] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const isStreamingRef = useRef(false)
  const pendingCreateRef = useRef<Promise<string> | null>(null)
  // Deferred create params — stored by create(), consumed by send()
  const deferredModeRef = useRef<SessionMode>('chat')
  const deferredContextRef = useRef<string | undefined>(undefined)
  const deferredContextFilesRef = useRef<string[] | undefined>(undefined)

  // Per-session message cache — survives session switches so streaming isn't lost
  const cacheRef = useRef<Map<string, ConversationMessage[]>>(new Map())
  // Per-session streaming state
  const streamingSessionsRef = useRef<Set<string>>(new Set())
  const pendingQueueRef = useRef<string[]>([])
  const [pendingQueue, setPendingQueue] = useState<string[]>([])
  const sendRef = useRef<((text: string) => Promise<boolean>) | null>(null)

  // Helper: update cached messages for a given session and sync to React state if active
  const updateSessionMessages = useCallback(
    (sid: string, updater: (prev: ConversationMessage[]) => ConversationMessage[]) => {
      const cache = cacheRef.current
      const prev = cache.get(sid) ?? []
      const next = updater(prev)
      cache.set(sid, next)
      // Only push to React state if this is the active session
      if (sid === sessionIdRef.current) {
        setMessages(next)
      }
    },
    [],
  )

  // Listen to conversation-stream events — process ALL sessions, not just active
  useEffect(() => {
    const unlisten = listen<ConversationStreamPayload>('conversation-stream', (event) => {
      const { session_id: sid, event: evt, data } = event.payload

      switch (evt) {
        case 'turn_start':
          // New LLM turn — push a fresh assistant message so each turn's
          // thinking/text/tools are separate.
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            // Only push if the last message is NOT already an empty assistant
            if (last?.role === 'assistant' && !last.content && !last.blocks?.length) {
              return prev
            }
            return [...prev, { role: 'assistant' as const, content: '', blocks: [] }]
          })
          break
        case 'text_delta':
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? [])]
              const lastBlock = blocks[blocks.length - 1]
              if (lastBlock?.type === 'text') {
                blocks[blocks.length - 1] = { ...lastBlock, content: lastBlock.content + data }
              } else {
                blocks.push({ type: 'text', content: data })
              }
              return [...prev.slice(0, -1), { ...last, content: last.content + data, blocks }]
            }
            return [
              ...prev,
              { role: 'assistant', content: data, blocks: [{ type: 'text', content: data }] },
            ]
          })
          break
        case 'thinking_delta':
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? [])]
              const lastBlock = blocks[blocks.length - 1]
              if (lastBlock?.type === 'thinking') {
                blocks[blocks.length - 1] = { ...lastBlock, content: lastBlock.content + data }
              } else {
                blocks.push({ type: 'thinking', content: data })
              }
              return [
                ...prev.slice(0, -1),
                { ...last, thinking: (last.thinking ?? '') + data, blocks },
              ]
            }
            return [
              ...prev,
              {
                role: 'assistant',
                content: '',
                thinking: data,
                blocks: [{ type: 'thinking', content: data }],
              },
            ]
          })
          break
        case 'tool_start': {
          const info = JSON.parse(data)
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const tools = [...(last.tools ?? []), { name: info.name, label: info.label }]
              const blocks = [
                ...(last.blocks ?? []),
                { type: 'tool' as const, name: info.name, label: info.label },
              ]
              return [...prev.slice(0, -1), { ...last, tools, blocks }]
            }
            // No assistant message yet (model went straight to tool_use) — create one
            return [
              ...prev,
              {
                role: 'assistant' as const,
                content: '',
                tools: [{ name: info.name, label: info.label }],
                blocks: [{ type: 'tool' as const, name: info.name, label: info.label }],
              },
            ]
          })
          break
        }
        case 'tool_end': {
          const info = JSON.parse(data)
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant' && last.tools?.length) {
              const tools = [...last.tools]
              const blocks = [...(last.blocks ?? [])]
              // Update tools array
              let toolIdx = -1
              for (let i = tools.length - 1; i >= 0; i--) {
                if (tools[i].name === info.name && !tools[i].output) {
                  toolIdx = i
                  break
                }
              }
              if (toolIdx >= 0) {
                tools[toolIdx] = { ...tools[toolIdx], output: info.output, isError: info.is_error }
              }
              // Update blocks array
              let blockIdx = -1
              for (let i = blocks.length - 1; i >= 0; i--) {
                const b = blocks[i]
                if (b.type === 'tool' && b.name === info.name && !b.output) {
                  blockIdx = i
                  break
                }
              }
              if (blockIdx >= 0) {
                const tb = blocks[blockIdx]
                if (tb.type === 'tool') {
                  blocks[blockIdx] = { ...tb, output: info.output, isError: info.is_error }
                }
              }
              return [...prev.slice(0, -1), { ...last, tools, blocks }]
            }
            return prev
          })
          break
        }
        case 'web_search_result': {
          const raw = JSON.parse(data)
          // Extract query from search_queries array
          const query = raw.search_queries?.[0]?.query ?? ''
          // Extract results
          const results = (raw.content ?? [])
            .filter((c: { type: string }) => c.type === 'web_search_result')
            .map((c: { url?: string; title?: string; page_age?: string }) => ({
              url: c.url ?? '',
              title: c.title ?? '',
              page_age: c.page_age,
            }))
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? [])]
              // Replace the last tool block (web_search tool_start) with a web_search block
              let replaced = false
              for (let i = blocks.length - 1; i >= 0; i--) {
                const b = blocks[i]
                if (b.type === 'tool' && b.name === 'web_search') {
                  blocks[i] = { type: 'web_search', query, results }
                  replaced = true
                  break
                }
              }
              if (!replaced) {
                blocks.push({ type: 'web_search', query, results })
              }
              // Also remove the web_search entry from tools array
              const tools = (last.tools ?? []).filter((t) => t.name !== 'web_search')
              return [...prev.slice(0, -1), { ...last, tools, blocks }]
            }
            return prev
          })
          break
        }
        case 'done':
          streamingSessionsRef.current.delete(sid)
          if (sid === sessionIdRef.current) {
            setIsStreaming(false)
            isStreamingRef.current = false
            // Flush pending queue — merge all queued messages into one
            if (pendingQueueRef.current.length > 0) {
              const merged = pendingQueueRef.current.join('\n\n')
              pendingQueueRef.current = []
              setPendingQueue([])
              sendRef.current?.(merged)
            }
          }
          break
        case 'error':
          streamingSessionsRef.current.delete(sid)
          if (sid === sessionIdRef.current) {
            setIsStreaming(false)
            isStreamingRef.current = false
          }
          updateSessionMessages(sid, (prev) => {
            // Parse structured error JSON, fallback to plain text
            let errorBlock: { type: 'error'; code: string; message: string; retryable: boolean }
            try {
              const parsed = JSON.parse(data)
              errorBlock = {
                type: 'error' as const,
                code: parsed.code ?? 'unknown',
                message: parsed.message ?? data,
                retryable: parsed.retryable ?? false,
              }
            } catch {
              errorBlock = {
                type: 'error' as const,
                code: 'unknown',
                message: data,
                retryable: false,
              }
            }
            // Don't show cancelled errors
            if (errorBlock.code === 'cancelled') return prev
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? []), errorBlock]
              return [...prev.slice(0, -1), { ...last, blocks }]
            }
            return [
              ...prev,
              {
                role: 'assistant' as const,
                content: '',
                blocks: [errorBlock],
              },
            ]
          })
          break
        case 'truncated':
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? []), { type: 'truncated' as const }]
              return [...prev.slice(0, -1), { ...last, blocks }]
            }
            return prev
          })
          break
        case 'title':
          if (sid === sessionIdRef.current) {
            setTitle(data)
          }
          break
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [updateSessionMessages])

  const create = useCallback((mode: SessionMode, context?: string, contextFiles?: string[]) => {
    // Pure UI reset — no IPC. Real session is created lazily on first send().
    sessionIdRef.current = null
    setSessionId(null)
    setMessages([])
    setIsStreaming(false)
    isStreamingRef.current = false
    setTitle(null)
    pendingCreateRef.current = null
    deferredModeRef.current = mode
    deferredContextRef.current = context
    deferredContextFilesRef.current = contextFiles
  }, [])

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      // If streaming, queue the message instead of sending
      if (isStreamingRef.current && streamingSessionsRef.current.has(sessionIdRef.current ?? '')) {
        pendingQueueRef.current = [...pendingQueueRef.current, text]
        setPendingQueue([...pendingQueueRef.current])
        return true
      }

      // Optimistic UI — show user message and streaming state immediately
      const userMsg: ConversationMessage = { role: 'user' as const, content: text }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)
      isStreamingRef.current = true

      // Lazy session creation — first message triggers the real IPC create
      if (!sessionIdRef.current && !pendingCreateRef.current) {
        const p = conversationCreate(
          deferredModeRef.current,
          deferredContextRef.current,
          deferredContextFilesRef.current,
        ).then((id) => {
          sessionIdRef.current = id
          setSessionId(id)
          const current = [userMsg]
          cacheRef.current.set(id, current)
          pendingCreateRef.current = null
          return id
        })
        pendingCreateRef.current = p
      }
      if (!sessionIdRef.current && pendingCreateRef.current) {
        await pendingCreateRef.current
      }
      if (!sessionIdRef.current) {
        setIsStreaming(false)
        isStreamingRef.current = false
        return false
      }
      const sid = sessionIdRef.current
      if (!pendingCreateRef.current) {
        updateSessionMessages(sid, (prev) => {
          if (prev[prev.length - 1]?.content === text && prev[prev.length - 1]?.role === 'user')
            return prev
          return [...prev, userMsg]
        })
      }
      streamingSessionsRef.current.add(sid)
      try {
        await conversationSend(sid, text)
        return true
      } catch (e) {
        console.error('[conversation] send failed:', e)
        setIsStreaming(false)
        isStreamingRef.current = false
        streamingSessionsRef.current.delete(sid)
        updateSessionMessages(sid, (prev) => [
          ...prev,
          {
            role: 'assistant' as const,
            content: '',
            blocks: [
              {
                type: 'error' as const,
                code: 'network_error',
                message: `${e}`,
                retryable: true,
              },
            ],
          },
        ])
        return false
      }
    },
    [updateSessionMessages],
  )

  sendRef.current = send

  const retry = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    // Remove error/truncated blocks from the last assistant message
    updateSessionMessages(sid, (prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') {
        return prev.slice(0, -1)
      }
      return prev
    })
    setIsStreaming(true)
    isStreamingRef.current = true
    streamingSessionsRef.current.add(sid)
    try {
      await conversationRetry(sid)
    } catch (e) {
      console.error('[conversation] retry failed:', e)
      setIsStreaming(false)
      isStreamingRef.current = false
      streamingSessionsRef.current.delete(sid)
      updateSessionMessages(sid, (prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: '',
          blocks: [
            {
              type: 'error' as const,
              code: 'network_error',
              message: `${e}`,
              retryable: true,
            },
          ],
        },
      ])
    }
  }, [updateSessionMessages])

  const cancel = useCallback(async () => {
    if (!sessionIdRef.current) return
    await conversationCancel(sessionIdRef.current)
    setIsStreaming(false)
  }, [])

  const close = useCallback(async () => {
    if (sessionIdRef.current) {
      cacheRef.current.delete(sessionIdRef.current)
      streamingSessionsRef.current.delete(sessionIdRef.current)
      await conversationClose(sessionIdRef.current)
    }
    sessionIdRef.current = null
    setSessionId(null)
    setMessages([])
    setIsStreaming(false)
  }, [])

  const load = useCallback(async (id: string, streaming?: boolean, initialUserMessage?: string) => {
    // If we have a cached version (e.g. from ongoing stream), use it directly
    const cached = cacheRef.current.get(id)
    if (cached) {
      sessionIdRef.current = id
      setSessionId(id)
      const isStillStreaming = streaming ?? streamingSessionsRef.current.has(id)
      setIsStreaming(isStillStreaming)
      isStreamingRef.current = isStillStreaming
      // Seed user message if cache is empty (race: event fires before send)
      if (cached.length === 0 && initialUserMessage) {
        const seeded: ConversationMessage[] = [{ role: 'user', content: initialUserMessage }]
        cacheRef.current.set(id, seeded)
        setMessages(seeded)
      } else {
        setMessages(cached)
      }
      setTitle(null)
      return
    }

    // No cache — load from Rust (persisted session)
    const loaded = await conversationGetMessages(id)
    sessionIdRef.current = id
    setSessionId(id)
    setIsStreaming(!!streaming)
    isStreamingRef.current = !!streaming
    // If backend has no messages yet (race: event fires before send), seed user message
    if (loaded.length === 0 && initialUserMessage) {
      const seeded: ConversationMessage[] = [{ role: 'user', content: initialUserMessage }]
      cacheRef.current.set(id, seeded)
      setMessages(seeded)
      setTitle(null)
      return
    }
    // Convert LoadedMessage[] to ConversationMessage[]
    const msgs: ConversationMessage[] = loaded.map((m) => {
      const msg: ConversationMessage = {
        role: m.role as 'user' | 'assistant',
        content: m.content,
        thinking: m.thinking ?? undefined,
      }
      if (m.tools?.length) {
        msg.tools = m.tools.map((t) => ({
          name: t.name,
          label: t.label,
          output: t.output ?? undefined,
          isError: t.is_error ?? false,
        }))
      }
      // Build blocks for assistant messages
      if (msg.role === 'assistant') {
        const blocks: ConversationMessage['blocks'] = []
        if (msg.thinking) blocks.push({ type: 'thinking', content: msg.thinking })
        if (msg.content) blocks.push({ type: 'text', content: msg.content })
        if (msg.tools) {
          for (const t of msg.tools) {
            if (t.name === 'web_search') {
              // Parse persisted web_search results from output JSON
              let query = ''
              let results: { url: string; title: string; page_age?: string }[] = []
              if (t.output) {
                try {
                  const raw = JSON.parse(t.output)
                  query = raw.search_queries?.[0]?.query ?? ''
                  results = (raw.content ?? [])
                    .filter((c: { type: string }) => c.type === 'web_search_result')
                    .map((c: { url?: string; title?: string; page_age?: string }) => ({
                      url: c.url ?? '',
                      title: c.title ?? '',
                      page_age: c.page_age,
                    }))
                } catch {
                  /* ignore parse errors */
                }
              }
              if (!query && t.label !== 'web_search') query = t.label.replace(/^搜索: /, '')
              blocks.push({ type: 'web_search', query, results })
            } else {
              blocks.push({
                type: 'tool',
                name: t.name,
                label: t.label,
                output: t.output,
                isError: t.isError,
              })
            }
          }
        }
        msg.blocks = blocks
      }
      return msg
    })
    setMessages(msgs)
    cacheRef.current.set(id, msgs)
    setTitle(null)
  }, [])

  const editAndResend = useCallback(
    async (messageIndex: number, newText: string) => {
      const sid = sessionIdRef.current
      if (!sid) return
      // Truncate backend messages to keep only messages before this user message
      await conversationTruncate(sid, messageIndex)
      // Truncate frontend messages
      const kept = (cacheRef.current.get(sid) ?? []).slice(0, messageIndex)
      cacheRef.current.set(sid, kept)
      setMessages(kept)
      // Re-send with new text
      await send(newText)
    },
    [send],
  )

  return {
    sessionId,
    messages,
    isStreaming,
    title,
    pendingQueue,
    create,
    send,
    retry,
    cancel,
    close,
    load,
    editAndResend,
  }
}
