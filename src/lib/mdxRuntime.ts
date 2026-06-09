import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime'
import type { ComponentType } from 'react'

export type MdxRuntimeComponent = ComponentType<{
  components?: Record<string, unknown>
}>

const JSX_RUNTIME_IMPORT_RE = /^\s*import\s+\{[^}]*\}\s+from\s+["']react\/jsx-runtime["'];?\s*/gm
const EXPORT_DEFAULT_RE = /^\s*export\s+default\s+MDXContent;?\s*$/m
const IMPORT_OR_EXPORT_RE = /^\s*(?:import|export)\s/m

export function createMdxComponent(compiledSource: string): MdxRuntimeComponent {
  const body = toRunnableFunctionBody(compiledSource)
  const factory = new Function('_jsx', '_jsxs', '_Fragment', body)
  const component = factory(_jsx, _jsxs, _Fragment)

  if (typeof component !== 'function') {
    throw new Error('Compiled MDX did not export a React component')
  }

  return component as MdxRuntimeComponent
}

export function toRunnableFunctionBody(compiledSource: string): string {
  let runnable = compiledSource.replace(JSX_RUNTIME_IMPORT_RE, '')

  if (!EXPORT_DEFAULT_RE.test(runnable)) {
    throw new Error('Compiled MDX output has an unsupported module shape')
  }

  runnable = runnable.replace(EXPORT_DEFAULT_RE, 'return MDXContent;')

  if (IMPORT_OR_EXPORT_RE.test(runnable)) {
    throw new Error('MDX imports and exports are not supported in journal entries')
  }

  return runnable
}
