/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { JournalEntry, TreeSelection } from '../types'

type AppView = 'journal' | 'settings' | 'automation'

export type Category = 'journal' | 'ideas' | 'identity' | 'topics' | 'automation' | 'skills'

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

// ── Persistent boolean (panel pinned flag) ──
const loadBool = (key: string, fallback: boolean): boolean => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch {
    return fallback
  }
}

const saveBool = (key: string, v: boolean) => {
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
  activeCategory?: Category
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
      return { view: 'journal', treeSelection: null, showIdeas: false, activeCategory: 'journal' }
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
      activeCategory: (parsed.activeCategory as Category) || 'journal',
    }
  } catch {
    return { view: 'journal', treeSelection: null, showIdeas: false, activeCategory: 'journal' }
  }
}

function saveTreeSelectionState(state: StoredTreeSelectionState) {
  try {
    localStorage.setItem(TREE_SELECTION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota exceeded — ignore */
  }
}

// ── Layout dimension storage keys ──
const SIDEBAR_WIDTH_KEY = 'journal_base_width'
const RIGHT_PANEL_WIDTH_KEY = 'journal_right_panel_width'
const RIGHT_PANEL_PINNED_KEY = 'journal_right_panel_pinned'

// ── LayoutContext: high-frequency layout dimensions (drag/resize) ──
// Split from UIContext so that dragging a divider does NOT re-render
// consumers that only care about view / selectedEntry / etc. (AC-5).
interface LayoutContextValue {
  sidebarWidth: number
  /** Update width in view state only — does NOT touch localStorage. Use during drag. */
  setSidebarWidthView: (w: number) => void
  /** Persist current width to localStorage. Call on drag end. */
  persistSidebarWidth: (w: number) => void
  /** Convenience: set view + persist in one call (for non-drag paths). */
  setSidebarWidth: (w: number) => void

  rightPanelWidth: number
  setRightPanelWidthView: (w: number) => void
  persistRightPanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void

  rightPanelOpen: boolean
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>
  rightPanelMode: 'chat' | 'run'
  setRightPanelMode: Dispatch<SetStateAction<'chat' | 'run'>>
  rightPanelPinned: boolean
  setRightPanelPinned: (p: boolean) => void
}

const LayoutContext = createContext<LayoutContextValue>(null!)

// ── UIContext: semantic / low-frequency UI state ──
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

  // Drag states (semantic flags, not dimensions)
  isDragging: boolean
  setIsDragging: Dispatch<SetStateAction<boolean>>
  isDragOver: boolean
  setIsDragOver: Dispatch<SetStateAction<boolean>>

  // Chat init
  chatInitialText: string
  setChatInitialText: Dispatch<SetStateAction<string>>

  // Category navigation
  activeCategory: Category
  setActiveCategory: (cat: Category) => void

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
  const [activeCategory, setActiveCategoryState] = useState<Category>(
    initialTreeState.activeCategory || 'journal',
  )
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [chatInitialText, setChatInitialText] = useState('')

  // ── Layout dimensions (moved to LayoutContext below) ──
  const [sidebarWidth, setSidebarWidthState] = useState(() => loadDim(SIDEBAR_WIDTH_KEY, 320))
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  // Right panel content mode: 'chat' (default) or 'run' (Agent Run panel).
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'run'>('chat')
  const [rightPanelWidth, setRightPanelWidthState] = useState(() =>
    loadDim(RIGHT_PANEL_WIDTH_KEY, 320),
  )
  const [rightPanelPinned, setRightPanelPinnedState] = useState(() =>
    loadBool(RIGHT_PANEL_PINNED_KEY, false),
  )

  // Setter split: view-only (drag hot path, no I/O) vs persist (drag end)
  const setSidebarWidthView = useCallback((w: number) => {
    setSidebarWidthState(w)
  }, [])
  const persistSidebarWidth = useCallback((w: number) => {
    saveDim(SIDEBAR_WIDTH_KEY, w)
  }, [])
  const setSidebarWidth = useCallback((w: number) => {
    setSidebarWidthState(w)
    saveDim(SIDEBAR_WIDTH_KEY, w)
  }, [])

  const setRightPanelWidthView = useCallback((w: number) => {
    setRightPanelWidthState(w)
  }, [])
  const persistRightPanelWidth = useCallback((w: number) => {
    saveDim(RIGHT_PANEL_WIDTH_KEY, w)
  }, [])
  const setRightPanelWidth = useCallback((w: number) => {
    setRightPanelWidthState(w)
    saveDim(RIGHT_PANEL_WIDTH_KEY, w)
  }, [])

  const setRightPanelPinned = useCallback((p: boolean) => {
    setRightPanelPinnedState(p)
    saveBool(RIGHT_PANEL_PINNED_KEY, p)
  }, [])

  const setActiveCategory = useCallback((cat: Category) => {
    setActiveCategoryState(cat)
  }, [])

  useEffect(() => {
    saveTreeSelectionState({
      view: view === 'automation' ? 'automation' : 'journal',
      treeSelection,
      showIdeas,
      activeCategory,
    })
  }, [view, treeSelection, showIdeas, activeCategory])

  const deselect = useCallback(() => {
    setSelectedEntry(null)
    setTreeSelection(null)
  }, [])

  // Memoized context values to avoid re-rendering all consumers on any state change (AC-4)
  const uiValue = useMemo<UIContextValue>(
    () => ({
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
      chatInitialText,
      setChatInitialText,
      activeCategory,
      setActiveCategory,
      deselect,
    }),
    [
      view,
      settingsInitialSection,
      selectedEntry,
      treeSelection,
      showIdeas,
      isDragging,
      isDragOver,
      chatInitialText,
      activeCategory,
      setActiveCategory,
      deselect,
    ],
  )

  const layoutValue = useMemo<LayoutContextValue>(
    () => ({
      sidebarWidth,
      setSidebarWidthView,
      persistSidebarWidth,
      setSidebarWidth,
      rightPanelWidth,
      setRightPanelWidthView,
      persistRightPanelWidth,
      setRightPanelWidth,
      rightPanelOpen,
      setRightPanelOpen,
      rightPanelMode,
      setRightPanelMode,
      rightPanelPinned,
      setRightPanelPinned,
    }),
    [
      sidebarWidth,
      setSidebarWidthView,
      persistSidebarWidth,
      setSidebarWidth,
      rightPanelWidth,
      setRightPanelWidthView,
      persistRightPanelWidth,
      setRightPanelWidth,
      rightPanelOpen,
      rightPanelMode,
      rightPanelPinned,
      setRightPanelPinned,
    ],
  )

  return (
    <LayoutContext.Provider value={layoutValue}>
      <UIContext.Provider value={uiValue}>{children}</UIContext.Provider>
    </LayoutContext.Provider>
  )
}

export function useUI() {
  return useContext(UIContext)
}

export function useLayout() {
  return useContext(LayoutContext)
}

// ── Legacy convenience hook: returns both contexts merged for components that
// still read layout + ui in one place. Prefer useUI()/useLayout() separately.
export function useUIAndLayout() {
  return { ...useLayout(), ...useUI() }
}
