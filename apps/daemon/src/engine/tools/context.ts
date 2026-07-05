import { resolve, relative, isAbsolute } from 'node:path'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { AuthorizationMode } from '@journal/contracts'
import { isPathAllowed, type AuthorizationDecision } from '../../changeset/authorization.js'
import { ChangeSetService } from '../../changeset/service.js'
import type { AgentRunService } from '../../runs/service.js'

export interface EngineToolContext {
  workspaceRoot: string
  runId: string
  authorizationMode: AuthorizationMode
  changeSetService: ChangeSetService
  runService?: AgentRunService
}

export interface EngineToolAuditEvent {
  toolCallId: string
  toolName: string
  details: unknown
  isError: boolean
  timestamp: string
}

export type EngineAgentTool = AgentTool<any, Record<string, unknown>>

export type FsToolName = 'read_file' | 'write_file' | 'edit_file' | 'move_file' | 'delete_file'

export const WRITE_TOOL_NAMES = new Set([
  'bash',
  'write_file',
  'edit_file',
  'move_file',
  'delete_file',
])
export const FS_TOOL_NAMES = new Set<FsToolName>([
  'read_file',
  'write_file',
  'edit_file',
  'move_file',
  'delete_file',
])

export function schema(input: unknown): AgentTool['parameters'] {
  return input as AgentTool['parameters']
}

export function textResult(text: string, details: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'text' as const, text }],
    details,
  }
}

export function normalizeWorkspaceRelative(workspaceRoot: string, path: string): string {
  const abs = resolvePath(workspaceRoot, path)
  return relative(resolve(workspaceRoot), abs).split(/[\\/]/).join('/')
}

export function resolvePath(workspaceRoot: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path)
}

export function authorizeToolPath(
  mode: AuthorizationMode,
  workspaceRoot: string,
  path: string,
  access: 'read' | 'write',
): AuthorizationDecision {
  if (access === 'write') {
    return isPathAllowed(mode, workspaceRoot, path)
  }
  if (mode === 'full_access' || mode === 'wide_with_audit') {
    return { allowed: true }
  }
  return isPathAllowed('workspace_write', workspaceRoot, path)
}

export function assertAllowed(decision: AuthorizationDecision): void {
  if (!decision.allowed) {
    throw new Error(decision.reason ?? 'tool call is not allowed by authorization mode')
  }
}
