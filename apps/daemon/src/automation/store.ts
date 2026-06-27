import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import type { AutomationRoutine, AutomationRun, RunManifest } from './types.js'

/**
 * AutomationStore — routine + run JSON persistence.
 *
 * Layout mirrors Rust AutomationStore exactly so a workspace is portable
 * between runtimes (Gate G):
 *   <workspace>/.Codex/automations/routines.json
 *   <workspace>/.Codex/automations/runs.json
 *   <workspace>/.Codex/automations/manifests/<runId>.json
 *
 * Writes are atomic (temp file + rename) and the manifest run-id is validated
 * to forbid path traversal, matching the Rust hardening.
 */
export class AutomationStore {
  readonly root: string

  constructor(workspaceRoot: string) {
    this.root = join(workspaceRoot, '.Codex', 'automations')
  }

  ensureDirs(): void {
    mkdirSync(join(this.root, 'manifests'), { recursive: true })
  }

  listRoutines(): AutomationRoutine[] {
    return this.readRoutinesFile().routines
  }

  saveRoutines(routines: AutomationRoutine[]): void {
    this.ensureDirs()
    writeJson(this.routinesPath(), { routines })
  }

  upsertRoutine(routine: AutomationRoutine): void {
    const routines = this.listRoutines()
    const index = routines.findIndex((r) => r.id === routine.id)
    if (index >= 0) routines[index] = routine
    else routines.push(routine)
    this.saveRoutines(routines)
  }

  getRoutine(id: string): AutomationRoutine {
    const routine = this.listRoutines().find((r) => r.id === id)
    if (!routine) throw new Error(`routine not found: ${id}`)
    return routine
  }

  deleteRoutine(id: string): void {
    this.saveRoutines(this.listRoutines().filter((r) => r.id !== id))
  }

  listRuns(): AutomationRun[] {
    return this.readRunsFile().runs
  }

  listRunsForRoutine(routineId: string): AutomationRun[] {
    return this.listRuns()
      .filter((run) => run.routine_id === routineId)
      .sort((a, b) => (a.started_at < b.started_at ? 1 : a.started_at > b.started_at ? -1 : 0))
  }

  upsertRun(run: AutomationRun): void {
    this.ensureDirs()
    if (run.manifest) this.saveManifest(run.id, run.manifest)

    const runs = this.readRunsFile().runs
    const index = runs.findIndex((r) => r.id === run.id)
    if (index >= 0) runs[index] = run
    else runs.push(run)
    writeJson(this.runsPath(), { runs })
  }

  getRun(runId: string): AutomationRun {
    const run = this.listRuns().find((r) => r.id === runId)
    if (!run) throw new Error(`automation run not found: ${runId}`)
    return run
  }

  private saveManifest(runId: string, manifest: RunManifest): void {
    this.ensureDirs()
    validateManifestRunId(runId)
    writeJson(this.manifestPath(runId), manifest)
  }

  private readRoutinesFile(): { routines: AutomationRoutine[] } {
    return readJsonOrDefault(this.routinesPath(), { routines: [] })
  }

  private readRunsFile(): { runs: AutomationRun[] } {
    return readJsonOrDefault(this.runsPath(), { runs: [] })
  }

  private routinesPath(): string {
    return join(this.root, 'routines.json')
  }

  private runsPath(): string {
    return join(this.root, 'runs.json')
  }

  private manifestPath(runId: string): string {
    return join(this.root, 'manifests', `${runId}.json`)
  }
}

function readJsonOrDefault<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  const data = readFileSync(path, 'utf8')
  try {
    return JSON.parse(data) as T
  } catch (err) {
    throw new Error(`invalid json ${path}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const data = `${JSON.stringify(value, null, 2)}\n`
  const tempPath = tempJsonPath(path)
  try {
    // create_new equivalent: 'wx' fails if the temp file already exists.
    const fd = openSync(tempPath, 'wx')
    writeFileSync(fd, data)
    closeSync(fd)
    renameSync(tempPath, path)
  } catch (err) {
    rmSync(tempPath, { force: true })
    throw err
  }
}

function tempJsonPath(path: string): string {
  const file = path.split('/').pop() ?? path
  return join(dirname(path), `.${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`)
}

function validateManifestRunId(runId: string): void {
  if (runId === '') throw new Error('invalid automation run id for manifest filename: empty')
  if (runId === '..' || runId.includes('..')) {
    throw new Error(`invalid automation run id for manifest filename: ${runId}`)
  }
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
    throw new Error(`invalid automation run id for manifest filename: ${runId}`)
  }
}
