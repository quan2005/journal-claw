import type { Provider } from '@earendil-works/pi-ai'
import type { Agent, AgentEvent } from '@earendil-works/pi-agent-core'
import { formatSkillsForSystemPrompt } from '@earendil-works/pi-agent-core'
import type { Skill } from '@earendil-works/pi-agent-core'
import type { AuthorizationMode } from '@journal/contracts'
import type { ChangeSetService } from '../changeset/service.js'
import type { ConfigService } from '../config/service.js'
import type { AgentRunService } from '../runs/service.js'
import type { SkillsService } from '../skills/service.js'
import { PiEngineService } from './service.js'
import { mapPiAgentEvent } from './events.js'

const BUILTIN_SYSTEM_PROMPT = 'You are JournalClaw daemon built-in agent.'

export interface ExecuteBuiltinRunInput {
  runId: string
  prompt: string
  systemPrompt: string
  workspaceRoot: string
  authorizationMode?: AuthorizationMode
}

export interface ExecuteBuiltinRunOptions {
  providers?: Provider[]
  signal?: AbortSignal
  changeSetService?: ChangeSetService
  skillsService?: SkillsService
  onSystemPrompt?: (systemPrompt: string) => void
  createAgent?: (engine: PiEngineService) => Agent
}

export interface ExecuteBuiltinRunResult {
  ok: boolean
}

export async function executeBuiltinRun(
  service: AgentRunService,
  configService: ConfigService,
  input: ExecuteBuiltinRunInput,
  options: ExecuteBuiltinRunOptions = {},
): Promise<ExecuteBuiltinRunResult> {
  const run = service.getRun(input.runId)
  const meta = { runId: input.runId, sessionId: run?.sessionId ?? input.runId }
  const systemPrompt = buildPiSystemPrompt(input.systemPrompt, options.skillsService)
  options.onSystemPrompt?.(systemPrompt)

  const engine = new PiEngineService(configService, {
    providers: options.providers,
    systemPrompt,
    workspaceRoot: input.workspaceRoot,
    runId: input.runId,
    authorizationMode: input.authorizationMode,
    changeSetService: options.changeSetService,
    runService: service,
  })
  const agent = options.createAgent ? options.createAgent(engine) : engine.createAgent()
  const unsubscribe = agent.subscribe((event) => {
    appendMappedPiEvents(service, input.runId, meta, event)
  })
  const removeAbortListener = bindAbort(options.signal, agent)

  try {
    await agent.prompt(input.prompt)
    const current = service.getRun(input.runId)
    return { ok: current?.status === 'succeeded' }
  } catch (err) {
    const current = service.getRun(input.runId)
    if (current?.status !== 'canceled') {
      service.appendEvent(input.runId, {
        type: 'run_failed',
        ...meta,
        data: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        timestamp: new Date().toISOString(),
      })
    }
    return { ok: false }
  } finally {
    removeAbortListener()
    unsubscribe()
  }
}

export function buildPiSystemPrompt(
  assembledContext: string,
  skillsService?: SkillsService,
): string {
  const parts = [BUILTIN_SYSTEM_PROMPT, '## Runtime Context', assembledContext]
  const skillsPrompt = skillsService
    ? formatSkillsForSystemPrompt(loadEnabledSkills(skillsService))
    : ''
  if (skillsPrompt.trim()) parts.push(skillsPrompt)
  return parts.join('\n\n')
}

function appendMappedPiEvents(
  service: AgentRunService,
  runId: string,
  meta: { runId: string; sessionId: string },
  event: AgentEvent,
): void {
  for (const mapped of mapPiAgentEvent(event, meta)) {
    service.appendEvent(runId, mapped)
  }
}

function bindAbort(signal: AbortSignal | undefined, agent: Agent): () => void {
  if (!signal) return () => {}
  const onAbort = (): void => {
    agent.abort()
  }
  if (signal.aborted) onAbort()
  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

function loadEnabledSkills(skillsService: SkillsService): Skill[] {
  return skillsService
    .listSkills()
    .filter((skill) => skill.enabled && !skill.shadowed_by)
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      content: safeReadSkillContent(skillsService, skill.id),
      filePath: skill.id,
    }))
}

function safeReadSkillContent(skillsService: SkillsService, skillId: string): string {
  try {
    return skillsService.getSkillContent(skillId)
  } catch {
    return ''
  }
}
