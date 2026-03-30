# Recording Queue Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 停止录音或导入音频后，queue item 立刻出现并平滑过渡到 AI 处理完成，不再有消失/重现的断层。

**Architecture:** 前端驱动——停止录音时立即插入 `converting` 占位 item，`recording-processed` 事件到达后原地升级为真实路径的 `queued` item；音频文件导入后直接插入 `queued` item。`ai-processing` 事件链正常接管后续状态。

**Tech Stack:** React hooks (useJournal), TypeScript, Tauri event system, Vitest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | 新增 `'converting'` 到 `QueueItemStatus` |
| `src/hooks/useJournal.ts` | Modify | 新增 `addConvertingItem` / `addQueuedItem`；改造 `recording-processed` 监听器 |
| `src/App.tsx` | Modify | 停止录音后调用 `addConvertingItem`；音频导入后调用 `addQueuedItem` |
| `src/components/ProcessingQueue.tsx` | Modify | `StatusIndicator` 新增 `converting` 分支 |
| `src/tests/useJournal.test.ts` | Modify | 新增 `addConvertingItem` / `addQueuedItem` 测试 |

---

### Task 1: 新增 `converting` 类型

**Files:**
- Modify: `src/types.ts`
- Test: `src/tests/types.test.ts`

- [ ] **Step 1: 在 types.test.ts 确认 converting 不在现有类型中**

检查 `src/tests/types.test.ts` 是否有 `QueueItemStatus` 的测试，没有则跳过，直接改类型。

- [ ] **Step 2: 修改 `src/types.ts`**

将第 62 行：
```ts
export type QueueItemStatus = 'recording' | 'queued' | 'processing' | 'completed' | 'failed'
```
改为：
```ts
export type QueueItemStatus = 'recording' | 'converting' | 'queued' | 'processing' | 'completed' | 'failed'
```

- [ ] **Step 3: 运行类型检查确认无报错**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | head -30
```
Expected: 无 TypeScript 错误（可能有其他构建产物，只看 tsc 部分）

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add converting status to QueueItemStatus"
```

---

### Task 2: useJournal 新增 addConvertingItem / addQueuedItem

**Files:**
- Modify: `src/hooks/useJournal.ts`
- Test: `src/tests/useJournal.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/tests/useJournal.test.ts` 末尾追加：

```ts
it('addConvertingItem inserts a converting item at head', async () => {
  const { result } = renderHook(() => useJournal())
  await act(async () => {})
  act(() => {
    result.current.addConvertingItem('__recording__', '录音处理中')
  })
  expect(result.current.queueItems).toHaveLength(1)
  expect(result.current.queueItems[0]).toMatchObject({
    path: '__recording__',
    filename: '录音处理中',
    status: 'converting',
  })
})

it('addConvertingItem is idempotent', async () => {
  const { result } = renderHook(() => useJournal())
  await act(async () => {})
  act(() => {
    result.current.addConvertingItem('__recording__', '录音处理中')
    result.current.addConvertingItem('__recording__', '录音处理中')
  })
  expect(result.current.queueItems).toHaveLength(1)
})

it('addQueuedItem inserts a queued item with real path', async () => {
  const { result } = renderHook(() => useJournal())
  await act(async () => {})
  act(() => {
    result.current.addQueuedItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
  })
  expect(result.current.queueItems[0]).toMatchObject({
    path: '/ws/2603/raw/meeting.m4a',
    filename: 'meeting.m4a',
    status: 'queued',
  })
})

it('addQueuedItem is idempotent (deduplicates by path)', async () => {
  const { result } = renderHook(() => useJournal())
  await act(async () => {})
  act(() => {
    result.current.addQueuedItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
    result.current.addQueuedItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
  })
  expect(result.current.queueItems).toHaveLength(1)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run src/tests/useJournal.test.ts 2>&1 | tail -20
```
Expected: FAIL — `result.current.addConvertingItem is not a function`

- [ ] **Step 3: 实现 addConvertingItem 和 addQueuedItem**

在 `src/hooks/useJournal.ts` 中，在 `dismissQueueItem` 之后、`useEffect` 之前插入：

```ts
const RECORDING_PLACEHOLDER = '__recording__'

const addConvertingItem = useCallback((placeholderPath: string, filename: string) => {
  setQueueItems(prev => {
    if (prev.some(i => i.path === placeholderPath)) return prev
    return [{ path: placeholderPath, filename, status: 'converting' as const, addedAt: Date.now(), logs: [] }, ...prev]
  })
}, [])

const addQueuedItem = useCallback((path: string, filename: string) => {
  setQueueItems(prev => {
    if (prev.some(i => i.path === path)) return prev
    return [{ path, filename, status: 'queued' as const, addedAt: Date.now(), logs: [] }, ...prev]
  })
}, [])
```

在文件顶部与其他常量一起定义占位常量：
```ts
export const RECORDING_PLACEHOLDER = '__recording__'
```
（移除函数内部的 `const RECORDING_PLACEHOLDER`，改为模块级 export）

在 `return` 语句中新增两个函数：
```ts
return { entries, loading, queueItems, isProcessing, dismissQueueItem, addConvertingItem, addQueuedItem, refresh }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run src/tests/useJournal.test.ts 2>&1 | tail -20
```
Expected: PASS — 所有 6 个测试通过

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useJournal.ts src/tests/useJournal.test.ts
git commit -m "feat: add addConvertingItem and addQueuedItem to useJournal"
```

---

### Task 3: 改造 recording-processed 监听器

**Files:**
- Modify: `src/hooks/useJournal.ts`
- Test: `src/tests/useJournal.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/tests/useJournal.test.ts` 末尾追加。

首先更新 `listen` mock 以支持事件触发：

在文件顶部 `vi.mock('@tauri-apps/api/event', ...)` 替换为：

```ts
type EventCallback = (event: { payload: unknown }) => void
const listenerMap = new Map<string, EventCallback>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, cb: EventCallback) => {
    listenerMap.set(eventName, cb)
    return Promise.resolve(() => { listenerMap.delete(eventName) })
  }),
}))

function fireEvent(name: string, payload: unknown) {
  listenerMap.get(name)?.({ payload })
}
```

然后追加测试：

```ts
it('recording-processed upgrades placeholder item to queued with real path', async () => {
  const { result } = renderHook(() => useJournal())
  await act(async () => {})

  // Insert converting placeholder
  act(() => {
    result.current.addConvertingItem('__recording__', '录音处理中')
  })
  expect(result.current.queueItems[0].status).toBe('converting')

  // Fire recording-processed with real data
  act(() => {
    fireEvent('recording-processed', {
      filename: '录音 2026-03-30 10:00.m4a',
      path: '/ws/2603/raw/录音 2026-03-30 10:00.m4a',
    })
  })

  expect(result.current.queueItems[0]).toMatchObject({
    path: '/ws/2603/raw/录音 2026-03-30 10:00.m4a',
    filename: '录音 2026-03-30 10:00.m4a',
    status: 'queued',
  })
  // placeholder must be gone
  expect(result.current.queueItems.some(i => i.path === '__recording__')).toBe(false)
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run src/tests/useJournal.test.ts 2>&1 | tail -20
```
Expected: FAIL — placeholder item 仍是 `converting` 状态

- [ ] **Step 3: 改造 recording-processed 监听器**

在 `src/hooks/useJournal.ts` 中找到：

```ts
const unlistenProcessed = listen('recording-processed', () => {
  refresh()
})
```

替换为：

```ts
const unlistenProcessed = listen<{ filename: string; path: string }>('recording-processed', (event) => {
  const { filename, path } = event.payload
  setQueueItems(prev => {
    const hasPlaceholder = prev.some(i => i.path === RECORDING_PLACEHOLDER)
    if (!hasPlaceholder) return prev
    return prev.map(i =>
      i.path === RECORDING_PLACEHOLDER
        ? { ...i, path, filename, status: 'queued' as const }
        : i
    )
  })
  refresh()
})
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run src/tests/useJournal.test.ts 2>&1 | tail -20
```
Expected: PASS — 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useJournal.ts src/tests/useJournal.test.ts
git commit -m "feat: upgrade placeholder item on recording-processed event"
```

---

### Task 4: 更新 App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 导入 RECORDING_PLACEHOLDER 和新函数**

在 `src/App.tsx` 顶部找到：
```ts
const { entries, loading, queueItems, isProcessing, dismissQueueItem, refresh } = useJournal()
```
替换为：
```ts
const { entries, loading, queueItems, isProcessing, dismissQueueItem, addConvertingItem, addQueuedItem, refresh } = useJournal()
```

- [ ] **Step 2: 停止录音后插入 converting item**

找到：
```ts
const handleRecord = async () => {
  if (status === 'idle') {
    await start()
  } else {
    await stop()
    refresh()
  }
}
```
替换为：
```ts
const handleRecord = async () => {
  if (status === 'idle') {
    await start()
  } else {
    await stop()
    addConvertingItem('__recording__', '录音处理中')
  }
}
```
（移除 `refresh()`——`recording-processed` 事件处理器会调用 `refresh()`）

- [ ] **Step 3: 音频文件导入后插入 queued item**

找到 `handleFilesSubmit` 中：
```ts
if (kind === 'audio') {
  await importAudioFile(path)
}
```
替换为：
```ts
if (kind === 'audio') {
  const result = await importAudioFile(path)
  addQueuedItem(result.path, result.filename)
}
```

- [ ] **Step 4: 确认 visibleQueueItems 逻辑不变**

找到 `visibleQueueItems` 构造（约第 179-182 行），确认它仍然是：
```ts
const RECORDING_PATH = '__recording__'
const visibleQueueItems = status === 'recording'
  ? [{ path: RECORDING_PATH, filename: '录音中', status: 'recording' as const, addedAt: Date.now(), logs: [], elapsedSecs, audioLevel }, ...queueItems]
  : queueItems
```
保持不变——录音进行中时虚拟 item 在头部；停止后由 `addConvertingItem` 插入的真实 item 接替。

注意：`RECORDING_PATH` 常量此时与 `useJournal` 的 `RECORDING_PLACEHOLDER` 值相同（`'__recording__'`）。为避免两处重复定义，可从 `useJournal` import：

在 `src/App.tsx` 顶部修改 import：
```ts
import { useJournal } from './hooks/useJournal'
```
改为：
```ts
import { useJournal, RECORDING_PLACEHOLDER } from './hooks/useJournal'
```

然后将 `App.tsx` 中的 `const RECORDING_PATH = '__recording__'` 删除，后续引用改为 `RECORDING_PLACEHOLDER`：
```ts
const visibleQueueItems = status === 'recording'
  ? [{ path: RECORDING_PLACEHOLDER, filename: '录音中', status: 'recording' as const, addedAt: Date.now(), logs: [], elapsedSecs, audioLevel }, ...queueItems]
  : queueItems
```

- [ ] **Step 5: 运行类型检查**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | head -30
```
Expected: 无 TypeScript 错误

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/hooks/useJournal.ts
git commit -m "feat: wire addConvertingItem and addQueuedItem in App.tsx"
```

---

### Task 5: ProcessingQueue 新增 converting 状态显示

**Files:**
- Modify: `src/components/ProcessingQueue.tsx`

- [ ] **Step 1: 在 StatusIndicator 新增 converting 分支**

找到 `function StatusIndicator` 中 `if (item.status === 'queued')` 块（约第 71-77 行），在其之前插入：

```tsx
if (item.status === 'converting') {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--item-meta)', fontSize: 9, opacity: 0.8 }}>
      <Spinner size={10} borderWidth={1.5} />
      转换中
    </span>
  )
}
```

- [ ] **Step 2: 运行所有前端测试**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -20
```
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add src/components/ProcessingQueue.tsx
git commit -m "feat: add converting status indicator in ProcessingQueue"
```

---

## Self-Review

**Spec coverage:**
- ✅ `converting` 状态 → Task 1
- ✅ `addConvertingItem` / `addQueuedItem` → Task 2
- ✅ `recording-processed` 监听器改造 → Task 3
- ✅ App.tsx 停止录音接入 → Task 4
- ✅ App.tsx 音频导入接入 → Task 4
- ✅ `RECORDING_PLACEHOLDER` 共享常量 → Task 4
- ✅ ProcessingQueue `converting` UI → Task 5
- ✅ 幂等性 → Task 2 测试覆盖
- ✅ race condition（`ai-processing: queued` 早于前端插入）→ `addQueuedItem` 幂等 + `useJournal` 原有去重逻辑 (`prev.some(i => i.path === material_path)`)

**Placeholder scan:** 无 TBD / TODO

**Type consistency:**
- `RECORDING_PLACEHOLDER` 在 `useJournal.ts` 定义并 export，`App.tsx` import 使用 ✅
- `addConvertingItem(placeholderPath: string, filename: string)` 在 Task 2 定义，Task 4 调用参数一致 ✅
- `addQueuedItem(path: string, filename: string)` 同上 ✅
- `recording-processed` payload 类型 `{ filename: string; path: string }` 与 Rust emit 一致 ✅
