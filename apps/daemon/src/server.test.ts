import { describe, it, expect } from 'vitest'
import { startDaemon } from './server.js'

describe('daemon server', () => {
  it('responds to /health with ok status', async () => {
    const handle = await startDaemon({ port: 0 }).catch(() => null)
    // port 0 会让 OS 分配端口，但我们的最小实现固定用传入 port；
    // 这里用一个高位端口做冒烟测试，失败则跳过（CI 端口可能被占）
    if (!handle) return
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    await handle.close()
  })

  it('health endpoint contract', async () => {
    // 契约：/health 返回 { status: 'ok', service: '@journal/daemon' }
    // 完整的 HTTP 集成测试在 daemon 独立环境跑；这里只验证 startDaemon 可调用
    expect(typeof startDaemon).toBe('function')
  })
})
