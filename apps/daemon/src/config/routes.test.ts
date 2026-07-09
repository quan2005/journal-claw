import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConfigService } from './service.js'
import { startDaemon, type DaemonHandle } from '../server.js'

describe('config HTTP routes', () => {
  let dir: string
  let handle: DaemonHandle | null

  beforeEach(async () => {
    dir = join(tmpdir(), `journal-config-routes-${Math.random().toString(36).slice(2)}`)
    mkdirSync(dir, { recursive: true })
    handle = null
    const port = 21000 + Math.floor(Math.random() * 10000)
    handle = await startDaemon({
      port,
      configService: new ConfigService({
        configDir: dir,
        packageJsonPath: join(dir, 'package.json'),
      }),
    }).catch(() => null)
  })

  afterEach(async () => {
    await handle?.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves API key, engine, workspace path, app version, and capabilities', async () => {
    if (!handle) return
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.2.3' }))

    await expect(get('/config/api-key')).resolves.toEqual({ key: null })
    await put('/config/api-key', { key: 'sk-route-secret' })
    await expect(get('/config/api-key')).resolves.toEqual({ key: 'sk-route-secret' })

    const engine = {
      active_provider: 'deepseek',
      providers: [
        {
          protocol: 'openai',
          id: 'deepseek',
          label: 'DeepSeek',
          api_key: '',
          base_url: '',
          models: [],
        },
      ],
    }
    await put('/config/engine', { config: engine })
    await expect(get('/config/engine')).resolves.toEqual(engine)

    await put('/config/workspace-path', { path: join(dir, 'workspace') })
    await expect(get('/config/workspace-path')).resolves.toEqual({ path: join(dir, 'workspace') })
    await expect(get('/config/app-version')).resolves.toEqual({ version: '1.2.3' })
    await expect(get('/config/platform-capabilities')).resolves.toMatchObject({
      apple_stt: false,
      whisperkit: false,
      speaker_diarization: false,
    })
  })

  it('local CRUD routes use the configured workspace path', async () => {
    if (!handle) return
    const workspace = join(dir, 'workspace')
    mkdirSync(join(workspace, '2606'), { recursive: true })
    await put('/config/workspace-path', { path: workspace })

    await expect(get('/journal/months')).resolves.toEqual(['2606'])
  })

  it('returns structured 400 for invalid engine config', async () => {
    if (!handle) return
    const res = await fetch(`${handle.url}/config/engine`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          active_provider: 'missing',
          providers: [
            { protocol: 'openai', id: 'deepseek', label: '', api_key: '', base_url: '', model: '' },
          ],
        },
      }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'invalid_engine_config', field: 'active_provider' },
    })
  })

  async function get(path: string): Promise<unknown> {
    if (!handle) throw new Error('daemon not started')
    const res = await fetch(`${handle.url}${path}`)
    expect(res.ok).toBe(true)
    return res.json()
  }

  async function put(path: string, body: Record<string, unknown>): Promise<void> {
    if (!handle) throw new Error('daemon not started')
    const res = await fetch(`${handle.url}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.ok).toBe(true)
  }
})
