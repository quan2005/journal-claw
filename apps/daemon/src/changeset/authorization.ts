/**
 * AuthorizationMode decision engine + claude permission-mode mapping.
 *
 * Three modes (AuthorizationMode from contracts):
 *   read_only       — deny ALL writes (structured rejection)
 *   workspace_write — allow writes only inside the workspace root
 *   full_access     — allow all writes (no path restriction)
 *   wide_with_audit — like full_access but audited (same allowance as full)
 *
 * toClaudePermissionMode maps each to claude's --permission-mode choices
 * (measured on claude 2.1.191: acceptEdits/auto/bypassPermissions/default/
 * dontAsk/plan). The mapping:
 *   read_only       -> plan          (claude plans but makes no edits)
 *   workspace_write -> acceptEdits   (auto-accept edits within the session)
 *   full_access     -> bypassPermissions
 *   wide_with_audit -> bypassPermissions
 */
import { resolve, relative, isAbsolute } from 'node:path'
import type { AuthorizationMode } from '@journal/contracts'

export interface AuthorizationDecision {
  allowed: boolean
  reason?: string
}

/**
 * Is `path` writable under `mode` given `workspaceRoot`?
 * `path` may be absolute or workspace-relative; it's resolved against root.
 */
export function isPathAllowed(
  mode: AuthorizationMode,
  workspaceRoot: string,
  path: string,
): AuthorizationDecision {
  if (mode === 'read_only') {
    return { allowed: false, reason: 'authorization mode is read_only — no writes permitted' }
  }
  if (mode === 'full_access' || mode === 'wide_with_audit') {
    return { allowed: true }
  }
  // workspace_write: path must resolve strictly inside workspaceRoot.
  const root = resolve(workspaceRoot)
  const target = isAbsolute(path) ? resolve(path) : resolve(root, path)
  const rel = relative(root, target)
  // relative() returns a path starting with '..' if target escapes root.
  if (rel.startsWith('..') || rel === '') {
    // rel === '' means target === root itself (writing the root dir is odd but
    // not an escape); treat '' as allowed, only '..' escapes are denied.
    if (rel === '') return { allowed: true }
    return { allowed: false, reason: `path escapes workspace root: ${path}` }
  }
  return { allowed: true }
}

export function toClaudePermissionMode(
  mode: AuthorizationMode,
): 'plan' | 'acceptEdits' | 'bypassPermissions' {
  switch (mode) {
    case 'read_only':
      return 'plan'
    case 'workspace_write':
      return 'acceptEdits'
    case 'full_access':
    case 'wide_with_audit':
      return 'bypassPermissions'
  }
}
