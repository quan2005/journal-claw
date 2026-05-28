import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { JournalEntry, TreeSelection } from '../types'

// ── Persistent layout dimensions ──
const loadDim = (key: string, fallback: number): number => {
  try {
    const v = localStorage.getItem(key)
    return v ? parseInt(v) : fallback
  } catch {
    return fallback
  }
}

const saveDim = (key: string, v: number) => {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    /* quota exceeded — ignore */
  }
}

// ── Types ─────────────────────────────────────────────

interface UIContextValue {
  view: 'journal' | 'settings'
  setView: Dispatch<SetStateAction<'journal' | 'settings'>>
  settingsInitialSection: string | undefined
  setSettingsInitialSection: Dispatch<SetStateAction<string | undefined>>

  selectedEntry: JournalEntry | null
  setSelectedEntry: Dispatch<SetStateAction<JournalEntry | null>>
  treeSelection: TreeSelection | null
  setTreeSelection: Dispatch<SetStateAction<TreeSelection | null>>
  showIdeas: boolean
  setShowIdeas: Dispatch<SetStateAction<boolean>>

  // Drag states
  isDragging: boolean
  setIsDragging: Dispatch<SetStateAction<boolean>>
  isDragOver: boolean
  setIsDragOver: Dispatch<SetStateAction<boolean>>

  // Layout dimensions (persisted)
  sidebarWidth: number
  setSidebarWidth: (w: number) => void
  rightPanelOpen: boolean
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>
  rightPanelWidth: number
  setRightPanelWidth: (w: number) => void

  // Chat init
  chatInitialText: string
  setChatInitialText: Dispatch<SetStateAction<string>>

  // Convenience
  deselect: () => void
}

const UIContext = createContext<UIContextValue>(null!)

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<'journal' | 'settings'>('journal')
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [treeSelection, setTreeSelection] = useState<TreeSelection | null>(null)
  const [showIdeas, setShowIdeas] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [sidebarWidth, setSidebarWidthState] = useState(() => loadDim('journal_base_width', 320))
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelWidth, setRightPanelWidthState] = useState(() =>
    loadDim('journal_right_panel_width', 320),
  )
  const [chatInitialText, setChatInitialText] = useState('')

  const setSidebarWidth = useCallback((w: number) => {
    setSidebarWidthState(w)
    saveDim('journal_base_width', w)
  }, [])

  const setRightPanelWidth = useCallback((w: number) => {
    setRightPanelWidthState(w)
    saveDim('journal_right_panel_width', w)
  }, [])

  const deselect = useCallback(() => {
    setSelectedEntry(null)
    setTreeSelection(null)
  }, [])

  return (
    <UIContext.Provider
      value={{
        view,
        setView,
        settingsInitialSection,
        setSettingsInitialSection,
        selectedEntry,
        setSelectedEntry,
        treeSelection,
        setTreeSelection,
        showIdeas,
        setShowIdeas,
        isDragging,
        setIsDragging,
        isDragOver,
        setIsDragOver,
        sidebarWidth,
        setSidebarWidth,
        rightPanelOpen,
        setRightPanelOpen,
        rightPanelWidth,
        setRightPanelWidth,
        chatInitialText,
        setChatInitialText,
        deselect,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  return useContext(UIContext)
}
