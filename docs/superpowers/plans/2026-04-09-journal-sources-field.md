# Journal Sources Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `sources` frontmatter field to journal entries that records which raw material files were used to generate the entry, displayed as static file chips in the detail panel.

**Architecture:** `sources` is a `Vec<String>` / `string[]` of workspace-relative paths (e.g. `2604/raw/录音-abc123.m4a`). AI writes it via CLAUDE.md spec; Rust parses it alongside `tags`; TypeScript renders it in `DetailPanel` as read-only file chips.

**Tech Stack:** Rust (gray_matter + fallback parser), TypeScript/React, Bash (fix-frontmatter script)

---

## File Map

| File | Change |
|---|---|
| `src-tauri/src/journal.rs` | Add `sources` to `FrontMatter`, `JournalEntry`, fallback parser |
| `src/types.ts` | Add `sources: string[]` to `JournalEntry` |
| `src/components/DetailPanel.tsx` | Render sources chips in header |
| `src-tauri/resources/workspace-template/.claude/CLAUDE.md` | Document `sources` field spec |
| `src-tauri/resources/workspace-template/.claude/scripts/fix-frontmatter` | Preserve `sources` line when rebuilding frontmatter |
| `src/tests/types.test.ts` | Add `sources` to fixture |
| `src/tests/DetailPanel.test.tsx` | Add `sources` to fakeEntry fixtures |

---

### Task 1: Rust — add `sources` to `FrontMatter` and `JournalEntry`

**Files:**
- Modify: `src-tauri/src/journal.rs`

- [ ] **Step 1: Write failing Rust tests**

Add to the `#[cfg(test)]` block at the bottom of `src-tauri/src/journal.rs`:

```rust
#[test]
fn fallback_extracts_sources() {
    let content = "---\ntags: [journal]\nsummary: 摘要\nsources: [2604/raw/rec-abc.m4a, 2604/raw/paste-20260409.txt]\n---\n\n# 标题\n";
    let fm = parse_frontmatter_fallback(content);
    assert_eq!(fm.sources, vec!["2604/raw/rec-abc.m4a", "2604/raw/paste-20260409.txt"]);
}

#[test]
fn fallback_sources_empty_when_absent() {
    let content = "---\ntags: [journal]\nsummary: 摘要\n---\n\n# 标题\n";
    let fm = parse_frontmatter_fallback(content);
    assert!(fm.sources.is_empty());
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test fallback_extracts_sources fallback_sources_empty_when_absent 2>&1 | tail -20
```

Expected: FAIL — `FrontMatter` has no `sources` field.

- [ ] **Step 3: Add `sources` to `FrontMatter` struct**

In `src-tauri/src/journal.rs`, find the `FrontMatter` struct (around line 29) and add the field:

```rust
#[derive(Debug, Deserialize, Default)]
struct FrontMatter {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    sources: Vec<String>,
}
```

- [ ] **Step 4: Add `sources` to `JournalEntry` struct**

Find `JournalEntry` struct (around line 14) and add after `materials`:

```rust
pub sources: Vec<String>,
```

- [ ] **Step 5: Update `parse_frontmatter_fallback` to extract `sources`**

Find the `for line in inner.lines()` loop in `parse_frontmatter_fallback` (around line 50). Add a `sources` variable and extraction:

```rust
fn parse_frontmatter_fallback(content: &str) -> FrontMatter {
    let inner = match content.strip_prefix("---") {
        Some(rest) => match rest.find("\n---") {
            Some(end) => &rest[..end],
            None => return FrontMatter::default(),
        },
        None => return FrontMatter::default(),
    };

    let mut summary = String::new();
    let mut tags: Vec<String> = vec![];
    let mut sources: Vec<String> = vec![];

    for line in inner.lines() {
        if let Some(val) = line.strip_prefix("summary:") {
            summary = extract_scalar_value(val.trim());
        } else if let Some(val) = line.strip_prefix("tags:") {
            tags = extract_inline_sequence(val.trim());
        } else if let Some(val) = line.strip_prefix("sources:") {
            sources = extract_inline_sequence(val.trim());
        }
    }

    FrontMatter { summary, tags, sources }
}
```

- [ ] **Step 6: Pass `sources` when building `JournalEntry` in `list_entries`**

Find the `entries.push(JournalEntry { ... })` call in `list_entries` (around line 180). Add `sources: fm.sources` to the struct literal:

```rust
entries.push(JournalEntry {
    filename,
    path: path.to_string_lossy().to_string(),
    title,
    summary: strip_surrounding_quotes(&fm.summary),
    tags: fm.tags,
    sources: fm.sources,
    year_month: year_month.to_string(),
    day,
    created_time,
    created_at_secs,
    mtime_secs,
    materials: vec![],
});
```

- [ ] **Step 7: Run all Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/journal.rs
git commit -m "feat(journal): add sources field to FrontMatter and JournalEntry"
```

---

### Task 2: TypeScript — add `sources` to `JournalEntry`

**Files:**
- Modify: `src/types.ts`
- Modify: `src/tests/types.test.ts`
- Modify: `src/tests/DetailPanel.test.tsx`

- [ ] **Step 1: Write failing TypeScript test**

In `src/tests/types.test.ts`, update the existing fixture to include `sources` and add a new assertion:

```typescript
const entry: JournalEntry = {
  filename: '28-AI平台产品会议纪要.md',
  path: '/nb/2603/28-AI平台产品会议纪要.md',
  title: 'AI平台产品会议纪要',
  summary: '探索可继续，需同步做场景化表达',
  tags: ['journal', 'meeting'],
  sources: ['2603/raw/录音-abc123.m4a'],
  year_month: '2603',
  day: 28,
  created_time: '10:15',
  created_at_secs: 1743120000,
  mtime_secs: 1743120000,
  materials: [],
}
expect(entry.sources).toContain('2603/raw/录音-abc123.m4a')
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/types.test.ts 2>&1 | tail -15
```

Expected: TypeScript compile error — `sources` does not exist on `JournalEntry`.

- [ ] **Step 3: Add `sources` to `JournalEntry` in `src/types.ts`**

Find the `JournalEntry` interface and add after `materials`:

```typescript
export interface JournalEntry {
  filename: string
  path: string
  title: string
  summary: string
  tags: string[]
  sources: string[]          // workspace-relative paths of source materials
  year_month: string
  day: number
  created_time: string
  created_at_secs: number
  mtime_secs: number
  materials: RawMaterial[]
}
```

- [ ] **Step 4: Update `fakeEntry` fixtures in `DetailPanel.test.tsx`**

Search for all `fakeEntry` / inline `JournalEntry` objects in `src/tests/DetailPanel.test.tsx` and add `sources: []` to each. Example:

```typescript
const fakeEntry: JournalEntry = {
  filename: '01-test.md', path: '/ws/2604/01-test.md',
  title: 'test', summary: '', tags: [], sources: [], year_month: '2604',
  day: 1, created_time: '10:00', created_at_secs: 0, mtime_secs: 0, materials: [],
}
```

Do the same for any other test files that construct `JournalEntry` objects (check `src/tests/JournalItem.test.tsx`, `src/tests/SoulView.test.tsx`, etc.).

- [ ] **Step 5: Run all frontend tests**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/tests/types.test.ts src/tests/DetailPanel.test.tsx src/tests/JournalItem.test.tsx src/tests/SoulView.test.tsx
git commit -m "feat(types): add sources field to JournalEntry"
```

---

### Task 3: CLAUDE.md — document `sources` field

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`

- [ ] **Step 1: Update the Frontmatter section**

Find the `### Frontmatter` section. The current spec shows two fields (`tags`, `summary`). Update it to three:

```markdown
### Frontmatter

Three fields only:

```yaml
---
tags: [journal, meeting]
summary: Core conclusion. Background and constraints.
sources: [2604/raw/录音-abc123.m4a, 2604/raw/paste-20260409.txt]
---
```

- `tags`: first tag must be `journal`, followed by content-type tags, all lowercase
- `summary`: 1-3 sentences, conclusion first then context. **Do not wrap the value in quotes**
- `sources`: workspace-relative paths of all raw materials referenced in this entry.
  Always write as an inline array. When appending to an existing entry, merge the existing
  `sources` array with the new material path(s) and deduplicate.
```

- [ ] **Step 2: Verify the file compiles into the binary (no action needed — `include_str!` picks it up at build time)**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "error|warning: unused" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/CLAUDE.md
git commit -m "docs(workspace): add sources field spec to CLAUDE.md"
```

---

### Task 4: fix-frontmatter script — preserve `sources`

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/scripts/fix-frontmatter`

- [ ] **Step 1: Add `sources_line` variable alongside `tags_line` and `summary_line`**

Find the section that declares `tags_line=""` and `summary_line=""` (around line 60). Add:

```bash
tags_line=""
summary_line=""
sources_line=""
```

- [ ] **Step 2: Extract `sources:` in the parsing loop**

Find the block that matches `tags:` and `summary:` lines. Add a parallel branch:

```bash
if [[ "$cleaned" =~ ^sources:\ * ]]; then
  sources_line="$cleaned"
  continue
fi
```

- [ ] **Step 3: Include `sources_line` in the rebuilt frontmatter**

Find the `new_fm` construction block:

```bash
new_fm="---"$'\n'
[[ -n "$tags_line" ]] && new_fm+="$tags_line"$'\n'
[[ -n "$summary_line" ]] && new_fm+="$summary_line"$'\n'
[[ -n "$sources_line" ]] && new_fm+="$sources_line"$'\n'
new_fm+="---"$'\n'
```

- [ ] **Step 4: Update the "must have at least one field" guard**

Find the guard that skips files with no tags/summary:

```bash
if [[ -z "$tags_line" && -z "$summary_line" && -z "$sources_line" ]]; then
  continue
fi
```

- [ ] **Step 5: Manual smoke test**

```bash
# Create a temp file with broken frontmatter that includes sources
tmp=$(mktemp /tmp/test-XXXX.md)
cat > "$tmp" <<'EOF'
---

## tags: [journal, meeting]
summary: 测试摘要
sources: [2604/raw/rec-abc.m4a]
EOF

bash src-tauri/resources/workspace-template/.claude/scripts/fix-frontmatter --dry-run "$tmp"
```

Expected output: `WOULD FIX: /tmp/test-XXXX.md` with sources preserved.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/scripts/fix-frontmatter
git commit -m "fix(script): preserve sources field in fix-frontmatter"
```

---

### Task 5: DetailPanel — render sources chips

**Files:**
- Modify: `src/components/DetailPanel.tsx`
- Modify: `src/tests/DetailPanel.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `src/tests/DetailPanel.test.tsx`:

```typescript
it('renders source filenames when entry has sources', async () => {
  const entryWithSources: JournalEntry = {
    ...fakeEntry,
    sources: ['2604/raw/录音-abc123.m4a', '2604/raw/paste-20260409.txt'],
  }
  render(<DetailPanel {...baseProps} entry={entryWithSources} entries={[entryWithSources]} />)
  await screen.findByText('录音-abc123.m4a')
  expect(screen.getByText('paste-20260409.txt')).toBeTruthy()
})

it('does not render sources section when sources is empty', async () => {
  render(<DetailPanel {...baseProps} entry={fakeEntry} entries={[fakeEntry]} />)
  await screen.findByText('# Test', { exact: false }).catch(() => {})
  // No source chips should appear
  expect(screen.queryByTestId('sources-row')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/DetailPanel.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `录音-abc123.m4a` not found in DOM.

- [ ] **Step 3: Add `fileKindFromName` import to `DetailPanel.tsx`**

At the top of `src/components/DetailPanel.tsx`, add:

```typescript
import { fileKindFromName } from '../lib/fileKind'
```

- [ ] **Step 4: Add sources chips in the header section**

In `DetailPanel`, find the header block that renders `displayTags` (the `<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>` block). Add a sources row immediately after it:

```tsx
{entry.sources.length > 0 && (
  <div
    data-testid="sources-row"
    style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: displayTags.length > 0 ? 8 : 0 }}
  >
    {entry.sources.map((src, i) => {
      const filename = src.split('/').pop() ?? src
      const kind = fileKindFromName(filename)
      const iconMap: Record<string, string> = {
        audio: 'M9 18V5l12-2v13',
        pdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
        docx: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
      }
      const iconPath = iconMap[kind] ?? 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
      return (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 'var(--text-xs)',
          padding: '2px 7px',
          borderRadius: 4,
          color: 'var(--item-meta)',
          background: 'var(--item-icon-bg)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconPath} />
          </svg>
          {filename}
        </span>
      )
    })}
  </div>
)}
```

- [ ] **Step 5: Run all frontend tests**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailPanel.tsx src/tests/DetailPanel.test.tsx
git commit -m "feat(detail): show source material chips in journal entry header"
```

---

### Task 6: Final build check

- [ ] **Step 1: TypeScript + Vite build**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 2: Rust build**

```bash
cd src-tauri && cargo build 2>&1 | grep "^error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Full test suite**

```bash
npx vitest run 2>&1 | tail -10 && cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 4: Final commit if any loose files**

```bash
git status
```

If clean, done. If any files remain unstaged, stage and commit with:

```bash
git commit -m "chore: sources field cleanup"
```
