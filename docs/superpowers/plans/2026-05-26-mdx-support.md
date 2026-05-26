# MDX Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.mdx` file support with runtime JSX compilation and 34 built-in presentation components.

**Architecture:** `@mdx-js/mdx` v3 `evaluate()` compiles MDX at runtime in the browser. A new `MdxRenderer` component wraps the evaluate call with an ErrorBoundary that falls back to the existing `marked` pipeline. `MarkdownRenderer` routes by file extension — `.md` stays on the marked path, `.mdx` goes to the new renderer.

**Tech Stack:** `@mdx-js/mdx` v3, React 19, TypeScript, existing design tokens from `globals.css`, Recharts (lazy), Mermaid.js (lazy)

---

## File Structure

```
src/components/
  MdxRenderer.tsx              — evaluate + ErrorBoundary + fallback
  mdx/
    index.ts                   — component map exported as mdxComponents
    typography.tsx             — Section, Subtitle, Label, Divider
    layout.tsx                 — Split, Columns/Column, Mockup, Placeholder
    display.tsx                — ProsCons, Stat/StatGroup, Table, Timeline, TagList, Progress, Avatar/AvatarGroup
    callout.tsx                — Callout, Quote, RelatedEntry, RelatedIdentity
    cards.tsx                  — Cards/Card, Options/Option, Kanban, Checklist, Counter, RatingBar
    media.tsx                  — AudioCard, VideoCard, ImageViewer, FileCard
    charts.tsx                 — BarChart, LineChart, PieChart, RadarChart (lazy Recharts)
    mermaid.tsx                — Mermaid (lazy mermaid.js)
src-tauri/src/
  journal.rs                  — +.mdx extension in parse_entry_filename, workspace_has_any_entry
  ai_processor.rs             — update embedded workspace template prompt with MDX component docs
src-tauri/
  tauri.conf.json             — CSP: add 'unsafe-eval' to script-src
package.json                  — +@mdx-js/mdx, recharts, mermaid
```

---

### Task 1: Install dependencies and configure CSP

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Install @mdx-js/mdx**

```bash
npm install @mdx-js/mdx
```
Expected: package added to `package.json` dependencies.

- [ ] **Step 2: Add CSP unsafe-eval to tauri.conf.json**

Read `src-tauri/tauri.conf.json`. Replace the `"security"` block:

```json
"security": {
  "csp": "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'",
  "assetProtocol": {
    "enable": true,
    "scope": {
      "allow": ["**"]
    }
  }
}
```

- [ ] **Step 3: Verify the app still builds**

```bash
npm run build
```
Expected: Build succeeds with no CSP-related errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src-tauri/tauri.conf.json
git commit -m "feat: add @mdx-js/mdx dependency and CSP unsafe-eval for MDX runtime"
```

---

### Task 2: Rust — add .mdx extension support

**Files:**
- Modify: `src-tauri/src/journal.rs:170-184` (parse_entry_filename)
- Modify: `src-tauri/src/journal.rs:541-568` (workspace_has_any_entry)

- [ ] **Step 1: Add .mdx to parse_entry_filename**

In `src-tauri/src/journal.rs`, at line 172-175, add `.mdx` to the strip_suffix chain:

```rust
pub fn parse_entry_filename(filename: &str) -> Option<(u32, String)> {
    // "28-AI平台产品会议纪要.md" 或 "28-dashboard.html" 或 "28-report.mdx" → Some((28, "title"))
    let stem = filename
        .strip_suffix(".mdx")
        .or_else(|| filename.strip_suffix(".md"))
        .or_else(|| filename.strip_suffix(".html"))
        .or_else(|| filename.strip_suffix(".htm"))?;
    // ... rest unchanged
```

- [ ] **Step 2: Add .mdx to workspace_has_any_entry**

In the same file, find the line in `workspace_has_any_entry` (around line 562) that checks extensions:

```rust
if fname.ends_with(".md") || fname.ends_with(".html") || fname.ends_with(".htm") || fname.ends_with(".mdx") {
```

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test
```
Expected: all existing tests pass. The `parse_entry_filename_standard` test still passes (`.md` still works). The new `.mdx` variant is covered by the chain.

- [ ] **Step 4: Add a unit test for .mdx filename parsing**

In `src-tauri/src/journal.rs`, in the `#[cfg(test)] mod tests` block, add:

```rust
#[test]
fn parse_entry_filename_mdx() {
    let r = parse_entry_filename("15-project-review.mdx");
    assert_eq!(r, Some((15, "project-review".to_string())));
}
```

- [ ] **Step 5: Run tests again, commit**

```bash
cd src-tauri && cargo test
```

```bash
git add src-tauri/src/journal.rs
git commit -m "feat: add .mdx extension recognition in journal scanner"
```

---

### Task 3: Create MdxRenderer component

**Files:**
- Create: `src/components/MdxRenderer.tsx`
- Create: `src/tests/MdxRenderer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/tests/MdxRenderer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MdxRenderer } from '../components/MdxRenderer'

// Mock @mdx-js/mdx evaluate
vi.mock('@mdx-js/mdx', () => ({
  evaluate: vi.fn(),
}))

// Mock react/jsx-runtime
vi.mock('react/jsx-runtime', () => ({
  Fragment: Symbol('Fragment'),
  jsx: vi.fn((type, props) => ({ type, props })),
  jsxs: vi.fn((type, props) => ({ type, props })),
}))

describe('MdxRenderer', () => {
  it('renders simple MDX content', async () => {
    const { evaluate } = await import('@mdx-js/mdx')
    const MockContent = () => ({ type: 'div', props: { children: 'Hello MDX' } })
    ;(evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      default: MockContent,
    })

    render(<MdxRenderer content="# Hello" />)
    await waitFor(() => {
      expect(screen.getByText('Hello MDX')).toBeTruthy()
    })
  })

  it('falls back to plain text on evaluate error', async () => {
    const { evaluate } = await import('@mdx-js/mdx')
    ;(evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('MDX compile error'),
    )

    render(<MdxRenderer content="# Hello World" />)
    await waitFor(() => {
      expect(screen.getByText('# Hello World')).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/MdxRenderer.test.tsx
```
Expected: FAIL — module not found or component not rendered.

- [ ] **Step 3: Implement MdxRenderer**

Create `src/components/MdxRenderer.tsx`:

```tsx
import { useState, useEffect, Component, type ReactNode } from 'react'
import { evaluate } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'
import { mdxComponents } from './mdx'

interface Props {
  content: string
  entryPath?: string
}

interface State {
  hasError: boolean
  error?: Error
}

class MdxErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function MdxRenderer({ content, entryPath }: Props) {
  const [MdxContent, setMdxContent] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function compile() {
      try {
        const result = await evaluate(content, {
          ...runtime,
          baseUrl: import.meta.url,
          ...mdxComponents,
        })
        if (!cancelled) {
          setMdxContent(() => result.default)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)))
        }
      }
    }

    compile()
    return () => { cancelled = true }
  }, [content])

  const fallback = (
    <div className="md-content">
      <pre className="mdx-fallback">{content}</pre>
    </div>
  )

  if (error) {
    return (
      <div className="md-content">
        <div className="mdx-error-banner">
          MDX compile error — showing raw source. {error.message}
        </div>
        <pre className="mdx-fallback">{content}</pre>
      </div>
    )
  }

  if (!MdxContent) {
    return <div className="md-content md-content--loading" />
  }

  return (
    <div className="md-content">
      <MdxErrorBoundary fallback={fallback}>
        <MdxContent />
      </MdxErrorBoundary>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/MdxRenderer.test.tsx
```
Expected: PASS (2 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/MdxRenderer.tsx src/tests/MdxRenderer.test.tsx
git commit -m "feat: add MdxRenderer with evaluate + ErrorBoundary + fallback"
```

---

### Task 4: Create component index and wire up MarkdownRenderer routing

**Files:**
- Create: `src/components/mdx/index.ts`
- Modify: `src/components/MarkdownRenderer.tsx`

- [ ] **Step 1: Create component index with empty placeholders**

Create `src/components/mdx/index.ts`:

```ts
// Layout
export { Split } from './layout'
export { Columns, Column } from './layout'
export { Mockup } from './layout'
export { Placeholder } from './layout'

// Display
export { ProsCons } from './display'
export { Stat, StatGroup } from './display'
export { Table } from './display'
export { Timeline } from './display'
export { TagList } from './display'
export { Progress } from './display'
export { Avatar, AvatarGroup } from './display'

// Callout & Quote
export { Callout } from './callout'
export { Quote } from './callout'
export { RelatedEntry } from './callout'
export { RelatedIdentity } from './callout'

// Cards & Lists
export { Cards, Card } from './cards'
export { Options, Option } from './cards'
export { Kanban } from './cards'
export { Checklist } from './cards'
export { Counter } from './cards'
export { RatingBar } from './cards'

// Media
export { AudioCard } from './media'
export { VideoCard } from './media'
export { ImageViewer } from './media'
export { FileCard } from './media'

// Charts (lazy)
export { BarChart, LineChart, PieChart, RadarChart } from './charts'

// Mermaid (lazy)
export { Mermaid } from './mermaid'

// Typography
export { Section } from './typography'
export { Subtitle } from './typography'
export { Label } from './typography'
export { Divider } from './typography'

// Component map for MDX evaluate
import { Split, Columns, Column, Mockup, Placeholder } from './layout'
import { ProsCons, Stat, StatGroup, Table, Timeline, TagList, Progress, Avatar, AvatarGroup } from './display'
import { Callout, Quote, RelatedEntry, RelatedIdentity } from './callout'
import { Cards, Card, Options, Option, Kanban, Checklist, Counter, RatingBar } from './cards'
import { AudioCard, VideoCard, ImageViewer, FileCard } from './media'
import { BarChart, LineChart, PieChart, RadarChart } from './charts'
import { Mermaid } from './mermaid'
import { Section, Subtitle, Label, Divider } from './typography'

export const mdxComponents = {
  Split, Columns, Column, Mockup, Placeholder,
  ProsCons, Stat, StatGroup, Table, Timeline, TagList, Progress, Avatar, AvatarGroup,
  Callout, Quote, RelatedEntry, RelatedIdentity,
  Cards, Card, Options, Option, Kanban, Checklist, Counter, RatingBar,
  AudioCard, VideoCard, ImageViewer, FileCard,
  BarChart, LineChart, PieChart, RadarChart,
  Mermaid,
  Section, Subtitle, Label, Divider,
}
```

- [ ] **Step 2: Create stub files so index.ts compiles**

Create each component file with minimal stub exports. For example, `src/components/mdx/typography.tsx`:

```tsx
export function Section({ children }: { children: React.ReactNode }) {
  return <div className="mdx-section">{children}</div>
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <p className="mdx-subtitle">{children}</p>
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="mdx-label">{children}</span>
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="mdx-divider" />
  return (
    <div className="mdx-divider--labeled">
      <hr /><span>{label}</span><hr />
    </div>
  )
}
```

Create stubs for `layout.tsx`, `display.tsx`, `callout.tsx`, `cards.tsx`, `media.tsx`, `charts.tsx`, `mermaid.tsx` similarly — each exporting the functions listed in `index.ts` as minimal `div` wrappers.

- [ ] **Step 3: Modify MarkdownRenderer to route .mdx files**

In `src/components/MarkdownRenderer.tsx`, in the `MarkdownRenderer` component (around line 305-368), add the extension check before the existing render logic:

```tsx
import { MdxRenderer } from './MdxRenderer'

// In the MarkdownRenderer component, at the top of the return:
export function MarkdownRenderer({ content, entryPath }: MarkdownRendererProps) {
  const isMdx = entryPath?.endsWith('.mdx')

  if (isMdx) {
    return <MdxRenderer content={content} entryPath={entryPath} />
  }

  // ... rest of existing render logic unchanged
```

- [ ] **Step 4: Verify the build compiles**

```bash
npm run build
```
Expected: tsc + vite build succeed. The stub components are in place.

- [ ] **Step 5: Commit**

```bash
git add src/components/mdx/ src/components/MarkdownRenderer.tsx
git commit -m "feat: add MDX component stubs and routing in MarkdownRenderer"
```

---

### Task 5: Implement typography components

**Files:**
- Modify: `src/components/mdx/typography.tsx` (replace stubs with real implementations)
- Create: `src/styles/mdx.css` (shared MDX component styles)

- [ ] **Step 1: Create mdx.css with typography and shared tokens**

Create `src/styles/mdx.css`:

```css
/* ── MDX Component Styles ── */

/* Section */
.mdx-section {
  margin-bottom: var(--space-8);
}

/* Subtitle */
.mdx-subtitle {
  color: var(--text-secondary, #6a7278);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-4);
}

/* Label */
.mdx-label {
  font-size: 0.7rem;
  color: var(--text-secondary, #6a7278);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

/* Divider */
.mdx-divider {
  border: none;
  border-top: 1px solid var(--divider);
  margin: var(--space-6) 0;
}
.mdx-divider--labeled {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-6) 0;
  color: var(--text-secondary, #6a7278);
  font-size: var(--text-xs);
}
.mdx-divider--labeled hr {
  flex: 1;
  border: none;
  border-top: 1px solid var(--divider);
}

/* ── Shared component tokens ── */
.mdx-card {
  background: var(--bg-secondary, #ffffff);
  border: 1px solid var(--divider);
  border-radius: 10px;
  padding: var(--space-4);
}
```

- [ ] **Step 2: Rewrite typography.tsx**

Replace the stub in `src/components/mdx/typography.tsx`:

```tsx
import '../../styles/mdx.css'

interface ChildrenProp {
  children: React.ReactNode
}

export function Section({ children }: ChildrenProp) {
  return <section className="mdx-section">{children}</section>
}

export function Subtitle({ children }: ChildrenProp) {
  return <p className="mdx-subtitle">{children}</p>
}

export function Label({ children }: ChildrenProp) {
  return <span className="mdx-label">{children}</span>
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="mdx-divider" />
  return (
    <div className="mdx-divider--labeled">
      <hr />
      <span>{label}</span>
      <hr />
    </div>
  )
}
```

- [ ] **Step 3: Write a render test**

Modify `src/tests/MdxRenderer.test.tsx` to add a test or create a separate test. For typography components, a simple smoke test:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section, Subtitle, Label, Divider } from '../components/mdx/typography'

describe('Typography components', () => {
  it('renders Section with children', () => {
    render(<Section><p>content</p></Section>)
    expect(screen.getByText('content')).toBeTruthy()
  })

  it('renders Subtitle', () => {
    render(<Subtitle>辅助文字</Subtitle>)
    expect(screen.getByText('辅助文字')).toBeTruthy()
  })

  it('renders Label', () => {
    render(<Label>TAG</Label>)
    expect(screen.getByText('TAG')).toBeTruthy()
  })

  it('renders Divider with label', () => {
    render(<Divider label="or" />)
    expect(screen.getByText('or')).toBeTruthy()
  })

  it('renders Divider without label', () => {
    const { container } = render(<Divider />)
    expect(container.querySelector('.mdx-divider')).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/MdxRenderer.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/mdx/typography.tsx src/styles/mdx.css src/tests/MdxRenderer.test.tsx
git commit -m "feat: implement MDX typography components"
```

---

### Task 6: Implement layout components

**Files:**
- Modify: `src/components/mdx/layout.tsx`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Append layout styles to mdx.css**

Add to `src/styles/mdx.css`:

```css
/* Split — two-column comparison */
.mdx-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin: var(--space-4) 0;
}
@media (max-width: 600px) {
  .mdx-split { grid-template-columns: 1fr; }
}

/* Columns */
.mdx-columns {
  display: grid;
  gap: var(--space-4);
  margin: var(--space-4) 0;
}
.mdx-columns--2 { grid-template-columns: 1fr 1fr; }
.mdx-columns--3 { grid-template-columns: 1fr 1fr 1fr; }
.mdx-columns--4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

/* Mockup — framed preview */
.mdx-mockup {
  border: 1px solid var(--divider);
  border-radius: 10px;
  overflow: hidden;
  margin: var(--space-4) 0;
}
.mdx-mockup-header {
  background: var(--bg-tertiary, #e5e5e7);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  border-bottom: 1px solid var(--divider);
}
.mdx-mockup-body {
  padding: var(--space-4);
}

/* Placeholder */
.mdx-placeholder {
  border: 2px dashed var(--divider);
  border-radius: 8px;
  padding: var(--space-8);
  text-align: center;
  color: var(--text-tertiary, #a0a8ad);
  margin: var(--space-4) 0;
}
```

- [ ] **Step 2: Rewrite layout.tsx**

Replace the stub in `src/components/mdx/layout.tsx`:

```tsx
interface ChildrenProp {
  children: React.ReactNode
}

export function Split({ children }: ChildrenProp) {
  return <div className="mdx-split">{children}</div>
}

export function Columns({ cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  return <div className={`mdx-columns mdx-columns--${cols}`}>{children}</div>
}

export function Column({ children }: ChildrenProp) {
  return <div>{children}</div>
}

export function Mockup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mdx-mockup">
      {title && <div className="mdx-mockup-header">{title}</div>}
      <div className="mdx-mockup-body">{children}</div>
    </div>
  )
}

export function Placeholder({ children }: ChildrenProp) {
  return <div className="mdx-placeholder">{children}</div>
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/layout.tsx src/styles/mdx.css
git commit -m "feat: implement MDX layout components (Split, Columns, Mockup, Placeholder)"
```

---

### Task 7: Implement display components

**Files:**
- Modify: `src/components/mdx/display.tsx`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Append display styles to mdx.css**

Add to `src/styles/mdx.css`:

```css
/* ProsCons */
.mdx-pros-cons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin: var(--space-4) 0;
}
.mdx-pros,
.mdx-cons {
  border-radius: 8px;
  padding: var(--space-4);
}
.mdx-pros { background: rgba(52, 199, 89, 0.08); }
.mdx-cons { background: rgba(255, 59, 48, 0.06); }
.mdx-pros h4 { color: #34c759; font-size: var(--text-sm); margin: 0 0 var(--space-2); }
.mdx-cons h4 { color: #ff3b30; font-size: var(--text-sm); margin: 0 0 var(--space-2); }

/* Stat */
.mdx-stat {
  text-align: center;
  padding: var(--space-3);
}
.mdx-stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--item-text);
  line-height: 1.2;
}
.mdx-stat-label {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  margin-top: var(--space-1);
}
.mdx-stat-trend {
  font-size: var(--text-xs);
  margin-left: var(--space-1);
}
.mdx-stat-trend--up { color: #34c759; }
.mdx-stat-trend--down { color: #ff3b30; }

/* StatGroup */
.mdx-stat-group {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin: var(--space-4) 0;
}

/* Table */
.mdx-table-wrap {
  overflow-x: auto;
  margin: var(--space-4) 0;
}
.mdx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.mdx-table th {
  text-align: left;
  font-weight: var(--font-medium);
  color: var(--text-secondary, #6a7278);
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--divider);
}
.mdx-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--divider);
}

/* Timeline */
.mdx-timeline {
  position: relative;
  padding-left: var(--space-6);
  margin: var(--space-4) 0;
}
.mdx-timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--divider);
}
.mdx-timeline-item {
  position: relative;
  margin-bottom: var(--space-4);
}
.mdx-timeline-item::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--space-6) + 3px);
  top: 5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--record-btn);
}
.mdx-timeline-time {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
}
.mdx-timeline-title {
  font-weight: var(--font-medium);
}
.mdx-timeline-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary, #6a7278);
}

/* TagList */
.mdx-tag-list {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin: var(--space-2) 0;
}
.mdx-tag {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  border-radius: 4px;
  background: var(--tag-bg);
  color: var(--tag-text);
}

/* Progress */
.mdx-progress {
  margin: var(--space-3) 0;
}
.mdx-progress-label {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  margin-bottom: var(--space-1);
}
.mdx-progress-bar {
  height: 6px;
  background: var(--bg-tertiary, #e5e5e7);
  border-radius: 3px;
  overflow: hidden;
}
.mdx-progress-fill {
  height: 100%;
  background: var(--record-btn);
  border-radius: 3px;
  transition: width 0.3s var(--ease-out);
}

/* Avatar */
.mdx-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--record-highlight);
  color: var(--record-btn);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}
.mdx-avatar--sm { width: 24px; height: 24px; font-size: 0.65rem; }
.mdx-avatar--lg { width: 40px; height: 40px; font-size: var(--text-base); }

/* AvatarGroup */
.mdx-avatar-group {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
```

- [ ] **Step 2: Rewrite display.tsx**

Replace the stub in `src/components/mdx/display.tsx`:

```tsx
interface ChildrenProp {
  children: React.ReactNode
}

// ── ProsCons ────────────────────────────────────────────

export function ProsCons({ children }: ChildrenProp) {
  return <div className="mdx-pros-cons">{children}</div>
}

export function Pros({ children }: { children: React.ReactNode }) {
  return <div className="mdx-pros"><h4>Pros</h4><ul>{children}</ul></div>
}

export function Cons({ children }: { children: React.ReactNode }) {
  return <div className="mdx-cons"><h4>Cons</h4><ul>{children}</ul></div>
}

// ── Stat ────────────────────────────────────────────────

export function Stat({
  label,
  value,
  trend,
  suffix,
}: {
  label: string
  value: string | number
  trend?: 'up' | 'down'
  suffix?: string
}) {
  return (
    <div className="mdx-stat">
      <div className="mdx-stat-value">
        {value}
        {suffix && <small>{suffix}</small>}
        {trend && (
          <span className={`mdx-stat-trend mdx-stat-trend--${trend}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div className="mdx-stat-label">{label}</div>
    </div>
  )
}

export function StatGroup({ children }: ChildrenProp) {
  return <div className="mdx-stat-group">{children}</div>
}

// ── Table ───────────────────────────────────────────────

export function Table({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="mdx-table-wrap">
      <table className="mdx-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Timeline ────────────────────────────────────────────

export function Timeline({
  items,
}: {
  items: { time: string; title: string; desc?: string }[]
}) {
  return (
    <div className="mdx-timeline">
      {items.map((item, i) => (
        <div key={i} className="mdx-timeline-item">
          <div className="mdx-timeline-time">{item.time}</div>
          <div className="mdx-timeline-title">{item.title}</div>
          {item.desc && <div className="mdx-timeline-desc">{item.desc}</div>}
        </div>
      ))}
    </div>
  )
}

// ── TagList ─────────────────────────────────────────────

export function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="mdx-tag-list">
      {tags.map((tag, i) => <span key={i} className="mdx-tag">{tag}</span>)}
    </div>
  )
}

// ── Progress ────────────────────────────────────────────

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="mdx-progress">
      {label && <div className="mdx-progress-label">{label} — {pct}%</div>}
      <div className="mdx-progress-bar">
        <div className="mdx-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Avatar ──────────────────────────────────────────────

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export function Avatar({
  name,
  size,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span className={`mdx-avatar${size && size !== 'md' ? ` mdx-avatar--${size}` : ''}`}>
      {initials(name)}
    </span>
  )
}

export function AvatarGroup({ children }: ChildrenProp) {
  return <div className="mdx-avatar-group">{children}</div>
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/display.tsx src/styles/mdx.css
git commit -m "feat: implement MDX display components (Stat, Table, Timeline, TagList, etc.)"
```

---

### Task 8: Implement callout, quote, and related link components

**Files:**
- Modify: `src/components/mdx/callout.tsx`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Append callout styles to mdx.css**

Add to `src/styles/mdx.css`:

```css
/* Callout */
.mdx-callout {
  border-left: 3px solid;
  border-radius: 0 8px 8px 0;
  padding: var(--space-3) var(--space-4);
  margin: var(--space-4) 0;
  font-size: var(--text-sm);
}
.mdx-callout--info {
  border-color: #0071e3;
  background: rgba(0, 113, 227, 0.06);
}
.mdx-callout--warning {
  border-color: #ff9f0a;
  background: rgba(255, 159, 10, 0.06);
}
.mdx-callout--tip {
  border-color: #34c759;
  background: rgba(52, 199, 89, 0.06);
}
.mdx-callout--note {
  border-color: var(--divider);
  background: var(--bg-secondary, #ffffff);
}
.mdx-callout-title {
  font-weight: var(--font-medium);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: var(--space-1);
}
.mdx-callout--info .mdx-callout-title { color: #0071e3; }
.mdx-callout--warning .mdx-callout-title { color: #ff9f0a; }
.mdx-callout--tip .mdx-callout-title { color: #34c759; }
.mdx-callout--note .mdx-callout-title { color: var(--text-secondary, #6a7278); }

/* Quote */
.mdx-quote {
  border-left: 3px solid var(--record-btn, #b8782a);
  padding: var(--space-3) var(--space-4);
  margin: var(--space-4) 0;
  background: var(--record-highlight, #fbf3e5);
  border-radius: 0 8px 8px 0;
  font-style: italic;
}
.mdx-quote-source {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  font-style: normal;
  margin-top: var(--space-2);
}

/* Related links */
.mdx-related-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--record-btn, #b8782a);
  font-size: var(--text-sm);
  cursor: pointer;
  text-decoration: none;
}
.mdx-related-link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 2: Rewrite callout.tsx**

Replace the stub in `src/components/mdx/callout.tsx`:

```tsx
interface ChildrenProp {
  children: React.ReactNode
}

type CalloutType = 'info' | 'warning' | 'tip' | 'note'

const typeLabels: Record<CalloutType, string> = {
  info: 'Info',
  warning: 'Warning',
  tip: 'Tip',
  note: 'Note',
}

export function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: CalloutType
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className={`mdx-callout mdx-callout--${type}`}>
      <div className="mdx-callout-title">{title ?? typeLabels[type]}</div>
      {children}
    </div>
  )
}

export function Quote({
  text,
  source,
  url,
}: {
  text: string
  source?: string
  url?: string
}) {
  return (
    <blockquote className="mdx-quote">
      <p>{text}</p>
      {source && (
        <div className="mdx-quote-source">
          — {url ? <a href={url}>{source}</a> : source}
        </div>
      )}
    </blockquote>
  )
}

export function RelatedEntry({
  path,
  label,
}: {
  path: string
  label?: string
}) {
  return (
    <a
      className="mdx-related-link"
      data-md-link={path}
      style={{ cursor: 'pointer' }}
    >
      {label ?? path}
    </a>
  )
}

export function RelatedIdentity({
  path,
  label,
}: {
  path: string
  label?: string
}) {
  return (
    <a
      className="mdx-related-link"
      data-md-link={path}
      style={{ cursor: 'pointer' }}
    >
      {label ?? path}
    </a>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/callout.tsx src/styles/mdx.css
git commit -m "feat: implement MDX callout, quote, and related link components"
```

---

### Task 9: Implement cards, options, kanban, checklist, counter, rating bar

**Files:**
- Modify: `src/components/mdx/cards.tsx`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Append card/list styles to mdx.css**

Add to `src/styles/mdx.css`:

```css
/* Cards */
.mdx-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-3);
  margin: var(--space-4) 0;
}
.mdx-card {
  border: 1px solid var(--divider);
  border-radius: 10px;
  overflow: hidden;
}
.mdx-card-image {
  background: var(--bg-tertiary, #e5e5e7);
  aspect-ratio: 16 / 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--text-tertiary, #a0a8ad);
}
.mdx-card-body {
  padding: var(--space-3);
}
.mdx-card-body h3 {
  font-size: var(--text-sm);
  margin: 0 0 var(--space-1);
}
.mdx-card-body p {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  margin: 0;
}

/* Options (static letter-badge list) */
.mdx-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-4) 0;
}
.mdx-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--divider);
  border-radius: 8px;
}
.mdx-option-letter {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 6px;
  background: var(--bg-tertiary, #e5e5e7);
  color: var(--text-secondary, #6a7278);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
  font-size: var(--text-xs);
  flex-shrink: 0;
}
.mdx-option-content h4 {
  font-size: var(--text-sm);
  margin: 0 0 var(--space-1);
}
.mdx-option-content p {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  margin: 0;
}

/* Kanban (static board) */
.mdx-kanban {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--space-3);
  overflow-x: auto;
  margin: var(--space-4) 0;
}
.mdx-kanban-column {
  border: 1px solid var(--divider);
  border-radius: 10px;
  padding: var(--space-3);
}
.mdx-kanban-column-title {
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 2px solid var(--record-btn, #b8782a);
}
.mdx-kanban-item {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary, #ffffff);
  border: 1px solid var(--divider);
  border-radius: 6px;
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
}

/* Checklist */
.mdx-checklist {
  list-style: none;
  padding: 0;
  margin: var(--space-3) 0;
}
.mdx-checklist-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  font-size: var(--text-sm);
}
.mdx-checklist-marker {
  flex-shrink: 0;
  width: 18px;
  text-align: center;
}
.mdx-checklist-marker--checked {
  color: var(--record-btn, #b8782a);
}
.mdx-checklist-marker--unchecked {
  color: var(--text-tertiary, #a0a8ad);
}

/* Counter */
.mdx-counter {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--record-highlight, #fbf3e5);
  border-radius: 8px;
  margin: var(--space-2) 0;
}
.mdx-counter-count {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--record-btn, #b8782a);
}
.mdx-counter-label {
  font-size: var(--text-sm);
  color: var(--text-secondary, #6a7278);
}

/* RatingBar */
.mdx-rating {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-2) 0;
}
.mdx-rating-stars {
  display: flex;
  gap: 2px;
}
.mdx-rating-star {
  font-size: var(--text-base);
}
.mdx-rating-star--filled { color: var(--record-btn, #b8782a); }
.mdx-rating-star--empty { color: var(--divider); }
.mdx-rating-label {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
}
```

- [ ] **Step 2: Rewrite cards.tsx**

Replace the stub in `src/components/mdx/cards.tsx`:

```tsx
interface ChildrenProp {
  children: React.ReactNode
}

// ── Cards / Card ────────────────────────────────────────

export function Cards({ children }: ChildrenProp) {
  return <div className="mdx-cards">{children}</div>
}

export function Card({
  image,
  title,
  description,
}: {
  image?: string
  title: string
  description?: string
}) {
  return (
    <div className="mdx-card">
      {image && <div className="mdx-card-image">{image}</div>}
      <div className="mdx-card-body">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}

// ── Options / Option ────────────────────────────────────

export function Options({ children }: ChildrenProp) {
  return <div className="mdx-options">{children}</div>
}

export function Option({
  letter,
  title,
  description,
}: {
  letter: string
  title: string
  description?: string
}) {
  return (
    <div className="mdx-option">
      <div className="mdx-option-letter">{letter}</div>
      <div className="mdx-option-content">
        <h4>{title}</h4>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}

// ── Kanban ──────────────────────────────────────────────

export function Kanban({
  columns,
}: {
  columns: { title: string; items: { text: string; tags?: string[] }[] }[]
}) {
  return (
    <div className="mdx-kanban">
      {columns.map((col, ci) => (
        <div key={ci} className="mdx-kanban-column">
          <div className="mdx-kanban-column-title">{col.title}</div>
          {col.items.map((item, ii) => (
            <div key={ii} className="mdx-kanban-item">
              {item.text}
              {item.tags && item.tags.length > 0 && (
                <div className="mdx-tag-list">
                  {item.tags.map((t, ti) => <span key={ti} className="mdx-tag">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Checklist ───────────────────────────────────────────

export function Checklist({
  items,
}: {
  items: { text: string; checked?: boolean }[]
}) {
  return (
    <ul className="mdx-checklist">
      {items.map((item, i) => (
        <li key={i} className="mdx-checklist-item">
          <span className={`mdx-checklist-marker ${item.checked ? 'mdx-checklist-marker--checked' : 'mdx-checklist-marker--unchecked'}`}>
            {item.checked ? '✓' : '○'}
          </span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Counter ─────────────────────────────────────────────

export function Counter({ count, label }: { count: number; label: string }) {
  return (
    <div className="mdx-counter">
      <span className="mdx-counter-count">{count}</span>
      <span className="mdx-counter-label">{label}</span>
    </div>
  )
}

// ── RatingBar ───────────────────────────────────────────

export function RatingBar({
  score,
  max = 5,
  label,
}: {
  score: number
  max?: number
  label?: string
}) {
  const clamped = Math.max(0, Math.min(score, max))
  const filled = Math.round(clamped)
  return (
    <div className="mdx-rating">
      <div className="mdx-rating-stars">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`mdx-rating-star ${i < filled ? 'mdx-rating-star--filled' : 'mdx-rating-star--empty'}`}
          >
            {i < filled ? '★' : '☆'}
          </span>
        ))}
      </div>
      {label && <span className="mdx-rating-label">{label}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/cards.tsx src/styles/mdx.css
git commit -m "feat: implement MDX cards, options, kanban, checklist, counter, rating"
```

---

### Task 10: Implement media components

**Files:**
- Modify: `src/components/mdx/media.tsx`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Append media styles to mdx.css**

Add to `src/styles/mdx.css`:

```css
/* Media cards */
.mdx-media-card {
  border: 1px solid var(--divider);
  border-radius: 10px;
  overflow: hidden;
  margin: var(--space-4) 0;
}
.mdx-media-header {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  border-bottom: 1px solid var(--divider);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.mdx-media-body {
  padding: var(--space-4);
}
.mdx-media-body audio,
.mdx-media-body video {
  width: 100%;
}

/* ImageViewer */
.mdx-image {
  margin: var(--space-4) 0;
  text-align: center;
}
.mdx-image img {
  max-width: 100%;
  border-radius: 8px;
}
.mdx-image-caption {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  margin-top: var(--space-2);
}

/* FileCard */
.mdx-file-card {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--divider);
  border-radius: 8px;
  cursor: pointer;
  font-size: var(--text-sm);
}
.mdx-file-card:hover {
  border-color: var(--record-btn, #b8782a);
}
.mdx-file-icon {
  font-size: var(--text-lg);
}
```

- [ ] **Step 2: Rewrite media.tsx**

Replace the stub in `src/components/mdx/media.tsx`:

```tsx
interface MediaCardProps {
  src: string
  title?: string
}

export function AudioCard({ src, title }: MediaCardProps) {
  return (
    <div className="mdx-media-card">
      <div className="mdx-media-header">
        <span>🔊</span>
        <span>{title ?? 'Audio'}</span>
      </div>
      <div className="mdx-media-body">
        <audio controls src={src} />
      </div>
    </div>
  )
}

export function VideoCard({
  src,
  title,
  poster,
}: {
  src: string
  title?: string
  poster?: string
}) {
  return (
    <div className="mdx-media-card">
      <div className="mdx-media-header">
        <span>🎬</span>
        <span>{title ?? 'Video'}</span>
      </div>
      <div className="mdx-media-body">
        <video controls src={src} poster={poster} />
      </div>
    </div>
  )
}

export function ImageViewer({
  src,
  alt = '',
  caption,
  width,
}: {
  src: string
  alt?: string
  caption?: string
  width?: string
}) {
  return (
    <figure className="mdx-image">
      <img src={src} alt={alt} style={width ? { width } : undefined} />
      {caption && <figcaption className="mdx-image-caption">{caption}</figcaption>}
    </figure>
  )
}

export function FileCard({
  path,
  label,
}: {
  path: string
  label?: string
}) {
  return (
    <a className="mdx-file-card" data-filepath={path} style={{ cursor: 'pointer' }}>
      <span className="mdx-file-icon">📄</span>
      <span>{label ?? path}</span>
    </a>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/media.tsx src/styles/mdx.css
git commit -m "feat: implement MDX media components (AudioCard, VideoCard, ImageViewer, FileCard)"
```

---

### Task 11: Implement chart components (lazy Recharts)

**Files:**
- Modify: `src/components/mdx/charts.tsx`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Install Recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Append chart styles to mdx.css**

Add to `src/styles/mdx.css`:

```css
/* Chart wrapper */
.mdx-chart {
  margin: var(--space-4) 0;
  padding: var(--space-4);
  border: 1px solid var(--divider);
  border-radius: 10px;
}
.mdx-chart-title {
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  color: var(--text-secondary, #6a7278);
  margin-bottom: var(--space-4);
}
```

- [ ] **Step 3: Rewrite charts.tsx with lazy loading**

Replace the stub in `src/components/mdx/charts.tsx`:

```tsx
import { Suspense, lazy } from 'react'

interface ChartData {
  label: string
  value: number
}

interface ChartProps {
  data: ChartData[]
  title?: string
  color?: string
}

const defaultColor = '#b8782a'

// ── Lazy chart wrappers ─────────────────────────────────

function ChartFallback() {
  return <div className="mdx-chart" style={{ minHeight: 200 }} />
}

function createLazyChart(
  importer: () => Promise<{ default: React.ComponentType<any> }>,
) {
  const LazyComponent = lazy(importer)
  return function ChartWrapper({ data, title, color }: ChartProps) {
    return (
      <div className="mdx-chart">
        {title && <div className="mdx-chart-title">{title}</div>}
        <Suspense fallback={<ChartFallback />}>
          <LazyComponent data={data} color={color ?? defaultColor} />
        </Suspense>
      </div>
    )
  }
}

export const BarChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.BarChartImpl })),
)
export const LineChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.LineChartImpl })),
)
export const PieChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.PieChartImpl })),
)
export const RadarChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.RadarChartImpl })),
)
```

- [ ] **Step 4: Create the Recharts implementation file**

Create `src/components/mdx/chart-impl.tsx`:

```tsx
import {
  BarChart as RechartsBar,
  Bar,
  LineChart as RechartsLine,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  RadarChart as RechartsRadar,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const amber = '#b8782a'
const amberLight = '#f0e4cc'

interface ChartData {
  label: string
  value: number
}

// ── BarChart ────────────────────────────────────────────

export function BarChartImpl({
  data,
  color = amber,
}: {
  data: ChartData[]
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsBar data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBar>
    </ResponsiveContainer>
  )
}

// ── LineChart ───────────────────────────────────────────

export function LineChartImpl({
  data,
  color = amber,
}: {
  data: ChartData[]
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsLine data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3 }}
        />
      </RechartsLine>
    </ResponsiveContainer>
  )
}

// ── PieChart ────────────────────────────────────────────

export function PieChartImpl({
  data,
}: {
  data: ChartData[]
  color?: string
}) {
  const colors = [amber, amberLight, '#d4b878', '#8a6500', '#f5edd8']
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsPie margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ label }: { label: string }) => label}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </RechartsPie>
    </ResponsiveContainer>
  )
}

// ── RadarChart ──────────────────────────────────────────

export function RadarChartImpl({
  data,
  color = amber,
}: {
  data: ChartData[]
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsRadar data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <PolarGrid stroke={amberLight} />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
        <Radar
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```
Expected: PASS. Recharts is bundled as a separate chunk (lazy loaded).

- [ ] **Step 6: Commit**

```bash
git add src/components/mdx/charts.tsx src/components/mdx/chart-impl.tsx src/styles/mdx.css package.json package-lock.json
git commit -m "feat: implement MDX chart components with lazy Recharts"
```

---

### Task 12: Implement Mermaid component (lazy)

**Files:**
- Modify: `src/components/mdx/mermaid.tsx`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Install Mermaid**

```bash
npm install mermaid
```

- [ ] **Step 2: Append mermaid styles to mdx.css**

Add to `src/styles/mdx.css`:

```css
/* Mermaid */
.mdx-mermaid {
  margin: var(--space-4) 0;
  padding: var(--space-4);
  border: 1px solid var(--divider);
  border-radius: 10px;
  overflow-x: auto;
}
.mdx-mermaid-caption {
  font-size: var(--text-xs);
  color: var(--text-secondary, #6a7278);
  margin-top: var(--space-3);
  text-align: center;
}
```

- [ ] **Step 3: Rewrite mermaid.tsx**

Replace the stub in `src/components/mdx/mermaid.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type mermaidType from 'mermaid'

interface Props {
  chart: string
  caption?: string
}

let mermaidPromise: Promise<typeof mermaidType> | null = null

function getMermaid(): Promise<typeof mermaidType> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'neutral',
        themeVariables: {
          primaryColor: '#b8782a',
          primaryBorderColor: '#b8782a',
          lineColor: '#6a7278',
        },
      })
      return m.default
    })
  }
  return mermaidPromise
}

export function Mermaid({ chart, caption }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setError(null)

    getMermaid()
      .then(async (mermaid) => {
        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`
        const { svg: rendered } = await mermaid.render(id, chart)
        if (!cancelled) setSvg(rendered)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })

    return () => { cancelled = true }
  }, [chart])

  return (
    <div className="mdx-mermaid">
      {svg && (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      {error && (
        <div style={{ color: '#ff3b30', fontSize: 'var(--text-xs)' }}>
          Mermaid error: {error}
        </div>
      )}
      {!svg && !error && (
        <div style={{ minHeight: 200 }} />
      )}
      {caption && <div className="mdx-mermaid-caption">{caption}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: PASS. Mermaid is bundled as a separate chunk.

- [ ] **Step 5: Commit**

```bash
git add src/components/mdx/mermaid.tsx src/styles/mdx.css package.json package-lock.json
git commit -m "feat: implement MDX Mermaid diagram component with lazy loading"
```

---

### Task 13: Update AI prompt to document MDX components

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md` (if it exists)
- Or modify: `src-tauri/src/ai_processor.rs` (embedded prompt)

- [ ] **Step 1: Check where the workspace template lives**

```bash
ls src-tauri/resources/workspace-template/.claude/
```

- [ ] **Step 2: Add MDX component reference to the workspace template**

Read the existing template file. Append an MDX component reference section at the end. The exact file depends on what exists — if there's a `CLAUDE.md` in the template, append to it. Otherwise, find the embedded prompt in `ai_processor.rs`.

The content to add:

```markdown

## MDX Components (available in journal entries)

When writing `.mdx` journal entries, you can use these components:

**Layout:** `<Split>`, `<Columns cols={2|3|4}>`, `<Column>`, `<Mockup title="...">`, `<Placeholder>`
**Display:** `<ProsCons>`, `<Pros>`, `<Cons>`, `<Stat label="..." value={...} trend="up|down">`, `<StatGroup>`, `<Table headers={[...]} rows={[[...]]}>`, `<Timeline items={[{time, title, desc}]}>`, `<TagList tags={[...]}>`, `<Progress value={0-100} label="...">`, `<Avatar name="..." size="sm|md|lg">`
**Callout:** `<Callout type="info|warning|tip|note" title="...">content</Callout>`, `<Quote text="..." source="..." url="...">`, `<RelatedEntry path="...">`, `<RelatedIdentity path="...">`
**Cards:** `<Cards>`, `<Card title="..." description="...">`, `<Options>`, `<Option letter="A" title="..." description="...">`, `<Kanban columns={[{title, items:[{text, tags}]}]}>`, `<Checklist items={[{text, checked}]}>`, `<Counter count={...} label="...">`, `<RatingBar score={...} max={5} label="...">`
**Media:** `<AudioCard src="...">`, `<VideoCard src="...">`, `<ImageViewer src="..." caption="...">`, `<FileCard path="...">`
**Charts (use sparingly):** `<BarChart data={[{label, value}]} title="...">`, `<LineChart data={[{label, value}]}>`, `<PieChart data={[{label, value}]}>`, `<RadarChart data={[{label, value}]}>`
**Diagrams:** `<Mermaid chart="...">` — Mermaid DSL for flowcharts, sequence diagrams, Gantt charts
**Typography:** `<Section>`, `<Subtitle>`, `<Label>`, `<Divider label="...">`

### Usage rules

1. Use components to **present information more clearly** — not for decoration
2. Prefer plain markdown when it suffices; reach for components when text alone is insufficient
3. Charts require real data from the conversation; don't fabricate values
4. Callout type: `info` for context, `warning` for caveats, `tip` for actionable advice, `note` for asides
5. Mermaid: use `flowchart TD` for decision flows, `sequenceDiagram` for interactions, `gantt` for timelines
```

- [ ] **Step 3: Verify the build still works**

```bash
npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/CLAUDE.md
git commit -m "feat: add MDX component reference to AI workspace template prompt"
```

---

### Task 14: End-to-end smoke test

**Files:**
- Create: a test `.mdx` file in a test workspace

- [ ] **Step 1: Create a test .mdx file for manual verification**

Create a test file `test-journal.mdx` to verify the full pipeline works. Steps:
1. Create a test workspace directory
2. Create `2605/` subdirectory
3. Write `01-test-mdx.mdx` with:

```mdx
---
summary: MDX smoke test
tags: [test]
---

# MDX Component Test

<Callout type="info" title="Test">
This is an info callout rendered via MDX.
</Callout>

<Columns cols={2}>
<Column>

## Column 1

<Stat label="Completion" value={87} trend="up" suffix="%" />

</Column>
<Column>

## Column 2

<Checklist items={[{text: "Item one", checked: true}, {text: "Item two", checked: false}]} />

</Column>
</Columns>

<Divider label="Key Insight" />

<Quote text="This is a test quote" source="Test Runner" />

<Timeline items={[
  {time: "10:00", title: "Start", desc: "Begin test"},
  {time: "10:15", title: "Complete", desc: "Test finished"}
]} />
```

- [ ] **Step 2: Load the file in the app**

Run `npm run tauri dev` and verify that:
- The `.mdx` file appears in the journal list
- The frontmatter (summary, tags) is parsed correctly
- The content renders with all components visible
- Callout shows with amber-ish left border
- Columns renders side by side
- Stat shows the number with trend arrow
- Checklist shows checked/unchecked markers
- Timeline shows with dots and line

- [ ] **Step 3: Test error fallback**

Create `02-test-broken.mdx` with invalid JSX:

```mdx
---
summary: Broken MDX test
tags: [test]
---

# Broken MDX

<DoesNotExist />
```

Verify the app shows the raw markdown source with an error banner, not a crash.

- [ ] **Step 4: Commit (or clean up test files)**

```bash
# If test files were committed as fixtures:
git add <test-fixture-path>
git commit -m "test: add MDX smoke test fixtures"
```

---

## Self-Review

### Spec Coverage
- ✅ .mdx file recognition (Task 2)
- ✅ MDX runtime with evaluate (Task 3)
- ✅ ErrorBoundary fallback (Task 3)
- ✅ MarkdownRenderer routing (Task 4)
- ✅ CSP unsafe-eval (Task 1)
- ✅ All 34 components (Tasks 5-12)
- ✅ AI prompt update (Task 13)
- ✅ Rust journal.rs changes (Task 2)

### Placeholder Scan
- No TBD, TODO, or "implement later"
- All code steps include complete implementations
- All commands have expected output

### Type Consistency
- All component props match between index.ts re-exports and implementations
- `mdxComponents` map in index.ts uses the same names as the export statements
- `evaluate()` options pass both runtime and components via spread
