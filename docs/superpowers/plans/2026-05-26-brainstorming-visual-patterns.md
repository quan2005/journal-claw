# Brainstorming Visual Patterns Replication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicate brainstorming visual companion's 7 CSS pattern groups into the journal's sandbox preview fragment wrapper, so AI-generated HTML journal entries can use cards, options, mockups, split views, pros/cons, and wireframe blocks.

**Architecture:** Append ~120 lines of CSS (adapted from brainstorming frame-template.css) into `buildSrcdoc.ts` fragment wrapper's `<style>` block. Update the AI system prompt `.claude/CLAUDE.md` with a visual component quick-reference table. Add one-line visual hints to each of the 4 meeting-minutes templates.

**Tech Stack:** TypeScript (buildSrcdoc.ts), CSS (fragment wrapper), Markdown (prompt/template files)

---

### Task 1: Add 7 CSS pattern groups to buildSrcdoc.ts

**Files:**
- Modify: `src/lib/sandbox/buildSrcdoc.ts` — insert after existing base element styles (after the `img` rule), before `</style>`

- [ ] **Step 1: Add brainstorming CSS variable aliases to :root**

Open `src/lib/sandbox/buildSrcdoc.ts`. In the `wrapFragment` function, inside the `:root { }` block, append these variable aliases after the existing `--font-mono` line:

```css
      --bg-primary: var(--bg);
      --bg-secondary: ${isDark ? '#1a1a1c' : '#ffffff'};
      --bg-tertiary: ${isDark ? '#2a2a2e' : '#e5e5e7'};
      --text-primary: var(--text);
      --text-tertiary: var(--text-muted);
      --success: #34c759;
      --error: #ff3b30;
```

Note: `--bg-secondary` and `--bg-tertiary` use template literals (like existing `--bg`, `--text` etc.) since they differ per theme. The others are static aliases.

- [ ] **Step 2: Insert the CSS patterns into wrapFragment's style block**

In the same `<style>` block, insert the following CSS block after the `img { max-width: 100%; height: auto; border-radius: 6px; }` line and before the closing `</style>` tag:

```css
    /* ===== VISUAL PATTERNS (from brainstorming frame-template) ===== */

    .subtitle { color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem; }
    .section { margin-bottom: 2rem; }
    .label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }

    /* Options (choice cards) */
    .options { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
    .option {
      background: var(--bg-secondary);
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }
    .option .letter {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      width: 1.75rem; height: 1.75rem;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 0.85rem; flex-shrink: 0;
    }
    .option .content { flex: 1; }
    .option .content h3 { font-size: 0.95rem; margin-bottom: 0.15rem; }
    .option .content p { color: var(--text-secondary); font-size: 0.85rem; margin: 0; }

    /* Cards (visual grid) */
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .card-image { background: var(--bg-tertiary); aspect-ratio: 16/10; display: flex; align-items: center; justify-content: center; }
    .card-body { padding: 1rem; }
    .card-body h3 { margin-bottom: 0.25rem; font-size: 0.95rem; }
    .card-body p { color: var(--text-secondary); font-size: 0.85rem; }

    /* Mockup container */
    .mockup {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
    }
    .mockup-header {
      background: var(--bg-tertiary);
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    }
    .mockup-body { padding: 1.5rem; }

    /* Split view (side-by-side) */
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 1rem 0; }
    @media (max-width: 700px) { .split { grid-template-columns: 1fr; } }

    /* Pros/Cons */
    .pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
    .pros, .cons { background: var(--bg-secondary); border-radius: 8px; padding: 1rem; }
    .pros h4 { color: var(--success); font-size: 0.85rem; margin-bottom: 0.5rem; }
    .cons h4 { color: var(--error); font-size: 0.85rem; margin-bottom: 0.5rem; }
    .pros ul, .cons ul { margin-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary); }
    .pros li, .cons li { margin-bottom: 0.25rem; }

    /* Placeholder */
    .placeholder {
      background: var(--bg-tertiary);
      border: 2px dashed var(--border);
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      color: var(--text-tertiary);
    }

    /* Inline mockup elements */
    .mock-nav { background: var(--accent); color: white; padding: 0.75rem 1rem; display: flex; gap: 1.5rem; font-size: 0.9rem; border-radius: 8px 8px 0 0; }
    .mock-sidebar { background: var(--bg-tertiary); padding: 1rem; min-width: 180px; }
    .mock-content { padding: 1.5rem; flex: 1; }
    .mock-button { background: var(--accent); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; display: inline-block; }
    .mock-input { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem; width: 100%; font-size: 0.85rem; }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/yanwu/Projects/github/journal && npx tsc --noEmit
```

Expected: No output (clean compile).

- [ ] **Step 4: Commit**

```bash
git -C /Users/yanwu/Projects/github/journal add src/lib/sandbox/buildSrcdoc.ts
git -C /Users/yanwu/Projects/github/journal commit -m "feat: add brainstorming visual pattern CSS to fragment wrapper"
```

---

### Task 2: Add visual component quick-reference to AI system prompt

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md` — insert after the "写作原则" section (after line 84)

- [ ] **Step 1: Insert the visual components guide**

Open `src-tauri/resources/workspace-template/.claude/CLAUDE.md`. After the last line of the "写作原则" section (after `- 复盘：突出目标、结果、原因、教训、改进。`), append:

```markdown

## 视觉组件速查

正文可使用以下 CSS class 增强可读性。按场景选用，不滥用：

| 场景 | 使用组件 | 示例 |
|---|---|---|
| 方案对比、选项罗列 | `.options` > `.option` > `.letter` + `.content` | 多个方案的 A/B/C 卡片 |
| 关键结论、信息分块 | `.cards` > `.card` > `.card-body` | 每项关键洞察一张卡片 |
| 设计稿、线框展示 | `.mockup` > `.mockup-header` + `.mockup-body` | 嵌在日志中的界面示意 |
| 利弊权衡 | `.pros-cons` > `.pros` / `.cons` | 方案的优势与风险对比 |
| 并排对比 | `.split` > 左 + 右 | 旧方案 vs 新方案 |
| 页面布局示意 | `.mock-nav`, `.mock-sidebar`, `.mock-content`, `.mock-button`, `.mock-input` | UI 结构讨论 |

排版辅助：`.subtitle`（副标题）、`.section`（章节块）、`.label`（小标签）。

**使用原则**：只在信息天然适合该视觉形态时才用。一条日志使用 1-3 个视觉组件即可，不要过度设计。简单的段落和列表仍然是大多数内容的最佳选择。
```

- [ ] **Step 2: Verify the file is valid**

```bash
head -5 /Users/yanwu/Projects/github/journal/src-tauri/resources/workspace-template/.claude/CLAUDE.md
```

Expected: Shows the "你的角色" title (file intact).

- [ ] **Step 3: Commit**

```bash
git -C /Users/yanwu/Projects/github/journal add src-tauri/resources/workspace-template/.claude/CLAUDE.md
git -C /Users/yanwu/Projects/github/journal commit -m "docs: add visual component quick-reference to AI system prompt"
```

---

### Task 3: Add visual hints to meeting minutes templates

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/alignment.md`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/argumentation-chain.md`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/progress-tracking.md`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/knowledge-distillation.md`

- [ ] **Step 1: Update alignment.md**

In `alignment.md`, after the line `**核心价值**：记录"对齐了什么、没对齐什么"。不光要记已达成的共识，没达成的分歧更关键 — 它们是下一步推进的发力点。`, add:

```
**视觉增强**：已对齐/未对齐事项可使用 `.pros-cons` 组件，参会人可使用 `.cards` 网格展示。
```

- [ ] **Step 2: Update argumentation-chain.md**

In `argumentation-chain.md`, after the line `**核心价值**：保留决策的可回溯性 — 不仅记录结论，还记录结论是怎么来的。三个月后翻回来读，能看懂当时为什么这么决定。`, add:

```
**视觉增强**：各方立场可使用 `.options` 组件展示，共识结论和稳固度可使用 `.card` 卡片，关键引用可使用 `.callout` 样式。
```

- [ ] **Step 3: Update progress-tracking.md**

In `progress-tracking.md`, after the line `**核心价值**：快速提取状态变化和风险信号。读者关心的不是"此刻的状态"，而是"从上次到现在发生了什么"。`, add:

```
**视觉增强**：风险看板可使用 `.cards` 网格（每项风险一张卡片），待办清单保持 `<table>`，关键讨论可使用 `.option` 组件。
```

- [ ] **Step 4: Update knowledge-distillation.md**

In `knowledge-distillation.md`, after the line `**核心价值**：从冗长的演讲中提炼可复用的认知资产。演讲会散，笔记要聚。`, add:

```
**视觉增强**：核心观点可使用 `.options` 编号列表，案例索引保持 `<table>`，个人启发可使用 `.card` 卡片。
```

- [ ] **Step 5: Commit**

```bash
git -C /Users/yanwu/Projects/github/journal add src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/
git -C /Users/yanwu/Projects/github/journal commit -m "docs: add visual component hints to meeting minutes templates"
```

---

### Task 4: Verification — build and test

- [ ] **Step 1: TypeScript type check**

```bash
cd /Users/yanwu/Projects/github/journal && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Rust tests**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 3: Verify generated srcdoc includes new CSS**

```bash
cd /Users/yanwu/Projects/github/journal && node -e "
const { buildSrcdoc } = require('./src/lib/sandbox/buildSrcdoc.ts');
" 2>&1 || echo "Cannot run directly (TS module) — manually verify by opening any .html journal entry in the app. Check: right-click iframe → Inspect → <style> should contain '.cards', '.options', '.pros-cons', '.mockup'."
```

Since this is a TypeScript module without a direct Node runner, manual verification:
- Open any `.html` journal entry in the app
- Right-click the preview iframe → Inspect Element
- In the `<style>` block, confirm these classes exist: `.cards`, `.options`, `.pros-cons`, `.mockup`, `.split`, `.placeholder`, `.mock-nav`

- [ ] **Step 4: Commit (if any fixes)**

```bash
git -C /Users/yanwu/Projects/github/journal status
```
