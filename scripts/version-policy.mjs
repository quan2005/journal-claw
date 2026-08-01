#!/usr/bin/env node

import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const VERSION_FILES = [
  'package.json',
  'apps/web/package.json',
  'apps/daemon/package.json',
  'apps/desktop/package.json',
  'packages/contracts/package.json',
]

const WORKSPACE_VERSION_FILES = VERSION_FILES.slice(1)
const STABLE_PRE_MAJOR_VERSION = /^0\.\d+\.\d+$/
const PUBLIC_TAG = /^v(\d+)\.(\d+)\.(\d+)$/

function readJson(repoRoot, relativePath, issues) {
  try {
    return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'))
  } catch (error) {
    issues.push(`cannot read ${relativePath}: ${error.message}`)
    return undefined
  }
}

export function validateVersionPolicy(repoRoot, { tagName } = {}) {
  const issues = []
  const manifests = new Map()

  for (const relativePath of VERSION_FILES) {
    const manifest = readJson(repoRoot, relativePath, issues)
    if (manifest) manifests.set(relativePath, manifest)
  }

  const rootVersion = manifests.get('package.json')?.version
  if (typeof rootVersion !== 'string' || !STABLE_PRE_MAJOR_VERSION.test(rootVersion)) {
    issues.push(`product version must remain a stable 0.x release; received ${rootVersion}`)
  }

  for (const relativePath of WORKSPACE_VERSION_FILES) {
    const workspaceVersion = manifests.get(relativePath)?.version
    if (workspaceVersion !== rootVersion) {
      issues.push(
        `workspace version mismatch: ${relativePath}=${workspaceVersion}, product=${rootVersion}`,
      )
    }
  }

  const releaseManifest = readJson(repoRoot, '.release-please-manifest.json', issues)
  if (releaseManifest?.['.'] !== rootVersion) {
    issues.push(
      `release baseline mismatch: manifest=${releaseManifest?.['.']}, product=${rootVersion}`,
    )
  }

  const releaseConfig = readJson(repoRoot, 'release-please-config.json', issues)
  const productConfig = releaseConfig?.packages?.['.']
  if (productConfig?.['include-component-in-tag'] !== false) {
    issues.push('tag must omit component name: include-component-in-tag must be false')
  }
  if (productConfig?.['bump-minor-pre-major'] !== true) {
    issues.push('breaking changes must bump minor before 1.0')
  }
  if (productConfig?.['bump-patch-for-minor-pre-major'] !== true) {
    issues.push('compatible features must bump patch before 1.0')
  }

  const extraFiles = Array.isArray(productConfig?.['extra-files'])
    ? productConfig['extra-files']
    : []
  const extraFileCounts = new Map()
  for (const entry of extraFiles) {
    if (entry?.type !== 'json' || entry?.jsonpath !== '$.version') continue
    extraFileCounts.set(entry.path, (extraFileCounts.get(entry.path) ?? 0) + 1)
  }
  for (const relativePath of WORKSPACE_VERSION_FILES) {
    const count = extraFileCounts.get(relativePath) ?? 0
    if (count === 0) issues.push(`extra-files missing ${relativePath}`)
    if (count > 1) issues.push(`extra-files duplicates ${relativePath}`)
  }

  if (tagName !== undefined) {
    const match = PUBLIC_TAG.exec(tagName)
    if (!match) {
      issues.push(`tag must match vX.Y.Z; received ${tagName}`)
    } else if (Number(match[1]) >= 1) {
      issues.push(`1.0 is not permitted before compatibility gates pass; received ${tagName}`)
    } else if (tagName !== `v${rootVersion}`) {
      issues.push(`tag version must equal product version ${rootVersion}; received ${tagName}`)
    }
  }

  return issues
}

function parseArguments(argv) {
  if (argv.length === 0) return {}
  if (argv.length === 2 && argv[0] === '--tag' && argv[1]) {
    return { tagName: argv[1] }
  }
  throw new Error('usage: node scripts/version-policy.mjs [--tag vX.Y.Z]')
}

function runCli() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
  } catch (error) {
    console.error(`[version-policy] ${error.message}`)
    process.exitCode = 1
    return
  }

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const issues = validateVersionPolicy(repoRoot, options)
  if (issues.length === 0) {
    console.log('[version-policy] OK')
    return
  }

  for (const issue of issues) console.error(`[version-policy] ${issue}`)
  process.exitCode = 1
}

if (
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
) {
  runCli()
}
