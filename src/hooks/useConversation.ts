import { useState, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { ConversationMessage, ConversationStreamPayload } from '../types'
import type { ImageAttachment } from '../lib/tauri'
import {
  conversationCreate,
  conversationSend,
  conversationCancel,
  conversationClose,
  conversationGetMessages,
  conversationTruncate,
  conversationRetry,
  conversationGetStats,
} from '../lib/tauri'
import type { SessionStats } from '../lib/tauri'
import { useEventCallback } from './useEventCallback'

// Module-level singletons — survive ConversationDialog remounts (key changes)
const globalCache = new Map<string, ConversationMessage[]>()
const globalStreamingSessions = new Set<string>()
const globalPendingQueue = new Map<string, string[]>()
const globalUsage = new Map<string, { input: number; output: number }>()

export function useConversation() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [title, setTitle] = useState<string | null>(null)
  const [usage, setUsage] = useState<{ input: number; output: number }>({ input: 0, output: 0 })
  const [stats, setStats] = useState<SessionStats | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const isStreamingRef = useRef(false)
  const pendingCreateRef = useRef<Promise<string> | null>(null)
  // Deferred create params — stored by create(), consumed by send()
  const deferredContextRef = useRef<string | undefined>(undefined)
  const deferredContextFilesRef = useRef<string[] | undefined>(undefined)

  const [pendingQueue, setPendingQueue] = useState<string[]>([])

  const getQueue = useEventCallback((sid: string): string[] => {
    return globalPendingQueue.get(sid) ?? []
  })

  const setQueue = useEventCallback((sid: string, queue: string[]) => {
    if (queue.length === 0) {
      globalPendingQueue.delete(sid)
    } else {
      globalPendingQueue.set(sid, queue)
    }
    if (sid === sessionIdRef.current) {
      setPendingQueue(queue)
    }
  })

  const updateSessionMessages = useEventCallback(
    (sid: string, updater: (prev: ConversationMessage[]) => ConversationMessage[]) => {
      const cache = globalCache
      const prev = cache.get(sid) ?? []
      const next = updater(prev)
      cache.set(sid, next)
      if (sid === sessionIdRef.current) {
        setMessages(next)
      }
    },
  )

  // Listen to conversation-stream events — process ALL sessions, not just active
  useEffect(() => {
    const unlisten = listen<ConversationStreamPayload>('conversation-stream', (event) => {
      const { session_id: sid, event: evt, data, span_id, parent_span_id } = event.payload
      void span_id
      void parent_span_id

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
          const toolInput = info.input as Record<string, unknown> | undefined
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const tools = [...(last.tools ?? []), { name: info.name, label: info.label }]
              const blocks = [
                ...(last.blocks ?? []),
                { type: 'tool' as const, name: info.name, label: info.label, input: toolInput },
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
                blocks: [
                  { type: 'tool' as const, name: info.name, label: info.label, input: toolInput },
                ],
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
          globalStreamingSessions.delete(sid)
          if (sid === sessionIdRef.current) {
            setIsStreaming(false)
            isStreamingRef.current = false
            if (data) {
              try {
                const s = JSON.parse(data)
                setStats({
                  elapsed_secs: s.elapsed_secs ?? 0,
                  total_input_tokens: s.total_input_tokens ?? 0,
                  total_output_tokens: s.total_output_tokens ?? 0,
                })
              } catch {
                /* backward compat */
              }
            }
          }
          // Flush pending queue for this session — send directly to sid,
          // not via send() which would use sessionIdRef.current (possibly wrong session)
          {
            const queue = getQueue(sid)
            if (queue.length > 0) {
              const merged = queue.join('\n\n')
              setQueue(sid, [])
              globalStreamingSessions.add(sid)
              if (sid === sessionIdRef.current) {
                setIsStreaming(true)
                isStreamingRef.current = true
              }
              updateSessionMessages(sid, (prev) => [
                ...prev,
                { role: 'user' as const, content: merged },
              ])
              conversationSend(sid, merged).catch((e) => {
                console.error('[conversation] queue flush failed:', e)
                globalStreamingSessions.delete(sid)
                if (sid === sessionIdRef.current) {
                  setIsStreaming(false)
                  isStreamingRef.current = false
                }
              })
            }
          }
          break
        case 'error':
          globalStreamingSessions.delete(sid)
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
        case 'loop_warning':
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            const warningBlock = { type: 'loop_warning' as const, message: data }
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? []), warningBlock]
              return [...prev.slice(0, -1), { ...last, blocks }]
            }
            return [...prev, { role: 'assistant' as const, content: '', blocks: [warningBlock] }]
          })
          break
        case 'subtask_start': {
          const info = JSON.parse(data)
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [
                ...(last.blocks ?? []),
                {
                  type: 'subtask' as const,
                  toolUseId: info.tool_use_id,
                  prompt: info.prompt,
                  isRunning: true,
                },
              ]
              return [...prev.slice(0, -1), { ...last, blocks }]
            }
            return prev
          })
          break
        }
        case 'subtask_delta': {
          const info = JSON.parse(data)
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? [])]
              for (let i = blocks.length - 1; i >= 0; i--) {
                const b = blocks[i]
                if (b.type === 'subtask' && b.toolUseId === info.tool_use_id) {
                  if (info.text) {
                    blocks[i] = { ...b, summary: (b.summary ?? '') + info.text }
                  }
                  if (info.tool_start) {
                    const tools = [
                      ...(b.tools ?? []),
                      { name: info.tool_start.name, label: info.tool_start.label },
                    ]
                    blocks[i] = { ...b, tools }
                  }
                  if (info.tool_end) {
                    const tools = [...(b.tools ?? [])]
                    for (let j = tools.length - 1; j >= 0; j--) {
                      if (tools[j].name === info.tool_end.name && tools[j].output === undefined) {
                        tools[j] = {
                          ...tools[j],
                          output: info.tool_end.output,
                          isError: info.tool_end.is_error,
                        }
                        break
                      }
                    }
                    blocks[i] = { ...b, tools }
                  }
                  break
                }
              }
              return [...prev.slice(0, -1), { ...last, blocks }]
            }
            return prev
          })
          break
        }
        case 'subtask_end': {
          const info = JSON.parse(data)
          updateSessionMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? [])]
              for (let i = blocks.length - 1; i >= 0; i--) {
                const b = blocks[i]
                if (b.type === 'subtask' && b.toolUseId === info.tool_use_id) {
                  blocks[i] = { ...b, isRunning: false, isError: info.is_error }
                  break
                }
              }
              return [...prev.slice(0, -1), { ...last, blocks }]
            }
            return prev
          })
          break
        }
        case 'title':
          if (sid === sessionIdRef.current) {
            setTitle(data)
          }
          break
        case 'usage': {
          try {
            const u = JSON.parse(data)
            const input = u.input_tokens ?? 0
            const output = u.output_tokens ?? 0
            const prev = globalUsage.get(sid) ?? { input: 0, output: 0 }
            const next = { input: prev.input + input, output: prev.output + output }
            globalUsage.set(sid, next)
            if (sid === sessionIdRef.current) {
              setUsage({ ...next })
            }
          } catch {
            /* ignore */
          }
          break
        }
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [updateSessionMessages, getQueue, setQueue])

  const create = useEventCallback((context?: string, contextFiles?: string[]) => {
    sessionIdRef.current = null
    setSessionId(null)
    setMessages([])
    setIsStreaming(false)
    isStreamingRef.current = false
    setTitle(null)
    setPendingQueue([])
    setUsage({ input: 0, output: 0 })
    setStats(null)
    pendingCreateRef.current = null
    deferredContextRef.current = context
    deferredContextFilesRef.current = contextFiles
  })

  const send = useEventCallback(
    async (text: string, images?: ImageAttachment[]): Promise<boolean> => {
      const currentSid = sessionIdRef.current
      // If streaming, queue the message for this session
      if (isStreamingRef.current && globalStreamingSessions.has(currentSid ?? '')) {
        if (currentSid) {
          const queue = [...getQueue(currentSid), text]
          setQueue(currentSid, queue)
        }
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
          deferredContextRef.current,
          deferredContextFilesRef.current,
        ).then((id) => {
          sessionIdRef.current = id
          setSessionId(id)
          const current = [userMsg]
          globalCache.set(id, current)
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
      globalStreamingSessions.add(sid)
      try {
        await conversationSend(sid, text, images)
        return true
      } catch (e) {
        console.error('[conversation] send failed:', e)
        setIsStreaming(false)
        isStreamingRef.current = false
        globalStreamingSessions.delete(sid)
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
  )

  const retry = useEventCallback(async () => {
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
    globalStreamingSessions.add(sid)
    try {
      await conversationRetry(sid)
    } catch (e) {
      console.error('[conversation] retry failed:', e)
      setIsStreaming(false)
      isStreamingRef.current = false
      globalStreamingSessions.delete(sid)
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
  })

  const cancel = useEventCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    await conversationCancel(sid)
    globalStreamingSessions.delete(sid)
    setIsStreaming(false)
    isStreamingRef.current = false
    setQueue(sid, [])
  })

  const removePendingItem = useEventCallback((index: number): string | undefined => {
    const sid = sessionIdRef.current
    if (!sid) return undefined
    const queue = getQueue(sid)
    if (index < 0 || index >= queue.length) return undefined
    const removed = queue[index]
    setQueue(sid, [...queue.slice(0, index), ...queue.slice(index + 1)])
    return removed
  })

  const close = useEventCallback(async () => {
    if (sessionIdRef.current) {
      globalCache.delete(sessionIdRef.current)
      globalStreamingSessions.delete(sessionIdRef.current)
      globalPendingQueue.delete(sessionIdRef.current)
      globalUsage.delete(sessionIdRef.current)
      await conversationClose(sessionIdRef.current)
    }
    sessionIdRef.current = null
    setSessionId(null)
    setMessages([])
    setIsStreaming(false)
    isStreamingRef.current = false
    setPendingQueue([])
  })

  const newSession = useEventCallback(() => {
    close()
    create()
  })

  const load = useEventCallback(
    async (id: string, streaming?: boolean, initialUserMessage?: string) => {
      // If we have a cached version (e.g. from ongoing stream), use it directly
      const cached = globalCache.get(id)
      if (cached) {
        sessionIdRef.current = id
        setSessionId(id)
        const isStillStreaming = streaming ?? globalStreamingSessions.has(id)
        setIsStreaming(isStillStreaming)
        isStreamingRef.current = isStillStreaming
        // Sync pending queue for this session
        setPendingQueue(globalPendingQueue.get(id) ?? [])
        // Seed user message if cache is empty (race: event fires before send)
        if (cached.length === 0 && initialUserMessage) {
          const seeded: ConversationMessage[] = [{ role: 'user', content: initialUserMessage }]
          globalCache.set(id, seeded)
          setMessages(seeded)
        } else {
          setMessages(cached)
        }
        setTitle(null)
        setUsage(globalUsage.get(id) ?? { input: 0, output: 0 })
        conversationGetStats(id)
          .then((s) => setStats(s))
          .catch(() => setStats(null))
        return
      }

      // No cache — load from Rust (persisted session)
      const loaded = await conversationGetMessages(id)
      sessionIdRef.current = id
      setSessionId(id)
      const isStillStreaming = !!streaming
      setIsStreaming(isStillStreaming)
      isStreamingRef.current = isStillStreaming
      if (isStillStreaming) {
        globalStreamingSessions.add(id)
      }
      // No pending queue for persisted sessions
      setPendingQueue([])
      setUsage(globalUsage.get(id) ?? { input: 0, output: 0 })
      conversationGetStats(id)
        .then((s) => setStats(s))
        .catch(() => setStats(null))
      // If backend has no messages yet (race: event fires before send), seed user message
      if (loaded.length === 0 && initialUserMessage) {
        const seeded: ConversationMessage[] = [{ role: 'user', content: initialUserMessage }]
        globalCache.set(id, seeded)
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
              } else if (t.name === 'task') {
                // Reconstruct subtask block from persisted JSON output
                const prompt = t.label.replace(/^task: /, '')
                let summary: string | undefined
                let tools:
                  | { name: string; label: string; output?: string; isError?: boolean }[]
                  | undefined
                if (t.output) {
                  try {
                    const parsed = JSON.parse(t.output)
                    summary = parsed.summary
                    if (Array.isArray(parsed.tools)) {
                      tools = parsed.tools.map(
                        (pt: {
                          name?: string
                          label?: string
                          output?: string
                          is_error?: boolean
                        }) => ({
                          name: pt.name ?? '',
                          label: pt.label ?? pt.name ?? '',
                          output: pt.output ?? undefined,
                          isError: pt.is_error ?? false,
                        }),
                      )
                    }
                  } catch {
                    summary = t.output
                  }
                }
                blocks.push({
                  type: 'subtask',
                  toolUseId: `persisted-${blocks.length}`,
                  prompt,
                  summary,
                  tools,
                  isError: t.isError,
                  isRunning: false,
                })
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
      globalCache.set(id, msgs)
      setTitle(null)
    },
  )

  const editAndResend = useEventCallback(async (messageIndex: number, newText: string) => {
    const sid = sessionIdRef.current
    if (!sid) return
    await conversationTruncate(sid, messageIndex)
    const kept = (globalCache.get(sid) ?? []).slice(0, messageIndex)
    globalCache.set(sid, kept)
    setMessages(kept)
    await send(newText)
  })

  return {
    sessionId,
    messages,
    isStreaming,
    title,
    usage,
    stats,
    pendingQueue,
    create,
    send,
    retry,
    cancel,
    removePendingItem,
    close,
    newSession,
    load,
    editAndResend,
  }
}
