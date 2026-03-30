# Global Icon Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all remaining Unicode symbol and emoji icons with Lucide React icons across 5 component files.

**Architecture:** `lucide-react@1.7.0` is already installed. Each task is one file. Icons are imported from lucide-react using the `LucideIcon` type. No new files created.

**Tech Stack:** React, TypeScript, lucide-react@1.7.0

---

### Task 1: TitleBar — settings button icon

**Files:**
- Modify: `src/components/TitleBar.tsx`

- [ ] **Step 1: Read the file**

```bash
cat src/components/TitleBar.tsx
```

- [ ] **Step 2: Add lucide import and replace the settings button icon**

Add `Settings2` import after the existing imports at the top:

```tsx
import { Settings2 } from 'lucide-react'
```

Find the settings toggle button that currently renders `⚙` as its child:

```tsx
        >⚙</button>
```

Replace it with:

```tsx
        ><Settings2 size={15} strokeWidth={1.5} /></button>
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TitleBar.tsx
git commit -m "feat(ui): replace settings button unicode symbol with Lucide Settings2 icon"
```

---

### Task 2: ThemeToggle — sun/moon/monitor icons

**Files:**
- Modify: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: Read the file**

```bash
cat src/components/ThemeToggle.tsx
```

- [ ] **Step 2: Replace the entire file content**

The `SEGMENTS` array changes `icon` from `string` to `LucideIcon`, and the render uses `<seg.icon size={12} strokeWidth={1.5} />`:

```tsx
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'
import type { Theme } from '../types'

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

const SEGMENTS: { value: Theme; icon: LucideIcon }[] = [
  { value: 'light',  icon: Sun },
  { value: 'dark',   icon: Moon },
  { value: 'system', icon: Monitor },
]

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Theme"
      style={{
        display: 'flex',
        border: '1px solid var(--divider)',
        borderRadius: 6,
        overflow: 'hidden',
        height: 22,
      }}
    >
      {SEGMENTS.map((seg, i) => (
        <button
          type="button"
          key={seg.value}
          aria-pressed={theme === seg.value}
          onClick={() => onChange(seg.value)}
          style={{
            width: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
            borderRight: i < SEGMENTS.length - 1 ? '1px solid var(--divider)' : 'none',
            background: theme === seg.value ? 'var(--item-selected-bg)' : 'transparent',
            opacity: theme === seg.value ? 1 : 0.45,
            padding: 0,
          }}
          title={seg.value}
        >
          <seg.icon size={12} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThemeToggle.tsx
git commit -m "feat(ui): replace theme toggle emoji with Lucide Sun/Moon/Monitor icons"
```

---

### Task 3: FileCard — file type icons and remove button

**Files:**
- Modify: `src/components/FileCard.tsx`

- [ ] **Step 1: Read the file**

```bash
cat src/components/FileCard.tsx
```

- [ ] **Step 2: Replace the entire file content**

Replace `iconEmoji()` with `iconLucide()` returning a `LucideIcon`. Icons render white on the existing gradient background. The `×` remove button uses Lucide `X`:

```tsx
import { FileText, Music, Image, X, type LucideIcon } from 'lucide-react'
import type { FileKind } from '../lib/fileKind'

interface FileCardProps {
  filename: string
  kind: FileKind
  onRemove: () => void
  onOpen?: () => void
}

function iconGradient(kind: FileKind): string {
  switch (kind) {
    case 'pdf':      return 'linear-gradient(160deg, #c63c3c 0%, #9e2828 100%)'
    case 'docx':     return 'linear-gradient(160deg, #3a6fd8 0%, #2756b0 100%)'
    case 'text':
    case 'markdown': return 'linear-gradient(160deg, #4a4a54 0%, #36363e 100%)'
    case 'audio':    return 'linear-gradient(160deg, #a03ad8 0%, #7828b0 100%)'
    case 'image':    return 'linear-gradient(160deg, #3aa87a 0%, #288a62 100%)'
    default:         return 'linear-gradient(160deg, #4a4a54 0%, #36363e 100%)'
  }
}

function iconLucide(kind: FileKind): LucideIcon {
  switch (kind) {
    case 'audio': return Music
    case 'image': return Image
    default:      return FileText
  }
}

export function FileCard({ filename, kind, onRemove, onOpen }: FileCardProps) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const Icon = iconLucide(kind)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        width: 56,
        padding: '4px 4px',
        borderRadius: 8,
        position: 'relative',
        flexShrink: 0,
      }}
      className="file-card-wrap"
    >
      {/* Icon — click opens file */}
      <div
        data-testid="file-card-icon"
        onClick={onOpen}
        style={{
          width: 44,
          height: 46,
          borderRadius: 9,
          background: iconGradient(kind),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onOpen ? 'pointer' : 'default',
          position: 'relative',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <Icon size={20} strokeWidth={1.5} color="#fff" />
        {ext && (
          <span style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: "'IBM Plex Mono', monospace",
            textTransform: 'uppercase',
            lineHeight: 1,
          }}>
            {ext}
          </span>
        )}
      </div>

      {/* Filename */}
      <span style={{
        fontSize: 9,
        color: 'var(--item-meta)',
        textAlign: 'center',
        maxWidth: 58,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
        userSelect: 'none',
      }}>
        {filename}
      </span>

      {/* Remove button */}
      <span
        data-testid="file-card-remove"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="file-card-remove"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#555',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        <X size={8} strokeWidth={2} />
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run src/tests/JournalItem.test.tsx
```

Expected: all tests pass (the FileCard tests check `data-testid` attributes, not emoji content).

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/FileCard.tsx
git commit -m "feat(ui): replace file type emoji and × with Lucide icons in FileCard"
```

---

### Task 4: DetailPanel — copy button checkmark

**Files:**
- Modify: `src/components/DetailPanel.tsx`

- [ ] **Step 1: Find the copy button section**

```bash
grep -n "已复制\|copied\|✓" src/components/DetailPanel.tsx
```

Expected output includes line ~94: `{copied ? '已复制 ✓' : '复制'}`

- [ ] **Step 2: Add lucide import**

Find the existing imports at the top of the file. After the last import, add:

```tsx
import { Check } from 'lucide-react'
```

- [ ] **Step 3: Replace the copy button label**

Find:

```tsx
          {copied ? '已复制 ✓' : '复制'}
```

Replace with:

```tsx
          {copied ? <><Check size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />已复制</> : '复制'}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat(ui): replace ✓ checkmark with Lucide Check icon in copy button"
```

---

### Task 5: SectionAiEngine — engine card icons and install checkmark

**Files:**
- Modify: `src/settings/components/SectionAiEngine.tsx`

- [ ] **Step 1: Read the relevant sections**

```bash
grep -n "◈\|◇\|✓\|icon\|ENGINES\|LucideIcon" src/settings/components/SectionAiEngine.tsx | head -20
```

Expected: lines 22-24 show `ENGINES` array with `icon: string` and `◈`/`◇` values; line ~155 shows `✓` in the install status badge.

- [ ] **Step 2: Add lucide imports**

Find the existing imports at top of file. Add after last import:

```tsx
import { Terminal, Sparkles, Check, type LucideIcon } from 'lucide-react'
```

- [ ] **Step 3: Update ENGINES array type and values**

Find:

```tsx
const ENGINES: { id: EngineId; label: string; vendor: string; icon: string }[] = [
  { id: 'claude', label: 'Claude Code', vendor: 'Anthropic', icon: '◈' },
  { id: 'qwen',   label: 'Qwen Code',   vendor: '阿里云',     icon: '◇' },
]
```

Replace with:

```tsx
const ENGINES: { id: EngineId; label: string; vendor: string; icon: LucideIcon }[] = [
  { id: 'claude', label: 'Claude Code', vendor: 'Anthropic', icon: Terminal },
  { id: 'qwen',   label: 'Qwen Code',   vendor: '阿里云',     icon: Sparkles },
]
```

- [ ] **Step 4: Update engine card icon render**

Find (inside the `ENGINES.map` render):

```tsx
                  <div style={{ fontSize: 22, marginBottom: 6, opacity: (!isComingSoon && (s === 'not_installed' || s === 'installing')) ? 0.5 : 1 }}>{icon}</div>
```

Replace with (destructure `icon` as `Icon` in the map):

First update the map destructuring from:
```tsx
            {ENGINES.map(({ id, label, vendor, icon }) => {
```
to:
```tsx
            {ENGINES.map(({ id, label, vendor, icon: Icon }) => {
```

Then replace the icon div:
```tsx
                  <div style={{ marginBottom: 6, opacity: (!isComingSoon && (s === 'not_installed' || s === 'installing')) ? 0.5 : 1, display: 'flex', justifyContent: 'center' }}>
                    <Icon size={22} strokeWidth={1.5} />
                  </div>
```

- [ ] **Step 5: Update install complete checkmark**

Find:

```tsx
                  <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 16, height: 16, background: '#27c93f', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: '#fff', fontWeight: 700,
                    }}>✓</div>
```

Replace with:

```tsx
                  <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 16, height: 16, background: '#27c93f', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Check size={9} strokeWidth={2.5} color="#fff" /></div>
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/settings/components/SectionAiEngine.tsx
git commit -m "feat(settings): replace unicode engine icons and checkmark with Lucide icons"
```
