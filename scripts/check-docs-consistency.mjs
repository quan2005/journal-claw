#!/usr/bin/env node
// Validate literal repository paths referenced by current authority documents.
// Globs are examples rather than literal paths and are intentionally skipped.

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const AUTHORITY_DOCS = [
  'AGENTS.md',
  'docs/ARCH.md',
  'docs/CONVENTIONS.md',
  'docs/final-state.md',
]

const BACKTICK_PATH = /`((?:apps|packages|docs|scripts|stories|\.github|\.agents)\/[^\s`]+)`/g

function stripTrailingPunctuation(path) {
  return path.replace(/[.:,;]+$/, '')
}

function isGlobPattern(path) {
  return /[*?[\]]/.test(path)
}

function isPathTemplate(path) {
  return /<[^<>]+>/.test(path)
}

export function checkDocsConsistency({ repoRoot, docs }) {
  const issues = []
  const absoluteRepoRoot = resolve(repoRoot)
  const documents = docs ?? discoverCurrentDocs(absoluteRepoRoot)

  for (const doc of documents) {
    const absoluteDoc = resolve(absoluteRepoRoot, doc)
    if (!existsSync(absoluteDoc)) {
      issues.push({ doc, ref: doc, reason: 'authority document missing' })
      continue
    }

    const text = readFileSync(absoluteDoc, 'utf8')
    const checkedInDocument = new Set()
    for (const match of text.matchAll(BACKTICK_PATH)) {
      const referencedPath = stripTrailingPunctuation(match[1])
      if (
        checkedInDocument.has(referencedPath) ||
        isGlobPattern(referencedPath) ||
        isPathTemplate(referencedPath)
      ) {
        continue
      }
      checkedInDocument.add(referencedPath)

      const target = resolve(absoluteRepoRoot, referencedPath)
      const targetFromRoot = relative(absoluteRepoRoot, target)
      const isOutsideRoot =
        targetFromRoot === '..' ||
        targetFromRoot.startsWith(`..${sep}`) ||
        isAbsolute(targetFromRoot)
      if (isOutsideRoot) {
        issues.push({ doc, ref: referencedPath, reason: 'outside repository root' })
      } else if (!existsSync(target)) {
        issues.push({ doc, ref: referencedPath, reason: 'missing' })
      }
    }
  }

  return issues
}

export function discoverCurrentDocs(repoRoot) {
  const docsRoot = resolve(repoRoot, 'docs')
  if (!existsSync(docsRoot)) return [...AUTHORITY_DOCS]

  const discovered = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name)
      const repoPath = relative(repoRoot, absolutePath).replaceAll('\\', '/')
      if (entry.isDirectory()) {
        if (repoPath === 'docs/adr') continue
        visit(absolutePath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        discovered.push(repoPath)
      }
    }
  }
  visit(docsRoot)

  return [...new Set([...AUTHORITY_DOCS, ...discovered])].sort()
}

function runCli() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const issues = checkDocsConsistency({ repoRoot })
  if (issues.length === 0) {
    console.log('[check-docs-consistency] OK — current document paths exist.')
    return
  }

  console.error(`\n[check-docs-consistency] 发现 ${issues.length} 处文档引用指向不存在的文件：\n`)
  for (const { doc, ref, reason } of issues) {
    console.error(`  ✗ ${relative(repoRoot, resolve(repoRoot, doc))}\n      → ${ref} (${reason})`)
  }
  console.error('\n修复：更正路径，或移除已经失效的当前状态声明。')
  process.exitCode = 1
}

function isMainModule() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMainModule()) {
  runCli()
}
