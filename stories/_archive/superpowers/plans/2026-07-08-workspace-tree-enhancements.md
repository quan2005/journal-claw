# Workspace 文件树排序、图标与操作效率增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Story:** `stories/20260708-workspace-tree-enhancements/story.md`
**Design:** `stories/20260708-workspace-tree-enhancements/design.md`

**Goal:** Workspace 文件树支持 4 种排序策略（含持久化手动拖拽顺序）、形状符号图标方案、子项计数/空文件夹提示、右键新建文件/文件夹/重命名、键盘导航。

**Architecture:** 排序策略与手动顺序存入已有的 daemon 通用 settings KV（`.setting.json`，走 `SettingsService`）；新建/重命名复用已有的 `FilesService` + `ChangeSetService` 写入模式；图标从文字缩写徽标改为纯 SVG 线性符号；所有新状态走 `runtimeClient`/`hostBridge`，不用 localStorage（Workspace 展开态例外，是已有的合法白名单，不在本次改动范围）。

**Tech Stack:** TypeScript, React, Express (daemon), Vitest + Testing Library。

## Global Constraints

- 文件写入一律走 `FilesService` → `ChangeSetService.recordChangeSet` → `authorization mode`，禁止绕过直接 `writeFileSync`/`mkdirSync`（`docs/ARCH.md`）。
- 组件禁止直连 daemon URL 或 raw Electron IPC，一律经 `selectRuntimeClient().invoke(...)`（`docs/ARCH.md`）。
- 新增持久化状态经 daemon `.setting.json`，不用 `localStorage`（`docs/ARCH.md`，Workspace 展开态是唯一现有例外，不适用于本次新状态）。
- 圆角/阴影/边框/聚焦环/字体走结构化 token，禁止硬编码（`docs/DESIGN.md` §5）。
- 单一信号橙 `#FF5701`/`--record-btn` 是唯一交互 accent 来源，不新增强调色（`docs/DESIGN.md`）。
- 每个非平凡逻辑改动需要留一个可跑的测试（`vitest run`，daemon 与 web 各自 workspace）。

---

## Task 1: Daemon settings 新增排序策略与手动顺序字段

**Files:**
- Modify: `apps/daemon/src/settings/service.ts:16-22`（`WorkspaceSettings` 接口）、`apps/daemon/src/settings/service.ts:95-113`（`normalizeSettings`）
- Test: `apps/daemon/src/settings/service.test.ts`

**Interfaces:**
- Produces: `WorkspaceSettings.workspace_tree_sort: 'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'`（默认 `'name-asc'`），`WorkspaceSettings.workspace_tree_manual_order?: Record<string, string[]>`（父目录相对路径 → 直接子项名称的手动顺序数组；根目录 key 为 `''`）。这两个字段供 Task 2 的 daemon 路由与 Task 3 的 `sortTopics.ts` 使用。

- [ ] **Step 1: 写失败的测试**

在 `apps/daemon/src/settings/service.test.ts` 末尾（`describe('SettingsService', ...)` 内）加：

```ts
  it('normalizes workspace_tree_sort with a valid default and rejects garbage values', () => {
    const svc = new SettingsService(ws)
    expect(svc.load().workspace_tree_sort).toBe('name-asc')

    svc.update({ workspace_tree_sort: 'mtime-desc' })
    expect(svc.load().workspace_tree_sort).toBe('mtime-desc')

    writeFileSync(join(ws, '.setting.json'), JSON.stringify({ workspace_tree_sort: 'bogus' }))
    expect(new SettingsService(ws).load().workspace_tree_sort).toBe('name-asc')
  })

  it('preserves workspace_tree_manual_order as an opaque per-directory map', () => {
    const svc = new SettingsService(ws)
    svc.update({
      workspace_tree_manual_order: { '': ['b', 'a'], 专题: ['输出作品', '资产资源'] },
    })
    expect(svc.load().workspace_tree_manual_order).toEqual({
      '': ['b', 'a'],
      专题: ['输出作品', '资产资源'],
    })
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/daemon && bunx vitest run src/settings/service.test.ts`
Expected: FAIL — `workspace_tree_sort` is `undefined`，不是 `'name-asc'`。

- [ ] **Step 3: 实现**

`apps/daemon/src/settings/service.ts` 里 `WorkspaceSettings` 接口加两个字段：

```ts
export type WorkspaceTreeSort = 'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'

export interface WorkspaceSettings {
  theme: Theme
  auto_lint: AutoLintConfig
  global_skills_enabled: boolean
  pinned?: unknown
  disabled_skills?: string[]
  enabled_global_skills?: string[]
  workspace_tree_sort: WorkspaceTreeSort
  workspace_tree_manual_order?: Record<string, string[]>
  [key: string]: unknown
}
```

`DEFAULT_SETTINGS` 加 `workspace_tree_sort: 'name-asc'`。

`normalizeSettings` 返回对象里加：

```ts
    workspace_tree_sort: normalizeTreeSort(raw.workspace_tree_sort),
    workspace_tree_manual_order: isRecord(raw.workspace_tree_manual_order)
      ? (raw.workspace_tree_manual_order as Record<string, string[]>)
      : undefined,
```

在文件底部（`normalizeAutoLint` 附近）加辅助函数：

```ts
const VALID_TREE_SORTS: WorkspaceTreeSort[] = [
  'name-asc',
  'name-desc',
  'mtime-desc',
  'type-first',
  'manual',
]

function normalizeTreeSort(value: unknown): WorkspaceTreeSort {
  return VALID_TREE_SORTS.includes(value as WorkspaceTreeSort)
    ? (value as WorkspaceTreeSort)
    : 'name-asc'
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/daemon && bunx vitest run src/settings/service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/settings/service.ts apps/daemon/src/settings/service.test.ts
git commit -m "feat(daemon): persist workspace tree sort strategy and manual order"
```

---

## Task 2: 前端排序策略读写 hook + httpRuntimeClient 接线

**Files:**
- Create: `apps/web/src/hooks/useTreeSort.ts`
- Modify: `apps/web/src/lib/httpRuntimeClient.ts:132-138`（紧邻 `get_workspace_theme`/`set_workspace_theme` 之后加两个 case）
- Test: `apps/web/src/tests/useTreeSort.test.tsx`

**Interfaces:**
- Consumes: `selectRuntimeClient().invoke('get_workspace_tree_sort')` / `invoke('set_workspace_tree_sort', { strategy })`（Task 1 的 `workspace_tree_sort` 字段）。
- Produces: `useTreeSort(): { strategy: WorkspaceTreeSort; setStrategy: (s: WorkspaceTreeSort) => void; loading: boolean }`，供 Task 3（排序应用）与 Task 5（TreeSidebar 排序菜单 UI）使用。`WorkspaceTreeSort` 类型从 `apps/web/src/lib/sortTopics.ts`（Task 3 创建）导出，本任务先在 `useTreeSort.ts` 内联声明同名 union，Task 3 完成后统一改为从 `sortTopics.ts` 导入（避免任务间循环依赖）。

- [ ] **Step 1: 写失败的测试**

Create `apps/web/src/tests/useTreeSort.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTreeSort } from '../hooks/useTreeSort'
import { selectRuntimeClient } from '../lib/runtimeClient'

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: vi.fn(),
}))

describe('useTreeSort', () => {
  const invoke = vi.fn()

  beforeEach(() => {
    invoke.mockReset()
    vi.mocked(selectRuntimeClient).mockReturnValue({ invoke } as never)
  })

  it('loads the persisted strategy on mount', async () => {
    invoke.mockResolvedValueOnce('mtime-desc')
    const { result } = renderHook(() => useTreeSort())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.strategy).toBe('mtime-desc')
    expect(invoke).toHaveBeenCalledWith('get_workspace_tree_sort')
  })

  it('falls back to name-asc when load fails', async () => {
    invoke.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useTreeSort())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.strategy).toBe('name-asc')
  })

  it('persists a new strategy immediately', async () => {
    invoke.mockResolvedValueOnce('name-asc') // initial load
    invoke.mockResolvedValueOnce(undefined) // set call
    const { result } = renderHook(() => useTreeSort())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setStrategy('type-first')
    })

    expect(result.current.strategy).toBe('type-first')
    expect(invoke).toHaveBeenCalledWith('set_workspace_tree_sort', { strategy: 'type-first' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/tests/useTreeSort.test.tsx`
Expected: FAIL — `Cannot find module '../hooks/useTreeSort'`

- [ ] **Step 3: 实现 hook**

Create `apps/web/src/hooks/useTreeSort.ts`:

```ts
import { useState, useEffect } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'

export type WorkspaceTreeSort = 'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'

const getTreeSort = (): Promise<WorkspaceTreeSort> =>
  selectRuntimeClient().invoke<WorkspaceTreeSort>('get_workspace_tree_sort')

const setTreeSort = (strategy: WorkspaceTreeSort): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_workspace_tree_sort', { strategy })

export function useTreeSort() {
  const [strategy, setStrategyState] = useState<WorkspaceTreeSort>('name-asc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getTreeSort()
      .then((saved) => {
        if (!cancelled) setStrategyState(saved)
      })
      .catch(() => {
        if (!cancelled) setStrategyState('name-asc')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setStrategy(next: WorkspaceTreeSort) {
    setStrategyState(next)
    setTreeSort(next).catch(console.error)
  }

  return { strategy, setStrategy, loading }
}
```

在 `apps/web/src/lib/httpRuntimeClient.ts` 的 `case 'set_workspace_theme':` 块后加：

```ts
      case 'get_workspace_tree_sort': {
        const settings = await this.getSettings()
        return (settings.workspace_tree_sort ?? 'name-asc') as unknown as T
      }
      case 'set_workspace_tree_sort': {
        await this.updateSettings({ workspace_tree_sort: args?.strategy })
        return undefined as T
      }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/tests/useTreeSort.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useTreeSort.ts apps/web/src/lib/httpRuntimeClient.ts apps/web/src/tests/useTreeSort.test.tsx
git commit -m "feat(web): add useTreeSort hook backed by daemon settings"
```

---

## Task 3: 排序纯函数 + 接入 TopicTree 渲染（AC-1, AC-2）

**Files:**
- Create: `apps/web/src/lib/sortTopics.ts`
- Test: `apps/web/src/lib/sortTopics.test.ts`
- Modify: `apps/web/src/components/TopicTree.tsx`（加 `sortStrategy`/`manualOrder` props，排序后再 `filterCuration`）
- Modify: `apps/web/src/components/TreeSidebar.tsx`（两处 `<TopicTree>` 调用传入 `useTreeSort()` 的值；顶部排序菜单见 Task 5，本任务只接线不加 UI）
- Test: `apps/web/src/tests/TopicTree.test.tsx`（追加用例）

**Interfaces:**
- Consumes: `WorkspaceTreeSort`（Task 2 定义，此时改为从本文件重新导出，`useTreeSort.ts` 改为 `import type { WorkspaceTreeSort } from '../lib/sortTopics'`）；`TopicEntry`（`apps/web/src/lib/apiTypes.ts`，字段 `name/is_dir/path/mtime_secs`）。
- Produces: `sortEntries(entries: TopicEntry[], strategy: WorkspaceTreeSort, manualOrder?: string[]): TopicEntry[]`，纯函数，供 `TopicTree.tsx` 与 Task 8（拖拽排序）使用。`manualOrder` 是**当前这一层**的手动顺序名称数组（不含子孙层），由调用方按父路径从 `workspace_tree_manual_order` 里取出。

- [ ] **Step 1: 写失败的测试**

Create `apps/web/src/lib/sortTopics.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sortEntries } from './sortTopics'
import type { TopicEntry } from './apiTypes'

function entry(name: string, is_dir = false, mtime_secs = 0): TopicEntry {
  return { name, path: name, is_dir, created_secs: 0, mtime_secs }
}

describe('sortEntries', () => {
  const mixed = [entry('banana.md', false, 100), entry('Apple', true, 50), entry('cherry.md', false, 200)]

  it('sorts name-asc case-insensitively', () => {
    expect(sortEntries(mixed, 'name-asc').map((e) => e.name)).toEqual([
      'Apple',
      'banana.md',
      'cherry.md',
    ])
  })

  it('sorts name-desc', () => {
    expect(sortEntries(mixed, 'name-desc').map((e) => e.name)).toEqual([
      'cherry.md',
      'banana.md',
      'Apple',
    ])
  })

  it('sorts mtime-desc (newest first)', () => {
    expect(sortEntries(mixed, 'mtime-desc').map((e) => e.name)).toEqual([
      'cherry.md',
      'banana.md',
      'Apple',
    ])
  })

  it('sorts type-first: directories before files, each group name-asc', () => {
    expect(sortEntries(mixed, 'type-first').map((e) => e.name)).toEqual([
      'Apple',
      'banana.md',
      'cherry.md',
    ])
  })

  it('manual strategy respects manualOrder and appends unknown entries by name-asc', () => {
    const result = sortEntries(mixed, 'manual', ['cherry.md', 'Apple'])
    expect(result.map((e) => e.name)).toEqual(['cherry.md', 'Apple', 'banana.md'])
  })

  it('manual strategy with no manualOrder falls back to name-asc', () => {
    expect(sortEntries(mixed, 'manual').map((e) => e.name)).toEqual([
      'Apple',
      'banana.md',
      'cherry.md',
    ])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/lib/sortTopics.test.ts`
Expected: FAIL — `Cannot find module './sortTopics'`

- [ ] **Step 3: 实现**

Create `apps/web/src/lib/sortTopics.ts`:

```ts
import type { TopicEntry } from './apiTypes'

export type WorkspaceTreeSort = 'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'

function byNameAsc(a: TopicEntry, b: TopicEntry): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function sortEntries(
  entries: TopicEntry[],
  strategy: WorkspaceTreeSort,
  manualOrder?: string[],
): TopicEntry[] {
  const copy = [...entries]
  switch (strategy) {
    case 'name-asc':
      return copy.sort(byNameAsc)
    case 'name-desc':
      return copy.sort((a, b) => byNameAsc(b, a))
    case 'mtime-desc':
      return copy.sort((a, b) => b.mtime_secs - a.mtime_secs)
    case 'type-first':
      return copy.sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
        return byNameAsc(a, b)
      })
    case 'manual': {
      if (!manualOrder || manualOrder.length === 0) return copy.sort(byNameAsc)
      const rank = new Map(manualOrder.map((name, i) => [name, i]))
      return copy.sort((a, b) => {
        const ra = rank.has(a.name) ? rank.get(a.name)! : Number.MAX_SAFE_INTEGER
        const rb = rank.has(b.name) ? rank.get(b.name)! : Number.MAX_SAFE_INTEGER
        if (ra !== rb) return ra - rb
        return byNameAsc(a, b)
      })
    }
  }
}
```

修改 `apps/web/src/hooks/useTreeSort.ts`：把 `export type WorkspaceTreeSort = ...` 一行删掉，改为 `import type { WorkspaceTreeSort } from '../lib/sortTopics'`，并 `export type { WorkspaceTreeSort }`。

修改 `apps/web/src/components/TopicTree.tsx`：

```ts
import type { WorkspaceTreeSort } from '../lib/sortTopics'
import { sortEntries } from '../lib/sortTopics'
```

`TopicTreeProps` 加：

```ts
  sortStrategy: WorkspaceTreeSort
  manualOrder?: Record<string, string[]>
```

`export function TopicTree({ entries, dirs, selectedPath, indent = 0, onToggleDir, onSelectFile, onAt, onMore, sortStrategy, manualOrder }: TopicTreeProps) {`

`TopicTreeProps` 加一个 `parentPath: string` prop（父组件调用时传入当前展开目录的 `path`，根调用传 `''`），排序时按这一层的 `parentPath` 取手动顺序：

```ts
interface TopicTreeProps {
  entries: TopicEntry[]
  dirs: Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }>
  selectedPath: string | null
  indent?: number
  parentPath: string
  sortStrategy: WorkspaceTreeSort
  manualOrder?: Record<string, string[]>
  onToggleDir: (path: string) => void
  onSelectFile: (entry: TopicEntry) => void
  onAt: (path: string) => void
  onMore: (entry: TopicEntry, x: number, y: number) => void
}

export function TopicTree({
  entries,
  dirs,
  selectedPath,
  indent = 0,
  parentPath,
  sortStrategy,
  manualOrder,
  onToggleDir,
  onSelectFile,
  onAt,
  onMore,
}: TopicTreeProps) {
  const sorted = sortEntries(filterCuration(entries), sortStrategy, manualOrder?.[parentPath])

  return sorted.map((entry) => {
```

（原来的 `return filterCuration(entries).map((entry) => {` 整行删除，用上面替换；循环体其余部分不变，只是变量源从 `filterCuration(entries)` 换成 `sorted`。）

递归调用处（`<TopicTree entries={childState.entries} ... />`）加 `parentPath={entry.path}`。

修改 `apps/web/src/components/TreeSidebar.tsx`：在组件顶部加 `const { strategy: treeSort } = useTreeSort()`（`import { useTreeSort } from '../hooks/useTreeSort'`），两处 `<TopicTree ...>` 调用都加 `sortStrategy={treeSort}` 与对应的 `parentPath`（第一处置顶区递归调用传 `parentPath={topicEntry.path}`；第二处根调用传 `parentPath=""`）。`manualOrder` 本任务先不传（Task 8 补）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/lib/sortTopics.test.ts src/tests/TopicTree.test.tsx src/tests/TreeSidebar.test.tsx`
Expected: PASS（若 `TopicTree.test.tsx`/`TreeSidebar.test.tsx` 现有用例因新增必填 prop `sortStrategy`/`parentPath` 报错，补上 `sortStrategy="name-asc"` `parentPath=""`）

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/sortTopics.ts apps/web/src/lib/sortTopics.test.ts apps/web/src/hooks/useTreeSort.ts apps/web/src/components/TopicTree.tsx apps/web/src/components/TreeSidebar.tsx apps/web/src/tests/TopicTree.test.tsx apps/web/src/tests/TreeSidebar.test.tsx
git commit -m "feat(web): apply tree sort strategy to workspace tree rendering"
```

---

## Task 4: 排序菜单 UI（AC-1, AC-2 收尾）

**Files:**
- Modify: `apps/web/src/components/TreeSidebar.tsx:598-641`（Workspace 面板头部，`Search`/`LayoutGrid` 按钮旁）
- Test: `apps/web/src/tests/TreeSidebar.test.tsx`

**Interfaces:**
- Consumes: `useTreeSort()`（Task 2）返回的 `{ strategy, setStrategy }`。
- Produces: 无新导出，纯 UI。

- [ ] **Step 1: 写失败的测试**

在 `apps/web/src/tests/TreeSidebar.test.tsx` 加：

```tsx
  it('lets the user switch the workspace tree sort strategy', async () => {
    const { user } = renderTreeSidebar() // 沿用文件内既有的渲染 helper，若签名不同以现有 helper 为准
    await user.click(screen.getByRole('button', { name: '排序' }))
    await user.click(screen.getByRole('menuitem', { name: '最近修改' }))
    expect(screen.getByRole('button', { name: '排序' })).toHaveAttribute(
      'data-active-sort',
      'mtime-desc',
    )
  })
```

（若文件内没有 `renderTreeSidebar` helper，改用文件内已有的渲染方式，参照相邻测试用例的写法。）

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx`
Expected: FAIL — 找不到 `排序` 按钮。

- [ ] **Step 3: 实现**

在 `Search`/`LayoutGrid` 按钮之间（`aria-label="Search"` 按钮之前）加一个排序按钮 + 下拉：

```tsx
const SORT_LABELS: Record<WorkspaceTreeSort, string> = {
  'name-asc': '名称 A-Z',
  'name-desc': '名称 Z-A',
  'mtime-desc': '最近修改',
  'type-first': '类型优先',
  manual: '手动排序',
}
```

（组件顶部，`import type { WorkspaceTreeSort } from '../hooks/useTreeSort'`）

```tsx
const [sortMenuOpen, setSortMenuOpen] = useState(false)
const { strategy: treeSort, setStrategy: setTreeSort } = useTreeSort()
```

按钮 + 菜单：

```tsx
<div style={{ position: 'relative' }}>
  <button
    type="button"
    aria-label="排序"
    data-active-sort={treeSort}
    onClick={() => setSortMenuOpen((v) => !v)}
    style={{
      width: 28,
      height: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      border: 'none',
      background: 'transparent',
      color: 'var(--item-meta)',
      cursor: 'pointer',
    }}
  >
    <ArrowUpDown size={16} strokeWidth={1.6} />
  </button>
  {sortMenuOpen && (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: 32,
        right: 0,
        zIndex: 20,
        background: 'var(--context-menu-bg)',
        border: 'var(--border-menu)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-overlay)',
        minWidth: 140,
        padding: '4px 0',
      }}
    >
      {(Object.keys(SORT_LABELS) as WorkspaceTreeSort[])
        .filter((key) => key !== 'manual')
        .map((key) => (
          <button
            key={key}
            role="menuitem"
            type="button"
            onClick={() => {
              setTreeSort(key)
              setSortMenuOpen(false)
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 12px',
              background: key === treeSort ? 'var(--item-selected-bg)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              color: 'var(--item-text)',
            }}
          >
            {SORT_LABELS[key]}
          </button>
        ))}
      <div style={{ height: 0.5, background: 'var(--divider)', margin: '4px 8px' }} />
      <button
        role="menuitem"
        type="button"
        onClick={() => {
          setTreeSort('manual')
          setSortMenuOpen(false)
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '6px 12px',
          background: treeSort === 'manual' ? 'var(--item-selected-bg)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          color: 'var(--item-text)',
        }}
      >
        {SORT_LABELS.manual}
      </button>
    </div>
  )}
</div>
```

`import { Search, LayoutGrid, ArrowUpDown } from 'lucide-react'`（`lucide-react` 已是项目依赖，`package.json` 已列出——不新增依赖）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TreeSidebar.tsx apps/web/src/tests/TreeSidebar.test.tsx
git commit -m "feat(web): add workspace tree sort strategy menu"
```

---

## Task 5: 图标覆盖扩展 + D 形状符号（AC-3, AC-4）

**Files:**
- Modify: `apps/web/src/lib/fileKind.ts`（加 `config` kind，`json`/`yaml`/`yml`/`toml` 归入）
- Modify: `apps/web/src/lib/fileTypeIconKind.ts`（`FileTypeIconKind` 加 `'folder-open'`）
- Modify: `apps/web/src/components/FileTypeIcon.tsx`（`GLYPHS` 文字缩写全部替换为 `VectorGlyph` 内的 SVG 分支；新增 `folder-open`/`config` 分支）
- Modify: `apps/web/src/components/TopicTree.tsx`（`iconKind` 按 `isExpanded` 选 `'folder'`/`'folder-open'`）
- Test: `apps/web/src/lib/fileKind.test.ts`（若不存在则创建）、`apps/web/src/tests/TopicTree.test.tsx`（追加）

**Interfaces:**
- Produces: `FileKind` 新增 `'config'`；`FileTypeIconKind` 新增 `'folder-open'`。两者是本任务对外暴露的唯一新符号，Task 6/7/8 不依赖图标细节。

- [ ] **Step 1: 写失败的测试**

Create/extend `apps/web/src/lib/fileKind.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fileKindFromName } from './fileKind'

describe('fileKindFromName', () => {
  it('classifies json/yaml/toml as config', () => {
    expect(fileKindFromName('settings.json')).toBe('config')
    expect(fileKindFromName('ci.yaml')).toBe('config')
    expect(fileKindFromName('ci.yml')).toBe('config')
    expect(fileKindFromName('Cargo.toml')).toBe('config')
  })

  it('still classifies general source files as code', () => {
    expect(fileKindFromName('index.ts')).toBe('code')
    expect(fileKindFromName('main.py')).toBe('code')
  })
})
```

追加到 `apps/web/src/tests/TopicTree.test.tsx`：

```tsx
  it('shows the open-folder icon variant for an expanded directory', () => {
    const dirs = new Map([['专题', { entries: [], expanded: true, loading: false }]])
    renderTopicTree([topic('专题', true)], dirs)
    expect(screen.getByLabelText('已展开的文件夹')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/lib/fileKind.test.ts src/tests/TopicTree.test.tsx`
Expected: FAIL — `fileKindFromName('settings.json')` 当前返回 `'code'`；找不到 `已展开的文件夹` label。

- [ ] **Step 3: 实现**

`apps/web/src/lib/fileKind.ts`：`FileKind` union 加 `| 'config'`；`switch` 里把 `case 'json': case 'yaml': case 'yml': case 'toml':` 从现有的 `code` 分支里摘出，单独返回 `'config'`：

```ts
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return 'config'
```

（从原来 `code` 分支的 case 列表里删掉这四个。）

`apps/web/src/lib/fileTypeIconKind.ts`：

```ts
export type FileTypeIconKind = FileKind | 'folder' | 'folder-open' | 'mdx'
```

`apps/web/src/components/FileTypeIcon.tsx`：

1. `ICON_LABELS` 加：
```ts
  'folder-open': '已展开的文件夹',
  config: '配置文件',
```
2. `ICON_PALETTES` 加（复用 `--file-default`，配置类不新增颜色变量）：
```ts
  'folder-open': ICON_PALETTES_FOLDER_SHARED, // 见下方说明
  config: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 26%, transparent)',
  },
```
   实际做法：`folder-open` 直接复用现有 `folder` 那一条调色板对象（不新建变量名），即把 `folder:` 那行的 value 提成一个局部常量 `FOLDER_PALETTE`，`folder: FOLDER_PALETTE, 'folder-open': FOLDER_PALETTE,`。
3. **删除 `GLYPHS` 常量**（不再需要文字缩写）。
4. `VectorGlyph` 函数补齐所有类型分支，替换原来靠 `GLYPHS[kind]` 兜底文字的类型（`markdown`/`mdx`/`text`/`html`/`pdf`/`docx`/`spreadsheet`/`presentation`/`csv`/`code`/`archive`/`config`），并加 `folder-open`：

```tsx
function VectorGlyph({ kind }: { kind: FileTypeIconKind }) {
  if (kind === 'folder') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M3 6.5h6l2 2H21v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M3 9h18" />
      </svg>
    )
  }
  if (kind === 'folder-open') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M3 8.5V6.5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H8.5a1.5 1.5 0 0 0-1.4 1L4 18.5" />
        <path d="M4 18.5 6 10h14.5a1 1 0 0 1 .97 1.24L20 18.5a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5Z" />
      </svg>
    )
  }
  if (kind === 'image') { /* 保持不变 */ }
  if (kind === 'audio') { /* 保持不变 */ }
  if (kind === 'video') { /* 保持不变 */ }
  if (kind === 'markdown' || kind === 'mdx' || kind === 'text') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M4 6h16M4 12h10M4 18h7" />
      </svg>
    )
  }
  if (kind === 'code') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
      </svg>
    )
  }
  if (kind === 'config') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M8 4h8M8 20h8M6 4c0 4-3 4-3 8s3 4 3 8M18 4c0 4 3 4 3 8s-3 4-3 8" />
      </svg>
    )
  }
  if (kind === 'html') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13 6l-2 12" />
      </svg>
    )
  }
  if (kind === 'pdf' || kind === 'docx' || kind === 'text') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M8 13h8M8 17h5" />
      </svg>
    )
  }
  if (kind === 'spreadsheet' || kind === 'csv') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16M4 15h16M10 4v16M15 4v16" />
      </svg>
    )
  }
  if (kind === 'presentation') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="3" y="5" width="18" height="12" rx="1" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    )
  }
  if (kind === 'archive') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M12 4v16M9 8h1M9 12h1M9 16h1" />
      </svg>
    )
  }
  // other
  return (
    <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}
```

（`glyph ? glyph : <VectorGlyph kind={kind} />` 那行改为直接 `<VectorGlyph kind={kind} />`，删掉对 `GLYPHS`/`glyph` 变量的引用。）

`apps/web/src/components/TopicTree.tsx`：把 `const iconKind = isDir ? 'folder' : fileTypeIconKindFromName(entry.name)` 改为：

```ts
const iconKind = isDir ? (isExpanded ? 'folder-open' : 'folder') : fileTypeIconKindFromName(entry.name)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/lib/fileKind.test.ts src/tests/TopicTree.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/fileKind.ts apps/web/src/lib/fileTypeIconKind.ts apps/web/src/components/FileTypeIcon.tsx apps/web/src/components/TopicTree.tsx apps/web/src/lib/fileKind.test.ts apps/web/src/tests/TopicTree.test.tsx
git commit -m "feat(web): shape-symbol file icons and folder open/closed state"
```

---

## Task 6: 子项计数、空文件夹提示（AC-5, AC-6）

**Files:**
- Modify: `apps/web/src/components/TopicTree.tsx`（行尾计数徽标 + 展开后空态行）
- Test: `apps/web/src/tests/TopicTree.test.tsx`

**Interfaces:**
- Consumes: 已有的 `dirs: Map<string, { entries, expanded, loading }>` prop（`childState.entries.length` 即直接子项数）。
- Produces: 无新导出。

- [ ] **Step 1: 写失败的测试**

追加到 `apps/web/src/tests/TopicTree.test.tsx`:

```tsx
  it('shows a child count badge next to an expanded folder with children', () => {
    const dirs = new Map([
      [
        '专题',
        {
          entries: [topic('a.md'), topic('b.md'), topic('sub', true)],
          expanded: true,
          loading: false,
        },
      ],
    ])
    renderTopicTree([topic('专题', true)], dirs)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows an empty-folder placeholder row when an expanded folder has no children', () => {
    const dirs = new Map([['专题', { entries: [], expanded: true, loading: false }]])
    renderTopicTree([topic('专题', true)], dirs)
    expect(screen.getByText('空文件夹')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/tests/TopicTree.test.tsx`
Expected: FAIL — 找不到文本 `3` / `空文件夹`。

- [ ] **Step 3: 实现**

在 `TopicTree.tsx` 的行内容渲染部分（`{/* Name */}` span 之后、`{/* Action buttons */}` 之前）加计数徽标：

```tsx
{isDir && childState && childState.entries.length > 0 && (
  <span
    style={{
      fontSize: '0.6875rem',
      color: 'var(--text-tertiary, #9CA3AF)',
      marginRight: 4,
      flexShrink: 0,
    }}
  >
    {childState.entries.length}
  </span>
)}
```

在递归子节点渲染处，`isLoading ? (...) : (<TopicTree .../>)` 的 `else` 分支里，`entries.length === 0` 时改为渲染空态行而非直接递归空数组：

```tsx
          ) : childState.entries.length === 0 ? (
            <div
              style={{
                paddingLeft: rowIndent + 20,
                color: 'var(--text-tertiary, #9CA3AF)',
                fontSize: '0.75rem',
                fontStyle: 'italic',
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              空文件夹
            </div>
          ) : (
            <TopicTree
              entries={childState.entries}
              dirs={dirs}
              selectedPath={selectedPath}
              indent={indent + 1}
              parentPath={entry.path}
              sortStrategy={sortStrategy}
              manualOrder={manualOrder}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onAt={onAt}
              onMore={onMore}
            />
          ))}
```

（保留原有的 `isLoading` 分支不动，只新增中间这一条 `entries.length === 0` 分支。）

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/tests/TopicTree.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TopicTree.tsx apps/web/src/tests/TopicTree.test.tsx
git commit -m "feat(web): show child count badge and empty-folder placeholder"
```

---

## Task 7: Daemon 新建文件/文件夹能力

**Files:**
- Modify: `apps/daemon/src/files/service.ts`（新增 `createFile`/`createFolder`，紧邻 `duplicate()` 之后）
- Modify: `apps/daemon/src/server.ts`（新增 `POST /files/create` 路由，紧邻 `/files/duplicate` 之后）
- Test: `apps/daemon/src/files/service.test.ts`

**Interfaces:**
- Produces: `FilesService.createFile(dirPath: string, name: string, mode?: AuthorizationMode): FileMutationResult<string>`、`FilesService.createFolder(dirPath: string, name: string, mode?: AuthorizationMode): FileMutationResult<string>`，均返回创建后的相对路径。供 Task 8 前端接线消费。路由 `POST /files/create` body `{ dirPath: string, name: string, kind: 'file' | 'folder' }`。

- [ ] **Step 1: 写失败的测试**

追加到 `apps/daemon/src/files/service.test.ts`（沿用文件顶部已有的 `files`/`ws` 变量约定，参照相邻 `it('duplicates, renames...')` 用例的写法）:

```ts
  it('creates a new empty file inside an existing directory and records a create ChangeSet', () => {
    mkdirSync(join(ws, '专题'), { recursive: true })
    const relPath = files.createFile('专题', 'notes.md').result
    expect(relPath).toBe('专题/notes.md')
    expect(readFileSync(join(ws, relPath), 'utf8')).toBe('')
  })

  it('creates a new folder inside an existing directory', () => {
    mkdirSync(join(ws, '专题'), { recursive: true })
    const relPath = files.createFolder('专题', '新建文件夹').result
    expect(relPath).toBe('专题/新建文件夹')
    expect(statSync(join(ws, relPath)).isDirectory()).toBe(true)
  })

  it('rejects creating a file that already exists', () => {
    mkdirSync(join(ws, '专题'), { recursive: true })
    files.createFile('专题', 'dup.md')
    expect(() => files.createFile('专题', 'dup.md')).toThrowError(/已存在/)
  })
```

（若 `statSync`/`readFileSync` 未在测试文件顶部 import，加上 `import { readFileSync, mkdirSync, statSync } from 'node:fs'`，与文件现有 import 合并去重。）

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/daemon && bunx vitest run src/files/service.test.ts`
Expected: FAIL — `files.createFile is not a function`

- [ ] **Step 3: 实现**

在 `apps/daemon/src/files/service.ts` 的 `duplicate()` 方法之后加：

```ts
  createFile(
    dirPath: string,
    name: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<string> {
    if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      throw new WorkspaceFsError('invalid_name', '文件名无效')
    }
    const dir = this.resolveExistingDir(dirPath)
    const dest = join(dir, name)
    this.assertWritableTarget(dest, mode)
    if (existsSync(dest)) throw new WorkspaceFsError('target_exists', '同名文件已存在', 409)
    const relPath = this.relativeFromRoot(dest)
    const changeSet = this.recordWritableChange(relPath, 'create', mode, '')
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    writeFileSync(dest, '')
    return { result: relPath, changeSet }
  }

  createFolder(
    dirPath: string,
    name: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<string> {
    if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      throw new WorkspaceFsError('invalid_name', '文件夹名无效')
    }
    const dir = this.resolveExistingDir(dirPath)
    const dest = join(dir, name)
    this.assertWritableTarget(dest, mode)
    if (existsSync(dest)) throw new WorkspaceFsError('target_exists', '同名文件夹已存在', 409)
    const relPath = this.relativeFromRoot(dest)
    const changeSet = this.recordWritableChange(relPath, 'create', mode, '')
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    mkdirSync(dest, { recursive: false })
    return { result: relPath, changeSet }
  }
```

在 `apps/daemon/src/server.ts` 的 `app.post('/files/duplicate', ...)` 路由之后加：

```ts
    app.post('/files/create', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (
          typeof body.dirPath !== 'string' ||
          typeof body.name !== 'string' ||
          (body.kind !== 'file' && body.kind !== 'folder')
        ) {
          res.status(400).json({
            error: {
              code: 'invalid_create_request',
              message: 'dirPath, name and kind are required',
            },
          })
          return
        }
        const result =
          body.kind === 'file'
            ? filesService().createFile(body.dirPath, body.name)
            : filesService().createFolder(body.dirPath, body.name)
        res.json(result.result)
      } catch (err) {
        handleFsError(res, err)
      }
    })
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/daemon && bunx vitest run src/files/service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/files/service.ts apps/daemon/src/server.ts apps/daemon/src/files/service.test.ts
git commit -m "feat(daemon): add create-file and create-folder file operations"
```

---

## Task 8: 右键新建文件/文件夹 + 重命名（AC-8, AC-9）

**Files:**
- Modify: `apps/web/src/lib/httpRuntimeClient.ts`（`workspace_duplicate_file` 之后加 `workspace_create_file`/`workspace_create_folder` case）
- Modify: `apps/web/src/components/TreeContextMenu.tsx`（加"新建文件"/"新建文件夹"/"重命名"菜单项）
- Modify: `apps/web/src/components/TopicTree.tsx`（inline 编辑态：新建占位行、重命名输入框）
- Modify: `apps/web/src/components/TreeSidebar.tsx`（新增 `onCreateFile`/`onCreateFolder`/`onRename` 回调，接线到 `runtimeClient` 并在成功后刷新 `useTopics`）
- Test: `apps/web/src/tests/TreeContextMenu.test.tsx`（若不存在则创建，参照 `TopicTree.test.tsx` 的渲染方式）、`apps/web/src/tests/TopicTree.test.tsx`

**Interfaces:**
- Consumes: `selectRuntimeClient().invoke('workspace_create_file', { dirPath, name })` / `'workspace_create_folder'` / `'workspace_rename_file'`（已存在，见 Task 依据里的 `httpRuntimeClient.ts:574`）。
- Produces: `TreeContextMenuProps` 新增可选 `onCreateFile?: (dirPath: string) => void`、`onCreateFolder?: (dirPath: string) => void`、`onRename?: (path: string) => void`；`TopicTreeProps` 新增可选 `editingPath?: string | null`（正在 inline 编辑/新建的行的 path，`null` 表示新建占位行尚无 path）与 `onCommitEdit?: (path: string | null, name: string) => void` / `onCancelEdit?: () => void`。

- [ ] **Step 1: 写失败的测试**

Create `apps/web/src/tests/TreeContextMenu.test.tsx`（若已存在同名文件则在其中追加）:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './setup'
import { TreeContextMenu } from '../components/TreeContextMenu'

describe('TreeContextMenu — create & rename', () => {
  it('shows 新建文件/新建文件夹 for a folder and calls the callbacks', async () => {
    const onCreateFile = vi.fn()
    const onCreateFolder = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <TreeContextMenu
        state={{
          x: 0,
          y: 0,
          itemType: 'topic-folder',
          name: '专题',
          path: '专题',
          isPinned: false,
        }}
        onClose={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onDelete={vi.fn()}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
      />,
    )
    await user.click(screen.getByText('新建文件'))
    expect(onCreateFile).toHaveBeenCalledWith('专题')
  })

  it('shows 重命名 for a topic file and calls onRename', async () => {
    const onRename = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <TreeContextMenu
        state={{
          x: 0,
          y: 0,
          itemType: 'topic-file',
          name: 'note.md',
          path: 'note.md',
          isPinned: false,
        }}
        onClose={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
      />,
    )
    await user.click(screen.getByText('重命名'))
    expect(onRename).toHaveBeenCalledWith('note.md')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/tests/TreeContextMenu.test.tsx`
Expected: FAIL — 找不到"新建文件"/"重命名"文本。

- [ ] **Step 3: 实现**

`apps/web/src/lib/httpRuntimeClient.ts`，在 `workspace_duplicate_file` case 之后加：

```ts
      case 'workspace_create_file': {
        return (await this.postJson(
          '/files/create',
          { dirPath: args?.dirPath, name: args?.name, kind: 'file' },
          'daemon create file',
        )) as T
      }
      case 'workspace_create_folder': {
        return (await this.postJson(
          '/files/create',
          { dirPath: args?.dirPath, name: args?.name, kind: 'folder' },
          'daemon create folder',
        )) as T
      }
```

`apps/web/src/components/TreeContextMenu.tsx`：

```ts
interface TreeContextMenuProps {
  state: TreeContextMenuState
  onClose: () => void
  onPin: (type: 'journal' | 'identity' | 'topic', path: string) => void
  onUnpin: (path: string) => void
  onDelete: (type: string, path: string) => void
  onArchive?: (path: string) => void
  onUnarchive?: (path: string) => void
  onCreateFile?: (dirPath: string) => void
  onCreateFolder?: (dirPath: string) => void
  onRename?: (path: string) => void
}
```

函数签名解构参数加 `onCreateFile, onCreateFolder, onRename`。加 handler：

```ts
  function handleCreateFile() {
    onCreateFile?.(path)
    onClose()
  }
  function handleCreateFolder() {
    onCreateFolder?.(path)
    onClose()
  }
  function handleRename() {
    onRename?.(path)
    onClose()
  }
```

`items` 数组：在 `showPin` 那一项之前（"复制路径"之前）加，仅当 `itemType === 'topic-folder'` 时加新建两项，`itemType === 'topic-file' || itemType === 'topic-folder'` 时加重命名一项：

```ts
    ...(itemType === 'topic-folder'
      ? [
          { type: 'action' as const, label: '新建文件', icon: 'file', onClick: handleCreateFile },
          {
            type: 'action' as const,
            label: '新建文件夹',
            icon: 'folder',
            onClick: handleCreateFolder,
          },
          { type: 'divider' as const },
        ]
      : []),
    ...(itemType === 'topic-file' || itemType === 'topic-folder'
      ? [{ type: 'action' as const, label: '重命名', icon: 'edit', onClick: handleRename }]
      : []),
```

（`icon: 'file'` 若 `iconPaths` 里没有对应 key，复用已有的 `icon: 'edit'` 的 path 或新增一条最简单的文档轮廓 path，跟随文件里 `iconPaths` 现有写法补一条 `file: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6" />`。）

`apps/web/src/components/TopicTree.tsx`：加 inline 编辑态支持。`TopicTreeProps` 加：

```ts
  editingPath?: string | null // 正在编辑的已有条目 path；新建占位行用特殊值 `${parentPath}/__new_file__` / `${parentPath}/__new_folder__`
  onCommitEdit?: (originalPath: string | null, newName: string, isNewFolder: boolean) => void
  onCancelEdit?: () => void
```

在文件名 `<span>` 处，若 `entry.path === editingPath`，渲染 `<input>` 替代：

```tsx
{entry.path === editingPath ? (
  <input
    autoFocus
    defaultValue={displayName}
    onClick={(e) => e.stopPropagation()}
    onKeyDown={(e) => {
      if (e.key === 'Enter') onCommitEdit?.(entry.path, e.currentTarget.value.trim(), isDir)
      if (e.key === 'Escape') onCancelEdit?.()
    }}
    onBlur={(e) => onCommitEdit?.(entry.path, e.currentTarget.value.trim(), isDir)}
    style={{
      flex: 1,
      font: 'inherit',
      color: 'inherit',
      background: 'var(--input-bg, transparent)',
      border: '1px solid var(--record-btn)',
      borderRadius: 'var(--radius-sm)',
      padding: '0 4px',
    }}
  />
) : (
  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} title={displayName}>
    {displayName}
  </span>
)}
```

（新建占位行的渲染：不在本文件盘算复杂的虚拟条目注入逻辑——在 `TreeSidebar.tsx` 里，`onCreateFile`/`onCreateFolder` 触发时，先往对应 `dirs` 状态里插入一个 `{ name: '', path: `${dirPath}/__pending__`, is_dir: isFolder, mtime_secs: Date.now()/1000 }` 的临时条目并把 `editingPath` 设成这个临时 path；`onCommitEdit` 收到空 path 判断（临时 path 含 `__pending__`）时调用 `workspace_create_file`/`workspace_create_folder`成功后用真实返回路径替换临时条目并刷新该目录；用户按 Escape 或输入为空时移除临时条目，不发起 daemon 请求。）

`apps/web/src/components/TreeSidebar.tsx`：加状态与回调：

```ts
const [editingPath, setEditingPath] = useState<string | null>(null)
const [pendingNew, setPendingNew] = useState<{ dirPath: string; isDir: boolean } | null>(null)

function handleCreateFile(dirPath: string) {
  setPendingNew({ dirPath, isDir: false })
  setEditingPath(`${dirPath}/__pending__`)
}
function handleCreateFolder(dirPath: string) {
  setPendingNew({ dirPath, isDir: true })
  setEditingPath(`${dirPath}/__pending__`)
}
async function handleCommitEdit(originalPath: string | null, newName: string, isDir: boolean) {
  if (!newName) {
    setEditingPath(null)
    setPendingNew(null)
    return
  }
  try {
    if (pendingNew) {
      const invokeName = pendingNew.isDir ? 'workspace_create_folder' : 'workspace_create_file'
      await selectRuntimeClient().invoke(invokeName, { dirPath: pendingNew.dirPath, name: newName })
    } else if (originalPath) {
      await selectRuntimeClient().invoke('workspace_rename_file', {
        relativePath: originalPath,
        newName,
      })
    }
    await loadTopics()
  } catch (e) {
    console.error('[TreeSidebar] create/rename failed:', e)
  } finally {
    setEditingPath(null)
    setPendingNew(null)
  }
}
function handleCancelEdit() {
  setEditingPath(null)
  setPendingNew(null)
}
function handleRename(path: string) {
  setEditingPath(path)
}
```

把 `editingPath`、`onCommitEdit={handleCommitEdit}`、`onCancelEdit={handleCancelEdit}` 传给两处 `<TopicTree>`；`<TreeContextMenu>` 调用处加 `onCreateFile={handleCreateFile}` `onCreateFolder={handleCreateFolder}` `onRename={handleRename}`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/tests/TreeContextMenu.test.tsx src/tests/TopicTree.test.tsx src/tests/TreeSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/httpRuntimeClient.ts apps/web/src/components/TreeContextMenu.tsx apps/web/src/components/TopicTree.tsx apps/web/src/components/TreeSidebar.tsx apps/web/src/tests/TreeContextMenu.test.tsx apps/web/src/tests/TopicTree.test.tsx apps/web/src/tests/TreeSidebar.test.tsx
git commit -m "feat(web): create file/folder and rename via tree context menu"
```

---

## Task 9: 手动拖拽排序（AC-7）

**Files:**
- Modify: `apps/web/src/components/TopicTree.tsx`（`strategy === 'manual'` 时渲染拖拽把手 + `draggable`/`onDragStart`/`onDrop`）
- Modify: `apps/web/src/components/TreeSidebar.tsx`（拖拽结束后计算新顺序、写入 `workspace_tree_manual_order`）
- Modify: `apps/web/src/hooks/useTreeSort.ts`（补充读写 `workspace_tree_manual_order` 的方法）
- Modify: `apps/web/src/lib/httpRuntimeClient.ts`（新增 `get_workspace_tree_manual_order`/`set_workspace_tree_manual_order` case）
- Test: `apps/web/src/tests/TopicTree.test.tsx`

**Interfaces:**
- Consumes: `sortEntries(entries, 'manual', manualOrder?.[parentPath])`（Task 3 已实现，直接复用）。
- Produces: `useTreeSort()` 返回值扩展为 `{ strategy, setStrategy, manualOrder, setManualOrderFor: (parentPath: string, order: string[]) => void, loading }`。`manualOrder: Record<string, string[]>`，供 `TreeSidebar.tsx` 传给 `TopicTree` 的 `manualOrder` prop（Task 3/6/8 已预留该 prop）。

- [ ] **Step 1: 写失败的测试**

追加到 `apps/web/src/tests/TopicTree.test.tsx`:

```tsx
  it('shows a drag handle only when sortStrategy is manual', () => {
    const { rerender } = renderWithProviders(
      <TopicTree
        entries={[topic('a.md'), topic('b.md')]}
        dirs={new Map()}
        selectedPath={null}
        parentPath=""
        sortStrategy="name-asc"
        onToggleDir={vi.fn()}
        onSelectFile={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />,
    )
    expect(screen.queryAllByLabelText('拖拽排序')).toHaveLength(0)

    rerender(
      <TopicTree
        entries={[topic('a.md'), topic('b.md')]}
        dirs={new Map()}
        selectedPath={null}
        parentPath=""
        sortStrategy="manual"
        onToggleDir={vi.fn()}
        onSelectFile={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />,
    )
    expect(screen.getAllByLabelText('拖拽排序')).toHaveLength(2)
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/tests/TopicTree.test.tsx`
Expected: FAIL — 找不到 `拖拽排序` label。

- [ ] **Step 3: 实现**

`apps/web/src/components/TopicTree.tsx`：`TopicTreeProps` 加可选 `onReorder?: (parentPath: string, orderedNames: string[]) => void`。在行内容最前（chevron 之前）条件渲染拖拽把手：

```tsx
{sortStrategy === 'manual' && (
  <span
    aria-label="拖拽排序"
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData('text/plain', entry.name)
      e.stopPropagation()
    }}
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => {
      e.preventDefault()
      e.stopPropagation()
      const draggedName = e.dataTransfer.getData('text/plain')
      if (!draggedName || draggedName === entry.name) return
      const names = sorted.map((it) => it.name)
      const from = names.indexOf(draggedName)
      const to = names.indexOf(entry.name)
      if (from === -1 || to === -1) return
      const next = [...names]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      onReorder?.(parentPath, next)
    }}
    style={{
      width: 12,
      height: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'grab',
      color: 'var(--text-tertiary, #9CA3AF)',
      flexShrink: 0,
    }}
  >
    <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
      <circle cx="2" cy="2" r="1" />
      <circle cx="6" cy="2" r="1" />
      <circle cx="2" cy="6" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="2" cy="10" r="1" />
      <circle cx="6" cy="10" r="1" />
    </svg>
  </span>
)}
```

`useTreeSort.ts` 扩展：

```ts
const getManualOrder = (): Promise<Record<string, string[]>> =>
  selectRuntimeClient().invoke<Record<string, string[]>>('get_workspace_tree_manual_order')

const setManualOrderAll = (order: Record<string, string[]>): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_workspace_tree_manual_order', { order })

export function useTreeSort() {
  // ...既有 strategy state...
  const [manualOrder, setManualOrderState] = useState<Record<string, string[]>>({})

  useEffect(() => {
    getManualOrder()
      .then(setManualOrderState)
      .catch(() => setManualOrderState({}))
  }, [])

  function setManualOrderFor(parentPath: string, order: string[]) {
    const next = { ...manualOrder, [parentPath]: order }
    setManualOrderState(next)
    setManualOrderAll(next).catch(console.error)
  }

  return { strategy, setStrategy, manualOrder, setManualOrderFor, loading }
}
```

`httpRuntimeClient.ts` 加：

```ts
      case 'get_workspace_tree_manual_order': {
        const settings = await this.getSettings()
        return (settings.workspace_tree_manual_order ?? {}) as unknown as T
      }
      case 'set_workspace_tree_manual_order': {
        await this.updateSettings({ workspace_tree_manual_order: args?.order })
        return undefined as T
      }
```

`TreeSidebar.tsx`：`const { strategy: treeSort, manualOrder, setManualOrderFor } = useTreeSort()`，两处 `<TopicTree>` 调用加 `manualOrder={manualOrder}` `onReorder={setManualOrderFor}`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/tests/TopicTree.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TopicTree.tsx apps/web/src/components/TreeSidebar.tsx apps/web/src/hooks/useTreeSort.ts apps/web/src/lib/httpRuntimeClient.ts apps/web/src/tests/TopicTree.test.tsx
git commit -m "feat(web): manual drag-to-reorder for workspace tree"
```

---

## Task 10: 键盘导航（AC-10）

**Files:**
- Modify: `apps/web/src/components/TreeSidebar.tsx`（Workspace 树容器加 `role="tree"`/`tabIndex`/`onKeyDown`，管理 `focusedPath` state）
- Modify: `apps/web/src/components/TopicTree.tsx`（每行加 `role="treeitem"`、`data-path`，聚焦态视觉用 `--focus-ring`）
- Test: `apps/web/src/tests/TreeSidebar.test.tsx`

**Interfaces:**
- Consumes: 已有的 `dirs`（`useTopics`）、`sortEntries`（Task 3）——键盘导航需要按"当前渲染顺序"（含排序结果）计算可见行的扁平列表。
- Produces: 无新导出，纯交互行为。

- [ ] **Step 1: 写失败的测试**

追加到 `apps/web/src/tests/TreeSidebar.test.tsx`:

```tsx
  it('moves focus down/up and expands/collapses via keyboard', async () => {
    const { user } = renderTreeSidebar() // 沿用既有 helper
    const tree = screen.getByRole('tree', { name: 'Workspace' })
    tree.focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.getAttribute('data-path')).toBeTruthy()
    await user.keyboard('{ArrowRight}')
    // 展开后子项可见（具体断言按现有测试 fixture 的数据调整）
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx`
Expected: FAIL — 找不到 `role="tree"` 的容器。

- [ ] **Step 3: 实现**

`TreeSidebar.tsx`：给 Workspace 树的滚动容器（`category === 'topics'` 分支内、`<TopicTree>` 的直接外层 `<div>`）加：

```tsx
<div
  role="tree"
  aria-label="Workspace"
  tabIndex={0}
  onKeyDown={handleTreeKeyDown}
  style={{ outline: 'none' }}
>
  {/* 现有内容不变 */}
</div>
```

加 `focusedPath` state 与扁平可见行计算：

```ts
const [focusedPath, setFocusedPath] = useState<string | null>(null)

function flattenVisible(
  entries: TopicEntry[],
  parentPath: string,
): { path: string; isDir: boolean }[] {
  const sorted = sortEntries(filterCuration(entries), treeSort, manualOrder[parentPath])
  const out: { path: string; isDir: boolean }[] = []
  for (const e of sorted) {
    out.push({ path: e.path, isDir: e.is_dir })
    const child = dirs.get(e.path)
    if (e.is_dir && child?.expanded) {
      out.push(...flattenVisible(child.entries, e.path))
    }
  }
  return out
}

function handleTreeKeyDown(e: React.KeyboardEvent) {
  const visible = flattenVisible(dirs.get('')?.entries ?? [], '')
  const idx = visible.findIndex((v) => v.path === focusedPath)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = visible[Math.min(idx + 1, visible.length - 1)] ?? visible[0]
    if (next) setFocusedPath(next.path)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = visible[Math.max(idx - 1, 0)]
    if (prev) setFocusedPath(prev.path)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    const current = visible[idx]
    if (current?.isDir) {
      const state = dirs.get(current.path)
      if (!state?.expanded) toggleDir(current.path)
      else {
        const child = flattenVisible(state.entries, current.path)[0]
        if (child) setFocusedPath(child.path)
      }
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    const current = visible[idx]
    if (current?.isDir && dirs.get(current.path)?.expanded) {
      toggleDir(current.path)
    } else {
      const parentPath = current?.path.split('/').slice(0, -1).join('/') ?? ''
      if (parentPath) setFocusedPath(parentPath)
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const current = visible[idx]
    if (!current) return
    if (current.isDir) {
      toggleDir(current.path)
    } else {
      const entry = dirs.get('')?.entries.find((x) => x.path === current.path)
      if (entry) handleSelect({ type: 'topic-file', path: entry.path, name: entry.name })
    }
  }
}
```

`TopicTree.tsx`：每行根 `<div className="tree-item-row" ...>` 加 `role="treeitem"` `data-path={entry.path}` `aria-selected={isSelected}`；聚焦态样式（行背景走已有 `--focus-ring` token，加在现有 `style` 对象里）：

```tsx
outline: entry.path === focusedPath ? 'var(--focus-ring)' : 'none',
outlineOffset: -1,
```

`TopicTreeProps` 加可选 `focusedPath?: string | null`，`TreeSidebar.tsx` 两处 `<TopicTree>` 调用传 `focusedPath={focusedPath}`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && bunx vitest run src/tests/TreeSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TreeSidebar.tsx apps/web/src/components/TopicTree.tsx apps/web/src/tests/TreeSidebar.test.tsx
git commit -m "feat(web): keyboard navigation for the workspace tree"
```

---

## 全量回归

所有任务完成后跑一次全量校验：

```bash
bun run lint
bun run format:check
npm run build
cd apps/web && bunx vitest run
cd ../daemon && bunx vitest run
```

对照 `stories/20260708-workspace-tree-enhancements/story.md` 的 AC-1～AC-10 逐条手动验证（`npm run desktop:dev` 实跑一遍：切换 4 种排序、切到手动拖拽、右键新建/重命名、展开态图标、空文件夹、计数、键盘导航），再进入 verification-gate 出 verify-report。
