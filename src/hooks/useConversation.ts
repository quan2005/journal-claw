import { useState, useEffect, useRef, useCallback } from 'react'
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

// ── Module-level singletons — shared across all hook instances ──
const globalCache = new Map<string, ConversationMessage[]>()
const globalStreamingSessions = new Set<string>()
const globalPendingQueue = new Map<string, string[]>()
const globalUsage = new Map<string, { input: number; output: number }>()
const globalStats = new Map<string, SessionStats>()

// ── Session tab state ────────────────────────────────────

export interface SessionTabState {
  sessionId: string
  messages: ConversationMessage[]
  isStreaming: boolean
  title: string | null
  usage: { input: number; output: number }
  stats: SessionStats | null
  pendingQueue: string[]
}

export function useConversation() {
  // ── Tab state ──────────────────────────────────────────
  const [tabs, setTabs] = useState<SessionTabState[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const tabsRef = useRef<SessionTabState[]>([])
  const activeTabIdRef = useRef<string | null>(null)

  // Keep refs in sync
  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])
  useEffect(() => {
    activeTabIdRef.current = activeTabId
  }, [activeTabId])

  // ── Derived: active tab ────────────────────────────────
  const activeTab = tabs.find((t) => t.sessionId === activeTabId) ?? null

  // ── Helpers ─────────────────────────────────────────────

  /** Build a fresh SessionTabState from module-level caches */
  const buildTabState = useCallback((sid: string): SessionTabState => {
    return {
      sessionId: sid,
      messages: globalCache.get(sid) ?? [],
      isStreaming: globalStreamingSessions.has(sid),
      title: null,
      usage: globalUsage.get(sid) ?? { input: 0, output: 0 },
      stats: globalStats.get(sid) ?? null,
      pendingQueue: globalPendingQueue.get(sid) ?? [],
    }
  }, [])

  /** Sync a single tab's React state from module-level caches */
  const syncTabState = useCallback((sid: string) => {
    const fresh = {
      messages: globalCache.get(sid) ?? [],
      isStreaming: globalStreamingSessions.has(sid),
      usage: globalUsage.get(sid) ?? { input: 0, output: 0 },
      stats: globalStats.get(sid) ?? null,
      pendingQueue: globalPendingQueue.get(sid) ?? [],
    }
    setTabs((prev) => prev.map((t) => (t.sessionId === sid ? { ...t, ...fresh } : t)))
  }, [])

  /** Update a tab's messages in both global cache and React state */
  const updateTabMessages = useCallback(
    (sid: string, updater: (prev: ConversationMessage[]) => ConversationMessage[]) => {
      const prev = globalCache.get(sid) ?? []
      const next = updater(prev)
      globalCache.set(sid, next)
      // Sync React state
      setTabs((prevTabs) =>
        prevTabs.map((t) => (t.sessionId === sid ? { ...t, messages: next } : t)),
      )
    },
    [],
  )

  /** Set streaming state for a session (global + React) */
  const setTabStreaming = useCallback((sid: string, streaming: boolean) => {
    if (streaming) {
      globalStreamingSessions.add(sid)
    } else {
      globalStreamingSessions.delete(sid)
    }
    setTabs((prev) => prev.map((t) => (t.sessionId === sid ? { ...t, isStreaming: streaming } : t)))
  }, [])

  /** Set title for a session */
  const setTabTitle = useCallback((sid: string, title: string) => {
    setTabs((prev) => prev.map((t) => (t.sessionId === sid ? { ...t, title } : t)))
  }, [])

  /** Set usage for a session */
  const setTabUsage = useCallback((sid: string, usage: { input: number; output: number }) => {
    globalUsage.set(sid, usage)
    setTabs((prev) => prev.map((t) => (t.sessionId === sid ? { ...t, usage } : t)))
  }, [])

  /** Set stats for a session */
  const setTabStats = useCallback((sid: string, stats: SessionStats | null) => {
    if (stats) globalStats.set(sid, stats)
    setTabs((prev) => prev.map((t) => (t.sessionId === sid ? { ...t, stats } : t)))
  }, [])

  /** Set pending queue for a session */
  const setTabPendingQueue = useCallback((sid: string, queue: string[]) => {
    if (queue.length === 0) {
      globalPendingQueue.delete(sid)
    } else {
      globalPendingQueue.set(sid, queue)
    }
    setTabs((prev) => prev.map((t) => (t.sessionId === sid ? { ...t, pendingQueue: queue } : t)))
  }, [])

  // ── Event listener — processes ALL sessions ────────────
  useEffect(() => {
    const unlisten = listen<ConversationStreamPayload>('conversation-stream', (event) => {
      const { session_id: sid, event: evt, data } = event.payload

      switch (evt) {
        case 'turn_start':
          updateTabMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant' && !last.content && !last.blocks?.length) {
              return prev
            }
            return [...prev, { role: 'assistant' as const, content: '', blocks: [] }]
          })
          break

        case 'text_delta':
          updateTabMessages(sid, (prev) => {
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
          updateTabMessages(sid, (prev) => {
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
          updateTabMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const tools = [...(last.tools ?? []), { name: info.name, label: info.label }]
              const blocks = [
                ...(last.blocks ?? []),
                { type: 'tool' as const, name: info.name, label: info.label, input: toolInput },
              ]
              return [...prev.slice(0, -1), { ...last, tools, blocks }]
            }
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
          updateTabMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant' && last.tools?.length) {
              const tools = [...last.tools]
              const blocks = [...(last.blocks ?? [])]
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
          const query = raw.search_queries?.[0]?.query ?? ''
          const results = (raw.content ?? [])
            .filter((c: { type: string }) => c.type === 'web_search_result')
            .map((c: { url?: string; title?: string; page_age?: string }) => ({
              url: c.url ?? '',
              title: c.title ?? '',
              page_age: c.page_age,
            }))
          updateTabMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? [])]
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
              const tools = (last.tools ?? []).filter((t) => t.name !== 'web_search')
              return [...prev.slice(0, -1), { ...last, tools, blocks }]
            }
            return prev
          })
          break
        }

        case 'done':
          setTabStreaming(sid, false)
          if (data) {
            try {
              const s = JSON.parse(data)
              setTabStats(sid, {
                elapsed_secs: s.elapsed_secs ?? 0,
                total_input_tokens: s.total_input_tokens ?? 0,
                total_output_tokens: s.total_output_tokens ?? 0,
              })
            } catch {
              /* backward compat */
            }
          }
          // Flush pending queue for this session
          {
            const queue = globalPendingQueue.get(sid) ?? []
            if (queue.length > 0) {
              const merged = queue.join('\n\n')
              setTabPendingQueue(sid, [])
              setTabStreaming(sid, true)
              updateTabMessages(sid, (prev) => [
                ...prev,
                { role: 'user' as const, content: merged },
              ])
              conversationSend(sid, merged).catch((e) => {
                console.error('[conversation] queue flush failed:', e)
                setTabStreaming(sid, false)
              })
            }
          }
          break

        case 'error':
          setTabStreaming(sid, false)
          updateTabMessages(sid, (prev) => {
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
          updateTabMessages(sid, (prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              const blocks = [...(last.blocks ?? []), { type: 'truncated' as const }]
              return [...prev.slice(0, -1), { ...last, blocks }]
            }
            return prev
          })
          break

        case 'loop_warning':
          updateTabMessages(sid, (prev) => {
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
          updateTabMessages(sid, (prev) => {
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
          updateTabMessages(sid, (prev) => {
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
          updateTabMessages(sid, (prev) => {
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
          setTabTitle(sid, data)
          break

        case 'usage': {
          try {
            const u = JSON.parse(data)
            const input = u.input_tokens ?? 0
            const output = u.output_tokens ?? 0
            const prev = globalUsage.get(sid) ?? { input: 0, output: 0 }
            const next = { input: prev.input + input, output: prev.output + output }
            setTabUsage(sid, next)
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
  }, [
    updateTabMessages,
    setTabStreaming,
    setTabTitle,
    setTabUsage,
    setTabStats,
    setTabPendingQueue,
  ])

  // ── Tab management ──────────────────────────────────────

  /** Open an existing session as a new tab (or focus if already open) */
  const openTab = useEventCallback(
    async (id: string, initialUserMessage?: string): Promise<void> => {
      // If already open, just switch
      const existing = tabsRef.current.find((t) => t.sessionId === id)
      if (existing) {
        setActiveTabId(id)
        activeTabIdRef.current = id
        return
      }

      // Create tab state from cache or scratch
      let tabState = buildTabState(id)

      // If no messages in cache, try to load from disk
      if (tabState.messages.length === 0) {
        try {
          const loaded = await conversationGetMessages(id)
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
            if (msg.role === 'assistant') {
              const blocks: ConversationMessage['blocks'] = []
              if (msg.thinking) blocks.push({ type: 'thinking', content: msg.thinking })
              if (msg.content) blocks.push({ type: 'text', content: msg.content })
              if (msg.tools) {
                for (const t of msg.tools) {
                  if (t.name === 'web_search') {
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
                        /* ignore */
                      }
                    }
                    if (!query && t.label !== 'web_search') query = t.label.replace(/^搜索: /, '')
                    blocks.push({ type: 'web_search', query, results })
                  } else if (t.name === 'task') {
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

          // Seed with initial user message if provided and cache was empty
          if (msgs.length === 0 && initialUserMessage) {
            const seeded: ConversationMessage[] = [{ role: 'user', content: initialUserMessage }]
            globalCache.set(id, seeded)
            tabState = { ...tabState, messages: seeded }
          } else {
            globalCache.set(id, msgs)
            tabState = { ...tabState, messages: msgs }
          }
        } catch {
          // If it fails, proceed with empty state
          if (initialUserMessage) {
            const seeded: ConversationMessage[] = [{ role: 'user', content: initialUserMessage }]
            globalCache.set(id, seeded)
            tabState = { ...tabState, messages: seeded }
          }
        }
      }

      // Load stats
      conversationGetStats(id)
        .then((s) => setTabStats(id, s))
        .catch(() => {})

      setTabs((prev) => [...prev.filter((t) => t.sessionId !== id), tabState])
      setActiveTabId(id)
      activeTabIdRef.current = id
    },
  )

  /** Switch to an existing tab */
  const switchTab = useEventCallback((id: string) => {
    setActiveTabId(id)
    activeTabIdRef.current = id
  })

  /** Close a tab (cancel any streaming, clean up) */
  const closeTab = useEventCallback(async (id: string) => {
    // Cancel any in-flight request
    try {
      await conversationCancel(id)
    } catch {
      /* ignore */
    }
    // Close session on backend
    try {
      await conversationClose(id)
    } catch {
      /* ignore */
    }

    // Clean up module-level caches
    globalCache.delete(id)
    globalStreamingSessions.delete(id)
    globalPendingQueue.delete(id)
    globalUsage.delete(id)
    globalStats.delete(id)

    // Remove from tabs
    setTabs((prev) => {
      const next = prev.filter((t) => t.sessionId !== id)
      // If closing active tab, switch to the last remaining tab
      if (id === activeTabIdRef.current) {
        const newActive = next.length > 0 ? next[next.length - 1].sessionId : null
        setActiveTabId(newActive)
        activeTabIdRef.current = newActive
      }
      return next
    })
  })

  /** Create a new session and open it as a tab */
  const createTab = useEventCallback(
    async (context?: string, contextFiles?: string[]): Promise<string | null> => {
      try {
        const id = await conversationCreate(context, contextFiles)
        const tabState = buildTabState(id)
        setTabs((prev) => [...prev, tabState])
        setActiveTabId(id)
        activeTabIdRef.current = id
        return id
      } catch (e) {
        console.error('[conversation] create failed:', e)
        return null
      }
    },
  )

  /** Create a new blank tab (Cmd+N) — deferred creation, tab placeholder */
  const newTab = useEventCallback(() => {
    // Create a placeholder tab that will get its real ID on first send
    const placeholderId = `new_${Date.now().toString(36)}`
    const tabState: SessionTabState = {
      sessionId: placeholderId,
      messages: [],
      isStreaming: false,
      title: null,
      usage: { input: 0, output: 0 },
      stats: null,
      pendingQueue: [],
    }
    setTabs((prev) => [...prev, tabState])
    setActiveTabId(placeholderId)
    activeTabIdRef.current = placeholderId
    return placeholderId
  })

  // ── Active tab operations ──────────────────────────────

  /** Deferred create tracking */
  const pendingCreateRef = useRef<Map<string, Promise<string>>>(new Map())
  const deferredContextRef = useRef<Map<string, { context?: string; contextFiles?: string[] }>>(
    new Map(),
  )

  const send = useEventCallback(
    async (text: string, images?: ImageAttachment[]): Promise<boolean> => {
      let sid = activeTabIdRef.current

      // Auto-create a tab if none exists
      if (!sid) {
        const placeholderId = `new_${Date.now().toString(36)}`
        const tabState: SessionTabState = {
          sessionId: placeholderId,
          messages: [],
          isStreaming: false,
          title: null,
          usage: { input: 0, output: 0 },
          stats: null,
          pendingQueue: [],
        }
        setTabs([tabState])
        setActiveTabId(placeholderId)
        activeTabIdRef.current = placeholderId
        sid = placeholderId
      }

      // If streaming, queue the message
      if (globalStreamingSessions.has(sid)) {
        const queue = [...(globalPendingQueue.get(sid) ?? []), text]
        setTabPendingQueue(sid, queue)
        return true
      }

      // Optimistic UI
      const userMsg: ConversationMessage = { role: 'user' as const, content: text }
      updateTabMessages(sid, (prev) => [...prev, userMsg])
      setTabStreaming(sid, true)

      // Handle placeholder tabs (Cmd+N creates a tab without backend session)
      let realSid = sid
      if (sid.startsWith('new_')) {
        const createPromise =
          pendingCreateRef.current.get(sid) ??
          conversationCreate(
            deferredContextRef.current.get(sid)?.context,
            deferredContextRef.current.get(sid)?.contextFiles,
          )
        if (!pendingCreateRef.current.has(sid)) {
          pendingCreateRef.current.set(sid, createPromise)
        }

        try {
          realSid = await createPromise
          pendingCreateRef.current.delete(sid)
          deferredContextRef.current.delete(sid)

          // Migrate the tab from placeholder to real ID
          const cached = globalCache.get(sid) ?? []
          globalCache.delete(sid)
          globalCache.set(realSid, cached)
          globalStreamingSessions.delete(sid)
          globalStreamingSessions.add(realSid)

          setTabs((prev) =>
            prev.map((t) =>
              t.sessionId === sid ? { ...t, sessionId: realSid, isStreaming: true } : t,
            ),
          )
          if (activeTabIdRef.current === sid) {
            setActiveTabId(realSid)
            activeTabIdRef.current = realSid
          }
        } catch (e) {
          console.error('[conversation] deferred create failed:', e)
          setTabStreaming(sid, false)
          updateTabMessages(sid, (prev) => [
            ...prev,
            {
              role: 'assistant' as const,
              content: '',
              blocks: [
                {
                  type: 'error' as const,
                  code: 'create_error',
                  message: `${e}`,
                  retryable: false,
                },
              ],
            },
          ])
          return false
        }
      }

      try {
        await conversationSend(realSid, text, images)
        return true
      } catch (e) {
        console.error('[conversation] send failed:', e)
        setTabStreaming(realSid, false)
        updateTabMessages(realSid, (prev) => [
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
    const sid = activeTabIdRef.current
    if (!sid) return
    // Remove error/truncated blocks from the last assistant message
    updateTabMessages(sid, (prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') {
        return prev.slice(0, -1)
      }
      return prev
    })
    setTabStreaming(sid, true)
    try {
      await conversationRetry(sid)
    } catch (e) {
      console.error('[conversation] retry failed:', e)
      setTabStreaming(sid, false)
      updateTabMessages(sid, (prev) => [
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
    const sid = activeTabIdRef.current
    if (!sid) return
    try {
      await conversationCancel(sid)
    } catch {
      /* ignore */
    }
    setTabStreaming(sid, false)
    setTabPendingQueue(sid, [])
  })

  const removePendingItem = useEventCallback((index: number): string | undefined => {
    const sid = activeTabIdRef.current
    if (!sid) return undefined
    const queue = globalPendingQueue.get(sid) ?? []
    if (index < 0 || index >= queue.length) return undefined
    const removed = queue[index]
    setTabPendingQueue(sid, [...queue.slice(0, index), ...queue.slice(index + 1)])
    return removed
  })

  const editAndResend = useEventCallback(async (messageIndex: number, newText: string) => {
    const sid = activeTabIdRef.current
    if (!sid) return
    await conversationTruncate(sid, messageIndex)
    const kept = (globalCache.get(sid) ?? []).slice(0, messageIndex)
    globalCache.set(sid, kept)
    syncTabState(sid)
    // Clear streaming state before resend
    globalStreamingSessions.delete(sid)
    await send(newText)
  })

  // ── Compatibility layer (for existing consumers) ───────

  // These mirror the old API surface for the active tab
  const sessionId = activeTab?.sessionId ?? null
  const messages = activeTab?.messages ?? []
  const isStreaming = activeTab?.isStreaming ?? false
  const title = activeTab?.title ?? null
  const usage = activeTab?.usage ?? { input: 0, output: 0 }
  const stats = activeTab?.stats ?? null
  const pendingQueue = activeTab?.pendingQueue ?? []

  // Legacy: single-session create (opens as tab)
  const create = useEventCallback((context?: string, contextFiles?: string[]) => {
    const placeholderId = `new_${Date.now().toString(36)}`
    deferredContextRef.current.set(placeholderId, { context, contextFiles })
    const tabState: SessionTabState = {
      sessionId: placeholderId,
      messages: [],
      isStreaming: false,
      title: null,
      usage: { input: 0, output: 0 },
      stats: null,
      pendingQueue: [],
    }
    setTabs((prev) => [...prev, tabState])
    setActiveTabId(placeholderId)
    activeTabIdRef.current = placeholderId
  })

  // Legacy: load a session (opens as tab)
  const load = useEventCallback(
    async (id: string, streaming?: boolean, initialUserMessage?: string) => {
      // Set streaming state in module-level cache
      if (streaming) {
        globalStreamingSessions.add(id)
      }
      await openTab(id, initialUserMessage)
    },
  )

  // Legacy: close active tab
  const close = useEventCallback(async () => {
    const sid = activeTabIdRef.current
    if (sid) {
      await closeTab(sid)
    }
  })

  return {
    // Multi-session API
    tabs,
    activeTabId,
    activeTab,
    openTab,
    switchTab,
    closeTab,
    createTab,
    newTab,

    // Active-tab scoped operations
    send,
    retry,
    cancel,
    removePendingItem,
    editAndResend,

    // Compatibility (active tab derived)
    sessionId,
    messages,
    isStreaming,
    title,
    usage,
    stats,
    pendingQueue,
    create,
    load,
    close,
    newSession: newTab,
  }
}
