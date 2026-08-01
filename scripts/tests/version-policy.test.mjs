import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

let validateVersionPolicy
try {
  ;({ validateVersionPolicy } = await import('../version-policy.mjs'))
} catch {
  // The first red run intentionally occurs before the production module exists.
}

const tempRoots = []

function writeJson(root, relativePath, value) {
  const target = join(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
}

function createRepositoryFixture() {
  const root = mkdtempSync(join(tmpdir(), 'journal-version-policy-'))
  tempRoots.push(root)

  for (const relativePath of [
    'package.json',
    'apps/web/package.json',
    'apps/daemon/package.json',
    'apps/desktop/package.json',
    'packages/contracts/package.json',
  ]) {
    writeJson(root, relativePath, { version: '0.16.0' })
  }

  writeJson(root, '.release-please-manifest.json', { '.': '0.16.0' })
  writeJson(root, 'release-please-config.json', {
    packages: {
      '.': {
        'release-type': 'node',
        'include-component-in-tag': false,
        'bump-minor-pre-major': true,
        'bump-patch-for-minor-pre-major': true,
        'extra-files': [
          { type: 'json', path: 'apps/web/package.json', jsonpath: '$.version' },
          { type: 'json', path: 'apps/daemon/package.json', jsonpath: '$.version' },
          { type: 'json', path: 'apps/desktop/package.json', jsonpath: '$.version' },
          {
            type: 'json',
            path: 'packages/contracts/package.json',
            jsonpath: '$.version',
          },
        ],
      },
    },
  })

  return root
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true })
  }
})

test('accepts a lockstep pre-1.0 repository and its exact public tag', () => {
  const root = createRepositoryFixture()

  assert.equal(typeof validateVersionPolicy, 'function')
  assert.deepEqual(validateVersionPolicy(root), [])
  assert.deepEqual(validateVersionPolicy(root, { tagName: 'v0.16.0' }), [])
})

test('rejects a workspace version that diverges from the product version', () => {
  const root = createRepositoryFixture()
  writeJson(root, 'apps/web/package.json', { version: '0.16.1' })

  assert.match(validateVersionPolicy(root).join('\n'), /workspace version mismatch/)
})

test('rejects a release baseline that diverges from the product version', () => {
  const root = createRepositoryFixture()
  writeJson(root, '.release-please-manifest.json', { '.': '0.11.3' })

  assert.match(validateVersionPolicy(root).join('\n'), /release baseline mismatch/)
})

test('requires release-please to preserve the pre-1.0 version semantics', () => {
  const mutations = [
    ['include-component-in-tag', true, /tag must omit component name/],
    ['bump-minor-pre-major', false, /breaking changes must bump minor before 1\.0/],
    ['bump-patch-for-minor-pre-major', false, /compatible features must bump patch before 1\.0/],
  ]

  for (const [property, value, expected] of mutations) {
    const root = createRepositoryFixture()
    const config = readJson(root, 'release-please-config.json')
    config.packages['.'][property] = value
    writeJson(root, 'release-please-config.json', config)

    assert.match(validateVersionPolicy(root).join('\n'), expected)
  }
})

test('requires release-please to update every workspace version exactly once', () => {
  const root = createRepositoryFixture()
  const config = readJson(root, 'release-please-config.json')
  config.packages['.']['extra-files'] = [
    ...config.packages['.']['extra-files'].slice(0, 3),
    config.packages['.']['extra-files'][0],
  ]
  writeJson(root, 'release-please-config.json', config)

  const issues = validateVersionPolicy(root).join('\n')
  assert.match(issues, /extra-files missing packages\/contracts\/package\.json/)
  assert.match(issues, /extra-files duplicates apps\/web\/package\.json/)
})

test('rejects a component-prefixed, incomplete, mismatched, or 1.0 tag', () => {
  const root = createRepositoryFixture()

  assert.match(
    validateVersionPolicy(root, { tagName: 'journal-v0.16.0' }).join('\n'),
    /tag must match vX\.Y\.Z/,
  )
  assert.match(
    validateVersionPolicy(root, { tagName: 'v0.16' }).join('\n'),
    /tag must match vX\.Y\.Z/,
  )
  assert.match(
    validateVersionPolicy(root, { tagName: 'v0.16.1' }).join('\n'),
    /tag version must equal product version 0\.16\.0/,
  )
  assert.match(
    validateVersionPolicy(root, { tagName: 'v1.0.0' }).join('\n'),
    /1\.0 is not permitted/,
  )
})

test('CLI rejects unknown arguments with a stable usage diagnostic', () => {
  const script = fileURLToPath(new URL('../version-policy.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [script, '--unknown'], {
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /\[version-policy\] usage: node scripts\/version-policy\.mjs \[--tag vX\.Y\.Z\]/,
  )
})

test('CLI accepts the real repository and its exact tag', () => {
  const script = fileURLToPath(new URL('../version-policy.mjs', import.meta.url))
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
  const productVersion = readJson(repoRoot, 'package.json').version

  for (const args of [[], ['--tag', `v${productVersion}`]]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
    })
    assert.equal(result.status, 0)
    assert.match(result.stdout, /^\[version-policy\] OK\s*$/)
    assert.equal(result.stderr, '')
  }
})

test('CLI prefixes every repository violation and exits nonzero', () => {
  const root = createRepositoryFixture()
  const sourceScript = fileURLToPath(new URL('../version-policy.mjs', import.meta.url))
  const fixtureScript = join(root, 'scripts/version-policy.mjs')
  mkdirSync(dirname(fixtureScript), { recursive: true })
  copyFileSync(sourceScript, fixtureScript)
  writeJson(root, '.release-please-manifest.json', { '.': '0.11.3' })
  const config = readJson(root, 'release-please-config.json')
  config.packages['.']['include-component-in-tag'] = true
  writeJson(root, 'release-please-config.json', config)

  const result = spawnSync(process.execPath, [fixtureScript], { encoding: 'utf8' })

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  const diagnostics = result.stderr.trim().split('\n')
  assert.equal(diagnostics.length, 2)
  for (const diagnostic of diagnostics) {
    assert.match(diagnostic, /^\[version-policy\] /)
  }
  assert.match(result.stderr, /release baseline mismatch/)
  assert.match(result.stderr, /tag must omit component name/)
})
