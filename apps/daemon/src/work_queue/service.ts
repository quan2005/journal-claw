import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'

export type WorkStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface WorkItem {
  id: string
  status: WorkStatus
  session_id: string | null
  text: string | null
  files: string[] | null
  prompt: string | null
  display_name: string
  error: string | null
  created_at: number
}

export interface EnqueueWorkInput {
  text?: string | null
  files?: string[] | null
  prompt?: string | null
  displayName: string
}

export interface WorkQueueRunner {
  run(item: WorkItem, signal: AbortSignal): Promise<string | null>
}

interface PersistedQueue {
  items: WorkItem[]
}

type WorkQueueSubscriber = () => void

const COMPLETE_RETENTION_MS = 2000

export class WorkQueueService {
  private items: WorkItem[] | null = null
  private processing = false
  private readonly aborters = new Map<string, AbortController>()
  private readonly subscribers = new Set<WorkQueueSubscriber>()

  constructor(
    private readonly workspaceRoot: string,
    private readonly runner: WorkQueueRunner,
    private readonly now = () => new Date(),
    private readonly completeRetentionMs = COMPLETE_RETENTION_MS,
  ) {}

  subscribe(subscriber: WorkQueueSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  enqueue(input: EnqueueWorkInput): WorkItem {
    if (!input.displayName.trim()) throw new Error('displayName is required')
    const item: WorkItem = {
      id: `wq-${randomUUID()}`,
      status: 'queued',
      session_id: null,
      text: input.text ?? null,
      files: input.files ?? null,
      prompt: input.prompt ?? null,
      display_name: input.displayName,
      error: null,
      created_at: Math.floor(this.now().getTime() / 1000),
    }
    const items = this.ensureLoaded()
    items.push(item)
    this.save()
    this.emit()
    void this.processNext()
    return item
  }

  list(): WorkItem[] {
    this.ensureLoaded()
    void this.processNext()
    return this.cloneItems()
  }

  cancel(id: string): void {
    const items = this.ensureLoaded()
    const item = this.find(id)
    if (item.status === 'queued') {
      this.items = items.filter((candidate) => candidate.id !== id)
    } else if (item.status === 'processing') {
      item.status = 'failed'
      item.error = 'cancelled'
      this.processing = false
      this.aborters.get(id)?.abort()
      this.aborters.delete(id)
    }
    this.save()
    this.emit()
    void this.processNext()
  }

  retry(id: string): void {
    const item = this.find(id)
    if (item.status !== 'failed') throw new Error('can only retry failed items')
    item.status = 'queued'
    item.error = null
    item.session_id = null
    this.save()
    this.emit()
    void this.processNext()
  }

  dismiss(id: string): void {
    this.ensureLoaded()
    this.items = this.cloneItems().filter((item) => item.id !== id)
    this.save()
    this.emit()
  }

  storagePath(): string {
    return join(this.workspaceRoot, '.work_queue.json')
  }

  private async processNext(): Promise<void> {
    const items = this.ensureLoaded()
    if (this.processing) return
    const item = items.find((candidate) => candidate.status === 'queued')
    if (!item) return

    this.processing = true
    item.status = 'processing'
    item.error = null
    const controller = new AbortController()
    this.aborters.set(item.id, controller)
    this.save()
    this.emit()

    try {
      const sessionId = await this.runner.run(item, controller.signal)
      const current = this.ensureLoaded().find((candidate) => candidate.id === item.id)
      if (current && current.status === 'processing') {
        current.status = 'completed'
        current.session_id = sessionId
        current.error = null
      }
    } catch (err) {
      const current = this.ensureLoaded().find((candidate) => candidate.id === item.id)
      if (current && current.status === 'processing') {
        current.status = 'failed'
        current.error = err instanceof Error ? err.message : String(err)
      }
    } finally {
      this.aborters.delete(item.id)
      this.processing = false
      this.save()
      this.emit()
      this.scheduleCompletedRemoval(item.id)
      void this.processNext()
    }
  }

  private scheduleCompletedRemoval(id: string): void {
    setTimeout(() => {
      const items = this.ensureLoaded()
      const item = items.find((candidate) => candidate.id === id)
      if (!item || item.status !== 'completed') return
      this.items = items.filter((candidate) => candidate.id !== id)
      this.save()
      this.emit()
    }, this.completeRetentionMs).unref?.()
  }

  private find(id: string): WorkItem {
    const item = this.ensureLoaded().find((candidate) => candidate.id === id)
    if (!item) throw new Error('item not found')
    return item
  }

  private ensureLoaded(): WorkItem[] {
    if (this.items) return this.items
    this.items = loadQueue(this.storagePath())
    let changed = false
    for (const item of this.items) {
      if (item.status === 'processing') {
        item.status = 'queued'
        item.error = null
        changed = true
      }
    }
    const retained = this.items.filter((item) => item.status !== 'completed')
    if (retained.length !== this.items.length) {
      this.items = retained
      changed = true
    }
    if (changed) this.save()
    return this.items
  }

  private cloneItems(): WorkItem[] {
    return this.ensureLoaded().map((item) => ({
      ...item,
      files: item.files ? [...item.files] : null,
    }))
  }

  private save(): void {
    saveQueue(this.storagePath(), this.ensureLoaded())
  }

  private emit(): void {
    for (const subscriber of this.subscribers) subscriber()
  }
}

export function loadQueue(path: string): WorkItem[] {
  if (!existsSync(path)) return []
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) return []
    return parsed.items.filter(isWorkItem).map(normalizeWorkItem)
  } catch {
    return []
  }
}

export function saveQueue(path: string, items: WorkItem[]): void {
  const persisted: PersistedQueue = { items }
  writeFileSync(path, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8')
}

export function buildWorkItemPrompt(workspaceRoot: string, item: WorkItem): string {
  if (item.files?.length) {
    const refs = item.files.map((file) => `@${relative(workspaceRoot, file).replace(/\\/g, '/')}`)
    return `${refs.join(' ')} ${item.prompt?.trim() || '请分析和处理'}`
  }
  if (item.text) return item.text
  return item.prompt || '请分析和处理'
}

function normalizeWorkItem(item: WorkItem): WorkItem {
  return {
    ...item,
    session_id: item.session_id ?? null,
    text: item.text ?? null,
    files: item.files ?? null,
    prompt: item.prompt ?? null,
    error: item.error ?? null,
  }
}

function isWorkItem(value: unknown): value is WorkItem {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    isWorkStatus(value.status) &&
    typeof value.display_name === 'string' &&
    typeof value.created_at === 'number'
  )
}

function isWorkStatus(value: unknown): value is WorkStatus {
  return value === 'queued' || value === 'processing' || value === 'completed' || value === 'failed'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
