import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { SettingsService } from '../settings/service.js'

export interface AutoLintStatus {
  state: 'idle' | 'running' | 'never_run' | 'error'
  last_run: string | null
  last_run_entries: number | null
  next_check: string | null
  current_new_entries: number
  error: string | null
}

interface LastLint {
  last_run?: string
  entries_at_last_run?: number
}

export class AutoLintService {
  private running = false

  constructor(
    private readonly workspaceRoot: string,
    private readonly settingsService: SettingsService,
    private readonly now = () => new Date(),
  ) {}

  getStatus(): AutoLintStatus {
    const cfg = this.settingsService.load().auto_lint
    const last = this.readLastLint()
    const currentNewEntries = this.computeNewEntries()
    return {
      state: this.running ? 'running' : last ? 'idle' : 'never_run',
      last_run: last?.last_run ?? null,
      last_run_entries: last?.entries_at_last_run ?? null,
      next_check: cfg.enabled ? this.nextCheckTime(cfg.frequency, cfg.time) : null,
      current_new_entries: currentNewEntries,
      error: null,
    }
  }

  triggerLintNow(): void {
    if (this.running) return
    this.running = true
    try {
      const total = this.countJournalEntries()
      const dir = join(this.workspaceRoot, '.claude')
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        join(dir, 'last-lint.json'),
        JSON.stringify(
          {
            last_run: this.formatTimestamp(this.now()),
            entries_at_last_run: total,
            daemon_note: 'daemon M3 marks the run checkpoint; native LLM lint remains host-managed',
          },
          null,
          2,
        ),
        'utf8',
      )
    } finally {
      this.running = false
    }
  }

  private readLastLint(): LastLint | null {
    for (const filename of ['last-lint.json', 'last-dream.json']) {
      const path = join(this.workspaceRoot, '.claude', filename)
      if (!existsSync(path)) continue
      try {
        return JSON.parse(readFileSync(path, 'utf8')) as LastLint
      } catch {
        return null
      }
    }
    return null
  }

  private countJournalEntries(): number {
    if (!existsSync(this.workspaceRoot)) return 0
    let count = 0
    for (const dirent of readdirSync(this.workspaceRoot, { withFileTypes: true })) {
      if (!dirent.isDirectory() || !/^\d{4}$/.test(dirent.name)) continue
      for (const file of readdirSync(join(this.workspaceRoot, dirent.name), {
        withFileTypes: true,
      })) {
        if (file.isFile() && /\.(md|html?)$/.test(file.name)) count += 1
      }
    }
    return count
  }

  private computeNewEntries(): number {
    return Math.max(0, this.countJournalEntries() - (this.readLastLint()?.entries_at_last_run ?? 0))
  }

  private nextCheckTime(frequency: string, time: string): string | null {
    const parsed = time.match(/^(\d{2}):(\d{2})$/)
    if (!parsed) return null
    const hour = Number(parsed[1])
    const minute = Number(parsed[2])
    const now = this.now()
    const candidate = new Date(now)
    candidate.setHours(hour, minute, 0, 0)
    if (frequency === 'daily') {
      if (candidate <= now) candidate.setDate(candidate.getDate() + 1)
    } else if (frequency === 'weekly') {
      const day = candidate.getDay()
      let delta = day === 0 && candidate > now ? 0 : (7 - day) % 7
      if (delta === 0 && candidate <= now) delta = 7
      candidate.setDate(candidate.getDate() + delta)
    } else if (frequency === 'monthly') {
      if (candidate.getDate() !== 1 || candidate <= now)
        candidate.setMonth(candidate.getMonth() + 1, 1)
      else candidate.setDate(1)
    } else {
      return null
    }
    return `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())} ${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`
  }

  private formatTimestamp(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${timezoneOffset(date)}`
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function timezoneOffset(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
}
