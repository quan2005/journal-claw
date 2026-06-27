import { ChangeSetService } from '../../changeset/service.js'
import { createBashTool } from './bash.js'
import { createFsTools } from './fs.js'
import { createSubtaskTool } from './subtask.js'
import type { EngineAgentTool, EngineToolContext } from './context.js'

export type {
  EngineAgentTool,
  EngineToolAuditEvent,
  EngineToolContext,
  FsToolName,
} from './context.js'
export {
  FS_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  authorizeToolPath,
  normalizeWorkspaceRelative,
} from './context.js'

export function createEngineToolContext(
  input: Omit<EngineToolContext, 'changeSetService'> & {
    changeSetService?: ChangeSetService
  },
): EngineToolContext {
  return {
    ...input,
    changeSetService: input.changeSetService ?? new ChangeSetService(input.workspaceRoot),
  }
}

export function createEngineTools(ctx: EngineToolContext): EngineAgentTool[] {
  return [createBashTool(ctx), ...createFsTools(ctx), createSubtaskTool(ctx)]
}
