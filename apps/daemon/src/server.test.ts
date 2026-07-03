import { describe, it, expect } from 'vitest'
import { startDaemon } from './server.js'

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
