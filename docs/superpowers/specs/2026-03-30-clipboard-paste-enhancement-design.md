# Design: ⌘V 全局剪贴板增强

**Date:** 2026-03-30
**Status:** Approved

## Overview

升级 ⌘V 行为：全局拦截所有粘贴操作，根据剪贴板内容类型自动路由。长文本自动转为临时文件，Finder 复制的文件直接读取路径，统一进入现有 `pendingFiles` → AI 处理流程。

## Goals

- 粘贴文本 > 100 字符时，自动转为 `.txt` 文件附件，无需用户手动操作
- 粘贴 Finder 复制的文件时，自动读取路径并加入待提交列表
- 短文本（≤ 100 字符）保持现有粘贴面板行为
- 全局统一：不检测活跃元素，所有 ⌘V 都走此逻辑

## Architecture

### Dependencies

新增：
- **npm:** `tauri-plugin-clipboard-api` (CrossCopy)
- **Cargo:** `tauri-plugin-clipboard`

### Data Flow

```
⌘V 按下（全局，无例外）
  → clipboard.readFiles()
      ├── 有文件路径 → props.onPasteFiles(paths[])
      └── 无文件
          → clipboard.readText()
              ├── text.length > 100
              │     → importTextAsFile(text, "paste-YYYYMMDD-HHmmss.txt")
              │     → Rust 写 raw/paste-YYYYMMDD-HHmmss.txt
              │     → 返回绝对路径
              │     → props.onPasteFiles([absPath])
              └── text.length ≤ 100
                    → 现有 setPasteMode(true) 逻辑（不变）
```

### Components

#### 新增：Rust 命令 `import_text_as_file`

位置：`src-tauri/src/materials.rs`

```rust
// 接收文本内容和文件名，写到当前月份 raw/ 目录，返回绝对路径
#[tauri::command]
pub async fn import_text_as_file(
    content: String,
    filename: String,
    state: State<'_, AppState>,
) -> Result<String, String>
```

- 写到 `workspace/<yyMM>/raw/<filename>`
- 返回写入文件的绝对路径字符串

#### 新增：IPC Wrapper

位置：`src/lib/tauri.ts`

```typescript
export const importTextAsFile = async (content: string, filename: string): Promise<string>
```

#### 修改：`CommandDock.tsx` 键盘监听

将现有 ⌘V 处理替换为：

```typescript
if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
  e.preventDefault()
  // 1. 尝试读取文件路径
  const files = await clipboard.readFiles().catch(() => [])
  if (files.length > 0) {
    props.onPasteFiles(files)
    return
  }
  // 2. 读取文本
  const text = await clipboard.readText().catch(() => '')
  if (text.length > 100) {
    const filename = `paste-${timestamp()}.txt`
    const path = await importTextAsFile(text, filename)
    props.onPasteFiles([path])
  } else if (text.length > 0) {
    setPasteMode(true)
    setPasteText(text)
  }
}
```

#### 修改：`App.tsx`

新增 prop 回调 `onPasteFiles`，或将 `setPendingFiles` 提升——`CommandDock` 通过 `onPasteFiles(paths: string[])` 回调将路径追加到 `pendingFiles`。

## File Naming

临时文件名格式：`paste-YYYYMMDD-HHmmss.txt`
示例：`paste-20260330-143022.txt`

## What Does NOT Change

- `pendingFiles` 进入后的 AI 处理流程（完全复用）
- 粘贴文本面板 UI（≤ 100 字符路径）
- 文件拖拽流程
- 录音流程

## Testing

- [ ] 粘贴短文本（< 100 字）→ 展开粘贴面板，文本预填
- [ ] 粘贴长文本（> 100 字）→ 展开文件面板，显示 `paste-xxx.txt` chip
- [ ] Finder 复制单文件 ⌘V → 展开文件面板，显示对应 chip
- [ ] Finder 复制多文件 ⌘V → 全部 chip 出现
- [ ] 提交后文件出现在 `raw/` 目录，AI 正常处理
