import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Agent } from '@earendil-works/pi-agent-core'
import { fauxAssistantMessage, fauxProvider, fauxText, type Context } from '@earendil-works/pi-ai'
import { ConfigService, type EngineConfig } from '../config/service.js'
import { AgentRunService } from '../runs/service.js'
import {
  ConversationService,
  type ConversationServiceOptions,
  type ConversationStreamPayload,
} from './service.js'

describe('ConversationService', () => {
  let dir: string
  let workspace: string
  let config: ConfigService
  let runService: AgentRunService
  let events: ConversationStreamPayload[]

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'journal-conversation-'))
    workspace = join(dir, 'workspace')
    mkdirSync(workspace, { recursive: true })
    config = new ConfigService({ configDir: join(dir, 'config') })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    runService = new AgentRunService(join(dir, 'runs'))
    events = []
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('runs multi-turn sends through one pi agent and accumulates context', async () => {
    const seen: string[][] = []
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    faux.setResponses([
      (context) => {
        seen.push(userTexts(context))
        return fauxAssistantMessage([fauxText('first answer')])
      },
      (context) => {
        seen.push(userTexts(context))
        return fauxAssistantMessage([fauxText('second answer')])
      },
    ])
    const service = makeService([faux.provider])
    const id = service.create()

    await service.send(id, 'first question')
    await service.waitForIdle(id)
    await service.send(id, 'second question')
    await service.waitForIdle(id)

    expect(seen).toEqual([['first question'], ['first question', 'second question']])
    expect(service.getMessages(id).map((m) => [m.role, m.content])).toEqual([
      ['user', 'first question'],
      ['assistant', 'first answer'],
      ['user', 'second question'],
      ['assistant', 'second answer'],
    ])
    expect(
      events.filter((event) => event.event === 'text_delta').map((event) => event.data),
    ).toEqual(['first answer', 'second answer'])
    expect(runService.readEvents(firstRunId()).map((event) => event.type)).toContain('run_finished')
  })

  it('injects a follow-up while a turn is active', async () => {
    let release!: () => void
    const seen: string[][] = []
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    faux.setResponses([
      async (context) => {
        seen.push(userTexts(context))
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return fauxAssistantMessage([fauxText('first')])
      },
      (context) => {
        seen.push(userTexts(context))
        return fauxAssistantMessage([fauxText('followed')])
      },
    ])
    const service = makeService([faux.provider])
    const id = service.create()

    await service.send(id, 'start')
    await waitForEvent('turn_start')
    service.inject(id, 'injected')
    release()
    await service.waitForIdle(id)

    expect(seen).toEqual([['start'], ['start', 'injected']])
    expect(events.some((event) => event.event === 'user_inject' && event.data === 'injected')).toBe(
      true,
    )
    expect(service.getMessages(id).map((m) => m.content)).toEqual([
      'start',
      'first',
      'injected',
      'followed',
    ])
  })

  it('truncates raw session history and retries with pi continue', async () => {
    const seen: string[][] = []
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    faux.setResponses([
      fauxAssistantMessage([fauxText('bad answer')]),
      (context) => {
        seen.push(userTexts(context))
        return fauxAssistantMessage([fauxText('better answer')])
      },
    ])
    const service = makeService([faux.provider])
    const id = service.create()

    await service.send(id, 'question')
    await service.waitForIdle(id)
    service.truncate(id, 1)
    await service.retry(id)
    await service.waitForIdle(id)

    expect(seen).toEqual([['question']])
    expect(service.getMessages(id).map((m) => [m.role, m.content])).toEqual([
      ['user', 'question'],
      ['assistant', 'better answer'],
    ])
  })

  it('cancels an active pi agent and records canceled run state', async () => {
    let abortCount = 0
    let listener: ((event: { type: 'agent_start' | 'turn_start' }) => void) | null = null
    const service = makeService(
      [],
      () =>
        ({
          state: {
            systemPrompt: '',
            model: {},
            thinkingLevel: 'off',
            tools: [],
            messages: [],
            isStreaming: false,
            pendingToolCalls: new Set(),
          },
          sessionId: '',
          transformContext: undefined,
          subscribe(fn: (event: { type: 'agent_start' | 'turn_start' }) => void) {
            listener = fn
            return () => {
              listener = null
            }
          },
          async prompt() {
            listener?.({ type: 'agent_start' })
            listener?.({ type: 'turn_start' })
            await new Promise((_resolve, reject) => {
              setTimeout(() => reject(new Error('aborted')), 20)
            })
          },
          async continue() {},
          followUp() {},
          abort() {
            abortCount += 1
          },
        }) as unknown as Agent,
    )
    const id = service.create()

    await service.send(id, 'slow')
    await waitForEvent('turn_start')
    service.cancel(id)
    await service.waitForIdle(id)

    const run = runService.getRun(firstRunId())
    expect(abortCount).toBe(1)
    expect(run?.status).toBe('canceled')
    expect(
      events.some((event) => event.event === 'error' && event.data.includes('cancelled')),
    ).toBe(true)
  })

  it('loads existing Rust V2 and V1 conversation history', () => {
    mkdirSync(join(workspace, '.conversations'), { recursive: true })
    writeFileSync(
      join(workspace, '.conversations', 'rust_v2.json'),
      JSON.stringify({
        id: 'rust_v2',
        title: 'Rust V2',
        title_locked: false,
        created_at: 1,
        updated_at: 2,
        version: 2,
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'old question' }] },
          { role: 'assistant', content: [{ type: 'text', text: 'old answer' }] },
        ],
      }),
    )
    writeFileSync(
      join(workspace, '.conversations', 'rust_v1.json'),
      JSON.stringify({
        id: 'rust_v1',
        title: 'Rust V1',
        title_locked: false,
        created_at: 3,
        updated_at: 4,
        messages: [
          { role: 'user', content: 'legacy question' },
          { role: 'assistant', content: 'legacy answer' },
        ],
      }),
    )
    const service = makeService([])

    expect(service.load('rust_v2').map((m) => m.content)).toEqual(['old question', 'old answer'])
    expect(service.load('rust_v1').map((m) => m.content)).toEqual([
      'legacy question',
      'legacy answer',
    ])
    expect(service.list().map((summary) => summary.id)).toEqual(['rust_v1', 'rust_v2'])
  })

  function makeService(
    providers: ConversationServiceOptions['providers'],
    createAgent?: ConversationServiceOptions['createAgent'],
  ): ConversationService {
    return new ConversationService({
      workspaceRoot: workspace,
      configService: config,
      runService,
      providers,
      publishEvent(event, payload) {
        if (event === 'conversation-stream') events.push(payload as ConversationStreamPayload)
      },
      createAgent,
      now: () => new Date('2026-06-27T00:00:00.000Z'),
    })
  }

  function firstRunId(): string {
    const first = events.find((event) => event.event === 'turn_start')
    expect(first).toBeTruthy()
    const runFile = join(dir, 'runs')
    const files = JSON.parse(
      JSON.stringify(
        // RunStore stores by id-named JSONL files; readEvents needs ids, so infer
        // from the service's own event directory names through list side effects.
        Array.from((runService as unknown as { runs?: Map<string, unknown> }).runs?.keys() ?? []),
      ),
    ) as string[]
    expect(files.length).toBeGreaterThan(0)
    void runFile
    return files[0]
  }

  async function waitForEvent(event: string): Promise<void> {
    for (let i = 0; i < 50; i += 1) {
      if (events.some((item) => item.event === event)) return
      await new Promise((resolve) => setTimeout(resolve, 1))
    }
    throw new Error(`timed out waiting for ${event}`)
  }
})

function userTexts(context: Context): string[] {
  return context.messages
    .filter((message) => message.role === 'user')
    .map((message) => {
      if (typeof message.content === 'string') return message.content
      return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
    })
}

function engineConfig(provider: string, model: string): EngineConfig {
  return {
    active_provider: provider,
    providers: [
      {
        protocol: 'openai',
        id: provider,
        label: provider,
        model,
        api_key: '',
        base_url: 'http://localhost:0',
      },
    ],
  }
}
