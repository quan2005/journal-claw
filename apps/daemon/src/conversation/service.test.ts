import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Agent } from '@earendil-works/pi-agent-core'
import { fauxAssistantMessage, fauxProvider, fauxText, type Context } from '@earendil-works/pi-ai'
import { ChangeSetService } from '../changeset/service.js'
import { ConfigService, type EngineConfig } from '../config/service.js'
import { IdentityService } from '../identity/service.js'
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

  it('injects an @-mentioned expert identity into the per-turn system prompt', async () => {
    mkdirSync(join(workspace, '.journal', 'identity'), { recursive: true })
    writeFileSync(
      join(workspace, '.journal', 'identity', 'AT-a-professor.md'),
      '---\ntags: ["专家"]\n---\n\n犀利地挑战用户的每一个假设。',
    )
    const seenPrompts: string[] = []
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    faux.setResponses([
      () => fauxAssistantMessage([fauxText('first answer')]),
      () => fauxAssistantMessage([fauxText('second answer')]),
    ])
    const identityService = new IdentityService(workspace, new ChangeSetService(workspace))
    const service = makeService([faux.provider], undefined, identityService)
    const id = service.create()

    await service.send(id, '你觉得呢 @identities/AT-a-professor.md')
    await service.waitForIdle(id)
    seenPrompts.push(getSystemPrompt(service, id))

    expect(seenPrompts[0]).toContain('犀利地挑战用户的每一个假设')
    expect(seenPrompts[0]).toContain('主视角')

    await service.send(id, '@清除专家 好的')
    await service.waitForIdle(id)

    expect(getSystemPrompt(service, id)).not.toContain('犀利地挑战用户的每一个假设')
  })

  it('hints load_skill for experts backed by an external skill', async () => {
    mkdirSync(join(workspace, '.journal', 'identity'), { recursive: true })
    writeFileSync(
      join(workspace, '.journal', 'identity', 'AT-critic.md'),
      '---\nexpert_skill: "james-bach-perspective"\n---\n\n简短兜底描述。',
    )
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    faux.setResponses([() => fauxAssistantMessage([fauxText('answer')])])
    const identityService = new IdentityService(workspace, new ChangeSetService(workspace))
    const service = makeService([faux.provider], undefined, identityService)
    const id = service.create()

    await service.send(id, '@identities/AT-critic.md 怎么看')
    await service.waitForIdle(id)

    const prompt = getSystemPrompt(service, id)
    expect(prompt).toContain('load_skill')
    expect(prompt).toContain('james-bach-perspective')
    expect(prompt).toContain('简短兜底描述')
  })

  it('applies a per-message model and thinking-level override to future agent turns', async () => {
    config.setEngineConfig({
      active_provider: 'faux',
      providers: [
        {
          protocol: 'openai',
          id: 'faux',
          label: 'faux',
          model: 'faux-model',
          api_key: '',
          base_url: 'http://localhost:0',
        },
        {
          protocol: 'openai',
          id: 'faux-2',
          label: 'faux two',
          model: 'faux-model-2',
          api_key: '',
          base_url: 'http://localhost:0',
        },
      ],
    })
    const fauxPrimary = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    const fauxSecondary = fauxProvider({
      provider: 'faux-2',
      models: [{ id: 'faux-model-2', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    fauxSecondary.setResponses([() => fauxAssistantMessage([fauxText('switched answer')])])
    const service = makeService([fauxPrimary.provider, fauxSecondary.provider])
    const id = service.create()

    await service.send(id, 'hello', null, { providerId: 'faux-2', thinkingLevel: 'high' })
    await service.waitForIdle(id)

    const session = (
      service as unknown as {
        sessions: Map<
          string,
          { agent: { state: { model: { id: string }; thinkingLevel: string } } }
        >
      }
    ).sessions.get(id)!
    expect(session.agent.state.model.id).toBe('faux-model-2')
    expect(session.agent.state.thinkingLevel).toBe('high')
    expect(service.getMessages(id).map((m) => [m.role, m.content])).toEqual([
      ['user', 'hello'],
      ['assistant', 'switched answer'],
    ])
  })

  it('keeps the current model when the composer selection points at an unknown provider', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    faux.setResponses([() => fauxAssistantMessage([fauxText('fallback answer')])])
    const service = makeService([faux.provider])
    const id = service.create()

    await service.send(id, 'hi', null, { providerId: 'does-not-exist' })
    await service.waitForIdle(id)

    const session = (
      service as unknown as {
        sessions: Map<string, { agent: { state: { model: { id: string } } } }>
      }
    ).sessions.get(id)!
    expect(session.agent.state.model.id).toBe('faux-model')
  })

  function makeService(
    providers: ConversationServiceOptions['providers'],
    createAgent?: ConversationServiceOptions['createAgent'],
    identityService?: ConversationServiceOptions['identityService'],
  ): ConversationService {
    return new ConversationService({
      workspaceRoot: workspace,
      configService: config,
      runService,
      providers,
      identityService,
      publishEvent(event, payload) {
        if (event === 'conversation-stream') events.push(payload as ConversationStreamPayload)
      },
      createAgent,
      now: () => new Date('2026-06-27T00:00:00.000Z'),
    })
  }

  function getSystemPrompt(service: ConversationService, id: string): string {
    return (
      service as unknown as {
        sessions: Map<string, { agent: { state: { systemPrompt: string } } }>
      }
    ).sessions.get(id)!.agent.state.systemPrompt
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
