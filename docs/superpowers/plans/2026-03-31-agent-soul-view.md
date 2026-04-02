# Agent 灵魂视图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将"工作引导"从设置页提取为独立的 `soul` 视图，入口为 TitleBar 右区灵魂图标（⌘P）；同时将 ⚙ 设置入口移到 CommandDock 左侧。

**Architecture:** App.tsx 的 `view` state 从 `'journal' | 'settings'` 扩展为 `'journal' | 'settings' | 'soul'`。新建 `SoulView` 组件复用 SectionGuide 的编辑器逻辑（`getWorkspacePrompt` / `setWorkspacePrompt` IPC 不变）。TitleBar 移除 ⚙ 加灵魂图标；CommandDock 左侧加 ⚙ 按钮。设置页删除"工作引导" section 和对应 nav item。

**Tech Stack:** React + TypeScript（无新依赖）；Tauri IPC `get_workspace_prompt` / `set_workspace_prompt`（已有，不变）

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `src/App.tsx` | `view` 类型扩展；加 ⌘P 快捷键；加 soul 视图渲染分支 |
| Modify | `src/components/TitleBar.tsx` | 移除 ⚙ 按钮；加灵魂图标按钮；接收 `onToggleSoul` prop |
| Modify | `src/components/CommandDock.tsx` | 最左侧加 ⚙ 按钮；接收 `onOpenSettings` prop |
| Create | `src/components/SoulView.tsx` | 灵魂编辑视图（从 SectionGuide 提取逻辑） |
| Create | `src/tests/SoulView.test.tsx` | SoulView 组件测试 |
| Modify | `src/settings/SettingsLayout.tsx` | 从 NAV_ITEMS 删 `guide`；从 SettingsContent 删 SectionGuide |
| Modify | `src/settings/navigation.ts` | 从 `NavId` 和 `ALL_NAV_IDS` 删 `'guide'` |
| Delete | `src/settings/components/SectionGuide.tsx` | 不再需要 |
| Delete | `src/tests/SectionGuide.test.tsx` | 随 SectionGuide 一起删除 |

---

## Task 1: 新建 SoulView 组件并测试

**Files:**
- Create: `src/components/SoulView.tsx`
- Create: `src/tests/SoulView.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/tests/SoulView.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SoulView from '../components/SoulView'

const mockGetWorkspacePrompt = vi.fn()
const mockSetWorkspacePrompt = vi.fn()

vi.mock('../lib/tauri', () => ({
  getWorkspacePrompt: (...args: unknown[]) => mockGetWorkspacePrompt(...args),
  setWorkspacePrompt: (...args: unknown[]) => mockSetWorkspacePrompt(...args),
}))

describe('SoulView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspacePrompt.mockResolvedValue('# 谨迹')
    mockSetWorkspacePrompt.mockResolvedValue(undefined)
  })

  it('loads workspace prompt on mount', async () => {
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    expect(textarea).toBeTruthy()
    expect(mockGetWorkspacePrompt).toHaveBeenCalledOnce()
  })

  it('calls setWorkspacePrompt when save button clicked', async () => {
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '# 更新内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockSetWorkspacePrompt).toHaveBeenCalledWith('# 更新内容')
    })
  })

  it('shows save error when setWorkspacePrompt fails', async () => {
    mockSetWorkspacePrompt.mockRejectedValue(new Error('write failed'))
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '# 失败内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockSetWorkspacePrompt).toHaveBeenCalled()
    })
    expect(await screen.findByText('保存失败，请重试')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/tests/SoulView.test.tsx
```

Expected: FAIL — `Cannot find module '../components/SoulView'`

- [ ] **Step 3: 创建 SoulView 组件**

```tsx
// src/components/SoulView.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { getWorkspacePrompt, setWorkspacePrompt } from '../lib/tauri'

function highlightMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (/^# /.test(line)) {
      return <div key={i} style={{ color: 'var(--item-text)' }}>{line}</div>
    }
    if (/^## /.test(line)) {
      return <div key={i} style={{ color: 'var(--item-meta)' }}>{line}</div>
    }
    const bulletMatch = line.match(/^(\s*)(- )(.*)/)
    if (bulletMatch) {
      return (
        <div key={i}>
          {bulletMatch[1]}
          <span style={{ color: 'var(--record-btn)' }}>{bulletMatch[2]}</span>
          <span style={{ color: 'var(--md-text, var(--item-meta))' }}>{bulletMatch[3]}</span>
        </div>
      )
    }
    return <div key={i} style={{ color: 'var(--md-text, var(--item-meta))' }}>{line || '\u00A0'}</div>
  })
}

export default function SoulView() {
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getWorkspacePrompt().then(setContent)
    const onFocus = () => getWorkspacePrompt().then(setContent)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const save = useCallback(async (text: string) => {
    setSaveStatus('saving')
    try {
      await setWorkspacePrompt(text)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(current => current === 'saved' ? 'idle' : current), 2000)
    } catch (error) {
      console.error('[soul] save failed', error)
      setSaveStatus('error')
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    setSaveStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(text), 800)
  }

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const editorFont = "'IBM Plex Mono', ui-monospace, monospace"
  const editorFontSize = 12
  const editorLineHeight = 1.7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 28px 28px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(90,154,106,0.10)',
          border: '0.5px solid rgba(90,154,106,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--soul-color, #5a9a6a)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z"/>
            <path d="M9 21h6M10 17h4"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--item-text)', lineHeight: 1.3 }}>Agent 灵魂</div>
          <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 1 }}>定义 Agent 的角色与工作偏好</div>
        </div>
      </div>

      {/* Editor */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={backdropRef} aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)', borderRadius: 6,
          padding: '12px 14px', fontFamily: editorFont,
          fontSize: editorFontSize, lineHeight: editorLineHeight, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          pointerEvents: 'none', overflowY: 'auto',
        }}>
          {highlightMarkdown(content)}
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onScroll={handleScroll}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            background: 'transparent', border: '1px solid transparent', borderRadius: 6,
            padding: '12px 14px', fontFamily: editorFont,
            fontSize: editorFontSize, lineHeight: editorLineHeight,
            color: 'transparent', caretColor: 'var(--item-text)', cursor: 'text',
            resize: 'none', outline: 'none', boxSizing: 'border-box',
            overflowY: 'auto',
          }}
          spellCheck={false}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--duration-text)' }}>
          {saveStatus === 'saving' ? '保存中…'
            : saveStatus === 'saved' ? '已自动保存'
            : saveStatus === 'error' ? '保存失败，请重试'
            : ''}
        </span>
        <button
          onClick={() => save(content)}
          disabled={saveStatus === 'saving'}
          style={{
            background: saveStatus === 'saving' ? 'var(--divider)' : 'var(--record-btn)',
            border: 'none', borderRadius: 5, padding: '6px 18px',
            fontSize: 12, fontWeight: 600,
            color: saveStatus === 'saving' ? 'var(--duration-text)' : 'var(--bg)',
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          {saveStatus === 'saving' ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/tests/SoulView.test.tsx
```

Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add src/components/SoulView.tsx src/tests/SoulView.test.tsx
git commit -m "feat: add SoulView component with editor and auto-save"
```

---

## Task 2: 更新 TitleBar — 移除 ⚙，加灵魂图标

**Files:**
- Modify: `src/components/TitleBar.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/tests/CommandDock.test.tsx` 旁边先确认 TitleBar 无独立测试文件，查一下：

```bash
ls src/tests/TitleBar* 2>/dev/null || echo "no titlebar test"
```

Expected: `no titlebar test`（无独立测试，靠 App 集成测试覆盖即可）

- [ ] **Step 2: 更新 TitleBar.tsx**

完整替换 `src/components/TitleBar.tsx`：

```tsx
// src/components/TitleBar.tsx
import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  onLogClick?: () => void
  view: 'journal' | 'settings' | 'soul'
  onToggleSoul: () => void
}

export function TitleBar({ theme, onThemeChange, isProcessing, processingFilename, onLogClick, view, onToggleSoul }: TitleBarProps) {
  const soulActive = view === 'soul'

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 38,
        background: 'var(--titlebar-bg)',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 16,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        borderBottom: '0.5px solid var(--divider)',
      }}
    >
      {/* Left: empty */}
      <div />

      {/* Center: title or AI status */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {view === 'soul' ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(90,154,106,0.08)',
            border: '0.5px solid rgba(90,154,106,0.2)',
            borderRadius: 5, padding: '3px 10px',
            fontSize: 11, color: 'var(--soul-color, #5a9a6a)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z"/>
              <path d="M9 21h6M10 17h4"/>
            </svg>
            Agent 灵魂
          </div>
        ) : view === 'settings' ? (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--item-text)' }}>设置</span>
        ) : (
          <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} onLogClick={onLogClick} />
        )}
      </div>

      {/* Right: theme toggle (journal only) + soul button */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view === 'journal' && <ThemeToggle theme={theme} onChange={onThemeChange} />}
        <button
          onClick={onToggleSoul}
          title={soulActive ? '返回 (Esc)' : 'Agent 灵魂 (⌘P)'}
          style={{
            background: soulActive ? 'rgba(90,154,106,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            color: soulActive ? 'var(--soul-color, #5a9a6a)' : 'var(--item-meta)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0, borderRadius: 4, lineHeight: 1,
            opacity: soulActive ? 1 : 0.6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z"/>
            <path d="M9 21h6M10 17h4"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 运行全量测试确认无回归**

```bash
npm test -- --run
```

Expected: 已有测试全部 PASS（TitleBar 的 prop 变化会在 Task 4 修 App.tsx 时一起处理，这里 TypeScript 编译可能报 prop 错误，暂时忽略，Task 4 修复）

- [ ] **Step 4: Commit**

```bash
git add src/components/TitleBar.tsx
git commit -m "feat: replace settings icon with soul icon in TitleBar"
```

---

## Task 3: 更新 CommandDock — 左侧加 ⚙ 设置按钮

**Files:**
- Modify: `src/components/CommandDock.tsx`
- Modify: `src/tests/CommandDock.test.tsx`

- [ ] **Step 1: 查看现有 CommandDock 测试**

```bash
npx vitest run src/tests/CommandDock.test.tsx
```

Expected: PASS（了解现有测试覆盖范围，后续要确保不破坏）

- [ ] **Step 2: 在 CommandDock.tsx 的 interface 和组件中加 `onOpenSettings` prop**

在 `src/components/CommandDock.tsx` 中，找到 `interface CommandDockProps` 并在末尾加一个字段：

```tsx
// 在 CommandDockProps 末尾加：
  onOpenSettings: () => void
```

然后在函数签名解构中加：

```tsx
// 在 export function CommandDock({ ..., audioRejected, }: ...) 解构中加：
  onOpenSettings,
```

- [ ] **Step 3: 在 Dock 最左侧加 ⚙ 按钮**

找到 `CommandDock.tsx` 中 `return (` 后的 JSX，在最外层 `<div>` 的第一个子元素（第一个竖线 divider）之前插入：

```tsx
      {/* Settings button */}
      <button
        onClick={onOpenSettings}
        title="设置 (⌘,)"
        style={{
          width: 34, height: 34, borderRadius: 8,
          border: '0.5px solid var(--divider)',
          background: 'var(--item-hover-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--item-meta)', cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>
        </svg>
      </button>
```

- [ ] **Step 4: 更新 CommandDock 测试中的 mock props**

打开 `src/tests/CommandDock.test.tsx`，找到 render 调用处，加上 `onOpenSettings` prop：

```tsx
onOpenSettings={vi.fn()}
```

（在每个 render 调用里加这个 prop，保持其余 props 不变）

- [ ] **Step 5: 运行测试**

```bash
npx vitest run src/tests/CommandDock.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/CommandDock.tsx src/tests/CommandDock.test.tsx
git commit -m "feat: add settings button to CommandDock left side"
```

---

## Task 4: 更新 App.tsx — 接线所有新 props 和视图

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 扩展 view state 类型**

在 `src/App.tsx` 中，找到：

```tsx
const [view, setView] = useState<'journal' | 'settings'>('journal')
```

替换为：

```tsx
const [view, setView] = useState<'journal' | 'settings' | 'soul'>('journal')
```

- [ ] **Step 2: 加 ⌘P 快捷键处理（在现有 Esc / ⌘, handler 中）**

找到处理 `Escape` 和 `⌘,` 的 `useEffect`：

```tsx
    if (e.key === 'Escape') { setView('journal'); return }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault()
      setView(v => v === 'settings' ? 'journal' : 'settings')
    }
```

替换为：

```tsx
    if (e.key === 'Escape') { setView('journal'); return }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault()
      setView(v => v === 'settings' ? 'journal' : 'settings')
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault()
      setView(v => v === 'soul' ? 'journal' : 'soul')
    }
```

- [ ] **Step 3: 更新 TitleBar 的 props**

找到 `<TitleBar` JSX，把 `onToggleSettings` prop 换成 `onToggleSoul`，并删除 `onToggleSettings`：

旧：
```tsx
      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        onLogClick={processingPath ? () => setActiveLogPath(processingPath) : undefined}
        view={view}
        onToggleSettings={() => setView(v => v === 'settings' ? 'journal' : 'settings')}
      />
```

新：
```tsx
      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        onLogClick={processingPath ? () => setActiveLogPath(processingPath) : undefined}
        view={view}
        onToggleSoul={() => setView(v => v === 'soul' ? 'journal' : 'soul')}
      />
```

- [ ] **Step 4: 加 soul 视图渲染分支，更新 settings 渲染分支**

找到：

```tsx
      {view === 'settings' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SettingsPanel initialSection={settingsInitialSection} onSectionConsumed={() => setSettingsInitialSection(undefined)} />
        </div>
      ) : (
```

替换为：

```tsx
      {view === 'settings' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SettingsPanel initialSection={settingsInitialSection} onSectionConsumed={() => setSettingsInitialSection(undefined)} />
        </div>
      ) : view === 'soul' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SoulView />
        </div>
      ) : (
```

- [ ] **Step 5: 加 SoulView import**

在 `src/App.tsx` 顶部 imports 中加：

```tsx
import SoulView from './components/SoulView'
```

- [ ] **Step 6: 传 `onOpenSettings` 给 CommandDock**

找到 `<CommandDock` JSX，加一个 prop：

```tsx
              onOpenSettings={() => setView(v => v === 'settings' ? 'journal' : 'settings')}
```

- [ ] **Step 7: 运行 TypeScript 类型检查和全量测试**

```bash
npm run build
npm test -- --run
```

Expected: 编译无 TS 错误，所有测试 PASS

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire soul view into App — add view state, ⌘P shortcut, SoulView render"
```

---

## Task 5: 清理设置页 — 删除"工作引导" section

**Files:**
- Modify: `src/settings/navigation.ts`
- Modify: `src/settings/SettingsLayout.tsx`
- Delete: `src/settings/components/SectionGuide.tsx`
- Delete: `src/tests/SectionGuide.test.tsx`

- [ ] **Step 1: 更新 navigation.ts**

完整替换 `src/settings/navigation.ts`：

```ts
// src/settings/navigation.ts
export type NavId = 'general' | 'ai' | 'voice' | 'plugins' | 'about'

export const ALL_NAV_IDS: NavId[] = [
  'general',
  'ai',
  'voice',
  'plugins',
  'about',
]

export const SECTION_TOP_GUTTER = 30

export function resolveActiveNav(
  sectionTops: Partial<Record<NavId, number>>,
  scrollTop: number,
  offset: number = SECTION_TOP_GUTTER,
): NavId {
  let activeNav: NavId = 'general'

  for (const id of ALL_NAV_IDS) {
    const sectionTop = sectionTops[id]
    if (typeof sectionTop === 'number' && sectionTop <= scrollTop + offset) {
      activeNav = id
    }
  }

  return activeNav
}
```

- [ ] **Step 2: 更新 SettingsLayout.tsx — 删除 guide nav item 和 section**

在 `src/settings/SettingsLayout.tsx` 中：

**2a.** 删除 import：
```tsx
import SectionGuide from './components/SectionGuide'
```

**2b.** 在 `NAV_ITEMS` 数组中删除：
```tsx
  { id: 'guide', label: '工作引导', icon: BookOpen },
```
同时删除 `BookOpen` 的 import（从 lucide-react 的 import 中移除）。

**2c.** 在 `SettingsContent` 组件中删除：
```tsx
      <section id="guide" ref={(el) => registerSectionRef('guide', el)}><SectionGuide /></section>
```

- [ ] **Step 3: 删除不再需要的文件**

```bash
rm src/settings/components/SectionGuide.tsx
rm src/tests/SectionGuide.test.tsx
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
npm test -- --run
```

Expected: PASS，不再有 SectionGuide 相关测试

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat: remove guide section from settings — moved to SoulView"
```

---

## Self-Review

**Spec coverage:**
- ✅ 灵魂图标在 TitleBar 右区（Task 2）
- ✅ ⚙ 移到 CommandDock 左侧（Task 3）
- ✅ 独立 soul 视图，读写同一 CLAUDE.md（Task 1、4）
- ✅ ⌘P 快捷键（Task 4）
- ✅ ⌘, 保持触发设置（Task 4，原有逻辑不变）
- ✅ 设置页删除"工作引导"（Task 5）
- ✅ 主题切换位置不变（Task 2，ThemeToggle 保留在 journal 视图的 TitleBar 右区）

**Type consistency:**
- `view: 'journal' | 'settings' | 'soul'` — Task 2 TitleBar 和 Task 4 App.tsx 使用同一类型
- `onToggleSoul` — Task 2 定义，Task 4 传入，名称一致
- `onOpenSettings` — Task 3 定义，Task 4 传入，名称一致
- `SoulView` — Task 1 创建，Task 4 import，路径一致（`src/components/SoulView`）

**Placeholder scan:** 无 TBD / TODO / 模糊步骤
