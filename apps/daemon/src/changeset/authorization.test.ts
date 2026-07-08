import { describe, it, expect } from 'vitest'
import { isPathAllowed } from './authorization.js'

const ROOT = '/tmp/jr-ws'

describe('authorization.isPathAllowed', () => {
  it('read_only denies all writes with a structured reason', () => {
    const d = isPathAllowed('read_only', ROOT, `${ROOT}/note.md`)
    expect(d.allowed).toBe(false)
    expect(d.reason).toMatch(/read_only/)
  })

  it('workspace_write allows paths inside root', () => {
    expect(isPathAllowed('workspace_write', ROOT, `${ROOT}/a/b.md`).allowed).toBe(true)
    expect(isPathAllowed('workspace_write', ROOT, 'relative.md').allowed).toBe(true)
  })

  it('workspace_write denies escapes (../)', () => {
    const d = isPathAllowed('workspace_write', ROOT, `${ROOT}/../secret.md`)
    expect(d.allowed).toBe(false)
    expect(d.reason).toMatch(/escapes/)
  })

  it('workspace_write denies absolute paths outside root', () => {
    expect(isPathAllowed('workspace_write', ROOT, '/etc/passwd').allowed).toBe(false)
  })

  it('full_access allows everything', () => {
    expect(isPathAllowed('full_access', ROOT, '/etc/passwd').allowed).toBe(true)
    expect(isPathAllowed('full_access', ROOT, `${ROOT}/../x`).allowed).toBe(true)
  })

  it('wide_with_audit allows everything', () => {
    expect(isPathAllowed('wide_with_audit', ROOT, '/anywhere').allowed).toBe(true)
  })
})
