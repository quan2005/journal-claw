# Brainstorming Visual Patterns Replication for Journal Entries

## Context

AI-generated journal entries are now Fragment HTML with semantic tags + basic CSS, but lack visual richness. The brainstorming skill's visual companion has a proven set of CSS patterns (options, cards, mockups, split views, pros/cons, wireframe blocks) that make documents scannable and engaging. This spec replicates those patterns into the journal's sandbox preview wrapper, adapting only the accent color (Apple blue → journal amber).

## Design Decision

**Maximum fidelity replication.** Copy brainstorming frame-template.css patterns verbatim — same class names, same structure, same behavior. Only changes:
- Color variables mapped to journal theme (amber accent, ink-cyan neutrals)
- Removed interactive states (`.selected`, `cursor:pointer`, `onclick`) since journal entries are read-only
- Removed frame chrome (`.header`, `.indicator-bar`) — not applicable

## CSS Patterns to Replicate (7 groups)

### 1. Typography Helpers
```css
.subtitle — secondary text below heading
.section  — content block with bottom margin
.label    — small uppercase label
```

### 2. Options (choice cards)
```css
.options            — vertical card list, gap: 0.75rem
.option             — bg-secondary, border, rounded 12px
.option .letter     — badge: bg-tertiary, weight 600, rounded 6px
.option .content    — flex:1, contains h3 + p
```

### 3. Cards (visual grid)
```css
.cards              — auto-fit grid, min 280px
.card               — bg-secondary, border, rounded 12px, overflow hidden
.card-image         — bg-tertiary, aspect-ratio 16/10
.card-body          — padding 1rem, h3 + p
```

### 4. Mockup Container
```css
.mockup             — bordered rounded container
.mockup-header      — bg-tertiary bar with label text
.mockup-body        — padding 1.5rem content area
```

### 5. Split View
```css
.split              — 1fr 1fr grid, gap 1.5rem, collapses at 700px
```

### 6. Pros/Cons
```css
.pros-cons          — 1fr 1fr grid
.pros h4            — green (#34c759) heading
.cons h4            — red (#ff3b30) heading
```

### 7. Wireframe Building Blocks
```css
.placeholder        — dashed border, centered, for empty areas
.mock-nav           — accent bg, white text, flex row
.mock-sidebar       — bg-tertiary, min-width 180px
.mock-content       — padding, flex:1
.mock-button        — accent bg, white text, rounded 6px
.mock-input         — bordered, rounded 6px, full width
```

### Color Mapping

| Brainstorming Variable | Journal Value (light) | Journal Value (dark) |
|---|---|---|
| `--bg-primary` | `#f5f6f7` | `#0f0f0f` |
| `--bg-secondary` | `#ffffff` | `#1a1a1c` |
| `--bg-tertiary` | `#e5e5e7` | `#2a2a2e` |
| `--border` | `#d8dce0` | `#2a2a2e` |
| `--text-primary` | `#1c1c1e` | `#e8e8e8` |
| `--text-secondary` | `#6a7278` | `#a2a6ae` |
| `--text-tertiary` | `#a0a8ad` | `#5a5e68` |
| `--accent` | `#b8782a` | `#c8933b` |
| `--success` | `#34c759` | `#34c759` |
| `--error` | `#ff3b30` | `#ff3b30` |

## Files to Modify

### 1. `src/lib/sandbox/buildSrcdoc.ts`
Append the 7 CSS pattern groups into the fragment wrapper's `<style>` block (after existing base element styles, before `</style>`). Approximately 120 lines of CSS.

### 2. `src-tauri/resources/workspace-template/.claude/CLAUDE.md`
Add a "Visual Patterns" reference section after the "Log Format" section:

```markdown
## 视觉组件速查

正文支持以下 CSS class，按场景选用：

| 场景 | 使用组件 |
|---|---|
| 方案对比、选项罗列 | `.options` > `.option` > `.letter` + `.content` |
| 关键结论、信息分块 | `.cards` > `.card` > `.card-body` |
| 设计稿、线框展示 | `.mockup` > `.mockup-header` + `.mockup-body` |
| 利弊权衡 | `.pros-cons` > `.pros` / `.cons` |
| 并排对比 | `.split` > 左 + 右 |
| 页面布局示意 | `.mock-nav`, `.mock-sidebar`, `.mock-content`, `.mock-button`, `.mock-input` |

排版辅助：`.subtitle`（副标题）、`.section`（章节块）、`.label`（小标签）。
不滥用。只在信息天然适合该视觉形态时使用。
```

### 3. Meeting minutes templates (4 files)
In each template's structure section, add a one-line hint about available visual components. Example for `argumentation-chain.md`:
```
论证链的各方立场可使用 `.options` 组件，共识结论可使用 `.card` 组件。
```

## Out of Scope
- Interactive behavior (click to select, events)
- Frame chrome (header, indicator bar)
- New visual patterns not in brainstorming frame-template.css
- Canvas.css / dot-pattern background (ideate-specific, not brainstorming)

## Verification
1. Open journal HTML entry → sandbox preview renders with new CSS classes available
2. Create a test HTML fragment using `.cards`, `.options`, `.pros-cons` → visually matches brainstorming companion style
3. Dark/light mode toggle → all patterns adapt correctly
4. Existing plain HTML entries render unchanged (backward compatible)
5. `npm run build` passes, `cargo test` passes
