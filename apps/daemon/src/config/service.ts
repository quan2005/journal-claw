import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export interface ProviderEntry {
  protocol: string
  id: string
  label: string
  api_key: string
  base_url: string
  model: string
}

export interface EngineConfig {
  active_provider: string
  providers: ProviderEntry[]
}

export interface PlatformCapabilities {
  os: string
  apple_stt: boolean
  whisperkit: boolean
  speaker_diarization: boolean
  native_permissions: boolean
}

interface EncryptedSecret {
  alg: 'aes-256-gcm'
  iv: string
  tag: string
  ciphertext: string
}

interface StoredConfig {
  api_key?: EncryptedSecret
  engine_config?: EngineConfig
  workspace_path?: string
  sample_entry_created?: boolean
  [key: string]: unknown
}

export interface ConfigServiceOptions {
  configDir?: string
  legacyConfigPath?: string
  packageJsonPath?: string
}

export class ConfigValidationError extends Error {
  constructor(
    readonly field: string,
    readonly value: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

const CONFIG_FILE = 'config.json'
const SECRET_FILE = 'secret.key'
const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  active_provider: 'deepseek',
  providers: [],
}

export class ConfigService {
  readonly configDir: string

  private readonly configPath: string
  private readonly secretPath: string
  private readonly legacyConfigPath: string
  private readonly packageJsonPath: string

  constructor(opts: ConfigServiceOptions = {}) {
    this.configDir = resolve(opts.configDir ?? defaultConfigDir())
    this.configPath = join(this.configDir, CONFIG_FILE)
    this.secretPath = join(this.configDir, SECRET_FILE)
    this.legacyConfigPath = opts.legacyConfigPath ?? defaultLegacyRustConfigPath()
    this.packageJsonPath = opts.packageJsonPath ?? resolve(process.cwd(), 'package.json')
  }

  getApiKey(): string | null {
    const encrypted = this.load().api_key
    if (!encrypted) return null
    try {
      return this.decrypt(encrypted)
    } catch {
      return null
    }
  }

  setApiKey(key: string): void {
    if (typeof key !== 'string') throw invalid('key', key)
    const current = this.load()
    current.api_key = this.encrypt(key)
    this.persist(current)
  }

  getEngineConfig(): EngineConfig {
    return normalizeEngineConfig(this.load().engine_config)
  }

  setEngineConfig(config: EngineConfig): void {
    const normalized = normalizeEngineConfig(config, { strict: true })
    this.persist({ ...this.load(), engine_config: normalized })
  }

  getWorkspacePath(): string {
    const current = this.load()
    if (typeof current.workspace_path === 'string' && current.workspace_path.length > 0) {
      return current.workspace_path
    }

    const migrated = this.readLegacyWorkspacePath()
    if (migrated) {
      this.persist({ ...current, workspace_path: migrated })
      return migrated
    }

    return defaultWorkspacePath()
  }

  setWorkspacePath(path: string): void {
    if (typeof path !== 'string') throw invalid('workspace_path', path)
    mkdirSync(path, { recursive: true })
    this.persist({ ...this.load(), workspace_path: path })
  }

  getSampleEntryCreated(): boolean {
    return this.load().sample_entry_created === true
  }

  setSampleEntryCreated(created: boolean): void {
    this.persist({ ...this.load(), sample_entry_created: created })
  }

  getAppVersion(): string {
    try {
      const parsed = JSON.parse(readFileSync(this.packageJsonPath, 'utf8')) as unknown
      if (isRecord(parsed) && typeof parsed.version === 'string') return parsed.version
    } catch {
      // fall through
    }
    return '0.0.0'
  }

  getPlatformCapabilities(): PlatformCapabilities {
    return {
      os: osName(),
      apple_stt: false,
      whisperkit: false,
      speaker_diarization: false,
      native_permissions: platform() === 'darwin',
    }
  }

  private load(): StoredConfig {
    if (!existsSync(this.configPath)) return {}
    try {
      const parsed = JSON.parse(readFileSync(this.configPath, 'utf8')) as unknown
      return isRecord(parsed) ? (parsed as StoredConfig) : {}
    } catch {
      return {}
    }
  }

  private persist(config: StoredConfig): void {
    mkdirSync(this.configDir, { recursive: true })
    writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  }

  private encrypt(plaintext: string): EncryptedSecret {
    const key = this.deriveKey()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return {
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    }
  }

  private decrypt(encrypted: EncryptedSecret): string {
    if (!isEncryptedSecret(encrypted)) throw new Error('invalid encrypted api key')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.deriveKey(),
      Buffer.from(encrypted.iv, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  }

  private deriveKey(): Buffer {
    const secret = this.readOrCreateSecret()
    return createHash('sha256').update('journal-daemon-config-v1').update(secret).digest()
  }

  private readOrCreateSecret(): Buffer {
    mkdirSync(dirname(this.secretPath), { recursive: true })
    if (!existsSync(this.secretPath)) {
      const secret = randomBytes(32)
      writeFileSync(this.secretPath, secret.toString('base64'), { encoding: 'utf8', mode: 0o600 })
      chmodSync(this.secretPath, 0o600)
      return secret
    }
    chmodSync(this.secretPath, 0o600)
    const raw = readFileSync(this.secretPath, 'utf8').trim()
    const decoded = Buffer.from(raw, 'base64')
    if (decoded.length >= 32) return decoded
    return createHash('sha256').update(raw).digest()
  }

  private readLegacyWorkspacePath(): string | null {
    if (!existsSync(this.legacyConfigPath)) return null
    try {
      const parsed = JSON.parse(readFileSync(this.legacyConfigPath, 'utf8')) as unknown
      if (isRecord(parsed) && typeof parsed.workspace_path === 'string' && parsed.workspace_path) {
        return parsed.workspace_path
      }
    } catch {
      // ignore broken legacy config
    }
    return null
  }
}

function normalizeEngineConfig(value: unknown, opts: { strict?: boolean } = {}): EngineConfig {
  if (value === undefined || value === null) return { ...DEFAULT_ENGINE_CONFIG, providers: [] }
  if (!isRecord(value)) {
    if (opts.strict) throw invalid('engine_config', value)
    return { ...DEFAULT_ENGINE_CONFIG, providers: [] }
  }

  const activeProvider = typeof value.active_provider === 'string' ? value.active_provider : ''
  const providers = Array.isArray(value.providers)
    ? value.providers.map((entry, index) => normalizeProvider(entry, index, opts.strict === true))
    : []

  if (opts.strict) {
    if (typeof value.active_provider !== 'string') {
      throw invalid('active_provider', value.active_provider)
    }
    if (!Array.isArray(value.providers)) throw invalid('providers', value.providers)
    if (
      providers.length > 0 &&
      !providers.some((provider) => provider.id === value.active_provider)
    ) {
      throw invalid('active_provider', value.active_provider)
    }
  }

  return {
    active_provider: activeProvider || DEFAULT_ENGINE_CONFIG.active_provider,
    providers,
  }
}

function normalizeProvider(value: unknown, index: number, strict: boolean): ProviderEntry {
  if (!isRecord(value)) {
    if (strict) throw invalid(`providers.${index}`, value)
    return emptyProvider()
  }
  const provider: ProviderEntry = {
    protocol: stringField(value.protocol, 'openai', `providers.${index}.protocol`, strict),
    id: stringField(value.id, '', `providers.${index}.id`, strict),
    label: stringField(value.label, '', `providers.${index}.label`, strict),
    api_key: stringField(value.api_key, '', `providers.${index}.api_key`, strict),
    base_url: stringField(value.base_url, '', `providers.${index}.base_url`, strict),
    model: stringField(value.model, '', `providers.${index}.model`, strict),
  }
  return provider
}

function stringField(value: unknown, fallback: string, field: string, strict: boolean): string {
  if (typeof value === 'string') return value
  if (strict) throw invalid(field, value)
  return fallback
}

function emptyProvider(): ProviderEntry {
  return { protocol: 'openai', id: '', label: '', api_key: '', base_url: '', model: '' }
}

function defaultConfigDir(): string {
  if (process.env.JOURNAL_DAEMON_CONFIG_DIR) return process.env.JOURNAL_DAEMON_CONFIG_DIR
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, 'journal')

  const home = homedir()
  // Mirror standard per-user config locations: XDG on Linux, Application
  // Support on macOS, and AppData/Roaming on Windows. This is intentionally
  // outside the workspace so secrets do not travel with repository files.
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', 'journal')
  if (platform() === 'win32') {
    return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'journal')
  }
  return join(home, '.config', 'journal')
}

function defaultLegacyRustConfigPath(): string {
  const home = homedir()
  if (platform() === 'darwin') {
    return join(home, 'Library', 'Application Support', 'com.journalclaw.app', 'config.json')
  }
  if (platform() === 'win32') {
    return join(
      process.env.APPDATA ?? join(home, 'AppData', 'Roaming'),
      'com.journalclaw.app',
      'config.json',
    )
  }
  return join(
    process.env.XDG_CONFIG_HOME ?? join(home, '.config'),
    'com.journalclaw.app',
    'config.json',
  )
}

function defaultWorkspacePath(): string {
  return join(homedir(), 'Documents', 'journal')
}

function osName(): string {
  switch (platform()) {
    case 'darwin':
      return 'macos'
    case 'win32':
      return 'windows'
    case 'linux':
      return 'linux'
    default:
      return platform()
  }
}

function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  return (
    isRecord(value) &&
    value.alg === 'aes-256-gcm' &&
    typeof value.iv === 'string' &&
    typeof value.tag === 'string' &&
    typeof value.ciphertext === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(field: string, value: unknown): ConfigValidationError {
  return new ConfigValidationError(field, value, `invalid ${field}: ${String(value)}`)
}

export function secretFileMode(path: string): number | null {
  try {
    return statSync(path).mode & 0o777
  } catch {
    return null
  }
}
