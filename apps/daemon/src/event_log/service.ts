export type EventKind =
  | 'journal-updated'
  | 'todos-updated'
  | 'identity-updated'
  | 'speakers-updated'
  | 'ai-processing'
  | 'recording-processed'

export interface DomainEvent {
  seq: number
  timestamp_ms: number
  kind: EventKind
  payload: unknown
}

const EVENT_LOG_CAPACITY = 500

export class EventLogService {
  private readonly buffer: DomainEvent[] = []
  private seq = 1

  record(kind: EventKind, payload: unknown): number {
    const seq = this.seq
    this.seq += 1
    this.buffer.push({ seq, timestamp_ms: Date.now(), kind, payload })
    if (this.buffer.length > EVENT_LOG_CAPACITY) this.buffer.shift()
    return seq
  }

  eventsSince(sinceSeq: number): DomainEvent[] {
    return this.buffer.filter((event) => event.seq > sinceSeq)
  }
}
