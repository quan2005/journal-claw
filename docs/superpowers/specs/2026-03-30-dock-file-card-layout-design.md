# Design: CommandDock 新布局 — 附件大图标 + 文字备注 + Inline 放大

**Date:** 2026-03-30
**Status:** Approved

## Overview

重新设计 CommandDock 的 files 模式布局：附件以大图标形式显示在左侧，右侧是始终可输入的文字备注区，文字区支持 Inline 撑高放大。文字备注与文件一起提交给 AI。

## Decisions

| 决策点 | 选择 |
|--------|------|
| 附件图标尺寸 | 中图标 48×52px |
| 布局 | 附件左列 + 文字右列 |
| 放大方式 | Inline 撑高（dock 高度动态增长） |
| 文字区定位 | 合并模式：备注随文件一起提交 |
| 附件点击行为 | 调用系统 `open` 命令打开文件 |

## UI States

### Idle（无变化）
与现在完全相同。

### Files + Text 模式（有文件时）

```
┌──┬──────────────────────────────────────────────────────┬──┬──────┬──┐
│  │  [📄]  [📕]  [🖼]          │  备注（可选）  [取消][提交↗] │  │  🎙  │  │
│  │  txt   pdf   png           │                           ⤢  │  │      │  │
│  │  文件名 文件名 文件名        │  添加背景说明…               │  │      │  │
└──┴──────────────────────────────────────────────────────┴──┴──────┴──┘
```

- 左侧附件列：每个文件一个图标卡片（48×52px 图标 + 文件名）；hover 显示 ×；**点击图标调用系统工具打开**
- 中间竖线分隔
- 右侧文字区：label "备注（可选）" + 操作按钮在顶部；⤢ 放大按钮在右下角；textarea 透明无边框
- dock 默认高度 ~84px

### Files + Text 放大模式（点击 ⤢）

```
┌──┬──────────────────────────────────────────────────────┬──┬──────┬──┐
│  │  [📄]  [📕]           │  备注（可选）  [⤡][取消][提交↗] │  │  🎙  │  │
│  │  txt   pdf            │  ┌──────────────────────────┐ │  │      │  │
│  │                       │  │  文字输入区（展开）        │ │  │      │  │
│  │                       │  │  ⌘↵ 提交                 │ │  │      │  │
│  │                       │  └──────────────────────────┘ │  │      │  │
└──┴──────────────────────────────────────────────────────┴──┴──────┴──┘
```

- dock 高度从 84px 动态撑高到 ~180px（CSS transition）
- 附件列固定在左上，不随 dock 撑高而变化
- 文字区展开，textarea 有轻微背景色区分（`var(--dock-paste-bg)`）
- ⤡ 按钮收起，回到默认高度

### Paste Text 模式（无文件，⌘V 短文本或点击空白区域）
与现在完全相同，不变。

## Component Changes

### FileChip → FileCard（重命名 + 重设计）

新增 `onOpen: () => void` prop，点击图标体调用。

```typescript
interface FileCardProps {
  filename: string
  kind: FileKind
  onRemove: () => void
  onOpen: () => void   // 新增：点击图标调用系统工具打开
}
```

布局变化：
- 竖向排列（icon 上，文件名下）
- 图标 48×52px，圆角 9px，按 kind 渐变色
- 图标左上角 type badge（可选）
- 文件名截断 ellipsis，最宽 58px
- × 删除按钮 hover 显示在右上角

**保留原 FileChip** 供其他地方使用（`RecordingItem` 等依赖它），不删除。新建 `FileCard.tsx`。

### CommandDock.tsx

新增 state：
```typescript
const [textExpanded, setTextExpanded] = useState(false)
const [noteText, setNoteText] = useState('')
```

**files 模式下的 ⌘↵ 行为变更**：
```typescript
// 提交时把 noteText 一并传出
await onFilesSubmit(paths, noteText.trim() || undefined)
```

`onFilesSubmit` signature 更新：
```typescript
onFilesSubmit: (paths: string[], note?: string) => Promise<void>
```

**取消时**：清空 `noteText` 和 `textExpanded`。

**放大时**：`setTextExpanded(true)` → dock 高度由 CSS 控制（`min-height` transition）。

### App.tsx

`handleFilesSubmit` 接收可选 `note`：
- 有 note → 额外调用 `importText(note)` 生成一个 `paste-*.txt` 文件，追加到 paths 末尾，再统一提交
- 无 note → 与现在相同

### src/lib/tauri.ts

`revealInFinder` 已存在。新增：
```typescript
export const openFile = (path: string) =>
  invoke<void>('open_with_system', { path })
```

`open_with_system` Rust 命令已在 `main.rs` 存在，直接复用。

## Dock Height Animation

```css
.dock-zone {
  min-height: 84px;
  transition: min-height 0.2s ease;
}
.dock-zone.expanded {
  min-height: 180px;
}
```

## What Does NOT Change

- Idle 状态 UI
- Paste text 模式（无文件时）
- ⌘V 全局路由逻辑
- 录音按钮
- AI 处理流程（pendingFiles → trigger_ai_processing）

## Testing

- [ ] 粘贴长文本 → files 模式：左侧显示 txt 图标卡片，右侧备注可输入
- [ ] 点击图标卡片 → 系统工具打开文件
- [ ] hover 图标 → × 出现，点击删除
- [ ] 点击 ⤢ → dock 撑高，textarea 展开
- [ ] 点击 ⤡ → dock 收回 84px
- [ ] 输入备注后 ⌘↵ → 备注作为额外文件附加到提交
- [ ] 无备注 ⌘↵ → 只提交文件，行为与现在一致
- [ ] 取消 → noteText 清空，textExpanded 重置
- [ ] 无文件时短文本 ⌘V → 原粘贴面板不受影响
