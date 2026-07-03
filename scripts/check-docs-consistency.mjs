#!/usr/bin/env node
// check-docs-consistency.mjs — AC-2 长效化（WS-3）
//
// 扫描核心文档（AGENTS.md、docs/ARCH.md、docs/CONVENTIONS.md、docs/final-state.md）
// 中反引号包裹的仓库相对路径（apps/ packages/ docs/ scripts/ 开头），验证文件真实存在。
// 任一缺失 → 打印清单并以非零退出，阻断 CI。零依赖，仅用 Node 内建 fs/path/url。

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 被扫描的文档（相对仓库根）。新增核心文档时在此登记。
const DOCS = ['AGENTS.md', 'docs/ARCH.md', 'docs/CONVENTIONS.md', 'docs/final-state.md']

// 仅承认这些前缀为仓库内路径，避免误判片段（如 `apps/web` 而非 `apps/web/src/...`）。
const PATH_PREFIXES = ['apps/', 'packages/', 'docs/', 'scripts/']

// 反引号包裹的路径：`<前缀>...`。路径内不含空白与反引号。
const BACKTICK_PATH = /`((?:apps|packages|docs|scripts)\/[^\s`]+)`/g

function stripTrailingPunct(p) {
  // 路径末尾偶有句号/冒号被一并包进反引号（少见），统一去掉。
  return p.replace(/[.:,;]+$/, '')
}

function isGlobPattern(p) {
  // 含通配符的不是字面文件路径（如 `apps/*`、`docs/adr/*`），无法也无需校验存在性。
  return /[*?[\]]/.test(p)
}

const missing = []
const checked = new Set()

for (const doc of DOCS) {
  const abs = resolve(repoRoot, doc)
  if (!existsSync(abs)) {
    console.error(`[check-docs-consistency] 文档自身不存在：${doc}`)
    process.exit(1)
  }
  const text = readFileSync(abs, 'utf8')
  for (const match of text.matchAll(BACKTICK_PATH)) {
    const raw = stripTrailingPunct(match[1])
    if (checked.has(raw)) continue
    checked.add(raw)
    // 仅校验显式前缀（matchAll 已保证，双重保险）。
    if (!PATH_PREFIXES.some((pre) => raw.startsWith(pre))) continue
    if (isGlobPattern(raw)) continue
    const target = resolve(repoRoot, raw)
    if (!existsSync(target)) {
      missing.push({ doc, ref: raw })
    }
  }
}

if (missing.length > 0) {
  console.error(
    `\n[check-docs-consistency] 发现 ${missing.length} 处文档引用指向不存在的文件：\n`,
  )
  for (const { doc, ref } of missing) {
    const rel = relative(repoRoot, resolve(repoRoot, doc))
    console.error(`  ✗ ${rel}\n      → ${ref}`)
  }
  console.error(
    '\n修复：更正路径，或移除/更新引用（docs/ARCH.md 是架构唯一真相，优先核对）。',
  )
  process.exit(1)
}

console.log(
  `[check-docs-consistency] OK — 已校验 ${checked.size} 个反引号路径，全部存在。`,
)
