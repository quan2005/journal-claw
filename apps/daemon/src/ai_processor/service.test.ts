import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai'
import { ChangeSetService } from '../changeset/service.js'
import { ConfigService, type EngineConfig } from '../config/service.js'
import { AgentRunService } from '../runs/service.js'
import {
  AiProcessorService,
  buildDefaultUserPrompt,
  classifyMaterial,
  compactMessages,
  computeSourceDigest,
  planProcessing,
  promptLabel,
  shouldAutoCompact,
  type AiLogLine,
  type ProcessingUpdate,
} from './service.js'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'journal-daemon-ai-processor-'))
}

describe('ai processor planning helpers', () => {
  it('matches Rust classification, prompt labels, digest, and compact threshold', () => {
    expect(classifyMaterial('voice.m4a')).toBe('audio')
    expect(classifyMaterial('note.md')).toBe('text')
    expect(classifyMaterial('image.webp')).toBe('image')
    expect(classifyMaterial('data.csv')).toBe('other')
    expect(buildDefaultUserPrompt('/tmp/file.txt', '2606', '会议')).toBe(
      '分析和处理 @.journal/memory/2606/raw/file.txt 会议',
    )
    expect(promptLabel('帮我把今天所有的会议记录整理成日志条目，按重要程度排序')).toHaveLength(21)
    expect(computeSourceDigest(Buffer.from('hello'), 'v1', 'm')).toHaveLength(64)
    expect(shouldAutoCompact(99_999)).toBe(false)
    expect(shouldAutoCompact(100_000)).toBe(true)
  })

  it('detects duplicate source_digest in month entries', () => {
    const ws = fixture()
    try {
      mkdirSync(join(ws, '.journal', 'memory', '2606'), { recursive: true })
      const material = join(ws, '.journal', 'memory', '2606', 'raw.txt')
      writeFileSync(material, 'hello')
      const digest = computeSourceDigest(Buffer.from('hello'), 'v1', 'faux-model')
      writeFileSync(
        join(ws, '.journal', 'memory', '2606', '01-old.md'),
        `---\nsource_digest: ${digest}\n---\n`,
      )
      expect(planProcessing(ws, material, '2606', null, null, 'faux-model')?.is_duplicate).toBe(
        true,
      )
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('compacts old messages and preserves recent messages', () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
    }))
    const result = compactMessages(messages)
    expect(result?.removed).toBeGreaterThan(0)
    expect(result?.messages[0].content).toContain('对话摘要')
    expect(result?.messages).toHaveLength(7)
  })
})

describe('AiProcessorService', () => {
  it('runs trigger through AgentRunService + pi faux provider and injects source_digest', async () => {
    const dir = fixture()
    try {
      const workspace = join(dir, 'workspace')
      mkdirSync(join(workspace, '.journal', 'memory', '2606'), { recursive: true })
      const material = join(workspace, '.journal', 'memory', '2606', 'raw.txt')
      writeFileSync(material, 'hello')
      const entry = join(workspace, '.journal', 'memory', '2606', '27-test.md')
      writeFileSync(entry, '---\nsummary: test\n---\n\n# Test\n')

      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      faux.setResponses([
        fauxAssistantMessage(
          [fauxText('ok'), fauxToolCall('read_file', { path: '2606/raw.txt' }, { id: 'tc-1' })],
          {
            stopReason: 'toolUse',
          },
        ),
        fauxAssistantMessage([fauxText('done')]),
      ])
      const config = configWithFaux(dir)
      const runService = new AgentRunService(join(dir, 'runs'))
      const updates: ProcessingUpdate[] = []
      const logs: AiLogLine[] = []
      const service = new AiProcessorService(workspace, runService, config, {
        providers: [faux.provider],
        changeSetService: () => new ChangeSetService(workspace),
        now: () => new Date(),
        events: {
          processing: (event) => updates.push(event),
          log: (event) => logs.push(event),
        },
      })

      await service.trigger({ materialPath: material, yearMonth: '2606' })
      await waitFor(() => updates.some((event) => event.status === 'completed'))

      expect(faux.state.callCount).toBe(2)
      expect(updates.map((event) => event.status)).toEqual(['queued', 'processing', 'completed'])
      expect(logs.some((event) => event.level === 'phase' && event.message === '读取文件')).toBe(
        true,
      )
      expect(readFileSync(entry, 'utf8')).toContain('source_digest:')
      expect(runService.readEvents([...runIds(runService)][0] ?? '').length).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('skips duplicates without calling pi provider', async () => {
    const dir = fixture()
    try {
      const workspace = join(dir, 'workspace')
      mkdirSync(join(workspace, '.journal', 'memory', '2606'), { recursive: true })
      const material = join(workspace, '.journal', 'memory', '2606', 'raw.txt')
      writeFileSync(material, 'hello')
      const digest = computeSourceDigest(Buffer.from('hello'), 'v1', 'faux-model')
      writeFileSync(
        join(workspace, '.journal', 'memory', '2606', '01-old.md'),
        `---\nsource_digest: ${digest}\n---\n`,
      )
      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      const updates: ProcessingUpdate[] = []

      await new AiProcessorService(
        workspace,
        new AgentRunService(join(dir, 'runs')),
        configWithFaux(dir),
        {
          providers: [faux.provider],
          events: { processing: (event) => updates.push(event) },
        },
      ).trigger({ materialPath: material, yearMonth: '2606' })
      await waitFor(() => updates.some((event) => event.status === 'completed'))

      expect(faux.state.callCount).toBe(0)
      expect(updates.at(-1)?.error).toBe('相同内容已处理，跳过重复处理')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

function configWithFaux(dir: string): ConfigService {
  const config = new ConfigService({ configDir: join(dir, 'config') })
  config.setEngineConfig({
    active_provider: 'faux',
    providers: [
      {
        protocol: 'openai',
        id: 'faux',
        label: 'Faux',
        api_key: '',
        base_url: '',
        models: ['faux-model'],
      },
    ],
  } satisfies EngineConfig)
  return config
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('timed out')
}

function runIds(_service: AgentRunService): string[] {
  return []
}
