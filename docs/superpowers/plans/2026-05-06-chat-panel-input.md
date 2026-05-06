# ChatPanel + RightPanel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CommandDock (bottom bar) and ConversationDialog (modal) with a unified RightPanel containing ChatPanel with OpenAI-style input bar.

**Architecture:** Two new components — `RightPanel.tsx` (tab container with resizable width) and `ChatPanel.tsx` (message list + input bar using `useConversation` hook). Remove `CommandDock.tsx`, `ConversationDialog.tsx`, `ConversationInput.tsx`. Update `App.tsx` to three-column layout with settings button in left sidebar.

**Tech Stack:** React 19 + TypeScript, same hooks (`useConversation`, `useRecorder`), no new dependencies.

---

### Task 1: Create ChatPanel.tsx — message list + scroll behavior

**Files:**
- Create: `src/components/ChatPanel.tsx`

Extract message list rendering and scroll logic from `ConversationDialog.tsx`. Reuse the same `useConversation` hook and all block renderers.

- [ ] **Step 1: Create ChatPanel.tsx with message list rendering**

Copy the message rendering logic from `ConversationDialog.tsx` (lines 44-805, excluding the modal wrapper). The component receives props for session management and renders:
- Message list with auto-scroll
- Scroll-to-bottom button
- Pending queue display
- Session stats / streaming stats
- All block renderers (BlockRenderer, ToolBlock, ThinkingBlock, WebSearchBlock, SubtaskBlock, etc.)

```tsx
// src/components/ChatPanel.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type { SessionMode, ConversationMessage, MessageBlock, WebSearchResultItem } from '../types'
import { useConversation } from '../hooks/useConversation'
import { useTranslation } from '../contexts/I18nContext'
import { Spinner } from './Spinner'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useSmoothStream } from '../hooks/useSmoothStream'
import { openFile } from '../lib/tauri'
import { FileAttachments } from './FileAttachments'
import { useRecorder } from '../hooks/useRecorder'

// Copy TOOL_ICON_PATHS from ConversationDialog.tsx
const TOOL_ICON_PATHS: Record<string, string> = { /* ... same as ConversationDialog ... */ }

interface ChatPanelProps {
  sessionId: string | null
  mode: SessionMode
  messages: ConversationMessage[]
  isStreaming: boolean
  usage: { input: number; output: number }
  stats: SessionStats | null
  pendingQueue: string[]
  onSend: (text: string, images?: ImageAttachment[]) => Promise<boolean>
  onCancel: () => void
  onRetry: () => void
  onEditAndResend: (index: number, text: string) => void
  onRemovePendingItem: (index: number) => string | undefined
  onContinue: () => void
}

export function ChatPanel({ /* props */ }: ChatPanelProps) {
  const { t } = useTranslation()
  const { status: recorderStatus, start: startRecord, stop: stopRecord } = useRecorder()
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  // ... scroll handling, elapsed timer (copy from ConversationDialog lines 106-132) ...

  const scrollToBottom = useCallback(() => { /* ... same as ConversationDialog ... */ }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Messages area */}
      <div ref={scrollRef} onScroll={handleScroll} style={{
        flex: 1, overflowY: 'auto', padding: '16px 24px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Empty state */}
        {messages.length === 0 && (/* ... same as ConversationDialog ... */)}

        {/* Message rendering — copy from ConversationDialog lines 580-622 */}
        {/* AssistantRun, MessageBubble — copy from ConversationDialog */}

        {/* Streaming spinner + stats — copy from ConversationDialog lines 624-673 */}
      </div>

      {/* Scroll to bottom button — copy from ConversationDialog lines 677-728 */}

      {/* Pending queue — copy from ConversationDialog lines 731-792 */}

      {/* Input bar (added in Task 2) — placeholder for now */}
      <div style={{ flexShrink: 0, padding: '8px 24px 12px' }}>
        {/* Task 2 will fill this in */}
      </div>

      {/* Image lightbox — copy from ConversationInput lines 524-544 */}
    </div>
  )
}

// Copy all helper components from ConversationDialog:
// - MessageBubble, UserContent, ActionBtn
// - AssistantRun, CollapsedToolSummary, ToolIcon
// - AssistantActions
// - BlockRenderer, ToolBlock, SubtaskBlock
// - WebSearchBlock, ThinkingBlock, ErrorBlock, TruncatedBlock
// - LoopWarningBlock, SmoothTextBlock
// - StreamingStats, AnimatedEllipsis, SessionStatsLine
```

- [ ] **Step 2: Verify the file compiles with no type errors**

```bash
npx tsc --noEmit src/components/ChatPanel.tsx 2>&1 | head -20
```

Expected: no errors (may need to adjust imports).

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: add ChatPanel with message list rendering

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Add OpenAI-style input bar to ChatPanel

**Files:**
- Modify: `src/components/ChatPanel.tsx`

Replace the placeholder input area with the new OpenAI-style input bar: full-width textarea above, toolbar row (📎 + 🎤 + ➤) below.

- [ ] **Step 1: Add input bar state and handlers to ChatPanel**

```tsx
// Inside ChatPanel component, add these state variables and handlers:

const [inputValue, setInputValue] = useState('')
const [attachments, setAttachments] = useState<Attachment[]>([])
const [imageAttachments, setImageAttachments] = useState<ImageAtt[]>([])
const [focused, setFocused] = useState(false)
const [dragOver, setDragOver] = useState(false)
const [slashOpen, setSlashOpen] = useState(false)
const [slashQuery, setSlashQuery] = useState('')
const [atOpen, setAtOpen] = useState(false)
const [atQuery, setAtQuery] = useState('')
const inputRef = useRef<HTMLTextAreaElement>(null)

// Auto-resize textarea
useEffect(() => {
  const el = inputRef.current
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }
}, [inputValue])

// Copy handlers from ConversationInput:
// - handleInputChange (slash command + @ mention detection)
// - handleSend
// - handleKeyDown
// - handlePaste (images + files)
// - handleDrop
// - addFiles, removeAttachment, removeImage
// - handleSlashSelect, handleAtSelect
// - handleAddFile (via @tauri-apps/plugin-dialog open())
```

- [ ] **Step 2: Build the OpenAI-style input bar JSX**

Replace the input placeholder div with:

```tsx
{/* Input bar */}
<div
  onDragOver={(e) => {
    e.preventDefault()
    setDragOver(true)
  }}
  onDragLeave={() => setDragOver(false)}
  onDrop={handleDrop}
  style={{
    padding: '8px 24px 12px',
    flexShrink: 0,
    position: 'relative',
  }}
>
  {/* Slash command / @ mention menus */}
  {slashOpen && (
    <SlashCommandMenu query={slashQuery} onSelect={handleSlashSelect} onClose={() => setSlashOpen(false)} />
  )}
  {atOpen && (
    <AtMentionMenu query={atQuery} onSelect={handleAtSelect} onClose={() => { setAtOpen(false); setAtQuery('') }} />
  )}

  {/* Fused container */}
  <div style={{
    border: dragOver
      ? '1.5px dashed var(--accent)'
      : focused
        ? '0.5px solid var(--accent)'
        : '0.5px solid var(--dialog-inset-border)',
    borderRadius: 12,
    background: dragOver ? 'var(--item-hover-bg)' : 'var(--dialog-inset-bg)',
    padding: '8px 12px 4px',
    transition: 'border-color 0.15s ease-out, background 0.15s ease-out',
    overflow: 'hidden',
  }}>
    {/* Drop hint */}
    {dragOver && (
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--accent)', opacity: 0.6, padding: '4px 0' }}>
        释放以添加文件
      </div>
    )}

    {/* Attachment chips */}
    {attachments.length > 0 && (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 6 }}>
        {attachments.map((att) => (
          <div key={att.path} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'var(--queue-bg)', border: '0.5px solid var(--queue-border)',
            borderRadius: 6, padding: '3px 8px', fontSize: 'var(--text-xs)', color: 'var(--item-text)',
          }}>
            <span onClick={() => openFile(att.path).catch(() => {})} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} title={att.path}>
              {att.filename}
            </span>
            <span onClick={() => removeAttachment(att.path)} style={{ color: 'var(--item-meta)', cursor: 'pointer', marginLeft: 2 }}>×</span>
          </div>
        ))}
      </div>
    )}

    {/* Image thumbnails */}
    {imageAttachments.length > 0 && (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 6 }}>
        {imageAttachments.map((img, idx) => (
          <div key={idx} style={{ position: 'relative', width: 44, height: 44, borderRadius: 6, overflow: 'hidden', border: '0.5px solid var(--queue-border)' }}>
            <img src={img.preview} alt="" onClick={() => setPreviewSrc(img.preview)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
            <span onClick={() => removeImage(idx)} style={{
              position: 'absolute', top: 1, right: 1, background: 'rgba(0,0,0,0.5)', color: '#fff',
              borderRadius: '50%', width: 14, height: 14, fontSize: 10, lineHeight: '14px',
              textAlign: 'center', cursor: 'pointer',
            }}>×</span>
          </div>
        ))}
      </div>
    )}

    {/* Full-width textarea */}
    <textarea
      ref={inputRef}
      value={inputValue}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="输入消息..."
      rows={1}
      style={{
        display: 'block', width: '100%', resize: 'none', border: 'none', borderRadius: 0,
        padding: '4px 0', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)',
        background: 'transparent', color: 'var(--item-text)', outline: 'none',
        lineHeight: 1.5, maxHeight: 160, overflow: 'auto',
      }}
    />

    {/* Toolbar row */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      {/* 📎 Attachment button */}
      <button onClick={handleAddFile} style={{
        background: 'none', border: 'none', color: dragOver ? 'var(--accent)' : 'var(--item-meta)',
        cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
        transition: 'color 0.15s ease-out',
      }} title="添加文件">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Stop button (streaming only) */}
        {isStreaming && (
          <button onClick={onCancel} style={{
            background: 'none', border: '0.5px solid var(--queue-border)', borderRadius: 6,
            padding: '4px 10px', fontSize: 'var(--text-xs)', color: 'var(--status-danger)', cursor: 'pointer',
          }}>
            {t('conversationStop')}
          </button>
        )}

        {/* 🎤 Mic button */}
        <button onClick={recorderStatus === 'recording' ? stopRecord : startRecord} style={{
          width: 30, height: 30, borderRadius: '50%',
          background: recorderStatus === 'recording'
            ? '#ff3b30'
            : 'rgba(184,120,42,0.12)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: inputValue.trim() ? 0 : 1,
          boxShadow: recorderStatus === 'recording'
            ? '0 4px 16px rgba(255,59,48,0.3)'
            : '0 4px 12px rgba(184,120,42,0.18)',
          transition: 'opacity 200ms ease-out, background 200ms ease-out, box-shadow 200ms ease-out',
        }}>
          {recorderStatus === 'recording' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--record-btn-icon)" stroke="none">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8" stroke="var(--record-btn-icon)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          )}
        </button>

        {/* ➤ Send button */}
        <button onClick={handleSend} disabled={!inputValue.trim() && imageAttachments.length === 0} style={{
          width: 30, height: 30, borderRadius: '50%',
          background: (inputValue.trim() || imageAttachments.length > 0) ? 'var(--accent)' : 'var(--dialog-kbd-bg)',
          border: 'none', cursor: (inputValue.trim() || imageAttachments.length > 0) ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: (inputValue.trim() || imageAttachments.length > 0) ? 1 : 0.3,
          transition: 'background 0.15s ease-out, opacity 0.15s ease-out',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  {/* Image lightbox */}
  {previewSrc && (
    <div onClick={() => setPreviewSrc(null)} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
    }}>
      <img src={previewSrc} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8 }} />
    </div>
  )}
</div>
```

- [ ] **Step 3: Add missing type imports at top of ChatPanel.tsx**

```tsx
import type { ImageAttachment } from '../lib/tauri'
import { fileKindFromName } from '../lib/fileKind'
import clipboard from 'tauri-plugin-clipboard-api'
import { open } from '@tauri-apps/plugin-dialog'
import { SlashCommandMenu } from './SlashCommandMenu'
import { AtMentionMenu } from './AtMentionMenu'
import type { SessionStats } from '../lib/tauri'

interface Attachment { path: string; filename: string; kind: string }
interface ImageAtt { media_type: string; data: string; preview: string }
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep -i "chatPanel\|ChatPanel" | head -10
```

Expected: no errors referencing ChatPanel.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: add OpenAI-style input bar to ChatPanel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Create RightPanel.tsx — tab container

**Files:**
- Create: `src/components/RightPanel.tsx`

- [ ] **Step 1: Create RightPanel.tsx with tab bar and content switching**

```tsx
// src/components/RightPanel.tsx
import type { ReactNode } from 'react'
import { useTranslation } from '../contexts/I18nContext'

export type RightPanelTab = 'ideas' | 'chat' | 'history'

interface RightPanelProps {
  activeTab: RightPanelTab
  onTabChange: (tab: RightPanelTab) => void
  ideasContent: ReactNode
  chatContent: ReactNode
  historyContent: ReactNode
  chatInputBar?: ReactNode  // rendered below chat content, fixed at bottom
}

export function RightPanel({
  activeTab,
  onTabChange,
  ideasContent,
  chatContent,
  historyContent,
  chatInputBar,
}: RightPanelProps) {
  const { t } = useTranslation()

  const btnStyle = (tab: RightPanelTab): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 'var(--text-sm)',
    fontWeight: activeTab === tab ? 'var(--font-semibold)' : 'var(--font-normal)',
    padding: 0,
    height: 34,
    color: activeTab === tab ? 'var(--segment-active-text)' : 'var(--segment-text)',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    letterSpacing: '0.03em',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--segment-active-text)' : '2px solid transparent',
    transition: 'color 0.15s ease-out',
  })

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--divider)',
        userSelect: 'none',
        flexShrink: 0,
      }}>
        <button style={btnStyle('ideas')} onClick={() => onTabChange('ideas')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          {t('ideas')}
        </button>
        <button style={btnStyle('chat')} onClick={() => onTabChange('chat')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {t('chat')}
        </button>
        <button style={btnStyle('history')} onClick={() => onTabChange('history')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {t('history')}
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'ideas' && ideasContent}
        {activeTab === 'chat' && (
          <>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{chatContent}</div>
            {chatInputBar}
          </>
        )}
        {activeTab === 'history' && historyContent}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify RightPanel compiles**

```bash
npx tsc --noEmit src/components/RightPanel.tsx 2>&1 | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/RightPanel.tsx
git commit -m "feat: add RightPanel tab container

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Add i18n keys for new tabs

**Files:**
- Modify: `src/locales/zh.ts`
- Modify: `src/locales/en.ts`

- [ ] **Step 1: Add tab label keys**

In `src/locales/zh.ts`, add to the `zh` object:

```ts
ideas: '想法',
chat: '探讨',
history: '历史',
```

In `src/locales/en.ts`, add to the `en` object:

```ts
ideas: 'Ideas',
chat: 'Chat',
history: 'History',
```

- [ ] **Step 2: Commit**

```bash
git add src/locales/zh.ts src/locales/en.ts
git commit -m "feat: add i18n keys for right panel tabs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Update App.tsx — remove old components, wire RightPanel

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove old imports and add new ones**

In `src/App.tsx`:
- Remove imports: `CommandDock`, `ConversationDialog`, `ProcessingQueue`, `TodoSidebar`
- Add imports: `RightPanel`, `ChatPanel` (type only for now), `SessionList`

```tsx
// Remove:
import { CommandDock } from './components/CommandDock'
import { ProcessingQueue } from './components/ProcessingQueue'
import { ConversationDialog } from './components/ConversationDialog'
import { TodoSidebar } from './components/TodoSidebar'

// Add:
import { RightPanel } from './components/RightPanel'
import type { RightPanelTab } from './components/RightPanel'
```

- [ ] **Step 2: Replace state variables**

Remove these state variables and their associated logic:
- `dockOpen`, `dockAppendText` (CommandDock state)
- `todoOpen`, `todoWidth`, `isTodoDragging`, `todoDragStartX`, `todoDragStartWidth` (TodoSidebar state)
- `conversationState` (ConversationDialog state)
- `pendingFiles`, `isDragOver` (CommandDock file handling — will move to ChatPanel)

Add these state variables:

```tsx
const [rightPanelOpen, setRightPanelOpen] = useState(true)
const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('ideas')
const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
  const saved = localStorage.getItem('journal_right_panel_width')
  return saved ? parseInt(saved) : 320
})
```

- [ ] **Step 3: Remove todo divider drag handling and related logic**

Remove:
- `onTodoDividerMouseDown` handler
- `useEffect` for `isTodoDragging`
- `todoOpen` related state
- All `dockOpen` / `dockAppendText` related logic

- [ ] **Step 4: Remove conversationState-related code**

Remove the `conversationState` state and its usage:
- The `useState` for `conversationState` (lines 94-105)
- The `useEffect` for `work-item-session-created` (lines 306-331)
- The `ConversationDialog` JSX rendering (lines 842-875)
- The `ProcessingQueue` floating overlay (lines 888-921)
- The `CommandDock` rendering (lines 922-939)
- The `aiReady === false` overlay (lines 940-994)

- [ ] **Step 5: Replace the todo sidebar section with RightPanel**

Replace the todo sidebar JSX (lines 774-839) with:

```tsx
{/* Right Panel */}
{rightPanelOpen && (
  <>
    {/* Divider drag handle */}
    <div
      onMouseDown={(e) => {
        // Drag logic for right panel resize
      }}
      style={{
        width: DIVIDER_WIDTH,
        flexShrink: 0,
        background: 'transparent',
        userSelect: 'none' as const,
        cursor: 'col-resize',
      }}
    />
    <div style={{ width: rightPanelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <RightPanel
        activeTab={rightPanelTab}
        onTabChange={setRightPanelTab}
        ideasContent={
          <TodoSidebar
            todos={todos}
            onToggle={toggleTodo}
            onAdd={addTodo}
            onDelete={deleteTodo}
            onSetDue={setTodoDue}
            onUpdateText={updateTodoText}
            onSetPath={setTodoPath}
            onRemovePath={removeTodoPath}
            onOpenConversation={/* ... */ }
            onNavigateToSource={/* ... */}
          />
        }
        chatContent={
          <ChatPanel
            sessionId={/* from useConversation */}
            mode="agent"
            messages={/* */}
            isStreaming={/* */}
            usage={/* */}
            stats={/* */}
            pendingQueue={/* */}
            onSend={/* */}
            onCancel={/* */}
            onRetry={/* */}
            onEditAndResend={/* */}
            onRemovePendingItem={/* */}
            onContinue={/* */}
          />
        }
        historyContent={
          <SessionList
            activeSessionId={/* */}
            onSelect={/* */}
            width={rightPanelWidth}
            collapsed={false}
          />
        }
      />
    </div>
  </>
)}
```

- [ ] **Step 6: Add right panel resize drag handling**

Add drag handling for right panel width (same pattern as existing divider drag):

```tsx
const [isRightPanelDragging, setIsRightPanelDragging] = useState(false)
const rightPanelDragStartX = useRef(0)
const rightPanelDragStartWidth = useRef(0)

const onRightPanelDividerMouseDown = (e: React.MouseEvent) => {
  setIsRightPanelDragging(true)
  rightPanelDragStartX.current = e.clientX
  rightPanelDragStartWidth.current = rightPanelWidth
}

useEffect(() => {
  const onMove = (e: MouseEvent) => {
    if (!isRightPanelDragging) return
    const delta = rightPanelDragStartX.current - e.clientX
    const newWidth = Math.max(200, Math.min(480, rightPanelDragStartWidth.current + delta))
    setRightPanelWidth(newWidth)
    localStorage.setItem('journal_right_panel_width', String(newWidth))
  }
  const onUp = () => setIsRightPanelDragging(false)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  return () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
}, [isRightPanelDragging])
```

- [ ] **Step 7: Update keyboard shortcuts**

Replace old `Cmd+T` (toggle todo) with right panel toggle, `Cmd+K` with chat tab:

```tsx
if ((e.metaKey || e.ctrlKey) && e.key === 't') {
  e.preventDefault()
  setRightPanelOpen(prev => {
    if (!prev) { setRightPanelTab('ideas'); return true }
    if (rightPanelTab === 'ideas') return false
    setRightPanelTab('ideas')
    return true
  })
}
if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
  e.preventDefault()
  setRightPanelOpen(prev => {
    if (!prev) { setRightPanelTab('chat'); return true }
    setRightPanelTab('chat')
    return true
  })
}
```

- [ ] **Step 8: Move settings button to left sidebar bottom section**

After the sidebar content area (`<div style={{ flex: 1, minHeight: 0 }}>`), add:

```tsx
{/* Settings button fixed at bottom */}
<div style={{
  borderTop: '0.5px solid var(--divider)',
  flexShrink: 0,
  padding: '6px 10px',
}}>
  <button
    onClick={() => setView('settings')}
    title="Settings (⌘,)"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '6px 8px',
      borderRadius: 6,
      border: 'none',
      background: 'transparent',
      color: 'var(--item-meta)',
      fontSize: 'var(--text-sm)',
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      transition: 'background 0.15s ease-out',
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--item-hover-bg)'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
    <span style={{ flex: 1, textAlign: 'left' }}>设置</span>
    <kbd style={{
      fontSize: '0.5625rem', color: 'var(--item-meta)', opacity: 0.4,
      fontFamily: 'var(--font-body)',
    }}>⌘,</kbd>
  </button>
</div>
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Fix any type errors.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace CommandDock+ConversationDialog with RightPanel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Update TitleBar.tsx

**Files:**
- Modify: `src/components/TitleBar.tsx`

- [ ] **Step 1: Update TitleBar props and todo button behavior**

Change the todo button to toggle right panel:

```tsx
interface TitleBarProps {
  // ... existing props ...
  rightPanelOpen: boolean      // replaces todoOpen
  onToggleRightPanel: () => void  // replaces onToggleTodo
  onOpenChat: () => void          // replaces onOpenConversation
  // remove: todoOpen, todoCount, onToggleTodo, onOpenConversation
}
```

Update todo button JSX:
- Use `rightPanelOpen` instead of `todoOpen`
- Use `onToggleRightPanel` instead of `onToggleTodo`
- Keep the checkmark icon and badge count (for Ideas tab indicator)

The AI status pill click now calls `onOpenChat`.

- [ ] **Step 2: Commit**

```bash
git add src/components/TitleBar.tsx
git commit -m "feat: update TitleBar for right panel toggle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Remove old files

**Files:**
- Remove: `src/components/CommandDock.tsx`
- Remove: `src/components/ConversationDialog.tsx`
- Remove: `src/components/ConversationInput.tsx`

- [ ] **Step 1: Delete the files**

```bash
git rm src/components/CommandDock.tsx src/components/ConversationDialog.tsx src/components/ConversationInput.tsx
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors (all references already removed in Task 5).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: remove deprecated CommandDock, ConversationDialog, ConversationInput

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Wire up useConversation in App.tsx

**Files:**
- Modify: `src/App.tsx`

Now that ChatPanel needs `useConversation` hook data, add it to App.tsx and pass props down.

- [ ] **Step 1: Import useConversation in App.tsx**

```tsx
import { useConversation } from './hooks/useConversation'
```

- [ ] **Step 2: Call useConversation and pass results to ChatPanel**

```tsx
const {
  sessionId,
  title: sessionTitle,
  messages,
  isStreaming,
  usage,
  stats,
  create,
  send,
  retry,
  cancel,
  load,
  editAndResend,
  pendingQueue,
  removePendingItem,
} = useConversation()
```

- [ ] **Step 3: Create chat entry point function**

```tsx
const openChatPanel = useCallback((sessionId?: string, context?: string, contextFiles?: string[]) => {
  setRightPanelOpen(true)
  setRightPanelTab('chat')
  if (sessionId) load(sessionId)
  if (context || contextFiles) {
    create('agent', context, contextFiles)
  }
}, [load, create])
```

- [ ] **Step 4: Pass to ChatPanel**

Update the ChatPanel JSX in RightPanel with actual props from useConversation.

- [ ] **Step 5: Update all entry points to use openChatPanel**

- Todo "discuss" button → `openChatPanel(undefined, todoText)`
- AI status pill click → `openChatPanel()`
- Processing queue item click → `openChatPanel(queueItem.sessionId)`
- History session click → `openChatPanel(sessionId)`

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
```

```bash
git add src/App.tsx
git commit -m "feat: wire useConversation into ChatPanel via App

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Dev server smoke test

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

```bash
npm run dev &
sleep 5
```

- [ ] **Step 2: Verify the app loads without errors**

Check browser console for errors. Expected: no React rendering errors.

- [ ] **Step 3: Test key interactions**

1. Click todo button → Right panel opens (Ideas tab)
2. Click chat tab → Chat tab with empty state + input bar
3. Click history tab → Session list loads
4. Type text in ChatPanel input → Mic disappears, Send activates
5. Click Send → message appears in list
6. Cmd+T → toggles right panel
7. Cmd+K → switches to Chat tab
8. Resize right panel → divider drag works, width persists

- [ ] **Step 4: Stop dev server and fix any issues**

---

### Task 10: Final commit

- [ ] **Step 1: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final fixes from smoke test

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
