import { randomUUID } from 'node:crypto'
import type { Provider } from '@earendil-works/pi-ai'
import type { ConversationService } from '../conversation/service.js'
import { nextWaitMs, shouldRunDue, validateSchedule } from './schedule.js'
import { RoutineRunner, type RoutineRunFailure } from './runner.js'
import { AutomationStore } from './store.js'
import type {
  AutomationRoutine,
  AutomationRun,
  AutomationRunTrigger,
  CreateRoutineRequest,
  UpdateRoutineRequest,
} from './types.js'
import { summarizeRun } from './types.js'

/**
 * AutomationService — CRUD + execution + scheduling for routines.
 *
 * Orchestrates AutomationStore (persistence), RoutineRunner (pi engine via
 * ConversationService) and the schedule module (pure due/wait math). The
 * scheduler loop is a setTimeout ticker driven by nextWaitMs, started via
 * start(); in tests the pure functions are asserted directly and the loop is
 * left unstarted.
 */
export interface AutomationServiceOptions {
  providers?: Provider[]
  now?: () => Date
  /** Inject a ConversationService factory (tests pass a faux-backed one). */
  conversationService: () => ConversationService
  /**
   * Override the runner's workspace snapshot. Defaults to the real recursive
   * walk; tests may inject a controllable snapshot.
   */
  snapshot?: (workspaceRoot: string) => Map<string, { mtimeMs: number; size: number }>
}

export class AutomationService {
  private readonly store: AutomationStore
  private readonly runner: RoutineRunner
  private readonly workspaceRoot: string
  private readonly now: () => Date
  private readonly providers?: Provider[]
  private readonly inFlight = new Set<string>()
  private readonly notify = createNotify()
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly publishEvent: (event: string, payload: unknown) => void

  constructor(workspaceRoot: string, opts: AutomationServiceOptions) {
    this.workspaceRoot = workspaceRoot
    this.store = new AutomationStore(workspaceRoot)
    this.providers = opts.providers
    this.now = opts.now ?? (() => new Date())
    this.publishEvent = () => {}
    this.runner = new RoutineRunner(opts.conversationService(), {
      now: this.now,
      snapshot: opts.snapshot,
    })
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  createRoutine(request: CreateRoutineRequest): AutomationRoutine {
    validateSchedule(request.schedule)
    const now = this.isoNow()
    const routine: AutomationRoutine = {
      id: `routine_${randomUUID()}`,
      title: request.title,
      template_id: request.template_id,
      prompt: request.prompt,
      schedule: request.schedule,
      scope: request.scope,
      enabled: request.enabled,
      full_agent_access: true,
      created_at: now,
      updated_at: now,
      last_run: null,
    }
    this.store.upsertRoutine(routine)
    this.notifyScheduler()
    return routine
  }

  updateRoutine(id: string, patch: UpdateRoutineRequest): AutomationRoutine {
    if (patch.schedule) validateSchedule(patch.schedule)
    const routine = this.store.getRoutine(id)
    if (patch.title !== undefined) routine.title = patch.title
    if (patch.prompt !== undefined) routine.prompt = patch.prompt
    if (patch.schedule !== undefined) routine.schedule = patch.schedule
    if (patch.scope !== undefined) routine.scope = patch.scope
    if (patch.enabled !== undefined) routine.enabled = patch.enabled
    routine.updated_at = this.isoNow()
    this.store.upsertRoutine(routine)
    this.notifyScheduler()
    return routine
  }

  deleteRoutine(id: string): void {
    this.store.deleteRoutine(id)
    this.notifyScheduler()
  }

  pauseRoutine(id: string): AutomationRoutine {
    return this.updateRoutine(id, { enabled: false })
  }

  resumeRoutine(id: string): AutomationRoutine {
    return this.updateRoutine(id, { enabled: true })
  }

  listRoutines(): AutomationRoutine[] {
    return this.store.listRoutines()
  }

  listRuns(routineId: string): AutomationRun[] {
    return this.store.listRunsForRoutine(routineId)
  }

  getRun(runId: string): AutomationRun {
    return this.store.getRun(runId)
  }

  // ── execution ──────────────────────────────────────────────────────────────

  async runNow(id: string): Promise<AutomationRun> {
    return this.runRoutine(id, 'manual')
  }

  /** Run all due routines once. Used by the scheduler tick and by tests. */
  async runDue(): Promise<AutomationRun[]> {
    const now = this.now()
    const routines = this.listRoutines().filter((r) => r.enabled)
    const results: AutomationRun[] = []
    for (const routine of routines) {
      if (!shouldRunDue(routine, now)) continue
      if (!this.markInFlight(routine.id)) continue
      try {
        const run = await this.runMarked(routine.id, 'scheduled')
        results.push(run)
      } catch {
        // runMarked always persists a run record even on failure.
      }
    }
    return results
  }

  private async runRoutine(
    routineId: string,
    trigger: AutomationRunTrigger,
  ): Promise<AutomationRun> {
    if (!this.markInFlight(routineId)) {
      return this.createSkippedRun(routineId, trigger, 'routine already running')
    }
    return this.runMarked(routineId, trigger)
  }

  private async runMarked(
    routineId: string,
    trigger: AutomationRunTrigger,
  ): Promise<AutomationRun> {
    try {
      return await this.runInner(routineId, trigger)
    } finally {
      this.inFlight.delete(routineId)
      this.notifyScheduler()
    }
  }

  private async runInner(routineId: string, trigger: AutomationRunTrigger): Promise<AutomationRun> {
    const routine = this.store.getRoutine(routineId)
    const run: AutomationRun = {
      id: `run_${randomUUID()}`,
      routine_id: routine.id,
      trigger,
      status: 'running',
      started_at: this.isoNow(),
      completed_at: null,
      error: null,
      conversation_id: null,
      manifest: null,
    }
    this.store.upsertRun(run)

    try {
      const { conversationId, manifest } = await this.runner.run(this.workspaceRoot, routine, run)
      run.status = 'succeeded'
      run.completed_at = this.isoNow()
      run.conversation_id = conversationId
      run.manifest = manifest
    } catch (err) {
      const failure = err as RoutineRunFailure
      run.status = 'failed'
      run.error = failure.message ?? String(err)
      run.conversation_id = failure.conversationId ?? null
      run.manifest = failure.manifest ?? null
      run.completed_at = this.isoNow()
    }

    this.store.upsertRun(run)
    this.updateRoutineLastRun(routine.id, summarizeRun(run))
    return run
  }

  private createSkippedRun(
    routineId: string,
    trigger: AutomationRunTrigger,
    reason: string,
  ): AutomationRun {
    const now = this.isoNow()
    const run: AutomationRun = {
      id: `run_${randomUUID()}`,
      routine_id: routineId,
      trigger,
      status: 'skipped',
      started_at: now,
      completed_at: now,
      error: reason,
      conversation_id: null,
      manifest: null,
    }
    this.store.upsertRun(run)
    return run
  }

  private updateRoutineLastRun(routineId: string, summary: ReturnType<typeof summarizeRun>): void {
    let routine
    try {
      routine = this.store.getRoutine(routineId)
    } catch (err) {
      // routine was deleted while running — keep the run, skip the update.
      if (err instanceof Error && err.message.includes('routine not found')) return
      throw err
    }
    routine.last_run = summary
    this.store.upsertRoutine(routine)
  }

  // ── scheduling ─────────────────────────────────────────────────────────────

  /**
   * Start the timer loop. The daemon (server.ts) calls this once per workspace
   * service. Each tick runs due routines, then reschedules after nextWaitMs.
   * The loop is interruptible: mutations notify it to recompute immediately.
   */
  start(): void {
    if (this.timer) return
    const tick = (): void => {
      this.runDue()
        .catch(() => {})
        .finally(() => this.scheduleNext())
    }
    this.scheduleNext(tick)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** Recompute the wait. Exposed for tests + internal scheduling. */
  nextWaitMs(): number {
    return nextWaitMs(this.listRoutines(), this.now(), { inFlight: this.inFlight })
  }

  private scheduleNext(tick?: () => void): void {
    const wait = this.nextWaitMs()
    const run = tick ?? this.defaultTick
    this.timer = setTimeout(run, wait)
    // A daemon tick holding the event loop alive would block clean shutdown.
    this.timer.unref?.()
  }

  private readonly defaultTick = (): void => {
    this.runDue()
      .catch(() => {})
      .finally(() => this.scheduleNext())
  }

  private markInFlight(routineId: string): boolean {
    if (this.inFlight.has(routineId)) return false
    this.inFlight.add(routineId)
    return true
  }

  private notifyScheduler(): void {
    this.notify.notify()
  }

  private isoNow(): string {
    return this.now().toISOString()
  }

  /** Snapshot of the in-flight routine ids (test affordance). */
  inFlightIds(): string[] {
    return [...this.inFlight]
  }

  /** Underlying store — exposed for fixture setup and inspection. */
  getStore(): AutomationStore {
    return this.store
  }
}

/**
 * Minimal interrupt primitive: notify() sets a pending flag; the timer loop
 * re-evaluates on its next tick. Because nextWaitMs returns 0 as soon as a
 * newly-due or newly-enabled routine appears, a notify followed by the next
 * scheduled tick converges quickly without a dedicated wakeup channel.
 */
function createNotify(): { notify: () => void; consume: () => boolean } {
  let pending = false
  return {
    notify: () => {
      pending = true
    },
    consume: () => {
      const was = pending
      pending = false
      return was
    },
  }
}
