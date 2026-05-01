# Conversation File Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the AI uses `write` or `edit` tools during a conversation turn, display the affected files as clickable attachment chips below the assistant's response — with file-type icons, clicking opens the file with the system default app.

**Architecture:** Pure frontend change. The tool block's `input.path` already contains the relative file path. We collect paths from write/edit tool blocks in each AssistantRun, resolve them to absolute paths using the workspace path, deduplicate, and render as styled chips with file-type-appropriate icons. No Rust backend changes needed.

**Tech Stack:** React, TypeScript, existing `openFile()` IPC call, existing `getWorkspacePath()` IPC call.

---

### Task 1: Add FileAttachments component

**Files:**
- Create: `src/components/FileAttachments.tsx`

This is the core component. It takes an array of tool blocks, extracts file paths from write/edit operations, deduplicates them, and renders clickable chips with file-type icons.

- [ ] **Step 1: Create the FileAttachments component**

```tsx
import { useEffect, useState } from 'react'
import { openFile, getWorkspacePath } from '../lib/tauri'
import type { MessageBlock } from '../types'

const FILE_TYPE_ICONS: Record<string, string> = {
  md: 'M4 4h16v16H4z M7 15V9l2.5 3L12 9v6 M15 9v6',
  ts: 'M4 4h16v16H4z M8 8h8 M12 8v8',
  tsx: 'M4 4h16v16H4z M8 8h8 M12 8v8',
  js: 'M4 4h16v16H4z M10 8v6a2 2 0 0 1-4 0 M14 8v8',
  jsx: 'M4 4h16v16H4z M10 8v6a2 2 0 0 1-4 0 M14 8v8',
  json: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1 M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 1 2 2 2 2 0 0 1-2 2v5a2 2 0 0 1-2 2h-1',
  css: 'M4 4h16v16H4z M12 8a2 2 0 0 0-2 2 2 2 0 0 0 2 2 2 2 0 0 1-2 2',
  rs: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  toml: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  yaml: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  txt: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
}

const DEFAULT_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6'

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return FILE_TYPE_ICONS[ext] ?? DEFAULT_ICON
}

export function FileAttachments({ blocks }: { blocks: MessageBlock[] }) {
  const [workspacePath, setWorkspacePath] = useState('')

  useEffect(() => {
    getWorkspacePath().then(setWorkspacePath).catch(() => {})
  }, [])

  const filePaths = new Map<string, string>()
  for (const block of blocks) {
    if (block.type === 'tool' && (block.name === 'write' || block.name === 'edit') && !block.isError) {
      const relPath = (block.input?.path as string) ?? ''
      if (relPath && !filePaths.has(relPath)) {
        filePaths.set(relPath, relPath.split('/').pop() ?? relPath)
      }
    }
  }

  if (filePaths.size === 0 || !workspacePath) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
      {[...filePaths.entries()].map(([relPath, filename]) => {
        const absPath = workspacePath + '/' + relPath
        const iconPath = getFileIcon(filename)
        return (
          <div
            key={relPath}
            onClick={() => openFile(absPath).catch(() => {})}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px 3px 7px',
              borderRadius: 6,
              background: 'var(--dialog-kbd-bg)',
              border: '0.5px solid var(--dialog-glass-divider)',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              color: 'var(--item-meta)',
              transition: 'background 120ms ease-out, color 120ms ease-out',
              maxWidth: 220,
            }}
            title={relPath}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--item-hover-bg)'
              e.currentTarget.style.color = 'var(--item-text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--dialog-kbd-bg)'
              e.currentTarget.style.color = 'var(--item-meta)'
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              {iconPath.split(' M').map((seg, j) => (
                <path key={j} d={j === 0 ? seg : 'M' + seg} />
              ))}
            </svg>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {filename}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/yanwu/Projects/github/journal && npx tsc --noEmit src/components/FileAttachments.tsx`
Expected: No errors (or run full `npm run build` to check)

- [ ] **Step 3: Commit**

```bash
git add src/components/FileAttachments.tsx
git commit -m "feat: add FileAttachments component for conversation file chips"
```

---

### Task 2: Integrate FileAttachments into AssistantRun

**Files:**
- Modify: `src/components/ConversationDialog.tsx:1175-1303` (AssistantRun function)

Add the `FileAttachments` component at the end of each AssistantRun, after the last text block and before AssistantActions. It should appear in all three render paths: streaming, collapsed, and expanded.

- [ ] **Step 1: Add import at top of ConversationDialog.tsx**

At the top of the file (after existing imports around line 12), add:

```tsx
import { FileAttachments } from './FileAttachments'
```

- [ ] **Step 2: Add FileAttachments to the collapsed view (non-streaming, has tool blocks)**

In the `AssistantRun` function, find the collapsed render path (around line 1258). Add `<FileAttachments>` after the last text block and before error/truncated blocks:

```tsx
// Collapsed: summary + last text only (+ error/truncated always visible)
if (!expanded) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <CollapsedToolSummary
        icons={iconSequence}
        toolCount={toolCount}
        msgCount={intermediateTextCount}
        onExpand={() => setExpanded(true)}
      />
      {lastTextBlock?.type === 'text' && lastTextBlock.content && (
        <div
          style={{
            maxWidth: '100%',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}
        >
          <MarkdownRenderer content={lastTextBlock.content} />
        </div>
      )}
      <FileAttachments blocks={allBlocks} />
      {errorOrTruncBlocks.map((block: MessageBlock, i: number) => (
        <BlockRenderer key={`et-${i}`} block={block} onRetry={onRetry} onContinue={onContinue} />
      ))}
      {!hideActions && <AssistantActions content={lastTextBlock?.content ?? ''} />}
    </div>
  )
}
```

- [ ] **Step 3: Add FileAttachments to the expanded view**

In the expanded render path (around line 1288), add `<FileAttachments>` after all blocks and before AssistantActions:

```tsx
// Expanded: summary (togglable) + all blocks
return (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
    <CollapsedToolSummary
      icons={iconSequence}
      toolCount={toolCount}
      msgCount={intermediateTextCount}
      expanded
      onExpand={() => setExpanded(false)}
    />
    {allBlocks.map((block: MessageBlock, i: number) => (
      <BlockRenderer key={i} block={block} onRetry={onRetry} onContinue={onContinue} />
    ))}
    <FileAttachments blocks={allBlocks} />
    {!hideActions && <AssistantActions content={lastTextBlock?.content ?? ''} />}
  </div>
)
```

- [ ] **Step 4: Add FileAttachments to the streaming view**

In the streaming render path (around line 1222), add `<FileAttachments>` at the end. During streaming, it will progressively show files as they are written:

```tsx
if (isStreaming) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      {allBlocks.map((block: MessageBlock, i: number) => (
        <BlockRenderer
          key={i}
          block={block}
          streaming
          onRetry={onRetry}
          onContinue={onContinue}
        />
      ))}
      <FileAttachments blocks={allBlocks} />
    </div>
  )
}
```

- [ ] **Step 5: Also add to the no-non-text path for completeness**

The "no non-text blocks" path (around line 1239) won't have write/edit tool blocks, so `FileAttachments` would render nothing. No change needed here — the component returns null when there are no file paths.

- [ ] **Step 6: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ConversationDialog.tsx
git commit -m "feat: show file attachment chips in conversation assistant turns"
```

---

### Task 3: Visual testing and polish

**Files:**
- Possibly adjust: `src/components/FileAttachments.tsx`

- [ ] **Step 1: Start dev server and test**

Run: `cd /Users/yanwu/Projects/github/journal && npm run tauri dev`

Test scenarios:
1. Open a conversation in agent mode
2. Ask the AI to create or edit a file (e.g., "在 workspace 里创建一个 test.md 文件")
3. Verify: after the assistant response, file chips appear below the text
4. Verify: the chip shows the correct filename with a file-type icon
5. Verify: clicking the chip opens the file in the system default app
6. Verify: hovering shows the relative path as tooltip
7. Verify: multiple files show as multiple chips, wrapping correctly
8. Verify: duplicate paths (same file edited twice) show only once
9. Verify: chips appear in both collapsed and expanded views
10. Verify: dark mode and light mode both look correct
11. Verify: error tool blocks (isError=true) do NOT produce chips

- [ ] **Step 2: Adjust styling if needed**

Based on visual testing, adjust padding, gap, border-radius, or colors in `FileAttachments.tsx` to match the design language (克制 · 沉静 · 专业).

- [ ] **Step 3: Final commit if adjustments were made**

```bash
git add src/components/FileAttachments.tsx
git commit -m "fix: polish file attachment chip styling"
```
