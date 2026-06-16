#!/usr/bin/env node
/**
 * migrate-heading-to-title.mjs
 *
 * 扫描 workspace 中所有 .mdx 文件，将指定 JSX 组件的 heading prop 重命名为 title。
 *
 * Usage:
 *   node scripts/migrate-heading-to-title.mjs [workspace-dir] [--dry-run] [--self-test] [--help]
 *
 * Examples:
 *   node scripts/migrate-heading-to-title.mjs ~/my-workspace
 *   node scripts/migrate-heading-to-title.mjs ~/my-workspace --dry-run
 *   node scripts/migrate-heading-to-title.mjs --self-test
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TARGET_COMPONENTS = ['Faq', 'Checklist', 'Cases', 'Toolbox', 'Timeline', 'Metrics', 'Steps']

// Regex explanation:
// - Match `<ComponentName` followed by attributes (possibly multiline) containing `heading` prop
// - We use a two-pass approach: first find the component open tag region, then replace heading inside it
//
// Pattern to match an opening tag of a target component (including self-closing):
//   <ComponentName ... > or <ComponentName ... />
// The tag content can span multiple lines, so we use [\s\S]*? (non-greedy).
const TAG_PATTERN = new RegExp(
  `<(${TARGET_COMPONENTS.join('|')})\\b([\\s\\S]*?)(\\/?>)`,
  'g'
)

// Inside a matched tag region, find `heading=` or `heading={`
const HEADING_PROP_PATTERN = /\bheading(\s*=)/g

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function migrateContent(content) {
  let count = 0

  const result = content.replace(TAG_PATTERN, (match, componentName, attrs, closing) => {
    // Replace heading prop(s) within this tag's attributes
    const newAttrs = attrs.replace(HEADING_PROP_PATTERN, (propMatch, equalsPart) => {
      count++
      return `title${equalsPart}`
    })
    return `<${componentName}${newAttrs}${closing}`
  })

  return { result, count }
}

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

function walkMdxFiles(dir) {
  if (!fs.existsSync(dir)) return []

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue
      files.push(...walkMdxFiles(fullPath))
    } else if (entry.name.endsWith('.mdx')) {
      files.push(fullPath)
    }
  }

  return files
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

function selfTest() {
  console.log('Running self-tests...\n')
  let passed = 0
  let failed = 0

  function assert(name, input, expected) {
    const { result } = migrateContent(input)
    if (result === expected) {
      console.log(`  ✓ ${name}`)
      passed++
    } else {
      console.log(`  ✗ ${name}`)
      console.log(`    Input:    ${JSON.stringify(input)}`)
      console.log(`    Expected: ${JSON.stringify(expected)}`)
      console.log(`    Got:      ${JSON.stringify(result)}`)
      failed++
    }
  }

  // --- Should replace ---
  assert(
    'Single-line Faq',
    '<Faq heading="问题" items={[]} />',
    '<Faq title="问题" items={[]} />'
  )

  assert(
    'Single-line Checklist with expression',
    '<Checklist heading={title} items={items} />',
    '<Checklist title={title} items={items} />'
  )

  assert(
    'Multi-line Cases',
    `<Cases\n  heading="案例分析"\n  items={caseList}\n/>`,
    `<Cases\n  title="案例分析"\n  items={caseList}\n/>`
  )

  assert(
    'Toolbox with space before =',
    '<Toolbox heading ="工具箱" />',
    '<Toolbox title ="工具箱" />'
  )

  assert(
    'Timeline non-self-closing',
    '<Timeline heading="时间线">\n  {children}\n</Timeline>',
    '<Timeline title="时间线">\n  {children}\n</Timeline>'
  )

  assert(
    'Metrics component',
    '<Metrics heading="数据指标" data={metrics} />',
    '<Metrics title="数据指标" data={metrics} />'
  )

  assert(
    'Steps component',
    '<Steps heading="步骤" items={steps} />',
    '<Steps title="步骤" items={steps} />'
  )

  // --- Should NOT replace ---
  assert(
    'Markdown heading (not JSX)',
    '## heading\n\nSome text about heading.',
    '## heading\n\nSome text about heading.'
  )

  assert(
    'Non-target component <div>',
    '<div heading="test">content</div>',
    '<div heading="test">content</div>'
  )

  assert(
    'Non-target component <Card>',
    '<Card heading="标题" />',
    '<Card heading="标题" />'
  )

  assert(
    'heading in text content (not a prop)',
    '<Faq items={[]}>\n  heading is important\n</Faq>',
    '<Faq items={[]}>\n  heading is important\n</Faq>'
  )

  // --- Count test ---
  const multiInput = '<Faq heading="A" />\n<Checklist heading="B" />\n<div heading="C" />'
  const { count } = migrateContent(multiInput)
  if (count === 2) {
    console.log('  ✓ Count: 2 replacements for 2 target components')
    passed++
  } else {
    console.log(`  ✗ Count: expected 2, got ${count}`)
    failed++
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
migrate-heading-to-title.mjs — Rename heading prop to title in MDX components

Usage:
  node scripts/migrate-heading-to-title.mjs [workspace-dir] [options]

Arguments:
  workspace-dir   Root directory to scan (default: current directory)

Options:
  --dry-run       Report changes without modifying files
  --self-test     Run built-in test cases and exit
  --help          Show this help message

Target components: ${TARGET_COMPONENTS.join(', ')}

The script recursively scans all .mdx files and replaces \`heading=\` props
with \`title=\` only within the listed JSX component tags.
`)
}

function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  if (args.includes('--self-test')) {
    selfTest()
    return
  }

  const dryRun = args.includes('--dry-run')
  const positional = args.filter((a) => !a.startsWith('--'))
  const workspaceDir = path.resolve(positional[0] || '.')

  if (!fs.existsSync(workspaceDir)) {
    console.error(`Error: directory does not exist: ${workspaceDir}`)
    process.exit(1)
  }

  console.log(`Scanning: ${workspaceDir}`)
  if (dryRun) console.log('Mode: dry-run (no files will be modified)\n')
  else console.log('')

  const files = walkMdxFiles(workspaceDir)

  if (files.length === 0) {
    console.log('No .mdx files found.')
    return
  }

  let totalFiles = 0
  let totalReplacements = 0

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const { result, count } = migrateContent(content)

    if (count > 0) {
      totalFiles++
      totalReplacements += count
      const relPath = path.relative(workspaceDir, file)
      console.log(`  ${relPath}: ${count} replacement${count > 1 ? 's' : ''}`)

      if (!dryRun) {
        fs.writeFileSync(file, result, 'utf-8')
      }
    }
  }

  console.log('')
  if (totalReplacements === 0) {
    console.log('No heading props found. Nothing to migrate.')
  } else {
    const action = dryRun ? 'would be modified' : 'modified'
    console.log(`Done: ${totalReplacements} replacement${totalReplacements > 1 ? 's' : ''} in ${totalFiles} file${totalFiles > 1 ? 's' : ''} ${action}.`)
  }
}

main()
