import type { ReactNode } from 'react'
import { MdxRuntimeContext } from './runtimeContext'

export function MdxRuntimeProvider({
  entryPath,
  children,
}: {
  entryPath?: string
  children: ReactNode
}) {
  return <MdxRuntimeContext.Provider value={{ entryPath }}>{children}</MdxRuntimeContext.Provider>
}
