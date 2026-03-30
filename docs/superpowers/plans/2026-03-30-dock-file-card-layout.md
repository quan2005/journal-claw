# CommandDock File Card Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重新设计 CommandDock 的 files 模式：附件以大图标卡片形式显示在左侧，右侧是可扩展的文字备注区，备注与文件一起提交给 AI。

**Architecture:** 新建 `FileCard.tsx` 组件（竖向大图标，点击打开文件，hover 显示删除），修改 `CommandDock.tsx` 的 files 模式 UI 为左右分栏 + Inline 撑高展开，更新 `App.tsx` 的 `handleFilesSubmit` 支持可选 note 参数。

**Tech Stack:** React, TypeScript, Tauri v2, Vitest + @testing-library/react

---

## File Map

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/components/FileCard.tsx` | Create | 新大图标卡片组件，替代 files 模式中的 FileChip |
| `src/tests/FileCard.test.tsx` | Create | FileCard 单元测试 |
| `src/lib/tauri.ts` | Modify | 新增 `openFile` wrapper（复用已有 `open_with_system`） |
| `src/components/CommandDock.tsx` | Modify | files 模式改为左附件列 + 右文字区 + Inline 展开 |
| `src/App.tsx` | Modify | `handleFilesSubmit` 接收可选 `note`，有备注时先 importText |

---

## Task 1: 新增 openFile IPC wrapper

**Files:**
- Modify: `src/lib/tauri.ts`

`open_with_system` Rust 命令（`main.rs:17`）接收 `path: String` 并用 macOS `open` 打开。前端目前没有对应 wrapper。

- [ ] **Step 1: 在 `src/lib/tauri.ts` 末尾追加**

找到文件末尾（`setWorkspacePrompt` 函数之后），添加：

```typescript
export const openFile = (path: string): Promise<void> =>
  invoke('open_with_system', { path })
```

- [ ] **Step 2: 确认 TypeScript 编译通过**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -5
```

Expected: 零错误。

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts && git commit -m "feat: 新增 openFile wrapper，复用 open_with_system 命令"
```

---

## Task 2: 创建 FileCard 组件及测试

**Files:**
- Create: `src/components/FileCard.tsx`
- Create: `src/tests/FileCard.test.tsx`

FileCard 是竖向大图标卡片：48×52px 渐变色图标（按 kind），文件名截断显示，hover 时右上角显示 × 删除按钮，点击图标体调用 `onOpen`。

- [ ] **Step 1: 先写测试文件**

创建 `src/tests/FileCard.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileCard } from '../components/FileCard'

describe('FileCard', () => {
  const baseProps = {
    filename: 'meeting.pdf',
    kind: 'pdf' as const,
    onRemove: vi.fn(),
    onOpen: vi.fn(),
  }

  it('renders filename', () => {
    render(<FileCard {...baseProps} />)
    expect(screen.getByText('meeting.pdf')).toBeTruthy()
  })

  it('calls onOpen when icon is clicked', () => {
    const onOpen = vi.fn()
    render(<FileCard {...baseProps} onOpen={onOpen} />)
    // icon area has data-testid="file-card-icon"
    fireEvent.click(screen.getByTestId('file-card-icon'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn()
    render(<FileCard {...baseProps} onRemove={onRemove} />)
    fireEvent.click(screen.getByTestId('file-card-remove'))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('does not call onOpen when remove is clicked', () => {
    const onOpen = vi.fn()
    render(<FileCard {...baseProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('file-card-remove'))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败（FileCard 不存在）**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run src/tests/FileCard.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../components/FileCard'`

- [ ] **Step 3: 创建 `src/components/FileCard.tsx`**

```typescript
import type { FileKind } from '../lib/fileKind'

interface FileCardProps {
  filename: string
  kind: FileKind
  onRemove: () => void
  onOpen: () => void
}

function iconGradient(kind: FileKind): string {
  switch (kind) {
    case 'pdf':   return 'linear-gradient(160deg, #c63c3c 0%, #9e2828 100%)'
    case 'docx':  return 'linear-gradient(160deg, #3a6fd8 0%, #2756b0 100%)'
    case 'text':
    case 'markdown': return 'linear-gradient(160deg, #4a4a54 0%, #36363e 100%)'
    case 'audio': return 'linear-gradient(160deg, #a03ad8 0%, #7828b0 100%)'
    case 'image': return 'linear-gradient(160deg, #3aa87a 0%, #288a62 100%)'
    default:      return 'linear-gradient(160deg, #4a4a54 0%, #36363e 100%)'
  }
}

function iconEmoji(kind: FileKind): string {
  switch (kind) {
    case 'pdf':      return '📕'
    case 'docx':     return '📘'
    case 'text':     return '📄'
    case 'markdown': return '📝'
    case 'audio':    return '🎵'
    case 'image':    return '🖼'
    default:         return '📄'
  }
}

export function FileCard({ filename, kind, onRemove, onOpen }: FileCardProps) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        width: 60,
        padding: '6px 4px',
        borderRadius: 8,
        position: 'relative',
        flexShrink: 0,
      }}
      className="file-card-wrap"
    >
      {/* Icon — click opens file */}
      <div
        data-testid="file-card-icon"
        onClick={onOpen}
        style={{
          width: 48,
          height: 52,
          borderRadius: 9,
          background: iconGradient(kind),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        {iconEmoji(kind)}
        {ext && (
          <span style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: "'IBM Plex Mono', monospace",
            textTransform: 'uppercase',
            lineHeight: 1,
          }}>
            {ext}
          </span>
        )}
      </div>

      {/* Filename */}
      <span style={{
        fontSize: 9,
        color: 'var(--item-meta)',
        textAlign: 'center',
        maxWidth: 58,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
        userSelect: 'none',
      }}>
        {filename}
      </span>

      {/* Remove button — always rendered, hidden via CSS class */}
      <span
        data-testid="file-card-remove"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="file-card-remove"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#555',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          cursor: 'pointer',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        ×
      </span>
    </div>
  )
}
```

- [ ] **Step 4: 添加 hover CSS 到 `src/App.css`**

在 `src/App.css` 末尾追加：

```css
/* FileCard hover: show remove button, highlight icon */
.file-card-remove {
  opacity: 0;
  transition: opacity 0.15s;
}
.file-card-wrap:hover .file-card-remove {
  opacity: 1;
}
.file-card-wrap:hover {
  background: rgba(255, 255, 255, 0.06);
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run src/tests/FileCard.test.tsx 2>&1 | tail -10
```

Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add src/components/FileCard.tsx src/tests/FileCard.test.tsx src/App.css
git commit -m "feat: 新建 FileCard 大图标卡片组件，支持点击打开和 hover 删除"
```

---

## Task 3: 重写 CommandDock files 模式 UI

**Files:**
- Modify: `src/components/CommandDock.tsx`

这是核心 UI 改动。将 files 模式从"标题行 + chip 流"改为"左附件列（FileCard）+ 右文字区 + Inline 展开"。

新增两个 state：`noteText` 和 `textExpanded`。更新 `onFilesSubmit` 签名为 `(paths: string[], note?: string) => Promise<void>`。

- [ ] **Step 1: 更新 imports 和 CommandDockProps**

在 `src/components/CommandDock.tsx` 文件顶部，将：
```typescript
import { FileChip } from './FileChip'
import { fileKindFromName } from '../lib/fileKind'
```
替换为：
```typescript
import { FileCard } from './FileCard'
import { fileKindFromName } from '../lib/fileKind'
import { openFile } from '../lib/tauri'
```

将 `CommandDockProps` interface：
```typescript
interface CommandDockProps {
  isDragOver: boolean
  pendingFiles: string[]
  onPasteSubmit: (text: string) => Promise<void>
  onFilesSubmit: (paths: string[]) => Promise<void>
  onFilesCancel: () => void
  onRemoveFile: (index: number) => void
  onPasteFiles: (paths: string[]) => void
  recorderStatus: RecorderStatus
  onRecord: () => void
}
```
替换为：
```typescript
interface CommandDockProps {
  isDragOver: boolean
  pendingFiles: string[]
  onPasteSubmit: (text: string) => Promise<void>
  onFilesSubmit: (paths: string[], note?: string) => Promise<void>
  onFilesCancel: () => void
  onRemoveFile: (index: number) => void
  onPasteFiles: (paths: string[]) => void
  recorderStatus: RecorderStatus
  onRecord: () => void
}
```

- [ ] **Step 2: 新增 state 和 ref**

在组件函数内，在现有 state 声明后追加：
```typescript
const [noteText, setNoteText] = useState('')
const [textExpanded, setTextExpanded] = useState(false)
const noteRef = useRef<HTMLTextAreaElement>(null)
```

- [ ] **Step 3: 更新 exitPaste 和取消逻辑**

找到 `function exitPaste()` 函数：
```typescript
function exitPaste() {
  setPasteMode(false)
  setPasteText('')
}
```
保持不变。在 `handleFilesSubmitClick` 函数中，找到：
```typescript
async function handleFilesSubmitClick() {
  const paths = [...pendingFiles]
  onFilesCancel()
  showToast('已提交，Agent 整理中…')
  try {
    await onFilesSubmit(paths)
  } catch (err) {
    console.error('[files-submit]', err)
    showToast('提交失败')
  }
}
```
替换为：
```typescript
async function handleFilesSubmitClick() {
  const paths = [...pendingFiles]
  const note = noteText.trim() || undefined
  onFilesCancel()
  setNoteText('')
  setTextExpanded(false)
  showToast('已提交，Agent 整理中…')
  try {
    await onFilesSubmit(paths, note)
  } catch (err) {
    console.error('[files-submit]', err)
    showToast('提交失败')
  }
}
```

找到 `onFilesCancel` 在键盘监听中的调用（Escape 处理）：
```typescript
if (hasFiles) { onFilesCancel(); return }
```
替换为：
```typescript
if (hasFiles) { onFilesCancel(); setNoteText(''); setTextExpanded(false); return }
```

- [ ] **Step 4: 替换 files 模式 JSX**

找到整个 `{/* Files preview mode */}` 块（从 `{activeMode === 'files' && (` 开始到对应的 `)}` 结束）：

```typescript
        {/* Files preview mode */}
        {activeMode === 'files' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 12px',
            minHeight: 46,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 10,
                color: 'var(--dock-paste-label)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
              }}>
                待导入文件
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); onFilesCancel() }} style={actionBtnCancel}>
                  取消
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleFilesSubmitClick() }} style={actionBtnSubmit}>
                  提交 Agent 整理 ↗
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pendingFiles.map((path, i) => {
                const filename = path.split('/').pop() ?? path
                return (
                  <FileChip
                    key={`${path}-${i}`}
                    filename={filename}
                    kind={fileKindFromName(filename)}
                    onRemove={() => onRemoveFile(i)}
                  />
                )
              })}
            </div>
          </div>
        )}
```

替换为：

```typescript
        {/* Files + Note mode */}
        {activeMode === 'files' && (
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            minHeight: textExpanded ? 180 : 84,
            transition: 'min-height 0.2s ease',
          }}>
            {/* Left: attachment cards */}
            <div style={{
              padding: '12px 12px 12px 14px',
              display: 'flex',
              flexDirection: 'row',
              gap: 10,
              flexWrap: 'wrap',
              alignContent: 'flex-start',
              alignItems: 'flex-start',
              flexShrink: 0,
            }}>
              {pendingFiles.map((path, i) => {
                const filename = path.split('/').pop() ?? path
                return (
                  <FileCard
                    key={`${path}-${i}`}
                    filename={filename}
                    kind={fileKindFromName(filename)}
                    onRemove={() => onRemoveFile(i)}
                    onOpen={() => openFile(path).catch(err => console.error('[open-file]', err))}
                  />
                )
              })}
            </div>

            {/* Vertical divider */}
            <div style={{ width: 1, background: 'var(--dock-border)', flexShrink: 0, alignSelf: 'stretch' }} />

            {/* Right: note textarea */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '10px 12px',
              minWidth: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{
                  fontSize: 10,
                  color: 'var(--dock-paste-label)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                }}>
                  备注（可选）
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); onFilesCancel(); setNoteText(''); setTextExpanded(false) }} style={actionBtnCancel}>
                    取消
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleFilesSubmitClick() }} style={actionBtnSubmit}>
                    提交 Agent 整理 ↗
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, marginTop: 7, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <textarea
                  ref={noteRef}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      handleFilesSubmitClick()
                    }
                  }}
                  placeholder="添加背景说明…"
                  className="dock-textarea"
                  style={{
                    flex: 1,
                    width: '100%',
                    background: textExpanded ? 'var(--dock-paste-bg)' : 'transparent',
                    border: textExpanded ? '0.5px solid var(--dock-paste-border)' : 'none',
                    borderRadius: textExpanded ? 6 : 0,
                    padding: textExpanded ? '6px 8px' : 0,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    color: 'var(--item-text)',
                    lineHeight: 1.6,
                    caretColor: 'var(--dock-paste-label)',
                    minHeight: 20,
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    transition: 'background 0.15s, border 0.15s, padding 0.15s',
                  } as React.CSSProperties}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setTextExpanded(v => !v) }}
                  title={textExpanded ? '收起' : '放大'}
                  style={{
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    borderRadius: 4,
                    background: 'var(--dock-kbd-bg)',
                    border: '0.5px solid var(--dock-kbd-border)',
                    color: 'var(--item-meta)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    cursor: 'pointer',
                    marginTop: 2,
                    flexDirection: 'column' as const,
                  }}
                >
                  {textExpanded ? '⤡' : '⤢'}
                </button>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 5: 确认 TypeScript 编译**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -15
```

Expected: 只有 `onFilesSubmit` 参数不匹配的 TS 错误（在 `App.tsx`，Task 4 修复）。无其他错误。

- [ ] **Step 6: Commit**

```bash
git add src/components/CommandDock.tsx
git commit -m "feat: CommandDock files 模式改为大图标左列 + 文字备注右列 + Inline 展开"
```

---

## Task 4: App.tsx 更新 handleFilesSubmit 支持 note

**Files:**
- Modify: `src/App.tsx`

`handleFilesSubmit` 需接收可选 `note`：有 note 时先调用 `importText(note)` 生成 paste 文件，追加到 paths 末尾，再逐一触发 AI 处理。

- [ ] **Step 1: 更新 import**

找到 `App.tsx` 第 11 行：
```typescript
import { importFile, triggerAiProcessing, submitPasteText } from './lib/tauri'
```
替换为：
```typescript
import { importFile, triggerAiProcessing, submitPasteText, importText } from './lib/tauri'
```

- [ ] **Step 2: 更新 handleFilesSubmit**

找到：
```typescript
  const handleFilesSubmit = async (paths: string[]) => {
    setPendingFiles([])
    for (const path of paths) {
      try {
        const result = await importFile(path)
        await triggerAiProcessing(result.path, result.year_month)
      } catch (err) {
        console.error('[file-submit] error:', String(err), 'path:', path)
      }
    }
    refresh()
  }
```

替换为：
```typescript
  const handleFilesSubmit = async (paths: string[], note?: string) => {
    setPendingFiles([])
    const allPaths = [...paths]
    if (note) {
      try {
        const noteResult = await importText(note)
        allPaths.push(noteResult.path)
      } catch (err) {
        console.error('[note-import] error:', String(err))
      }
    }
    for (const path of allPaths) {
      try {
        const result = await importFile(path)
        await triggerAiProcessing(result.path, result.year_month)
      } catch (err) {
        console.error('[file-submit] error:', String(err), 'path:', path)
      }
    }
    refresh()
  }
```

- [ ] **Step 3: 确认 TypeScript 编译通过（零错误）**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -5
```

Expected: 零错误，零警告。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: handleFilesSubmit 支持可选 note 备注，追加为 paste 文件一起提交"
```

---

## Task 5: 手动验收测试

- [ ] **启动开发服务器**

```bash
cd /Users/yanwu/Projects/github/journal && npm run tauri dev
```

- [ ] **测试 1: 粘贴长文本 → files 模式布局**

1. 复制 100+ 字符文本，按 ⌘V
2. 期望：左侧显示 `paste-YYYYMMDD-HHmmss.txt` 的大图标卡片（灰色渐变），右侧可输入备注

- [ ] **测试 2: 附件图标点击**

1. 在 files 模式中点击图标卡片
2. 期望：系统用对应应用打开文件（txt 用文本编辑器，pdf 用预览）

- [ ] **测试 3: hover 删除**

1. hover 文件卡片
2. 期望：右上角出现 × 按钮
3. 点击 ×
4. 期望：该附件从列表移除

- [ ] **测试 4: 放大 / 收起**

1. 点击 ⤢ 按钮
2. 期望：dock 高度从 ~84px 撑高到 ~180px（有 transition 动画），textarea 出现背景色和边框
3. 点击 ⤡
4. 期望：dock 收回 84px

- [ ] **测试 5: 无备注提交**

1. 粘贴文件，不输入备注，⌘↵ 或点提交
2. 期望：只提交文件，`raw/` 目录只有原文件，AI 正常处理

- [ ] **测试 6: 有备注提交**

1. 粘贴文件，输入备注文字，⌘↵ 提交
2. 期望：`raw/` 目录出现原文件 + 一个新的 `paste-*.txt`，两者都被 AI 处理

- [ ] **测试 7: 原粘贴面板不受影响**

1. 复制短文本（< 100 字），按 ⌘V
2. 期望：仍然展开原粘贴文本面板（无文件的 paste 模式），行为与之前一致

- [ ] **测试 8: 运行全部单元测试**

```bash
cd /Users/yanwu/Projects/github/journal && npm test 2>&1 | tail -10
```

Expected: 所有测试通过（含新增的 FileCard 测试）

- [ ] **Final Commit**

```bash
git add -A && git commit -m "chore: CommandDock 附件大图标布局功能完成"
```
