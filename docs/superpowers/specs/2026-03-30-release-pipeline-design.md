# Release Pipeline Design

**Date:** 2026-03-30
**Scope:** Version bump 0.3.0 → 0.4.0, GitHub Actions CI release pipeline
**Status:** Approved

---

## Overview

Upgrade the app version to `0.4.0` and establish a GitHub Actions-based release pipeline. From this version onward, pushing a version tag triggers an automated macOS build and publishes a `.dmg` to GitHub Releases.

---

## 1. Version Bump Scope

Three files must be updated in sync to `0.4.0`:

| File | Field |
|---|---|
| `package.json` | `"version"` |
| `src-tauri/Cargo.toml` | `[package] version` |
| `src-tauri/tauri.conf.json` | `"version"` |

Tauri v2 validates that `Cargo.toml` and `tauri.conf.json` versions match at build time.

---

## 2. Commit Strategy

Current uncommitted changes are split into three commits in this order:

1. **`feat: [summary of functional changes]`** — source code, Rust modules, config files
2. **`docs: update specs and plans`** — `docs/superpowers/` files
3. **`chore: bump version to v0.4.0`** — version fields in the three files above

Then: `git tag v0.4.0` → `git push origin master --tags`

Tag format: `v0.4.0` (consistent with existing `v0.1.0`, `v0.2.0`, `v0.3.0`).

---

## 3. GitHub Actions Workflow

**File:** `.github/workflows/release.yml`

### Trigger

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

Only version tags trigger this workflow. Normal branch pushes are unaffected.

### Runner

`macos-latest` — required for Tauri builds (needs macOS frameworks, `afconvert`, Metal, etc.).

### Steps

1. `actions/checkout@v4`
2. Install Rust stable toolchain (`dtolnay/rust-toolchain@stable`)
3. Install Node.js 20 (`actions/setup-node@v4`)
4. `npm ci`
5. `npm run tauri build`
6. Locate `.dmg` artifact via glob: `src-tauri/target/release/bundle/dmg/*.dmg`
7. Create GitHub Release using `softprops/action-gh-release@v2`
   - Release name: tag name (e.g. `v0.4.0`)
   - Body: auto-generated from git commits between tags
   - Upload `.dmg` as release asset
8. `GITHUB_TOKEN` is auto-injected by Actions — no additional secrets needed

### Artifact

Only `.dmg` is uploaded. No code signing or notarization.

---

## 4. After This Release

Future releases follow this flow:

1. Make changes, commit to `master`
2. Update version in `package.json`, `Cargo.toml`, `tauri.conf.json`
3. Commit: `chore: bump version to vX.Y.Z`
4. `git tag vX.Y.Z && git push origin master --tags`
5. GitHub Actions builds and publishes automatically (~30-60 min)

---

## Out of Scope

- Code signing / notarization (users see "unidentified developer" warning, workaround: right-click → Open)
- Auto-updater (Tauri updater JSON not included)
- Linux / Windows builds
- PR-based release workflows
