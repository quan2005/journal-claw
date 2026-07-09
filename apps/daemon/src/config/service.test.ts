import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConfigService, secretFileMode, type EngineConfig } from './service.js'

describe('ConfigService', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `journal-config-${Math.random().toString(36).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('encrypts API key at rest and decrypts it on read', () => {
    const service = new ConfigService({ configDir: dir })

    service.setApiKey('sk-secret-value')

    expect(service.getApiKey()).toBe('sk-secret-value')
    const raw = readFileSync(join(dir, 'config.json'), 'utf8')
    expect(raw).not.toContain('sk-secret-value')
    expect(JSON.parse(raw)).toMatchObject({
      api_key: {
        alg: 'aes-256-gcm',
        iv: expect.any(String),
        tag: expect.any(String),
        ciphertext: expect.any(String),
      },
    })
    // Windows does not support Unix file permission bits; verify mode only on Unix.
    if (process.platform !== 'win32') {
      expect(secretFileMode(join(dir, 'secret.key'))).toBe(0o600)
    }
  })

  it('returns null when API key is missing or cannot be decrypted', () => {
    const service = new ConfigService({ configDir: dir })
    expect(service.getApiKey()).toBeNull()

    service.setApiKey('sk-secret-value')
    writeFileSync(join(dir, 'secret.key'), Buffer.alloc(32, 7).toString('base64'), {
      encoding: 'utf8',
      mode: 0o600,
    })

    expect(service.getApiKey()).toBeNull()
  })

  it('reads and writes engine config', () => {
    const service = new ConfigService({ configDir: dir })
    const config: EngineConfig = {
      active_provider: 'deepseek',
      providers: [
        {
          protocol: 'openai',
          id: 'deepseek',
          label: 'DeepSeek',
          api_key: '',
          base_url: 'https://api.deepseek.com/v1',
          models: ['deepseek-chat'],
        },
      ],
    }

    expect(service.getEngineConfig()).toEqual({ active_provider: 'deepseek', providers: [] })
    service.setEngineConfig(config)
    expect(service.getEngineConfig()).toEqual(config)
  })

  it('rejects invalid engine config when active provider is absent', () => {
    const service = new ConfigService({ configDir: dir })

    expect(() =>
      service.setEngineConfig({
        active_provider: 'missing',
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
      }),
    ).toThrow(/invalid active_provider/)
  })

  it('migrates a legacy single `model` field into the `models` array on read', () => {
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        engine_config: {
          active_provider: 'deepseek',
          providers: [
            {
              protocol: 'openai',
              id: 'deepseek',
              label: 'DeepSeek',
              api_key: '',
              base_url: 'https://api.deepseek.com/v1',
              model: 'deepseek-chat',
            },
          ],
        },
      }),
    )
    const service = new ConfigService({ configDir: dir })
    const cfg = service.getEngineConfig()
    expect(cfg.providers[0].models).toEqual(['deepseek-chat'])
    // The legacy scalar field is no longer surfaced on the normalized entry.
    expect((cfg.providers[0] as unknown as { model?: unknown }).model).toBeUndefined()
  })

  it('preserves an existing `models` array and falls back to empty when neither field is present', () => {
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        engine_config: {
          active_provider: 'deepseek',
          providers: [
            {
              protocol: 'openai',
              id: 'deepseek',
              label: 'DeepSeek',
              api_key: '',
              base_url: '',
              models: ['deepseek-chat', 'deepseek-reasoner'],
            },
            {
              protocol: 'openai',
              id: 'empty',
              label: 'Empty',
              api_key: '',
              base_url: '',
            },
          ],
        },
      }),
    )
    const service = new ConfigService({ configDir: dir })
    const cfg = service.getEngineConfig()
    expect(cfg.providers[0].models).toEqual(['deepseek-chat', 'deepseek-reasoner'])
    expect(cfg.providers[1].models).toEqual([])
  })

  it('migrates workspace_path from legacy Rust config without modifying it', () => {
    const legacyPath = join(dir, 'legacy', 'config.json')
    mkdirSync(join(dir, 'legacy'), { recursive: true })
    writeFileSync(legacyPath, JSON.stringify({ workspace_path: '/tmp/legacy-journal' }, null, 2))
    const before = readFileSync(legacyPath, 'utf8')

    const service = new ConfigService({
      configDir: join(dir, 'daemon'),
      legacyConfigPath: legacyPath,
    })

    expect(service.getWorkspacePath()).toBe('/tmp/legacy-journal')
    expect(readFileSync(legacyPath, 'utf8')).toBe(before)
    expect(JSON.parse(readFileSync(join(dir, 'daemon', 'config.json'), 'utf8'))).toMatchObject({
      workspace_path: '/tmp/legacy-journal',
    })
  })

  it('persists workspace_path in daemon user config', () => {
    const service = new ConfigService({ configDir: dir })
    const workspace = join(dir, 'workspace')

    service.setWorkspacePath(workspace)

    expect(existsSync(workspace)).toBe(true)
    expect(service.getWorkspacePath()).toBe(workspace)
  })

  it('persists sample_entry_created in daemon user config', () => {
    const service = new ConfigService({ configDir: dir })

    expect(service.getSampleEntryCreated()).toBe(false)
    service.setSampleEntryCreated(true)

    expect(service.getSampleEntryCreated()).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))).toMatchObject({
      sample_entry_created: true,
    })
  })

  it('reads app version from package.json and disables removed audio capabilities', () => {
    const pkg = join(dir, 'package.json')
    writeFileSync(pkg, JSON.stringify({ version: '9.8.7' }))
    const service = new ConfigService({ configDir: dir, packageJsonPath: pkg })

    expect(service.getAppVersion()).toBe('9.8.7')
    expect(service.getPlatformCapabilities()).toMatchObject({
      apple_stt: false,
      whisperkit: false,
      speaker_diarization: false,
    })
  })
})
