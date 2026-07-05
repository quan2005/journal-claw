import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '../..')

const OWNED_FILES = [
  '.agents/skills/journal/references/component-catalog.md',
  '.agents/skills/journal/references/component-recipes.md',
  'docs/superpowers/examples/journal-v2-showcase.mdx',
  'docs/superpowers/examples/jsx-component-gallery.mdx',
  'docs/superpowers/examples/jsx-all-components-demo.mdx',
]

const OWNED_DIRECTORIES = [
  '.agents/skills/journal/references/templates',
  '.agents/skills/journal/references/template-examples',
  '.agents/skills/journal/references/examples',
]

function walkMarkupFiles(directory) {
  if (!fs.existsSync(directory)) return []

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return walkMarkupFiles(entryPath)
      return /\.(?:md|mdx)$/.test(entry.name) ? [entryPath] : []
    })
    .sort()
}

function relativePath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

export function extractPascalCaseJsxTags(source) {
  return [...source.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)].map((match) => match[1])
}

function collectOwnedFiles(repoRoot) {
  const explicitFiles = OWNED_FILES.map((file) => path.join(repoRoot, file)).filter((file) =>
    fs.existsSync(file),
  )
  const directoryFiles = OWNED_DIRECTORIES.flatMap((directory) =>
    walkMarkupFiles(path.join(repoRoot, directory)),
  )
  return [...new Set([...explicitFiles, ...directoryFiles])].sort()
}

function readManifest(repoRoot) {
  const manifestPath = path.join(repoRoot, 'apps/web/src/components/mdx/component-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  return manifest
    .filter((component) => component.public !== false)
    .map((component) => component.jsxName)
}

function findUnknownTags(repoRoot, files, publicNames) {
  const allowed = new Set(publicNames)

  return files.flatMap((file) => {
    const tags = [...new Set(extractPascalCaseJsxTags(fs.readFileSync(file, 'utf8')))]
      .filter((tag) => !allowed.has(tag))
      .sort()
    return tags.length > 0 ? [{ file: relativePath(repoRoot, file), tags }] : []
  })
}

function findUnknownRecommendations(repoRoot, publicNames) {
  const allowed = new Set(publicNames)
  const templateDirectory = path.join(repoRoot, '.agents/skills/journal/references/templates')

  return walkMarkupFiles(templateDirectory).flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8')
    return [...source.matchAll(/^Recommended components:\s*(.+)$/gm)].flatMap((match) => {
      const names = [...match[1].matchAll(/`([A-Z][A-Za-z0-9_]*)`/g)].map((item) => item[1])
      const unknown = [...new Set(names.filter((name) => !allowed.has(name)))].sort()
      return unknown.length > 0
        ? [
            {
              file: relativePath(repoRoot, file),
              line: source.slice(0, match.index).split('\n').length,
              names: unknown,
            },
          ]
        : []
    })
  })
}

function readCatalogComponents(repoRoot) {
  const catalogPath = path.join(repoRoot, '.agents/skills/journal/references/component-catalog.md')
  const source = fs.readFileSync(catalogPath, 'utf8')
  return [...source.matchAll(/^###\s+`([A-Z][A-Za-z0-9_]*)`\s*$/gm)].map((match) => match[1])
}

function duplicates(values) {
  const seen = new Set()
  const duplicateValues = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicateValues.add(value)
    seen.add(value)
  }
  return [...duplicateValues].sort()
}

export function validateJournalMdxExamples({ repoRoot = defaultRepoRoot } = {}) {
  const publicComponents = readManifest(repoRoot)
  const publicSet = new Set(publicComponents)
  const ownedFiles = collectOwnedFiles(repoRoot)
  const catalogComponents = readCatalogComponents(repoRoot)
  const catalogSet = new Set(catalogComponents)
  const demoPath = path.join(repoRoot, 'docs/superpowers/examples/jsx-all-components-demo.mdx')
  const demoComponents = new Set(extractPascalCaseJsxTags(fs.readFileSync(demoPath, 'utf8')))

  return {
    repoRoot,
    publicComponents,
    ownedFileCount: ownedFiles.length,
    unknownTags: findUnknownTags(repoRoot, ownedFiles, publicComponents),
    unknownRecommendations: findUnknownRecommendations(repoRoot, publicComponents),
    missingCatalogComponents: publicComponents.filter((name) => !catalogSet.has(name)).sort(),
    extraCatalogComponents: [...catalogSet].filter((name) => !publicSet.has(name)).sort(),
    duplicateCatalogComponents: duplicates(catalogComponents),
    missingDemoComponents: publicComponents.filter((name) => !demoComponents.has(name)).sort(),
  }
}

export function formatJournalMdxValidation(result) {
  const lines = [
    `Validated ${result.ownedFileCount} owned Markdown/MDX files against ${result.publicComponents.length} public components.`,
  ]

  for (const issue of result.unknownTags) {
    lines.push(`Unknown JSX in ${issue.file}: ${issue.tags.join(', ')}`)
  }
  for (const issue of result.unknownRecommendations) {
    lines.push(`Unknown recommendation in ${issue.file}:${issue.line}: ${issue.names.join(', ')}`)
  }
  if (result.missingCatalogComponents.length > 0) {
    lines.push(`Missing catalog entries: ${result.missingCatalogComponents.join(', ')}`)
  }
  if (result.extraCatalogComponents.length > 0) {
    lines.push(`Extra catalog entries: ${result.extraCatalogComponents.join(', ')}`)
  }
  if (result.duplicateCatalogComponents.length > 0) {
    lines.push(`Duplicate catalog entries: ${result.duplicateCatalogComponents.join(', ')}`)
  }
  if (result.missingDemoComponents.length > 0) {
    lines.push(`Missing demo components: ${result.missingDemoComponents.join(', ')}`)
  }

  return lines.join('\n')
}

function hasValidationErrors(result) {
  return (
    result.unknownTags.length > 0 ||
    result.unknownRecommendations.length > 0 ||
    result.missingCatalogComponents.length > 0 ||
    result.extraCatalogComponents.length > 0 ||
    result.duplicateCatalogComponents.length > 0 ||
    result.missingDemoComponents.length > 0
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const result = validateJournalMdxExamples()
  console.log(formatJournalMdxValidation(result))
  process.exitCode = hasValidationErrors(result) ? 1 : 0
}
