# Settings Loading Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page fade-in entry animation and per-section skeleton loading states to the settings window, making the UI feel polished and responsive during Tauri IPC data fetches.

**Architecture:** Two independent layers — (1) the root `SettingsApp` component gets a CSS `@keyframes` fade-in on mount; (2) each data-fetching Section (`SectionGeneral`, `SectionAiEngine`, `SectionAbout`) renders a shimmer skeleton while its `loading` state is `true`, then cross-fades to real content. Pure CSS animations, no new dependencies. `SectionPlugins` and `SectionVoice` are static/disabled and need no skeleton.

**Tech Stack:** React, TypeScript, CSS `@keyframes` (inline `<style>` tags as already used in codebase)

---

## File Map

| File | Change |
|---|---|
| `src/settings/App.tsx` | Add `settings-fadein` CSS class + `<style>` block |
| `src/settings/components/SectionGeneral.tsx` | Add `loading` state + skeleton renderer |
| `src/settings/components/SectionAiEngine.tsx` | Add `loading` state + skeleton renderer |
| `src/settings/components/SectionAbout.tsx` | Add `loading` state + skeleton renderer |

---

## Task 1: Page fade-in entry animation

**Files:**
- Modify: `src/settings/App.tsx`

- [ ] **Step 1: Add fade-in keyframe + class to SettingsApp root div**

Open `src/settings/App.tsx`. The root `<div>` is at line 60. Add a `className` and inject a `<style>` block:

```tsx
// At the top of the return statement, add a <style> tag after the opening fragment.
// Change the outer <div> to include className="settings-root":

export default function SettingsApp() {
  useTheme()
  const [activeNav, setActiveNav] = useState<NavId>('general')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<NavId, HTMLElement>>>({})

  // ... (keep existing useEffect and helpers unchanged)

  return (
    <>
      <style>{`
        @keyframes settings-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .settings-root {
          animation: settings-fadein 160ms ease-out both;
        }
      `}</style>
      <div
        className="settings-root"
        style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--item-text)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
      >
        {/* rest of content unchanged */}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify visually**

Run `npm run dev` (or `npm run tauri dev` if Rust commands are needed), open the settings window, confirm it fades in over ~160ms on open. The nav and content area should appear together.

- [ ] **Step 3: Commit**

```bash
git add src/settings/App.tsx
git commit -m "feat(settings): add 160ms fade-in entry animation"
```

---

## Task 2: Shared skeleton CSS keyframe utility

**Files:**
- Modify: `src/settings/components/SectionGeneral.tsx` (add here first, reuse pattern in Tasks 3–4)

The shimmer animation will be defined inline in each Section's `<style>` block — consistent with how `SectionAiEngine` already defines `@keyframes spin` and `pulse` locally. No shared file needed.

The skeleton row pattern used across all sections:

```tsx
// Reusable inline helper — copy into each Section file, no import needed
function SkeletonRow({ width = '100%', height = 28, mb = 14 }: { width?: string | number; height?: number; mb?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--detail-case-bg) 25%, var(--divider) 50%, var(--detail-case-bg) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}
```

The `@keyframes shimmer` will be in each Section's own `<style>` tag:

```css
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes section-fadein {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

No step to commit here — this pattern is documented for Tasks 3–5 to copy.

---

## Task 3: Skeleton for SectionGeneral

**Files:**
- Modify: `src/settings/components/SectionGeneral.tsx`

`SectionGeneral` fetches `getWorkspacePath()` in `useEffect`. Currently no loading state — the input starts empty and fills in asynchronously.

- [ ] **Step 1: Add `loading` state and SkeletonRow helper**

Replace the top of the file (lines 1–19) with:

```tsx
import { useState, useEffect } from 'react'
import { getWorkspacePath, setWorkspacePath, pickFolder } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none',
}

function SkeletonRow({ width = '100%', height = 28, mb = 14 }: { width?: string | number; height?: number; mb?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--detail-case-bg) 25%, var(--divider) 50%, var(--detail-case-bg) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}
```

- [ ] **Step 2: Add `loading` state and update `useEffect`**

Replace the component body start (lines 13–19 of the original, the `export default function SectionGeneral()` through the `useEffect`):

```tsx
export default function SectionGeneral() {
  const [workspacePath, setWorkspacePathState] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorkspacePath().then(path => {
      setWorkspacePathState(path)
      setLoading(false)
    })
  }, [])
```

- [ ] **Step 3: Add skeleton branch in the return statement**

Replace the full `return (...)` block:

```tsx
  return (
    <div style={sectionStyle}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes section-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>通用</div>

      {loading ? (
        <>
          <SkeletonRow height={11} width={80} mb={5} />
          <SkeletonRow height={32} mb={4} />
          <SkeletonRow height={10} width={120} mb={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonRow height={30} width={60} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          {/* Workspace 路径 */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Workspace 路径</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={inputStyle}
                value={workspacePath}
                onChange={e => setWorkspacePathState(e.target.value)}
                placeholder="/Users/you/Documents/journal"
              />
              <button
                onClick={handlePickFolder}
                style={{
                  background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
                  borderRadius: 6, padding: '0 12px', fontSize: 12, color: 'var(--item-meta)',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                选择…
              </button>
            </div>
            <div style={hintStyle}>日志和素材的存储根目录</div>
          </div>

          {/* 保存 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
            <button
              onClick={handleSave}
              style={{
                background: 'var(--record-btn)', border: 'none', borderRadius: 5,
                padding: '6px 18px', fontSize: 12, fontWeight: 600,
                color: 'var(--bg)', cursor: 'pointer',
              }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

Keep `handlePickFolder` and `handleSave` functions unchanged.

- [ ] **Step 4: Verify**

Open settings. The 通用 section should show a shimmer skeleton briefly (IPC is fast, may only flash), then fade in the real content.

- [ ] **Step 5: Commit**

```bash
git add src/settings/components/SectionGeneral.tsx
git commit -m "feat(settings): skeleton loading state for SectionGeneral"
```

---

## Task 4: Skeleton for SectionAiEngine

**Files:**
- Modify: `src/settings/components/SectionAiEngine.tsx`

`SectionAiEngine` fetches two things: `checkEngineInstalled()` for each engine, and `getEngineConfig()`. Both are in the same `useEffect`. Currently shows engine cards at `opacity: 0.6` during `checking` — but fields and the whole section flash in without transition.

- [ ] **Step 1: Add `SkeletonRow` helper and `loading` state**

Insert after the existing imports and constants (after line 24, before `export default function SectionAiEngine()`):

```tsx
function SkeletonRow({ width = '100%', height = 28, mb = 14 }: { width?: string | number; height?: number; mb?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--detail-case-bg) 25%, var(--divider) 50%, var(--detail-case-bg) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}
```

Add `loading` to the state declarations inside the component (after `const [saved, setSaved] = useState(false)`):

```tsx
const [loading, setLoading] = useState(true)
```

- [ ] **Step 2: Update useEffect to clear loading when both fetches complete**

Replace the existing `useEffect` that calls `checkEngineInstalled` and `getEngineConfig` (lines 41–48):

```tsx
  useEffect(() => {
    Promise.all([
      ...ENGINES.map(({ id }) =>
        checkEngineInstalled(id).then(installed => {
          setStatus(prev => ({ ...prev, [id]: installed ? 'installed' : 'not_installed' }))
        })
      ),
      getEngineConfig().then(setCfg),
    ]).then(() => setLoading(false))
  }, [])
```

- [ ] **Step 3: Add skeleton branch in the return statement**

After the section title `<div>` (the "AI 引擎" label, line 87), wrap the engine cards + config area in a conditional:

```tsx
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>AI 引擎</div>

      {loading ? (
        <>
          {/* Two engine card skeletons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <SkeletonRow height={90} mb={0} />
            <SkeletonRow height={90} mb={0} />
          </div>
          {/* Config fields skeleton */}
          <SkeletonRow height={1} width="100%" mb={14} />
          <SkeletonRow height={11} width={60} mb={5} />
          <SkeletonRow height={32} mb={4} />
          <SkeletonRow height={10} width={160} mb={14} />
          <SkeletonRow height={11} width={60} mb={5} />
          <SkeletonRow height={32} mb={4} />
          <SkeletonRow height={10} width={140} mb={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonRow height={30} width={60} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          {/* Engine cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {ENGINES.map(({ id, label, vendor, icon }) => {
              const s = status[id]
              const isActive = active === id
              const isComingSoon = id === 'qwen'
              return (
                <div
                  key={id}
                  onClick={() => !isComingSoon && s === 'installed' && setCfg(prev => ({ ...prev, active_ai_engine: id }))}
                  title={isComingSoon ? '开发中，敬请期待' : undefined}
                  style={{
                    background: isActive ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                    border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                    borderRadius: 10, padding: '14px 12px 12px',
                    textAlign: 'center', position: 'relative',
                    cursor: isComingSoon ? 'not-allowed' : s === 'installed' ? 'pointer' : 'default',
                    opacity: isComingSoon ? 0.4 : s === 'checking' ? 0.6 : 1,
                    pointerEvents: isComingSoon ? 'none' : undefined,
                  }}
                >
                  {isComingSoon && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      fontSize: 9, color: 'var(--duration-text)',
                      background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
                      borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em',
                    }}>开发中</div>
                  )}
                  {!isComingSoon && s === 'checking' && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 14, height: 14, border: '2px solid var(--divider)',
                      borderTopColor: 'var(--record-btn)', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                  )}
                  {!isComingSoon && s === 'installed' && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 16, height: 16, background: '#27c93f', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: '#fff', fontWeight: 700,
                    }}>✓</div>
                  )}
                  <div style={{ fontSize: 22, marginBottom: 6, opacity: (!isComingSoon && (s === 'not_installed' || s === 'installing')) ? 0.5 : 1 }}>{icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--record-btn)' : 'var(--item-meta)' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 2 }}>{vendor}</div>
                  {!isComingSoon && s === 'not_installed' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleInstall(id) }}
                      style={{
                        position: 'absolute', bottom: 8, right: 8,
                        background: 'var(--record-btn)', border: 'none', borderRadius: 4,
                        padding: '3px 8px', fontSize: 10, color: 'var(--bg)',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >安装</button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Install progress */}
          {ENGINES.filter(({ id }) => status[id] === 'installing').map(({ id, label }) => (
            <div key={id} style={{
              background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
              borderRadius: 8, padding: '12px 14px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--record-btn)', animation: 'pulse 1s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, color: 'var(--item-meta)' }}>正在安装 {label}…</span>
              </div>
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10,
                color: 'var(--item-meta)', maxHeight: 120, overflowY: 'auto', lineHeight: 1.7,
              }}>
                {installLogs[id].map((line, i) => <div key={i}>{line}</div>)}
                <div ref={logsEndRef} />
              </div>
            </div>
          ))}

          {/* Config fields for active installed engine */}
          {status[active] === 'installed' && (
            <>
              <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

              {active === 'claude' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>API Key</label>
                    <input type="password" style={inputStyle} placeholder="sk-ant-…"
                      value={cfg.claude_code_api_key}
                      onChange={e => setCfg(prev => ({ ...prev, claude_code_api_key: e.target.value }))} />
                    <div style={hintStyle}>留空则使用 CLI 默认配置</div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Base URL</label>
                    <input style={inputStyle} placeholder="https://api.anthropic.com"
                      value={cfg.claude_code_base_url}
                      onChange={e => setCfg(prev => ({ ...prev, claude_code_base_url: e.target.value }))} />
                    <div style={hintStyle}>自定义 API 端点，留空使用默认值（代理场景）</div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Model</label>
                    <input style={inputStyle} placeholder="claude-sonnet-4-5"
                      value={cfg.claude_code_model}
                      onChange={e => setCfg(prev => ({ ...prev, claude_code_model: e.target.value }))} />
                    <div style={hintStyle}>留空使用 CLI 默认模型</div>
                  </div>
                </>
              )}

              {active === 'qwen' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>API Key</label>
                    <input type="password" style={inputStyle} placeholder="sk-…"
                      value={cfg.qwen_code_api_key}
                      onChange={e => setCfg(prev => ({ ...prev, qwen_code_api_key: e.target.value }))} />
                    <div style={hintStyle}>阿里云 DashScope API Key（独立于语音转写配置）</div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Base URL</label>
                    <input style={inputStyle} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                      value={cfg.qwen_code_base_url}
                      onChange={e => setCfg(prev => ({ ...prev, qwen_code_base_url: e.target.value }))} />
                    <div style={hintStyle}>自定义 API 端点，留空使用默认值</div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Model</label>
                    <input style={inputStyle} placeholder="qwen-coder-plus"
                      value={cfg.qwen_code_model}
                      onChange={e => setCfg(prev => ({ ...prev, qwen_code_model: e.target.value }))} />
                    <div style={hintStyle}>留空使用默认模型</div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
                <button onClick={handleSave} style={{
                  background: 'var(--record-btn)', border: 'none', borderRadius: 5,
                  padding: '6px 18px', fontSize: 12, fontWeight: 600,
                  color: 'var(--bg)', cursor: 'pointer',
                }}>保存</button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes section-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
```

Note: The `<style>` tag already exists at the bottom of the component — add the two new keyframes to it rather than creating a second `<style>` tag.

- [ ] **Step 4: Verify**

Open settings and navigate to AI 引擎. Two card-shaped skeletons and field skeletons should shimmer briefly, then the engine cards and config fields fade in.

- [ ] **Step 5: Commit**

```bash
git add src/settings/components/SectionAiEngine.tsx
git commit -m "feat(settings): skeleton loading state for SectionAiEngine"
```

---

## Task 5: Skeleton for SectionAbout

**Files:**
- Modify: `src/settings/components/SectionAbout.tsx`

`SectionAbout` fetches `getAppVersion()` and shows `'…'` until it resolves.

- [ ] **Step 1: Add `SkeletonRow` helper and `loading` state**

Insert after imports (before `const sectionStyle`):

```tsx
function SkeletonRow({ width = '100%', height = 28, mb = 14 }: { width?: string | number; height?: number; mb?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--detail-case-bg) 25%, var(--divider) 50%, var(--detail-case-bg) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}
```

Change state initialization:

```tsx
  const [version, setVersion] = useState('…')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAppVersion().then(v => {
      setVersion(v)
      setLoading(false)
    })
  }, [])
```

- [ ] **Step 2: Add skeleton branch in the return**

```tsx
  return (
    <div style={sectionStyle}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes section-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>关于</div>

      {loading ? (
        <div style={{
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
          borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <SkeletonRow height={18} width={60} mb={0} />
          <SkeletonRow height={12} width={80} mb={0} />
          <SkeletonRow height={10} width={120} mb={0} />
        </div>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          <div style={{
            background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
            borderRadius: 8, padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, color: 'var(--item-text)', fontWeight: 500, marginBottom: 4 }}>谨迹</div>
            <div style={{ fontSize: 11, color: 'var(--duration-text)' }}>版本 {version}</div>
          </div>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 3: Verify**

Open settings and scroll to 关于. A centered card skeleton should shimmer, then the version info fades in.

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/SectionAbout.tsx
git commit -m "feat(settings): skeleton loading state for SectionAbout"
```

---

## Task 6: Final check

- [ ] **Step 1: Build check**

```bash
npm run build
```

Expected: clean tsc + vite build, no type errors.

- [ ] **Step 2: Smoke test all sections**

Open settings window. Verify:
1. Window fades in (160ms)
2. 通用 section shows shimmer skeleton → fades to content
3. AI 引擎 section shows card + field skeletons → fades to content
4. 关于 section shows centered skeleton → fades to version info
5. 语音转写 and 技能插件 sections appear immediately (no async data, no skeleton needed)

- [ ] **Step 3: Commit**

If any cleanup needed:

```bash
git add -p
git commit -m "fix(settings): loading animation polish"
```
