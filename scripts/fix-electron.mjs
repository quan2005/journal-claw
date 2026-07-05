#!/usr/bin/env node
/**
 * Fix incomplete Electron binary installation after `bun install`.
 *
 * Bun (as of 1.3.x) runs Electron's postinstall script, but the `extract-zip`
 * dependency resolves its promise without actually extracting on Node.js 26.
 * This leaves `dist/` with only a partial skeleton (e.g. missing
 * `Frameworks/` on macOS) and no `path.txt`, so Electron crashes on launch.
 *
 * This script reuses @electron/get to obtain the cached/downloaded zip, then
 * extracts it with the system unzip tool (macOS/Linux) or PowerShell
 * Expand-Archive (Windows), and writes `path.txt` without a trailing newline.
 */
import { execFileSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { platform, homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// @ts-ignore createRequire is available in Node.js ESM
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const IS_WIN = platform() === 'win32'
const IS_MAC = platform() === 'darwin'

function log(message) {
  // eslint-disable-next-line no-console
  console.log(`[fix-electron] ${message}`)
}

async function resolveElectronDir() {
  // Electron is a devDependency of apps/desktop. In a Bun workspace it lives
  // in the content-addressable store under node_modules/.bun/electron@<hash>/.
  const candidates = [
    join(process.cwd(), 'node_modules/electron'),
    join(process.cwd(), 'apps/desktop/node_modules/electron'),
  ]
  const bunRoot = join(process.cwd(), 'node_modules/.bun')
  try {
    const entries = await readdir(bunRoot)
    for (const entry of entries) {
      if (entry.startsWith('electron@')) {
        candidates.push(join(bunRoot, entry, 'node_modules/electron'))
      }
    }
  } catch {
    // ignore
  }

  for (const candidate of candidates) {
    const s = await stat(join(candidate, 'package.json')).catch(() => null)
    if (s?.isFile()) return candidate
  }
  throw new Error('electron not found in node_modules')
}

function getPlatformPath() {
  if (IS_MAC) return 'Electron.app/Contents/MacOS/Electron'
  if (IS_WIN) return 'electron.exe'
  return 'electron'
}

function getExecutablePath(electronDir) {
  return join(electronDir, 'dist', getPlatformPath())
}

async function isInstalled(electronDir) {
  const pathFile = join(electronDir, 'path.txt')
  const executable = getExecutablePath(electronDir)
  try {
    const [pathContent, executableStat] = await Promise.all([
      readFile(pathFile, 'utf-8').catch(() => ''),
      stat(executable).catch(() => null),
    ])
    return pathContent.trim() === getPlatformPath() && executableStat?.isFile() === true
  } catch {
    return false
  }
}

async function findCachedZip(version) {
  const platform = IS_MAC ? 'darwin' : IS_WIN ? 'win32' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const zipName = `electron-v${version}-${platform}-${arch}.zip`

  const cacheRoots = []
  if (IS_MAC) cacheRoots.push(join(homedir(), 'Library/Caches/electron'))
  if (IS_WIN) cacheRoots.push(join(homedir(), 'AppData/Local/electron/Cache'))
  cacheRoots.push(join(homedir(), '.cache/electron'))
  cacheRoots.push(join(homedir(), '.electron'))

  for (const root of cacheRoots) {
    try {
      const entries = await readdir(root)
      // @electron/get stores zips under a content-addressed subdirectory.
      for (const entry of entries) {
        const candidate = join(root, entry, zipName)
        const s = await stat(candidate).catch(() => null)
        if (s?.isFile()) return candidate
      }
      // Also check the root itself (older cache layouts).
      const direct = join(root, zipName)
      const s = await stat(direct).catch(() => null)
      if (s?.isFile()) return direct
    } catch {
      // ignore
    }
  }
  return null
}

async function downloadZip(electronDir, version) {
  // Prefer cache; fall back to @electron/get download.
  const cached = await findCachedZip(version)
  if (cached) {
    log(`using cached zip: ${cached}`)
    return cached
  }

  log('downloading electron via @electron/get...')
  const { downloadArtifact } = await import('@electron/get')
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: IS_MAC ? 'darwin' : IS_WIN ? 'win32' : 'linux',
    arch: process.arch === 'arm64' ? 'arm64' : 'x64',
    cacheRoot: process.env.electron_config_cache,
  })
  log(`downloaded to: ${zipPath}`)
  return zipPath
}

async function extractZip(zipPath, distPath) {
  await rm(distPath, { recursive: true, force: true })
  await mkdir(distPath, { recursive: true })

  if (IS_WIN) {
    // PowerShell Expand-Archive is available on Windows 8+ / Server 2012+.
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${distPath}" -Force`,
      ],
      { stdio: 'inherit' },
    )
  } else {
    execFileSync('unzip', ['-q', zipPath, '-d', distPath], { stdio: 'inherit' })
  }
}

async function writePathFile(electronDir) {
  const pathFile = join(electronDir, 'path.txt')
  const platformPath = getPlatformPath()
  await new Promise((resolve, reject) => {
    const stream = createWriteStream(pathFile)
    stream.on('error', reject)
    stream.on('finish', resolve)
    stream.write(platformPath)
    stream.end()
  })
}

async function main() {
  let electronDir
  try {
    electronDir = await resolveElectronDir()
  } catch {
    log('electron not found in node_modules; skipping')
    return
  }

  const { version } = require(join(electronDir, 'package.json'))
  log(`electron ${version} at ${electronDir}`)

  if (await isInstalled(electronDir)) {
    log('electron binary is already complete')
    return
  }

  log('electron binary incomplete; repairing...')
  const zipPath = await downloadZip(electronDir, version)
  const distPath = join(electronDir, 'dist')
  await extractZip(zipPath, distPath)
  await writePathFile(electronDir)

  if (await isInstalled(electronDir)) {
    log('electron repaired successfully')
  } else {
    throw new Error('electron repair failed; dist is still incomplete')
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[fix-electron] ${err.message}`)
  process.exit(1)
})
