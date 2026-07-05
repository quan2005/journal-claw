import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkQueueService, buildWorkItemPrompt, loadQueue, type WorkItem } from './service.js'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'journal-daemon-work-queue-'))
}

describe('WorkQueueService', () => {
  it('persists Rust-compatible .work_queue.json and processes serially', async () => {
    const ws = fixture()
    try {
      const seen: string[] = []
      const service = new WorkQueueService(
        ws,
        {
          async run(item) {
            seen.push(item.id)
            return `session-${seen.length}`
          },
        },
        () => new Date(2026, 5, 27, 12),
        60_000,
      )

      const item = service.enqueue({ text: 'hello', displayName: 'Hello' })
      await waitFor(() => service.list()[0]?.status === 'completed')

      expect(seen).toEqual([item.id])
      expect(JSON.parse(readFileSync(join(ws, '.work_queue.json'), 'utf8'))).toMatchObject({
        items: [{ id: item.id, status: 'completed', session_id: 'session-1' }],
      })
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('cancels queued items, retries failed items, and dismisses items', async () => {
    const ws = fixture()
    try {
      const service = new WorkQueueService(
        ws,
        {
          async run(item) {
            if (item.display_name === 'fail') throw new Error('boom')
            return null
          },
        },
        undefined,
        60_000,
      )
      const failed = service.enqueue({ prompt: 'x', displayName: 'fail' })
      await waitFor(() => service.list()[0]?.status === 'failed')
      service.retry(failed.id)
      await waitFor(() => service.list()[0]?.status === 'failed')
      service.dismiss(failed.id)
      expect(service.list()).toEqual([])

      const blocked = new WorkQueueService(
        ws,
        {
          run: () => new Promise(() => undefined),
        },
        undefined,
        60_000,
      )
      const running = blocked.enqueue({ text: 'first', displayName: 'first' })
      const queued = blocked.enqueue({ text: 'second', displayName: 'second' })
      await waitFor(() => blocked.list().some((item) => item.id === queued.id))
      blocked.cancel(queued.id)
      expect(blocked.list().some((item) => item.id === queued.id)).toBe(false)
      blocked.cancel(running.id)
      expect(blocked.list()[0]).toMatchObject({
        id: running.id,
        status: 'failed',
        error: 'cancelled',
      })
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('loads processing items as queued on restart', () => {
    const ws = fixture()
    try {
      const item: WorkItem = {
        id: 'wq-1',
        status: 'processing',
        session_id: 's1',
        text: null,
        files: null,
        prompt: 'p',
        display_name: 'P',
        error: null,
        created_at: 1,
      }
      writeFileSync(join(ws, '.work_queue.json'), JSON.stringify({ items: [item] }))
      expect(loadQueue(join(ws, '.work_queue.json'))[0]).toMatchObject({ status: 'processing' })
      const service = new WorkQueueService(
        ws,
        { run: () => new Promise(() => undefined) },
        undefined,
        60_000,
      )
      expect(service.list()[0]).toMatchObject({ status: 'processing' })
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('builds file prompts with workspace-relative @mentions', () => {
    expect(
      buildWorkItemPrompt('/workspace', {
        id: 'wq-1',
        status: 'queued',
        session_id: null,
        text: null,
        files: ['/workspace/2606/raw/a.md'],
        prompt: null,
        display_name: 'A',
        error: null,
        created_at: 1,
      }),
    ).toBe('@2606/raw/a.md 请分析和处理')
  })
})

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('timed out')
}
