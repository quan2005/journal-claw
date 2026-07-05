import type { EngineAgentTool, EngineToolContext } from './context.js'
import { schema, textResult } from './context.js'

export function createSubtaskTool(ctx: EngineToolContext): EngineAgentTool {
  return {
    name: 'subtask',
    label: 'Subtask',
    description:
      'Spawn a child agent run for an isolated task. ME-b records the child run; ME-c wires execution.',
    parameters: schema({
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Self-contained instructions for the child agent.',
        },
      },
      required: ['prompt'],
    }),
    executionMode: 'sequential',
    execute: async (_toolCallId, params) => {
      const input = params as Record<string, unknown>
      const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''
      if (!prompt) throw new Error("missing or empty 'prompt'")
      const child = ctx.runService?.createRun({
        goal: prompt,
        mode: 'agent',
        authorizationMode: ctx.authorizationMode,
        parentRunId: ctx.runId,
      })
      return textResult(
        child ? `spawned child run ${child.id}` : 'subtask queued for ME-c execution',
        {
          kind: 'subtask',
          prompt,
          parentRunId: ctx.runId,
          childRunId: child?.id,
          status: child ? 'created' : 'stubbed',
        },
      )
    },
  }
}

export { createSubtaskTool as createTaskTool }
