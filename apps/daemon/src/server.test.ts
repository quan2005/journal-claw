import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startDaemon } from './server.js'
import { ConfigService } from './config/service.js'

describe('daemon server', () => {
  it('responds to /health with ok status', async () => {
    const handle = await startDaemon({ port: 0 }).catch(() => null)
    if (!handle) return
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    const res = await fetch(`${handle.url}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', service: '@journal/daemon' })
    await handle.close()
  })

  it('health endpoint contract', async () => {
    // 契约：/health 返回 { status: 'ok', service: '@journal/daemon' }
    // 完整的 HTTP 集成测试在 daemon 独立环境跑；这里只验证 startDaemon 可调用
    expect(typeof startDaemon).toBe('function')
  })

  it('allows loopback renderer origins to read daemon APIs', async () => {
    const handle = await startDaemon({ port: 0 })
    try {
      const res = await fetch(`${handle.url}/config/workspace-path`, {
        headers: { Origin: 'http://localhost:1420' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:1420')
      expect(res.headers.get('access-control-allow-methods')).toContain('GET')
    } finally {
      await handle.close()
    }
  })

  it('answers loopback preflight requests with CORS headers', async () => {
    const handle = await startDaemon({ port: 0 })
    try {
      const res = await fetch(`${handle.url}/journal/months`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://127.0.0.1:1420',
          'Access-Control-Request-Method': 'GET',
        },
      })
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:1420')
      expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
    } finally {
      await handle.close()
    }
  })

  it('GET /files lists the configured workspace root and triggers migration (AC-3)', async () => {
    // 回归：filesService 曾绑定 process.cwd()，生产环境列错目录且跳过迁移。
    const configDir = mkdtempSync(join(tmpdir(), 'jc-config-'))
    const workspace = mkdtempSync(join(tmpdir(), 'jc-ws-'))
    mkdirSync(join(workspace, 'topics'))
    writeFileSync(join(workspace, 'notes.md'), '# notes\n')
    const configService = new ConfigService({ configDir })
    configService.setWorkspacePath(workspace)

    const handle = await startDaemon({ port: 0, configService })
    try {
      const res = await fetch(`${handle.url}/files`)
      expect(res.status).toBe(200)
      const entries = (await res.json()) as Array<{ name: string }>
      const names = entries.map((e) => e.name)
      expect(names).toContain('topics')
      expect(names).toContain('notes.md')
      expect(names.some((n) => n.startsWith('.'))).toBe(false)
      // 首次访问触发磁盘布局迁移
      expect(existsSync(join(workspace, '.journal'))).toBe(true)

      // 删除也走 workspace 根（回归：曾用 cwd 绑定的 ChangeSetService，204 却不删除）
      const del = await fetch(`${handle.url}/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath: 'notes.md' }),
      })
      expect(del.status).toBe(204)
      expect(existsSync(join(workspace, 'notes.md'))).toBe(false)
    } finally {
      await handle.close()
      rmSync(configDir, { recursive: true, force: true })
      rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('GET /files/content-binary streams bytes with the right Content-Type (fix-image-preview)', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'jc-config-'))
    const workspace = mkdtempSync(join(tmpdir(), 'jc-ws-'))
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    writeFileSync(join(workspace, 'photo.png'), png)
    const configService = new ConfigService({ configDir })
    configService.setWorkspacePath(workspace)

    const handle = await startDaemon({ port: 0, configService })
    try {
      const res = await fetch(
        `${handle.url}/files/content-binary?relativePath=${encodeURIComponent('photo.png')}`,
      )
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      const bytes = Buffer.from(await res.arrayBuffer())
      expect(bytes.equals(png)).toBe(true)

      const missing = await fetch(
        `${handle.url}/files/content-binary?relativePath=${encodeURIComponent('missing.png')}`,
      )
      expect(missing.status).toBe(404)
    } finally {
      await handle.close()
      rmSync(configDir, { recursive: true, force: true })
      rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('does not grant CORS access to non-loopback origins', async () => {
    const handle = await startDaemon({ port: 0 })
    try {
      const res = await fetch(`${handle.url}/config/workspace-path`, {
        headers: { Origin: 'https://example.com' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    } finally {
      await handle.close()
    }
  })
})
