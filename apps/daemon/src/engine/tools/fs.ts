import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ChangeSet, ChangeSetOperation } from '@journal/contracts'
import type { EngineAgentTool, EngineToolContext } from './context.js'
import {
  assertAllowed,
  authorizeToolPath,
  normalizeWorkspaceRelative,
  resolvePath,
  schema,
  textResult,
} from './context.js'

export function createFsTools(ctx: EngineToolContext): EngineAgentTool[] {
  return [
    createReadFileTool(ctx),
    createWriteFileTool(ctx),
    createEditFileTool(ctx),
    createMoveFileTool(ctx),
    createDeleteFileTool(ctx),
  ]
}

function createReadFileTool(ctx: EngineToolContext): EngineAgentTool {
  return {
    name: 'read_file',
    label: 'Read File',
    description: 'Read a UTF-8 text file.',
    parameters: schema({
      type: 'object',
      properties: { path: { type: 'string', description: 'File path' } },
      required: ['path'],
    }),
    execute: async (_toolCallId, params) => {
      const input = params as Record<string, unknown>
      const path = requiredString(input.path, 'path')
      assertAllowed(authorizeToolPath(ctx.authorizationMode, ctx.workspaceRoot, path, 'read'))
      const abs = resolvePath(ctx.workspaceRoot, path)
      const content = readFileSync(abs, 'utf8')
      return textResult(content, {
        kind: 'fs',
        operation: 'read',
        path: normalizeWorkspaceRelative(ctx.workspaceRoot, abs),
        bytes: Buffer.byteLength(content, 'utf8'),
        runId: ctx.runId,
      })
    },
  }
}

function createWriteFileTool(ctx: EngineToolContext): EngineAgentTool {
  return {
    name: 'write_file',
    label: 'Write File',
    description: 'Create or overwrite a UTF-8 text file. Records a ChangeSet before writing.',
    parameters: schema({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'New file content' },
      },
      required: ['path', 'content'],
    }),
    executionMode: 'sequential',
    execute: async (_toolCallId, params) => {
      const input = params as Record<string, unknown>
      const path = requiredString(input.path, 'path')
      const content = requiredString(input.content, 'content')
      const abs = resolvePath(ctx.workspaceRoot, path)
      const operation: ChangeSetOperation = existsSync(abs) ? 'edit' : 'create'
      const changeSet = recordChange(ctx, path, operation, content)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content, 'utf8')
      return textResult(`wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path}`, {
        kind: 'fs',
        operation,
        path: normalizeWorkspaceRelative(ctx.workspaceRoot, abs),
        changeSet,
        runId: ctx.runId,
      })
    },
  }
}

function createEditFileTool(ctx: EngineToolContext): EngineAgentTool {
  return {
    name: 'edit_file',
    label: 'Edit File',
    description:
      'Replace text in a UTF-8 file using regex by default or literal matching when literal=true.',
    parameters: schema({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        old_string: { type: 'string', description: 'Text or regex pattern to replace' },
        new_string: { type: 'string', description: 'Replacement text' },
        literal: { type: 'boolean', description: 'Treat old_string as literal text' },
        first_only: { type: 'boolean', description: 'Only replace the first occurrence' },
      },
      required: ['path', 'old_string', 'new_string'],
    }),
    executionMode: 'sequential',
    execute: async (_toolCallId, params) => {
      const input = params as Record<string, unknown>
      const path = requiredString(input.path, 'path')
      const oldString = requiredString(input.old_string, 'old_string')
      const newString = requiredString(input.new_string, 'new_string')
      if (!oldString) throw new Error('old_string cannot be empty')
      const abs = resolvePath(ctx.workspaceRoot, path)
      assertAllowed(authorizeToolPath(ctx.authorizationMode, ctx.workspaceRoot, abs, 'write'))
      const content = readFileSync(abs, 'utf8')
      const { content: nextContent, count } = replaceContent(content, oldString, newString, {
        literal: Boolean(input.literal),
        firstOnly: Boolean(input.first_only),
      })
      if (count === 0) throw new Error(`pattern not found in ${path}`)
      const changeSet = recordChange(ctx, path, 'edit', nextContent)
      writeFileSync(abs, nextContent, 'utf8')
      return textResult(`replaced ${count} occurrence(s) in ${path}`, {
        kind: 'fs',
        operation: 'edit',
        path: normalizeWorkspaceRelative(ctx.workspaceRoot, abs),
        changeSet,
        runId: ctx.runId,
      })
    },
  }
}

function createMoveFileTool(ctx: EngineToolContext): EngineAgentTool {
  return {
    name: 'move_file',
    label: 'Move File',
    description: 'Move or rename a file. Records a ChangeSet before moving.',
    parameters: schema({
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' },
      },
      required: ['source', 'destination'],
    }),
    executionMode: 'sequential',
    execute: async (_toolCallId, params) => {
      const input = params as Record<string, unknown>
      const source = requiredString(input.source, 'source')
      const destination = requiredString(input.destination, 'destination')
      const sourceAbs = resolvePath(ctx.workspaceRoot, source)
      const destAbs = resolvePath(ctx.workspaceRoot, destination)
      if (!existsSync(sourceAbs)) throw new Error(`source not found: ${source}`)
      assertAllowed(authorizeToolPath(ctx.authorizationMode, ctx.workspaceRoot, destAbs, 'write'))
      if (existsSync(destAbs)) throw new Error(`destination already exists: ${destination}`)
      const changeSet = recordChange(ctx, source, 'move', undefined)
      mkdirSync(dirname(destAbs), { recursive: true })
      renameSync(changeSet.beforePath ?? sourceAbs, destAbs)
      return textResult(`moved ${source} to ${destination}`, {
        kind: 'fs',
        operation: 'move',
        path: normalizeWorkspaceRelative(ctx.workspaceRoot, sourceAbs),
        destination: normalizeWorkspaceRelative(ctx.workspaceRoot, destAbs),
        changeSet,
        runId: ctx.runId,
      })
    },
  }
}

function createDeleteFileTool(ctx: EngineToolContext): EngineAgentTool {
  return {
    name: 'delete_file',
    label: 'Delete File',
    description: 'Move a file into .journal-trash through ChangeSetService so it can be reverted.',
    parameters: schema({
      type: 'object',
      properties: { path: { type: 'string', description: 'Path to delete' } },
      required: ['path'],
    }),
    executionMode: 'sequential',
    execute: async (_toolCallId, params) => {
      const input = params as Record<string, unknown>
      const path = requiredString(input.path, 'path')
      const abs = resolvePath(ctx.workspaceRoot, path)
      if (!existsSync(abs)) throw new Error(`path not found: ${path}`)
      const changeSet = recordChange(ctx, path, 'remove', undefined)
      return textResult(`moved to .journal-trash: ${path}`, {
        kind: 'fs',
        operation: 'remove',
        path: normalizeWorkspaceRelative(ctx.workspaceRoot, abs),
        changeSet,
        runId: ctx.runId,
      })
    },
  }
}

function recordChange(
  ctx: EngineToolContext,
  path: string,
  operation: ChangeSetOperation,
  afterContent: string | undefined,
): ChangeSet {
  const rel = normalizeWorkspaceRelative(ctx.workspaceRoot, path)
  const changeSet = ctx.changeSetService.recordChangeSet({
    runId: ctx.runId,
    path: rel,
    operation,
    mode: ctx.authorizationMode,
    afterContent,
    risk: operation === 'remove' ? 'medium' : 'low',
  })
  if (changeSet.status !== 'applied') {
    throw new Error('write blocked by authorization policy')
  }
  return changeSet
}

function replaceContent(
  content: string,
  oldString: string,
  newString: string,
  opts: { literal: boolean; firstOnly: boolean },
): { content: string; count: number } {
  if (opts.literal) {
    const count = content.split(oldString).length - 1
    if (opts.firstOnly) {
      return { content: content.replace(oldString, newString), count: Math.min(count, 1) }
    }
    return { content: content.split(oldString).join(newString), count }
  }
  const flags = opts.firstOnly ? 'm' : 'gm'
  const regex = new RegExp(oldString, flags)
  const countFlags = flags.includes('g') ? flags : `g${flags}`
  const count = [...content.matchAll(new RegExp(oldString, countFlags))].length
  return { content: content.replace(regex, newString), count }
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`missing '${name}' field`)
  return value
}
