# Settings Nav Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Unicode geometric symbols in the settings sidebar nav with Lucide React icons for consistent, semantically meaningful, macOS-native-feeling icons.

**Architecture:** Install lucide-react, update `NAV_ITEMS` in `SettingsPanel.tsx` to store component references instead of strings, update the render to use `<Icon size={14} strokeWidth={1.5} />`.

**Tech Stack:** React, TypeScript, lucide-react

---

### Task 1: Install lucide-react

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install lucide-react
```

Expected output: `added 1 package` (lucide-react is tree-shaken — only imported icons are bundled)

- [ ] **Step 2: Verify it appears in dependencies**

```bash
grep lucide package.json
```

Expected: `"lucide-react": "^0.x.x"` under `dependencies`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(settings): install lucide-react for nav icons"
```

---

### Task 2: Update SettingsPanel nav icons

**Files:**
- Modify: `src/settings/SettingsPanel.tsx`

- [ ] **Step 1: Update imports and NAV_ITEMS**

Replace the top of `SettingsPanel.tsx`. The `NAV_ITEMS` array changes from `icon: string` to `icon: React.ComponentType<{ size?: number; strokeWidth?: number }>`.

Full updated file top section (lines 1–17):

```tsx
import { useEffect, useRef, useState } from 'react'
import { Settings2, Cpu, Mic, BookOpen, Puzzle, Info } from 'lucide-react'
import SectionGeneral from './components/SectionGeneral'
import SectionAiEngine from './components/SectionAiEngine'
import SectionVoice from './components/SectionVoice'
import SectionGuide from './components/SectionGuide'
import SectionPlugins from './components/SectionPlugins'
import SectionAbout from './components/SectionAbout'

type NavId = 'general' | 'ai' | 'voice' | 'guide' | 'plugins' | 'about'

type NavItem = { id: NavId; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }

const NAV_ITEMS: NavItem[] = [
  { id: 'general',  label: '通用',    icon: Settings2 },
  { id: 'ai',       label: 'AI 引擎', icon: Cpu },
  { id: 'voice',    label: '语音转写', icon: Mic },
  { id: 'guide',    label: '工作引导', icon: BookOpen },
  { id: 'plugins',  label: '技能插件', icon: Puzzle },
]
```

- [ ] **Step 2: Update nav button render and about button**

In the `return` block, update the two places that render icons.

Replace the `NAV_ITEMS.map` button content (the `<span>` with icon string):

```tsx
{NAV_ITEMS.map(({ id, label, icon: Icon }) => (
  <button key={id} onClick={() => jumpTo(id)} style={navBtnStyle(id)}>
    <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={14} strokeWidth={1.5} />
    </span>
    {label}
  </button>
))}
```

Replace the standalone about button:

```tsx
<button onClick={() => jumpTo('about')} style={navBtnStyle('about')}>
  <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Info size={14} strokeWidth={1.5} />
  </span>
  关于
</button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/settings/SettingsPanel.tsx
git commit -m "feat(settings): replace unicode symbols with lucide-react nav icons"
```
