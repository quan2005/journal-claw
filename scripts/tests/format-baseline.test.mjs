import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

let classifyFormatDebt
let findBaselineRegressions
try {
  ;({ classifyFormatDebt, findBaselineRegressions } = await import('../check-format-baseline.mjs'))
} catch {
  // The first red run occurs before the production module exists.
}

test('allows fingerprinted formatting debt to shrink without changing the baseline first', () => {
  assert.equal(typeof classifyFormatDebt, 'function')
  assert.deepEqual(
    classifyFormatDebt(
      { 'apps/web/src/known.tsx': 'sha256:known' },
      {
        'apps/web/src/known.tsx': 'sha256:known',
        'apps/daemon/src/already-fixed.ts': 'sha256:fixed',
      },
    ),
    { changedPaths: [], newPaths: [] },
  )
})

test('rejects new files and changed formatting debt inside a known file', () => {
  assert.equal(typeof classifyFormatDebt, 'function')
  assert.deepEqual(
    classifyFormatDebt(
      {
        'known/a.ts': 'sha256:expanded-debt',
        'new/z.ts': 'sha256:z',
        'new/b.ts': 'sha256:b',
      },
      { 'known/a.ts': 'sha256:original-debt' },
    ),
    { changedPaths: ['known/a.ts'], newPaths: ['new/b.ts', 'new/z.ts'] },
  )
})

test('baseline comparison permits removals but rejects added or rewritten entries', () => {
  assert.equal(typeof findBaselineRegressions, 'function')
  assert.deepEqual(
    findBaselineRegressions(
      {
        'known/a.ts': 'sha256:rewritten',
        'new/b.ts': 'sha256:new',
      },
      {
        'known/a.ts': 'sha256:original',
        'removed/c.ts': 'sha256:removed',
      },
    ),
    { addedPaths: ['new/b.ts'], changedPaths: ['known/a.ts'] },
  )
})

test('CLI rejects baseline growth relative to the configured git reference', () => {
  const root = mkdtempSync(join(tmpdir(), 'journal-format-baseline-'))
  const sourceScript = fileURLToPath(new URL('../check-format-baseline.mjs', import.meta.url))
  const fixtureScript = join(root, 'scripts/check-format-baseline.mjs')
  const original = {
    version: 1,
    files: { 'known/a.ts': `sha256:${'a'.repeat(64)}` },
  }
  const expanded = {
    version: 1,
    files: {
      ...original.files,
      'new/b.ts': `sha256:${'b'.repeat(64)}`,
    },
  }

  try {
    mkdirSync(dirname(fixtureScript), { recursive: true })
    copyFileSync(sourceScript, fixtureScript)
    writeFileSync(join(root, 'scripts/format-baseline.json'), `${JSON.stringify(original)}\n`)
    assert.equal(spawnSync('git', ['init'], { cwd: root }).status, 0)
    assert.equal(spawnSync('git', ['add', '.'], { cwd: root }).status, 0)
    assert.equal(
      spawnSync(
        'git',
        [
          '-c',
          'user.name=Policy Test',
          '-c',
          'user.email=policy@example.invalid',
          'commit',
          '-m',
          'baseline',
        ],
        { cwd: root },
      ).status,
      0,
    )
    writeFileSync(join(root, 'scripts/format-baseline.json'), `${JSON.stringify(expanded)}\n`)

    const result = spawnSync(process.execPath, [fixtureScript], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, FORMAT_BASELINE_REF: 'HEAD' },
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Baseline may only shrink relative to HEAD/)
    assert.match(result.stderr, /Added baseline entries:\n  new\/b\.ts/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('CLI accepts the repository when all differences are in the recorded baseline', () => {
  const script = fileURLToPath(new URL('../check-format-baseline.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })

  assert.equal(result.status, 0)
  assert.match(
    result.stdout,
    /\[format-baseline\] OK — \d+ unchanged known differences, 0 new or expanded/,
  )
  assert.equal(result.stderr, '')
})
