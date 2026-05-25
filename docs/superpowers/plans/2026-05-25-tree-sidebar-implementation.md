# 左栏树形结构重构 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将左栏从 SidebarTabs 三标签切换模式重构为统一树形层级结构（置顶/画像/流水/专题四分区）。

**Architecture:** TreeSidebar 作为容器管理四分区折叠状态和选中项。TreeItem 统一渲染不同类型的树节点（画像/日志/文件）。数据通过现有 hooks（useJournal, useIdentity）和新增 hooks（useTopics, usePinned）驱动。后端新增 topics 目录管理和置顶持久化命令。

**Tech Stack:** React 19 + TypeScript + Tauri v2 (Rust)

---

### Task 1: 新增类型定义

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: 添加树节点类型**

```typescript
// 在 src/types.ts 末尾追加

/** 树节点类型 */
export type TreeNodeType = 'pinned-section' | 'identity' | 'journal' | 'journal-month' | 'topic' | 'topic-file'

/** 树中选中项的标识 —— 由 (type, path) 唯一确定 */
export interface TreeSelection {
  type: TreeNodeType
  path: string
}

/** 置顶条目 */
export interface PinnedItem {
  type: 'journal' | 'identity'
  path: string // workspace-relative path
  order: number
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```
Expected: 无新增报错。

---

### Task 2: 后端 — 置顶持久化

**Files:**
- Create: `src-tauri/src/pinned.rs`
- Modify: `src-tauri/src/main.rs` (register commands)
- Modify: `src-tauri/src/config.rs` (PinnedConfig 读写)

- [ ] **Step 1: 在 config.rs 添加 pinned 字段**

Read `src-tauri/src/config.rs` 找到 `WorkspaceSettings` 结构体，确认其路径。查找现有结构：

```bash
grep -n 'struct.*Settings\|settings.json\|pinned' src-tauri/src/config.rs src-tauri/src/workspace_settings.rs
```

- [ ] **Step 2: 在 workspace_settings.rs 添加 pinned 读写**

```rust
// 在 src-tauri/src/workspace_settings.rs 追加

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PinnedItem {
    #[serde(rename = "type")]
    pub item_type: String, // "journal" | "identity"
    pub path: String,
    pub order: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceSettingsFull {
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub pinned: Vec<PinnedItem>,
    // ... other existing fields
}

#[tauri::command]
pub fn get_pinned_items(app: tauri::AppHandle) -> Result<Vec<PinnedItem>, String> {
    let ws = crate::config::get_workspace_path(&app)?;
    let settings = read_settings(&ws)?;
    Ok(settings.pinned)
}

#[tauri::command]
pub fn set_pinned_items(app: tauri::AppHandle, items: Vec<PinnedItem>) -> Result<(), String> {
    let ws = crate::config::get_workspace_path(&app)?;
    let mut settings = read_settings(&ws)?;
    settings.pinned = items;
    write_settings(&ws, &settings)
}
```

- [ ] **Step 3: 在 main.rs 注册命令**

在 `invoke_handler![]` 中添加：
```rust
workspace_settings::get_pinned_items,
workspace_settings::set_pinned_items,
```

- [ ] **Step 4: 编译检查**

```bash
cd src-tauri && cargo check 2>&1 | tail -20
```
Expected: 编译通过或仅 warnings。

---

### Task 3: 后端 — topics 目录管理

**Files:**
- Create: `src-tauri/src/topics.rs`
- Modify: `src-tauri/src/main.rs` (register commands + mod)

- [ ] **Step 1: 创建 topics.rs**

```rust
// src-tauri/src/topics.rs
use crate::workspace;
use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct TopicEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String, // workspace-relative
    pub mtime_secs: i64,
}

fn topics_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let ws = crate::config::get_workspace_path(app)?;
    Ok(PathBuf::from(&ws).join("topics"))
}

#[tauri::command]
pub fn list_topics_dir(app: AppHandle, relative_path: String) -> Result<Vec<TopicEntry>, String> {
    let base = topics_dir(&app)?;
    let dir = if relative_path.is_empty() {
        base
    } else {
        base.join(&relative_path)
    };

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建 topics 目录失败: {}", e))?;
        return Ok(vec![]);
    }

    let mut entries: Vec<TopicEntry> = vec![];
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let full = entry.path();
        let rel = if relative_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", relative_path, name)
        };
        let mtime = entry.metadata().ok().and_then(|m| m.modified().ok())
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
            .unwrap_or(0);
        entries.push(TopicEntry { name, is_dir, path: rel, mtime_secs: mtime });
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(entries)
}

#[tauri::command]
pub fn create_topic(app: AppHandle, name: String, parent_path: Option<String>) -> Result<(), String> {
    let base = topics_dir(&app)?;
    let dir = if let Some(p) = parent_path {
        base.join(&p).join(&name)
    } else {
        base.join(&name)
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建专题失败: {}", e))
}

#[tauri::command]
pub fn delete_topic(app: AppHandle, relative_path: String) -> Result<(), String> {
    let full = topics_dir(&app)?.join(&relative_path);
    if full.is_dir() {
        std::fs::remove_dir_all(&full).map_err(|e| format!("删除专题失败: {}", e))
    } else {
        std::fs::remove_file(&full).map_err(|e| format!("删除文件失败: {}", e))
    }
}

#[tauri::command]
pub fn import_file_to_topic(app: AppHandle, source: String, topic_path: String) -> Result<String, String> {
    let base = topics_dir(&app)?;
    let dest_dir = base.join(&topic_path);
    std::fs::create_dir_all(&dest_dir).map_err(|e| format!("创建目录失败: {}", e))?;
    let src = PathBuf::from(&source);
    let fname = src.file_name().ok_or("无效文件名")?.to_string_lossy().to_string();
    let dest = dest_dir.join(&fname);
    std::fs::copy(&src, &dest).map_err(|e| format!("复制文件失败: {}", e))?;
    Ok(format!("{}/{}", topic_path, fname))
}
```

- [ ] **Step 2: 在 main.rs 注册**

```rust
// 在 main.rs 顶部添加:
mod topics;

// 在 invoke_handler![] 中添加:
topics::list_topics_dir,
topics::create_topic,
topics::delete_topic,
topics::import_file_to_topic,
```

- [ ] **Step 3: 编译检查**

```bash
cd src-tauri && cargo check 2>&1 | tail -20
```

---

### Task 4: 前端 — tauri.ts IPC 封装

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 添加 topics 和 pinned 的 IPC 封装**

```typescript
// 在 src/lib/tauri.ts 末尾追加

// ── Topics ────────────────────────────────────────────────
export interface TopicEntry {
  name: string
  is_dir: boolean
  path: string
  mtime_secs: number
}

export const listTopicsDir = (relativePath: string): Promise<TopicEntry[]> =>
  invoke<TopicEntry[]>('list_topics_dir', { relativePath })

export const createTopic = (name: string, parentPath?: string): Promise<void> =>
  invoke<void>('create_topic', { name, parentPath: parentPath ?? null })

export const deleteTopic = (relativePath: string): Promise<void> =>
  invoke<void>('delete_topic', { relativePath })

export const importFileToTopic = (source: string, topicPath: string): Promise<string> =>
  invoke<string>('import_file_to_topic', { source, topicPath })

// ── Pinned ─────────────────────────────────────────────────
export interface PinnedItem {
  type: 'journal' | 'identity'
  path: string
  order: number
}

export const getPinnedItems = (): Promise<PinnedItem[]> =>
  invoke<PinnedItem[]>('get_pinned_items')

export const setPinnedItems = (items: PinnedItem[]): Promise<void> =>
  invoke<void>('set_pinned_items', { items })
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 5: usePinned hook

**Files:**
- Create: `src/hooks/usePinned.ts`

- [ ] **Step 1: 创建 hook**

```typescript
// src/hooks/usePinned.ts
import { useState, useEffect, useCallback } from 'react'
import { getPinnedItems, setPinnedItems, type PinnedItem } from '../lib/tauri'

export function usePinned() {
  const [items, setItems] = useState<PinnedItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const list = await getPinnedItems()
      setItems(list.sort((a, b) => a.order - b.order))
    } catch (e) {
      console.error('[usePinned] refresh failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const pin = useCallback(async (itemType: 'journal' | 'identity', path: string) => {
    const updated = [...items, { type: itemType, path, order: items.length }]
    await setPinnedItems(updated)
    setItems(updated)
  }, [items])

  const unpin = useCallback(async (path: string) => {
    const updated = items.filter(i => i.path !== path).map((item, i) => ({ ...item, order: i }))
    await setPinnedItems(updated)
    setItems(updated)
  }, [items])

  const reorder = useCallback(async (fromIndex: number, toIndex: number) => {
    const updated = [...items]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    const reordered = updated.map((item, i) => ({ ...item, order: i }))
    await setPinnedItems(reordered)
    setItems(reordered)
  }, [items])

  return { items, loading, pin, unpin, reorder, refresh }
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 6: useTopics hook

**Files:**
- Create: `src/hooks/useTopics.ts`

- [ ] **Step 1: 创建 hook**

```typescript
// src/hooks/useTopics.ts
import { useState, useCallback } from 'react'
import { listTopicsDir, type TopicEntry } from '../lib/tauri'

interface DirState {
  entries: TopicEntry[]
  expanded: boolean
  loading: boolean
}

export function useTopics() {
  const [dirs, setDirs] = useState<Map<string, DirState>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await listTopicsDir('')
      setDirs(new Map([['', { entries, expanded: true, loading: false }]]))
    } catch (e) {
      console.error('[useTopics] load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleDir = useCallback(async (path: string) => {
    const current = dirs.get(path)
    if (current) {
      setDirs(prev => {
        const next = new Map(prev)
        next.set(path, { ...current, expanded: !current.expanded })
        return next
      })
    } else {
      setDirs(prev => {
        const next = new Map(prev)
        next.set(path, { entries: [], expanded: true, loading: true })
        return next
      })
      try {
        const entries = await listTopicsDir(path)
        setDirs(prev => {
          const next = new Map(prev)
          next.set(path, { entries, expanded: true, loading: false })
          return next
        })
      } catch (e) {
        console.error('[useTopics] toggleDir failed:', e)
      }
    }
  }, [dirs])

  return { dirs, loading, load, toggleDir }
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 7: TreeItem 组件

**Files:**
- Create: `src/components/TreeItem.tsx`

- [ ] **Step 1: 创建统一树节点组件**

```typescript
// src/components/TreeItem.tsx
import type { TreeNodeType } from '../types'
import type { JournalEntry, IdentityEntry } from '../types'
import type { TopicEntry } from '../lib/tauri'

interface TreeItemProps {
  itemType: 'identity' | 'journal' | 'topic-file'
  identity?: IdentityEntry
  entry?: JournalEntry
  topicEntry?: TopicEntry
  indent?: number
  isToday?: boolean
  isSelected: boolean
  onClick: () => void
  onAt?: () => void
  onMore?: (x: number, y: number) => void
}

export function TreeItem({
  itemType, identity, entry, topicEntry, indent = 0,
  isToday, isSelected, onClick, onAt, onMore,
}: TreeItemProps) {
  const style = {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: itemType === 'topic-file' ? '5px 8px' : '8px 8px',
    paddingLeft: 8 + indent * 16,
    borderRadius: 6,
    cursor: 'pointer',
    background: isSelected ? 'var(--tree-selected-bg, rgba(200,147,59,0.10))' : 'transparent',
    borderLeft: isSelected ? '2px solid var(--accent, #C8933B)' : '2px solid transparent',
    transition: 'background 0.1s',
  }

  return (
    <div
      style={style}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onMore?.(e.clientX, e.clientY) }}
    >
      {/* Header row: block + name/title + tags + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Identity avatar or Journal date block or File icon */}
        {itemType === 'identity' && identity && (
          <div style={{
            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: '#fff',
            background: identity.name.charCodeAt(0) % 2 === 0 ? '#8b7355' : '#6b8e6b',
          }}>
            {identity.name.charAt(0)}
          </div>
        )}
        {itemType === 'journal' && entry && (
          <div style={{
            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600,
            background: isToday ? 'rgba(200,147,59,0.12)' : 'rgba(128,128,128,0.10)',
            color: isToday ? 'var(--accent, #C8933B)' : 'var(--text-tertiary, #5c5852)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {entry.day}
          </div>
        )}
        {itemType === 'topic-file' && topicEntry && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.5 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        )}

        {/* Name / Title + inline tags */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span style={{
            fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
            color: isSelected ? 'var(--accent, #C8933B)' : 'var(--text, #e6ded4)',
          }}>
            {itemType === 'identity' ? identity?.name : itemType === 'journal' ? entry?.title : topicEntry?.name}
          </span>
          {/* Inline tags */}
          {itemType !== 'topic-file' && (
            <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
              {(itemType === 'identity' ? identity?.tags.slice(0, 3) : entry?.tags.slice(0, 3))?.map((tag, i) => (
                <span key={i} style={{
                  fontSize: '0.6875rem', padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(128,128,128,0.08)', color: 'var(--text-secondary, #a0988c)',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{typeof tag === 'string' ? tag : (tag as {label:string}).label}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions: @ and … */}
        <div className="tree-item-actions" style={{
          display: 'flex', gap: 2, flexShrink: 0,
          width: 0, overflow: 'hidden', opacity: 0,
          transition: 'width 0.15s ease-out, opacity 0.12s',
        }}>
          <button onClick={(e) => { e.stopPropagation(); onAt?.() }} style={actionBtnStyle}>@</button>
          <button onClick={(e) => { e.stopPropagation(); onMore?.(e.clientX, e.clientY) }} style={actionBtnStyle}>…</button>
        </div>
      </div>

      {/* Description (identity/journal only) */}
      {(itemType === 'identity' || itemType === 'journal') && (identity?.summary || entry?.summary) && (
        <div style={{
          fontSize: '0.75rem', color: isSelected ? 'rgba(200,147,59,0.5)' : 'var(--text-secondary, #a0988c)',
          lineHeight: 1.5, marginTop: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {itemType === 'identity' ? identity?.summary : entry?.summary}
        </div>
      )}
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 4, cursor: 'pointer', color: 'var(--text-tertiary, #5c5852)',
  background: 'transparent', border: 'none',
  fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
}
```

- [ ] **Step 2: 添加 hover 展开行为的 CSS**

在全局 CSS 文件或 TreeSidebar 中注入：

```css
.tree-item-row:hover .tree-item-actions {
  width: 48px !important;
  opacity: 1 !important;
}
```

由于 inline style 无法处理 `:hover` 伪类，此行为通过 JS mouseEnter/mouseLeave 或 CSS 类实现。将 TreeItem 的 actions 容器改为使用 className `tree-item-actions`，并在 TreeSidebar.css 中添加上述规则。

---

### Task 8: MonthDivider 组件

**Files:**
- Create: `src/components/MonthDivider.tsx`

- [ ] **Step 1: 创建月份分割线**

```typescript
// src/components/MonthDivider.tsx

interface MonthDividerProps {
  label: string
}

const MONTH_NAMES: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月',
  '05': '5月', '06': '6月', '07': '7月', '08': '8月',
  '09': '9月', '10': '10月', '11': '11月', '12': '12月',
}

export function MonthDivider({ label }: MonthDividerProps) {
  // label format: "2605" -> "2026年5月"
  const year = `20${label.slice(0, 2)}`
  const month = MONTH_NAMES[label.slice(2)] ?? label.slice(2) + '月'
  const display = `${year}年${month}`

  return (
    <div style={{
      padding: '14px 8px 6px',
      fontSize: '0.6875rem',
      fontWeight: 600,
      color: 'var(--text-tertiary, #5c5852)',
      letterSpacing: '0.04em',
    }}>
      {display}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 9: TopicTree 组件

**Files:**
- Create: `src/components/TopicTree.tsx`

- [ ] **Step 1: 创建递归专题树**

```typescript
// src/components/TopicTree.tsx
import { type TopicEntry } from '../lib/tauri'

interface TopicTreeProps {
  entries: TopicEntry[]
  dirs: Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }>
  selectedPath: string | null
  indent?: number
  onToggleDir: (path: string) => void
  onSelectFile: (entry: TopicEntry) => void
  onAt: (path: string) => void
  onMore: (entry: TopicEntry, x: number, y: number) => void
}

export function TopicTree({
  entries, dirs, selectedPath, indent = 0,
  onToggleDir, onSelectFile, onAt, onMore,
}: TopicTreeProps) {
  return entries.map((entry) => {
    const isDir = entry.is_dir
    const childState = dirs.get(entry.path)
    const isExpanded = childState?.expanded ?? false
    const isLoading = childState?.loading ?? false
    const isSelected = entry.path === selectedPath
    const rowIndent = 8 + indent * 16

    return (
      <div key={entry.path}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: `5px 4px 5px ${rowIndent}px`,
            borderRadius: 6, cursor: 'pointer',
            fontSize: '0.8125rem', whiteSpace: 'nowrap',
            background: isSelected ? 'var(--tree-selected-bg, rgba(200,147,59,0.10))' : 'transparent',
            color: isSelected ? 'var(--accent, #C8933B)' : 'var(--text, #e6ded4)',
          }}
          onClick={() => isDir ? onToggleDir(entry.path) : onSelectFile(entry)}
        >
          {/* Chevron or gap */}
          {isDir ? (
            <span style={{
              width: 10, height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s', color: 'var(--text-tertiary)',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          ) : <span style={{ width: 10, flexShrink: 0 }} />}

          {/* Folder/File icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, opacity: 0.5 }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>

          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>

          {/* Actions */}
          <div className="tree-item-actions" style={{
            display: 'flex', gap: 2, flexShrink: 0,
            width: 0, overflow: 'hidden', opacity: 0,
          }}>
            <button onClick={(e) => { e.stopPropagation(); onAt(entry.path) }} style={actBtn}>@</button>
            <button onClick={(e) => { e.stopPropagation(); onMore(entry, e.clientX, e.clientY) }} style={actBtn}>…</button>
          </div>
        </div>

        {/* Recursive children */}
        {isDir && isExpanded && childState && (
          isLoading ? (
            <div style={{ paddingLeft: rowIndent + 20, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>加载中…</div>
          ) : (
            <TopicTree
              entries={childState.entries}
              dirs={dirs}
              selectedPath={selectedPath}
              indent={indent + 1}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onAt={onAt}
              onMore={onMore}
            />
          )
        )}
      </div>
    )
  })
}

const actBtn: React.CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 4, cursor: 'pointer', color: 'var(--text-tertiary)',
  background: 'transparent', border: 'none',
  fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 10: TreeSidebar 容器组件

**Files:**
- Create: `src/components/TreeSidebar.tsx`

- [ ] **Step 1: 创建 TreeSidebar**

```typescript
// src/components/TreeSidebar.tsx
import { useState, useCallback, useEffect } from 'react'
import type { JournalEntry, IdentityEntry, TreeSelection } from '../types'
import type { TopicEntry, PinnedItem } from '../lib/tauri'
import { MonthDivider } from './MonthDivider'
import { TreeItem } from './TreeItem'
import { TopicTree } from './TopicTree'
import { useJournal } from '../hooks/useJournal'
import { useIdentity } from '../hooks/useIdentity'
import { useTopics } from '../hooks/useTopics'
import { usePinned } from '../hooks/usePinned'
import { openFile } from '../lib/tauri'

interface TreeSidebarProps {
  selected: TreeSelection | null
  onSelect: (sel: TreeSelection) => void
  onDeselect: () => void
  entries: JournalEntry[]
  identities: IdentityEntry[]
  identityLoading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onAtRef: (path: string) => void
  todayYearMonth: string
  todayDay: number
}

type SectionKey = 'pinned' | 'identities' | 'journal' | 'topics'

export function TreeSidebar({
  selected, onSelect, onDeselect,
  entries, identities, identityLoading,
  loadingMore, hasMore, onLoadMore, onAtRef,
  todayYearMonth, todayDay,
}: TreeSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    pinned: false, identities: false, journal: false, topics: false,
  })
  const { items: pinnedItems, unpin } = usePinned()
  const { dirs, load: loadTopics, toggleDir: toggleTopicDir } = useTopics()

  useEffect(() => { loadTopics() }, [loadTopics])

  const toggleSection = (key: SectionKey) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isToday = (entry: JournalEntry) =>
    entry.year_month === todayYearMonth && entry.day === todayDay

  const handleSelect = (type: TreeSelection['type'], path: string) => {
    if (selected?.type === type && selected?.path === path) {
      onDeselect()
    } else {
      onSelect({ type, path })
    }
  }

  // Group journal entries by month
  const monthGroups = new Map<string, JournalEntry[]>()
  for (const e of entries) {
    const list = monthGroups.get(e.year_month) ?? []
    list.push(e)
    monthGroups.set(e.year_month, list)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {/* ── 置顶 ── */}
        <div style={{ background: 'rgba(200,147,59,0.03)', borderRadius: 8, padding: '4px 0 6px', marginBottom: 6 }}>
          <SectionHeader
            collapsed={collapsed.pinned}
            onToggle={() => toggleSection('pinned')}
            label="置顶"
            count={pinnedItems.length}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="20" x2="12" y2="8"/><line x1="18" y1="14" x2="12" y2="8"/><line x1="12" y1="8" x2="12" y2="2"/>
              </svg>
            }
          />
          {!collapsed.pinned && pinnedItems.map((pinned) => {
            if (pinned.type === 'journal') {
              const entry = entries.find(e => `${e.year_month}/${e.filename}` === pinned.path)
              if (!entry) return null
              return (
                <TreeItem key={pinned.path} itemType="journal" entry={entry}
                  isToday={isToday(entry)}
                  isSelected={selected?.path === pinned.path}
                  onClick={() => handleSelect('journal', pinned.path)}
                  onAt={() => onAtRef(pinned.path)}
                />
              )
            }
            if (pinned.type === 'identity') {
              const iden = identities.find(i => i.path === pinned.path || `identities/${i.filename}` === pinned.path)
              if (!iden) return null
              return (
                <TreeItem key={pinned.path} itemType="identity" identity={iden}
                  isSelected={selected?.path === pinned.path}
                  onClick={() => handleSelect('identity', pinned.path)}
                  onAt={() => onAtRef(pinned.path)}
                />
              )
            }
            return null
          })}
        </div>

        {/* ── 画像 ── */}
        <SectionHeader
          collapsed={collapsed.identities}
          onToggle={() => toggleSection('identities')}
          label="画像"
          count={identities.length}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          }
        />
        {!collapsed.identities && identities.map((iden) => (
          <TreeItem key={iden.path} itemType="identity" identity={iden}
            isSelected={selected?.type === 'identity' && selected?.path === iden.path}
            onClick={() => handleSelect('identity', iden.path)}
            onAt={() => onAtRef(`identities/${iden.filename}`)}
          />
        ))}

        {/* ── 流水 ── */}
        <SectionHeader
          collapsed={collapsed.journal}
          onToggle={() => toggleSection('journal')}
          label="流水"
          count={`${entries.length}`}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
        {!collapsed.journal && (
          <>
            {[...monthGroups.entries()].map(([ym, monthEntries]) => (
              <div key={ym}>
                <MonthDivider label={ym} />
                {monthEntries.map((entry) => (
                  <TreeItem key={entry.path} itemType="journal" entry={entry}
                    isToday={isToday(entry)}
                    isSelected={selected?.type === 'journal' && selected?.path === `${entry.year_month}/${entry.filename}`}
                    onClick={() => handleSelect('journal', `${entry.year_month}/${entry.filename}`)}
                    onAt={() => onAtRef(`${entry.year_month}/${entry.filename}`)}
                  />
                ))}
              </div>
            ))}
            {hasMore && (
              <div onClick={onLoadMore} style={{
                padding: '8px 8px', fontSize: '0.75rem', color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}>
                {loadingMore ? '加载中…' : `加载更多（已显示 ${entries.length} 条）`}
              </div>
            )}
          </>
        )}

        {/* ── 专题 ── */}
        <SectionHeader
          collapsed={collapsed.topics}
          onToggle={() => toggleSection('topics')}
          label="专题"
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          }
        />
        {!collapsed.topics && (
          <TopicTree
            entries={dirs.get('')?.entries ?? []}
            dirs={dirs}
            selectedPath={selected?.type === 'topic-file' ? selected?.path : null}
            onToggleDir={toggleTopicDir}
            onSelectFile={(entry) => {
              handleSelect('topic-file', entry.path)
              if (!entry.is_dir) openFile(entry.path).catch(console.error)
            }}
            onAt={(path) => onAtRef(`topics/${path}`)}
            onMore={(entry, x, y) => { /* context menu */ }}
          />
        )}
      </div>
    </div>
  )
}

// ── SectionHeader ──
function SectionHeader({ collapsed, onToggle, label, count, icon }: {
  collapsed: boolean
  onToggle: () => void
  label: string
  count?: number | string
  icon: React.ReactNode
}) {
  return (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '12px 6px 8px', cursor: 'pointer',
    }}>
      <span style={{
        width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'transform 0.15s ease-out',
        transform: collapsed ? 'rotate(-90deg)' : 'none',
        color: 'var(--text-tertiary)',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
      <span style={{ opacity: 0.55 }}>{icon}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>{count}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 11: App.tsx 集成

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 替换左侧栏渲染逻辑**

将 App.tsx 中第 670–801 行（左侧栏 `<div>` 及 `SidebarTabs` + 三个 `display:none` 条件渲染区域）替换为 `TreeSidebar` 组件调用。

具体操作：
1. 移除 `import { SidebarTabs, type SidebarTab }` 
2. 移除 `import { IdentityList, SOUL_PATH }`
3. 移除 `import { FileTree }`
4. 新增 `import { TreeSidebar } from './components/TreeSidebar'`
5. 新增 `import type { TreeSelection } from './types'`
6. 移除 `const [sidebarTab, setSidebarTab] = useState<SidebarTab>('journal')`
7. 替换为 `const [treeSelection, setTreeSelection] = useState<TreeSelection | null>(null)`
8. 移除 `const [selectedFile, setSelectedFile] = useState<WorkspaceDirEntry | null>(null)`
9. 移除 `handleTabChange`
10. 左侧栏区域替换为：

```tsx
{/* Left: Tree Sidebar */}
<div
  style={{
    width: baseWidth,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '0.5px solid var(--divider)',
  }}
>
  <TreeSidebar
    selected={treeSelection}
    onSelect={setTreeSelection}
    onDeselect={() => setTreeSelection(null)}
    entries={entries}
    identities={allIdentities}
    identityLoading={identityLoading}
    loadingMore={loadingMore}
    hasMore={hasMore}
    onLoadMore={loadMore}
    onAtRef={(path) => {
      setRightPanelOpen(true)
      setRightPanelTab('chat')
      window.dispatchEvent(new CustomEvent('chat-append-text', { detail: `@${path}` }))
    }}
    todayYearMonth={/* 当前年月，格式 "2605" */ }
    todayDay={/* 当前日，如 25 */}
  />
  {/* Settings button */}
  {view !== 'settings' && (
    <div style={{ borderTop: '0.5px solid var(--divider)', flexShrink: 0, padding: '6px 10px' }}>
      <button onClick={() => setView('settings')} style={{ /* 保持原样 */ }}>...</button>
    </div>
  )}
</div>
```

11. 中栏区域：根据 `treeSelection.type` 切换显示 `DetailPanel` / `IdentityDetail` / `FilePreviewPanel`，不再依赖 `sidebarTab`。

```tsx
{/* Center: Contextual detail */}
<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
  {(!treeSelection || treeSelection.type === 'journal' || treeSelection.type === 'pinned-section') && (
    <div style={{ flex: 1, display: treeSelection?.type === 'journal' || treeSelection?.type === 'pinned-section' ? 'flex' : 'flex', flexDirection: 'column' }}>
      <DetailPanel
        entry={treeSelection?.type === 'journal' || treeSelection?.type === 'pinned-section'
          ? entries.find(e => `${e.year_month}/${e.filename}` === treeSelection.path) ?? selectedEntry
          : selectedEntry}
        entries={entries}
        onDeselect={handleDeselect}
        onRecord={handleRecord}
        onOpenDock={handleOpenChat}
        onSelectSample={handleSelectSample}
        onAddToTodo={handleAddToTodo}
        onProcess={handleProcessEntry}
        onVisualDesign={handleVisualDesign}
      />
    </div>
  )}
  {treeSelection?.type === 'identity' && (
    <IdentityDetail
      identity={allIdentities.find(i => i.path === treeSelection.path) ?? null}
      onRecord={handleRecord}
      onOpenDock={handleOpenChat}
    />
  )}
  {treeSelection?.type === 'topic-file' && (
    <FilePreviewPanel
      file={{ path: treeSelection.path, name: treeSelection.path.split('/').pop() ?? '', is_dir: false, mtime_secs: 0 }}
    />
  )}
</div>
```

- [ ] **Step 2: 生成 todayYearMonth 和 todayDay**

在 App.tsx 中添加：

```typescript
const today = new Date()
const todayYearMonth = `${String(today.getFullYear()).slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}`
const todayDay = today.getDate()
```

- [ ] **Step 3: 清理未使用的 import 和状态**

确认移除：`SidebarTabs`, `IdentityList`, `FileTree`, `FilePreviewPanel`（如不再需要）, `sidebarTab`, `selectedFile`, `handleTabChange`

- [ ] **Step 4: 运行 dev 检查**

```bash
npm run dev
```
手动验证：左栏树形结构出现，点击条目可选中，中栏显示对应详情。

---

### Task 12: 移除旧组件 + 清理

**Files:**
- Remove: `src/components/SidebarTabs.tsx`
- Remove: `src/components/IdentityList.tsx` （功能已迁移到 TreeSidebar）
- Remove 或保留: `src/components/JournalList.tsx` （可能仍被其他视图使用，检查后决定）
- Remove 或保留: `src/components/FileTree.tsx` （仅当不再被引用时移除）

- [ ] **Step 1: 检查引用并移除**

```bash
grep -rl 'SidebarTabs' src/ && grep -rl 'IdentityList' src/ && grep -rl 'FileTree' src/ && grep -rl 'JournalList' src/
```

对于仅在已删除代码中引用的文件，移除它们。

- [ ] **Step 2: 全局类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 运行前端测试**

```bash
npm test
```

- [ ] **Step 4: Lint 检查**

```bash
npm run lint
```

---

### Task 13: 后端 — 流水分页支持

**Files:**
- Modify: `src-tauri/src/journal.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 添加分页查询命令**

```rust
// 在 journal.rs 中添加

#[tauri::command]
pub fn list_journal_entries_paginated(
    app: tauri::AppHandle,
    offset: usize,
    limit: usize,
) -> Result<(Vec<JournalEntry>, usize), String> {
    let workspace = crate::config::get_workspace_path(&app)?;
    let all_months = list_available_months_impl(&workspace)?;
    // months already sorted descending by existing list_available_months

    let mut all_entries: Vec<JournalEntry> = vec![];
    for ym in &all_months {
        let entries = list_month_entries(&workspace, ym)?;
        all_entries.extend(entries);
    }

    // Sort: newest first
    all_entries.sort_by(|a, b| {
        b.year_month.cmp(&a.year_month)
            .then_with(|| b.day.cmp(&a.day))
            .then_with(|| b.created_at_secs.cmp(&a.created_at_secs))
    });

    let total = all_entries.len();
    let page: Vec<JournalEntry> = all_entries.into_iter().skip(offset).take(limit).collect();
    Ok((page, total))
}
```

- [ ] **Step 2: 在 main.rs 注册**

```rust
journal::list_journal_entries_paginated,
```

- [ ] **Step 3: 编译检查**

```bash
cd src-tauri && cargo check 2>&1 | tail -20
```

---

### Task 14: 前端 — 使用分页查询优化加载

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 添加 IPC 封装**

```typescript
export const listJournalEntriesPaginated = (offset: number, limit: number): Promise<[JournalEntry[], number]> =>
  invoke<[JournalEntry[], number]>('list_journal_entries_paginated', { offset, limit })
```

- [ ] **Step 2: 更新 useJournal hook 使用分页**

修改 `src/hooks/useJournal.ts`，添加基于分页的加载逻辑作为替代方案。现有月份批加载仍可使用，但在 TreeSidebar 中通过 `onLoadMore` 触发。

---

### Task 15: 端到端验证

- [ ] **Step 1: 完整 dev 运行**

```bash
npm run tauri dev
```

验证 checklist：
- [ ] 四个分区均可折叠/展开
- [ ] 置顶区显示钉选条目，@ 和 … 按钮 hover 出现
- [ ] 画像区显示所有 identity，头像色块、行内标签、描述文字
- [ ] 流水分区按月份分组，当天日期块显示金橙色
- [ ] 专题分区显示 topics/ 目录树，可折叠子文件夹
- [ ] 点击日志 → 中栏 DetailPanel
- [ ] 点击画像 → 中栏 IdentityDetail
- [ ] 点击专题文件 → 中栏 FilePreviewPanel
- [ ] 点击 @ → 右栏探讨输入框追加 `@path`
- [ ] 右键 … → 上下文菜单
- [ ] 加载更多按钮追加日志条目

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "feat: replace sidebar tabs with unified tree structure"
```
