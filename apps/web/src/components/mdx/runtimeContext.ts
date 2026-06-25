import { convertFileSrc } from '@tauri-apps/api/core'
import { createContext, useContext } from 'react'
import { resolveRelativePath } from '../../lib/markdownUtils'

export interface MdxRuntimeContextValue {
  entryPath?: string
}

export const MdxRuntimeContext = createContext<MdxRuntimeContextValue>({})

export function useMdxRuntime(): MdxRuntimeContextValue {
  return useContext(MdxRuntimeContext)
}

export function useMdxAsset(src: string): string {
  const { entryPath } = useMdxRuntime()

  if (!src || /^(?:https?:|data:|blob:|asset:)/i.test(src)) return src
  if (src.startsWith('/')) return convertFileSrc(src)
  if (!entryPath) return convertFileSrc(src)

  const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/'))
  return convertFileSrc(resolveRelativePath(entryDir, src))
}
