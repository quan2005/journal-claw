# Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump version to 0.4.0, commit all pending changes, and establish a GitHub Actions workflow that auto-builds `.dmg` and publishes a GitHub Release when a version tag is pushed.

**Architecture:** Three sequential commits (feat → docs → chore/version), then tag + push to trigger CI. The workflow file lives at `.github/workflows/release.yml` and uses `macos-latest` runner with Tauri's standard build command.

**Tech Stack:** GitHub Actions, Tauri v2, Node.js 20, Rust stable, `softprops/action-gh-release@v2`

---

## File Map

| Action | Path |
|---|---|
| Create | `.github/workflows/release.yml` |
| Modify | `package.json` — version field |
| Modify | `src-tauri/Cargo.toml` — version field |
| Modify | `src-tauri/tauri.conf.json` — version field |

---

### Task 1: Commit functional source changes

**Files:**
- Commit: `src-tauri/src/ai_processor.rs`, `src-tauri/src/journal.rs`, `src-tauri/src/materials.rs`, `src-tauri/capabilities/default.json`, `src-tauri/capabilities/settings.json`, `src-tauri/Cargo.lock`, `src-tauri/resources/workspace-template/.claude/CLAUDE.md`, `src/assets/wechat-qrcode.png`, `src/components/JournalContextMenu.tsx`, `src/hooks/useJournal.ts`, `src/settings/components/SectionAbout.tsx`, `src/settings/components/SectionVoice.tsx`

- [ ] **Step 1: Stage all source and asset changes**

```bash
git add \
  src-tauri/src/ai_processor.rs \
  src-tauri/src/journal.rs \
  src-tauri/src/materials.rs \
  src-tauri/capabilities/default.json \
  src-tauri/capabilities/settings.json \
  src-tauri/Cargo.lock \
  src-tauri/resources/workspace-template/.claude/CLAUDE.md \
  src/assets/wechat-qrcode.png \
  src/components/JournalContextMenu.tsx \
  src/hooks/useJournal.ts \
  src/settings/components/SectionAbout.tsx \
  src/settings/components/SectionVoice.tsx
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: icon unification, settings redesign, workspace claude init, voice/AI improvements"
```

- [ ] **Step 3: Verify commit**

```bash
git log --oneline -3
```

Expected: top line shows the feat commit just made.

---

### Task 2: Commit docs and plan updates

**Files:**
- Commit: all `docs/superpowers/plans/` and `docs/superpowers/specs/` new/modified files

- [ ] **Step 1: Stage all docs changes**

```bash
git add docs/
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: add specs and plans for v0.4.0 features"
```

- [ ] **Step 3: Verify**

```bash
git log --oneline -3
```

Expected: top two commits are the docs commit and the feat commit.

---

### Task 3: Create GitHub Actions workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflows directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write release.yml**

Create `.github/workflows/release.yml` with this exact content:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    runs-on: macos-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install frontend dependencies
        run: npm ci

      - name: Build Tauri app
        run: npm run tauri build

      - name: Upload release
        uses: softprops/action-gh-release@v2
        with:
          name: ${{ github.ref_name }}
          generate_release_notes: true
          files: src-tauri/target/release/bundle/dmg/*.dmg
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Stage and commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions release workflow"
```

- [ ] **Step 4: Verify file exists**

```bash
cat .github/workflows/release.yml
```

Expected: the YAML content above is printed.

---

### Task 4: Bump version to 0.4.0

**Files:**
- Modify: `package.json:3`
- Modify: `src-tauri/Cargo.toml:3`
- Modify: `src-tauri/tauri.conf.json` (top-level `version` field)

- [ ] **Step 1: Update package.json**

Open `package.json`. Change line:
```json
"version": "0.3.0",
```
to:
```json
"version": "0.4.0",
```

- [ ] **Step 2: Update src-tauri/Cargo.toml**

Open `src-tauri/Cargo.toml`. Change line:
```toml
version = "0.3.0"
```
to:
```toml
version = "0.4.0"
```

- [ ] **Step 3: Update src-tauri/tauri.conf.json**

Open `src-tauri/tauri.conf.json`. Change:
```json
"version": "0.3.0"
```
to:
```json
"version": "0.4.0"
```

- [ ] **Step 4: Verify all three files show 0.4.0**

```bash
grep '"version"' package.json
grep '^version' src-tauri/Cargo.toml
python3 -c "import json; d=json.load(open('src-tauri/tauri.conf.json')); print(d['version'])"
```

Expected output (all three lines):
```
"version": "0.4.0",
version = "0.4.0"
0.4.0
```

- [ ] **Step 5: Stage and commit**

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to v0.4.0"
```

---

### Task 5: Tag and push

- [ ] **Step 1: Create annotated tag**

```bash
git tag v0.4.0
```

- [ ] **Step 2: Verify tag exists locally**

```bash
git tag --list | grep v0.4
```

Expected: `v0.4.0`

- [ ] **Step 3: Push commits and tag**

```bash
git push origin master --tags
```

Expected: output shows both branch and tag pushed, e.g.:
```
To git@github.com:quan2005/journal.git
   5ecb72a..xxxxxxx  master -> master
 * [new tag]         v0.4.0 -> v0.4.0
```

- [ ] **Step 4: Confirm Actions workflow triggered**

Open: `https://github.com/quan2005/journal/actions`

Expected: a new workflow run named "Release" is running or queued, triggered by tag `v0.4.0`. Build takes ~30-60 min on `macos-latest`.

- [ ] **Step 5: Confirm Release published (after workflow completes)**

Open: `https://github.com/quan2005/journal/releases`

Expected: release `v0.4.0` appears with a `.dmg` asset attached and auto-generated release notes.
