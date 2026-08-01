import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkDocsConsistency } from '../check-docs-consistency.mjs'

const tempRoots = []
const CORE_DOCS = ['AGENTS.md', 'docs/ARCH.md', 'docs/CONVENTIONS.md', 'docs/final-state.md']

function writeText(root, relativePath, content) {
  const target = join(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function createRepositoryFixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'journal-docs-policy-'))
  tempRoots.push(root)
  const sourceScript = fileURLToPath(new URL('../check-docs-consistency.mjs', import.meta.url))
  const fixtureScript = join(root, 'scripts/check-docs-consistency.mjs')
  mkdirSync(dirname(fixtureScript), { recursive: true })
  copyFileSync(sourceScript, fixtureScript)

  for (const doc of CORE_DOCS) {
    writeText(root, doc, overrides[doc] ?? '# Current authority\n')
  }
  return { root, fixtureScript }
}

function runChecker(overrides, existingPaths = []) {
  const fixture = createRepositoryFixture(overrides)
  for (const relativePath of existingPaths) {
    writeText(fixture.root, relativePath, 'present\n')
  }
  return spawnSync(process.execPath, [fixture.fixtureScript], { encoding: 'utf8' })
}

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true })
  }
})

test('rejects missing repository paths under hidden authority directories', () => {
  for (const reference of ['.agents/skills/missing/SKILL.md', '.github/workflows/missing.yml']) {
    const result = runChecker({ 'AGENTS.md': `Current gate: \`${reference}\`\n` })

    assert.equal(result.status, 1)
    assert.match(result.stderr, new RegExp(reference.replaceAll('.', '\\.')))
  }
})

test('accepts existing hidden paths', () => {
  const reference = '.github/workflows/ci.yml'
  const result = runChecker({ 'AGENTS.md': `Current workflow: \`${reference}\`\n` }, [reference])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OK/)
})

test('rejects a retired runtime path that no longer exists', () => {
  const reference = 'apps/daemon/src/runtimes/'
  const result = runChecker({ 'docs/ARCH.md': `Current runtime: \`${reference}\`\n` })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /apps\/daemon\/src\/runtimes\//)
})

test('scans linked current documentation outside the four authority hubs', () => {
  const { root, fixtureScript } = createRepositoryFixture()
  writeText(root, 'docs/dev/backend.md', 'Current runtime: `apps/daemon/src/runtimes/`\n')

  const result = spawnSync(process.execPath, [fixtureScript], { encoding: 'utf8' })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /docs\/dev\/backend\.md/)
  assert.match(result.stderr, /apps\/daemon\/src\/runtimes\//)
})

test('ignores repository glob examples that cannot be checked literally', () => {
  const result = runChecker({ 'docs/ARCH.md': 'ADR set: `docs/adr/*`\n' })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OK/)
})

test('ignores repository path templates that contain angle-bracket placeholders', () => {
  const result = runChecker({
    'docs/CONVENTIONS.md': 'Story location: `stories/<YYYYMMDD>-<slug>/`\n',
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /OK/)
})

test('reports the same missing path once for every authority document that claims it', () => {
  const reference = 'apps/missing/current.ts'
  const result = runChecker({
    'AGENTS.md': `Summary: \`${reference}\`\n`,
    'docs/ARCH.md': `Authority: \`${reference}\`\n`,
  })

  assert.equal(result.status, 1)
  assert.equal(result.stderr.match(/apps\/missing\/current\.ts/g)?.length, 2)
  assert.match(result.stderr, /AGENTS\.md/)
  assert.match(result.stderr, /docs\/ARCH\.md/)
})

test('returns one structured issue per authority document and missing path', () => {
  const { root } = createRepositoryFixture({
    'AGENTS.md': 'First `apps/missing.ts`, again `apps/missing.ts`.\n',
    'docs/ARCH.md': 'Architecture `apps/missing.ts`.\n',
  })

  assert.deepEqual(checkDocsConsistency({ repoRoot: root }), [
    { doc: 'AGENTS.md', ref: 'apps/missing.ts', reason: 'missing' },
    { doc: 'docs/ARCH.md', ref: 'apps/missing.ts', reason: 'missing' },
  ])
})

test('rejects a prefixed path that resolves outside the repository root', () => {
  const result = runChecker({
    'docs/ARCH.md': 'Unsafe current path: `apps/../../../../etc/passwd`\n',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /outside repository root/)
})

test('can be imported from a non-file stdin entrypoint without running the CLI', () => {
  const moduleUrl = new URL('../check-docs-consistency.mjs', import.meta.url).href
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: `import ${JSON.stringify(moduleUrl)}\n`,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})
