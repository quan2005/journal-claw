# Clipboard Paste Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全局拦截 ⌘V，剪贴板有文件时直接加入 `pendingFiles`，长文本（>100字符）写临时 `.txt` 文件再加入 `pendingFiles`，短文本保持现有行为。

**Architecture:** 引入 `tauri-plugin-clipboard` 读取剪贴板文件路径；在 `CommandDock.tsx` 的 ⌘V 全局监听中统一处理三种情况；新增 `onPasteFiles` prop 将路径追加到 `App.tsx` 管理的 `pendingFiles`。`import_text` Rust 命令已存在，只需修改文件名格式并添加前端 wrapper。

**Tech Stack:** Tauri v2, `tauri-plugin-clipboard` (CrossCopy), React, TypeScript

---

## File Map

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src-tauri/Cargo.toml` | Modify | 添加 `tauri-plugin-clipboard` 依赖 |
| `src-tauri/src/lib.rs` 或 `main.rs` | Modify | 注册 clipboard plugin |
| `src-tauri/src/materials.rs` | Modify | `import_text` 文件名格式加日期前缀 |
| `src-tauri/capabilities/default.json` | Modify | 添加 clipboard 读取权限 |
| `src/lib/tauri.ts` | Modify | 新增 `importText` wrapper（不触发AI） |
| `src/components/CommandDock.tsx` | Modify | 替换 ⌘V 处理逻辑；新增 `onPasteFiles` prop |
| `src/App.tsx` | Modify | 传入 `onPasteFiles` prop 给 CommandDock |

---

## Task 1: 安装并注册 tauri-plugin-clipboard

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 安装 npm 包**

```bash
npm install tauri-plugin-clipboard-api
```

Expected: `tauri-plugin-clipboard-api` 出现在 `package.json` dependencies。

- [ ] **Step 2: 添加 Cargo 依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 末尾添加：

```toml
tauri-plugin-clipboard = "2"
```

- [ ] **Step 3: 注册插件到 Tauri Builder**

在 `src-tauri/src/main.rs` 的 `tauri::Builder::default()` 链中，`.manage(...)` 之前添加：

```rust
.plugin(tauri_plugin_clipboard::init())
```

完整位置（在 `.manage(recorder::RecorderState(...))` 前）：

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_clipboard::init())
    .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
    // ... 其余不变
```

- [ ] **Step 4: 添加 capability 权限**

在 `src-tauri/capabilities/default.json` 的 `permissions` 数组末尾添加：

```json
"clipboard-manager:allow-read-text",
"clipboard-manager:allow-read-files"
```

完整文件变为：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-set-size",
    "core:event:default",
    "core:webview:allow-set-webview-zoom",
    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-read-files"
  ]
}
```

- [ ] **Step 5: 确认 capability 权限名称**

CrossCopy 插件的权限 identifier 可能是 `clipboard-manager` 或 `tauri-plugin-clipboard`，以实际 crate 为准。编译后若出现 `unknown permission` 错误，运行：

```bash
ls src-tauri/gen/schemas/ | grep clipboard
```

查看生成的 schema 文件名（形如 `tauri-plugin-clipboard-schema.json`），其前缀即为正确 identifier。将 `default.json` 中的 `clipboard-manager` 前缀替换为正确值。

- [ ] **Step 6: 验证编译**

```bash
cd src-tauri && cargo build 2>&1 | tail -5
```

Expected: 编译成功，无错误（warning 可忽略）。

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/main.rs src-tauri/capabilities/default.json package.json package-lock.json
git commit -m "feat: 安装并注册 tauri-plugin-clipboard"
```

---

## Task 2: 修改 import_text 文件名格式

**Files:**
- Modify: `src-tauri/src/materials.rs`

当前 `import_text` 生成的文件名是 `paste-HHmmss.txt`（只有时间），改为 `paste-YYYYMMDD-HHmmss.txt`（含日期）。

- [ ] **Step 1: 修改 materials.rs 中的文件名格式**

找到 `import_text` 函数中这行：
```rust
let ts = chrono::Local::now().format("%H%M%S").to_string();
let filename = format!("paste-{}.txt", ts);
```

替换为：
```rust
let ts = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
let filename = format!("paste-{}.txt", ts);
```

- [ ] **Step 2: 运行现有 Rust 单元测试确认不回归**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: `test result: ok.` 所有测试通过。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/materials.rs
git commit -m "fix: import_text 文件名加日期前缀 paste-YYYYMMDD-HHmmss.txt"
```

---

## Task 3: 新增前端 importText IPC wrapper

**Files:**
- Modify: `src/lib/tauri.ts`

现有 `submitPasteText` 调用 `import_text` 后立即触发 AI 处理。新流程需要一个只写文件、返回路径的 wrapper（不触发 AI），供 `CommandDock` 把路径加入 `pendingFiles`，让用户手动点提交。

- [ ] **Step 1: 在 tauri.ts 新增 importText**

在 `submitPasteText` 函数前新增：

```typescript
// 粘贴文本 → 保存为 raw 文件 → 返回路径（不自动触发 AI）
export const importText = (text: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_text', { text })
```

`submitPasteText` 保持不变（它仍被粘贴面板短文本流程使用）。

- [ ] **Step 2: 确认 TypeScript 编译通过**

```bash
npm run build 2>&1 | tail -10
```

Expected: 编译成功，无 TS 错误。

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: 新增 importText IPC wrapper，返回路径不触发 AI"
```

---

## Task 4: 升级 CommandDock ⌘V 逻辑

**Files:**
- Modify: `src/components/CommandDock.tsx`

这是核心改动。在现有全局键盘监听中替换 ⌘V 处理，并新增 `onPasteFiles` prop。

- [ ] **Step 1: 在 CommandDock.tsx 顶部添加 import**

在文件顶部现有 import 后添加：

```typescript
import clipboard from 'tauri-plugin-clipboard-api'
import { importText } from '../lib/tauri'
```

- [ ] **Step 2: 在 CommandDockProps interface 添加 onPasteFiles**

找到：
```typescript
interface CommandDockProps {
  isDragOver: boolean
  pendingFiles: string[]
  onPasteSubmit: (text: string) => Promise<void>
  onFilesSubmit: (paths: string[]) => Promise<void>
  onFilesCancel: () => void
  onRemoveFile: (index: number) => void
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
  onFilesSubmit: (paths: string[]) => Promise<void>
  onFilesCancel: () => void
  onRemoveFile: (index: number) => void
  onPasteFiles: (paths: string[]) => void
  recorderStatus: RecorderStatus
  onRecord: () => void
}
```

- [ ] **Step 3: 在解构参数中添加 onPasteFiles**

找到：
```typescript
export function CommandDock({
  isDragOver, pendingFiles, onPasteSubmit, onFilesSubmit,
  onFilesCancel, onRemoveFile, recorderStatus, onRecord,
}: CommandDockProps) {
```

替换为：
```typescript
export function CommandDock({
  isDragOver, pendingFiles, onPasteSubmit, onFilesSubmit,
  onFilesCancel, onRemoveFile, onPasteFiles, recorderStatus, onRecord,
}: CommandDockProps) {
```

- [ ] **Step 4: 替换全局键盘监听中的 ⌘V 处理**

找到现有 ⌘V 处理块（约第 57-69 行）：
```typescript
      // ⌘V to enter paste mode (only when no input is focused and no files pending)
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !pasteMode && !hasFiles) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement ||
                        active instanceof HTMLTextAreaElement ||
                        (active as HTMLElement)?.isContentEditable
        if (!isInput) {
          setPasteMode(true)
          navigator.clipboard.readText().then((text) => {
            if (text) setPasteText(text)
          }).catch(() => {})
        }
      }
```

替换为：
```typescript
      // ⌘V: 全局剪贴板路由
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault()
        // 1. 尝试读取文件路径（Finder 复制的文件）
        clipboard.readFiles().then((files) => {
          if (files && files.length > 0) {
            onPasteFiles(files)
            return
          }
          // 2. 读取文本
          clipboard.readText().then((text) => {
            if (!text) return
            if (text.length > 100) {
              // 长文本 → 写临时文件 → 加入 pendingFiles
              importText(text).then((result) => {
                onPasteFiles([result.path])
              }).catch((err) => console.error('[import-text]', err))
            } else {
              // 短文本 → 展开粘贴面板
              setPasteMode(true)
              setPasteText(text)
            }
          }).catch(() => {})
        }).catch(() => {
          // readFiles 不支持时回退到文本
          clipboard.readText().then((text) => {
            if (!text) return
            if (text.length > 100) {
              importText(text).then((result) => {
                onPasteFiles([result.path])
              }).catch((err) => console.error('[import-text]', err))
            } else {
              setPasteMode(true)
              setPasteText(text)
            }
          }).catch(() => {})
        })
        return
      }
```

- [ ] **Step 5: 确认 TypeScript 编译通过**

```bash
npm run build 2>&1 | tail -15
```

Expected: 编译成功。若有 TS 错误，根据报错修复（通常是 `onPasteFiles` prop 未传的报错，Task 5 会解决）。

- [ ] **Step 6: Commit**

```bash
git add src/components/CommandDock.tsx
git commit -m "feat: CommandDock ⌘V 全局路由 — 文件/长文本/短文本三路分流"
```

---

## Task 5: App.tsx 传入 onPasteFiles prop

**Files:**
- Modify: `src/App.tsx`

`pendingFiles` 的 state 在 `App.tsx` 管理。需要将追加路径的函数作为 `onPasteFiles` prop 传给 `CommandDock`。

- [ ] **Step 1: 在 App.tsx 中定义 handlePasteFiles**

找到 `handlePasteSubmit` 函数附近（约第 135 行）：
```typescript
  const handlePasteSubmit = async (text: string) => {
    await submitPasteText(text)
  }
```

在其后添加：
```typescript
  const handlePasteFiles = (paths: string[]) => {
    setPendingFiles(prev => {
      const existing = new Set(prev)
      const newPaths = paths.filter(p => !existing.has(p))
      return newPaths.length > 0 ? [...prev, ...newPaths] : prev
    })
  }
```

- [ ] **Step 2: 在 CommandDock JSX 中传入 onPasteFiles**

找到 `<CommandDock` 的 JSX（约第 180 行），在现有 props 中添加 `onPasteFiles`：

```tsx
          <CommandDock
            isDragOver={isDragOver}
            pendingFiles={pendingFiles}
            onPasteSubmit={handlePasteSubmit}
            onFilesSubmit={handleFilesSubmit}
            onFilesCancel={handleFilesCancel}
            onRemoveFile={handleRemoveFile}
            onPasteFiles={handlePasteFiles}
            recorderStatus={status}
            onRecord={handleRecord}
          />
```

- [ ] **Step 3: 确认 TypeScript 编译通过**

```bash
npm run build 2>&1 | tail -10
```

Expected: 编译成功，无错误。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App.tsx 传入 onPasteFiles prop 给 CommandDock"
```

---

## Task 6: 手动验收测试

- [ ] **启动开发服务器**

```bash
npm run tauri dev
```

- [ ] **测试 1：短文本粘贴（≤ 100 字符）**

1. 复制任意短文本（如 `hello world`）
2. 在 app 中按 ⌘V
3. 期望：展开粘贴文本面板，文本预填

- [ ] **测试 2：长文本粘贴（> 100 字符）**

1. 复制超过 100 字符的文本（如一段会议记录）
2. 在 app 中按 ⌘V
3. 期望：展开文件面板，显示 `paste-YYYYMMDD-HHmmss.txt` chip
4. 点「提交 Agent 整理」
5. 期望：文件出现在 `~/Documents/journal/<yyMM>/raw/` 目录，AI 开始处理

- [ ] **测试 3：Finder 复制单文件**

1. 在 Finder 中选中一个 PDF 或文本文件，按 ⌘C
2. 切换到 app，按 ⌘V
3. 期望：展开文件面板，显示对应文件名 chip

- [ ] **测试 4：Finder 复制多文件**

1. 在 Finder 中选中多个文件，按 ⌘C
2. 切换到 app，按 ⌘V
3. 期望：所有文件 chip 均出现

- [ ] **Final Commit**

```bash
git add -A
git commit -m "chore: ⌘V 全局剪贴板增强功能完成"
```
