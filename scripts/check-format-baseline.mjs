#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASELINE_PATH = 'scripts/format-baseline.json'
const FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/

export function classifyFormatDebt(actualFiles, baselineFiles) {
  const newPaths = []
  const changedPaths = []

  for (const [path, fingerprint] of Object.entries(actualFiles)) {
    if (!(path in baselineFiles)) newPaths.push(path)
    else if (baselineFiles[path] !== fingerprint) changedPaths.push(path)
  }

  return { changedPaths: changedPaths.sort(), newPaths: newPaths.sort() }
}

export function findBaselineRegressions(currentFiles, referenceFiles) {
  const addedPaths = []
  const changedPaths = []

  for (const [path, fingerprint] of Object.entries(currentFiles)) {
    if (!(path in referenceFiles)) addedPaths.push(path)
    else if (referenceFiles[path] !== fingerprint) changedPaths.push(path)
  }

  return { addedPaths: addedPaths.sort(), changedPaths: changedPaths.sort() }
}

function parseBaseline(contents, source) {
  let baseline
  try {
    baseline = JSON.parse(contents)
  } catch (error) {
    throw new Error(`${source} is not valid JSON: ${error.message}`)
  }

  if (baseline?.version !== 1 || !baseline.files || Array.isArray(baseline.files)) {
    throw new Error(`${source} must contain { "version": 1, "files": { ... } }`)
  }

  for (const [path, fingerprint] of Object.entries(baseline.files)) {
    if (!path || typeof fingerprint !== 'string' || !FINGERPRINT_PATTERN.test(fingerprint)) {
      throw new Error(`${source} has an invalid fingerprint for ${path || '<empty path>'}`)
    }
  }

  return baseline.files
}

function fingerprintFile(repoRoot, path) {
  const normalizedContents = readFileSync(resolve(repoRoot, path), 'utf8').replaceAll('\r\n', '\n')
  return `sha256:${createHash('sha256').update(normalizedContents).digest('hex')}`
}

function loadReferenceBaseline(repoRoot, ref) {
  const commit = spawnSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (commit.status !== 0) {
    throw new Error(`cannot resolve format baseline reference ${ref}: ${commit.stderr.trim()}`)
  }

  const result = spawnSync('git', ['show', `${ref}:${BASELINE_PATH}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status === 0) return parseBaseline(result.stdout, `${ref}:${BASELINE_PATH}`)

  const missingAtRef =
    result.stderr.includes('does not exist in') ||
    result.stderr.includes('exists on disk, but not in') ||
    result.stderr.includes('Path exists on disk, but not in')
  if (missingAtRef) return null
  throw new Error(`cannot read ${ref}:${BASELINE_PATH}: ${result.stderr.trim()}`)
}

function printPaths(label, paths) {
  if (paths.length === 0) return
  console.error(label)
  for (const path of paths) console.error(`  ${path}`)
}

function runCli() {
  try {
    const scriptDirectory = dirname(fileURLToPath(import.meta.url))
    const repoRoot = resolve(scriptDirectory, '..')
    const baseline = parseBaseline(
      readFileSync(resolve(repoRoot, BASELINE_PATH), 'utf8'),
      BASELINE_PATH,
    )
    const reference = process.env.FORMAT_BASELINE_REF || 'HEAD'
    const referenceBaseline = loadReferenceBaseline(repoRoot, reference)

    if (referenceBaseline) {
      const regression = findBaselineRegressions(baseline, referenceBaseline)
      if (regression.addedPaths.length > 0 || regression.changedPaths.length > 0) {
        console.error(`[format-baseline] Baseline may only shrink relative to ${reference}.`)
        printPaths('Added baseline entries:', regression.addedPaths)
        printPaths('Rewritten baseline entries:', regression.changedPaths)
        process.exitCode = 1
        return
      }
    }

    const prettier = spawnSync('bunx', ['prettier', '--list-different', '**/*.{ts,tsx,md}'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    if (prettier.error || ![0, 1].includes(prettier.status)) {
      throw new Error(prettier.stderr || prettier.error?.message || 'Prettier failed to run')
    }

    const actualPaths = prettier.stdout
      .split(/\r?\n/)
      .map((path) => path.trim().replaceAll('\\', '/'))
      .filter(Boolean)
    const actualFiles = Object.fromEntries(
      actualPaths.map((path) => [path, fingerprintFile(repoRoot, path)]),
    )
    const debt = classifyFormatDebt(actualFiles, baseline)

    if (debt.newPaths.length > 0 || debt.changedPaths.length > 0) {
      console.error('[format-baseline] Formatting debt increased.')
      printPaths('New files with formatting differences:', debt.newPaths)
      printPaths('Known files with changed formatting debt:', debt.changedPaths)
      process.exitCode = 1
      return
    }

    const bootstrap = referenceBaseline ? '' : ' (initial baseline)'
    console.log(
      `[format-baseline] OK — ${actualPaths.length} unchanged known differences, 0 new or expanded${bootstrap}.`,
    )
  } catch (error) {
    console.error(`[format-baseline] ${error.message}`)
    process.exitCode = 1
  }
}

function isMainModule() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMainModule()) runCli()
