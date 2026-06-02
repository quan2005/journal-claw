/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { JournalEntry, TreeSelection } from '../types'

type AppView = 'journal' | 'settings' | 'automation'

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

// ── Persistent tree selection ──

const TREE_SELECTION_STORAGE_KEY = 'journal_tree_selection_v1'

const treeSelectionTypes = new Set([
  'pinned-section',
  'identity',
  'journal',
  'journal-month',
  'topic',
  'topic-file',
  'ideas',
  'automation',
])

interface StoredTreeSelectionState {
  view: AppView
  treeSelection: TreeSelection | null
  showIdeas: boolean
}

function isTreeSelection(value: unknown): value is TreeSelection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TreeSelection>
  return (
    typeof candidate.type === 'string' &&
    treeSelectionTypes.has(candidate.type) &&
    typeof candidate.path === 'string'
  )
}

function loadTreeSelectionState(): StoredTreeSelectionState {
  try {
    const raw = localStorage.getItem(TREE_SELECTION_STORAGE_KEY)
    if (!raw) {
      return { view: 'journal', treeSelection: null, showIdeas: false }
    }

    const parsed = JSON.parse(raw) as Partial<StoredTreeSelectionState>
    const treeSelection = isTreeSelection(parsed.treeSelection) ? parsed.treeSelection : null
    const view =
      parsed.view === 'automation' || treeSelection?.type === 'automation'
        ? 'automation'
        : 'journal'

    return {
      view,
      treeSelection,
      showIdeas: parsed.showIdeas === true,
    }
  } catch {
    return { view: 'journal', treeSelection: null, showIdeas: false }
  }
}

function saveTreeSelectionState(state: StoredTreeSelectionState) {
  try {
    localStorage.setItem(TREE_SELECTION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota exceeded — ignore */
  }
}

// ── Types ─────────────────────────────────────────────

interface UIContextValue {
  view: AppView
  setView: Dispatch<SetStateAction<AppView>>
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
  const [initialTreeState] = useState(loadTreeSelectionState)
  const [view, setView] = useState<AppView>(initialTreeState.view)
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(
    undefined,
  )
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [treeSelection, setTreeSelection] = useState<TreeSelection | null>(
    initialTreeState.treeSelection,
  )
  const [showIdeas, setShowIdeas] = useState(initialTreeState.showIdeas)
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

  useEffect(() => {
    saveTreeSelectionState({
      view: view === 'automation' ? 'automation' : 'journal',
      treeSelection,
      showIdeas,
    })
  }, [view, treeSelection, showIdeas])

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
