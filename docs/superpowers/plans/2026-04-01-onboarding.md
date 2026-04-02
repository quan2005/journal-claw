# 初始化引导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首次启动时写入示例日志条目，右侧空状态展示三张引导卡片，底部 CommandDock 视觉权重提升。

**Architecture:** Rust 侧在 `config.rs` 新增 `sample_entry_created` flag，新增 `create_sample_entry_if_needed` command 写入示例 `.md` 文件；前端 `App.tsx` 在 mount 时调用该 command，并将引导卡片的三个回调传入 `DetailPanel`；`DetailPanel` 在空状态时叠加引导卡片；`CommandDock` idle 状态视觉微调。

**Tech Stack:** Rust (Tauri v2 commands), React + TypeScript (Tauri invoke), Vitest (前端测试)

---

### Task 1: Rust — config.rs 增加 `sample_entry_created` 字段

**Files:**
- Modify: `src-tauri/src/config.rs:32-62`

- [ ] **Step 1: 在 `Config` struct 中增加字段**

在 `src-tauri/src/config.rs` 的 `Config` struct（第 32 行附近）增加一个字段：

```rust
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Config {
    #[serde(default)]
    pub dashscope_api_key: String,
    #[serde(default)]
    pub workspace_path: String,
    #[serde(default = "default_claude_cli")]
    pub claude_cli_path: String,
    #[serde(default)]
    pub window_state: Option<WindowState>,
    // AI 引擎配置
    #[serde(default = "default_active_engine")]
    pub active_ai_engine: String,
    #[serde(default)]
    pub claude_code_api_key: String,
    #[serde(default)]
    pub claude_code_base_url: String,
    #[serde(default)]
    pub claude_code_model: String,
    #[serde(default)]
    pub qwen_code_api_key: String,
    #[serde(default)]
    pub qwen_code_base_url: String,
    #[serde(default)]
    pub qwen_code_model: String,
    // ASR 引擎配置
    #[serde(default = "default_asr_engine")]
    pub asr_engine: String,
    #[serde(default = "default_whisperkit_model")]
    pub whisperkit_model: String,
    // 首次启动引导
    #[serde(default)]
    pub sample_entry_created: bool,
}
```

- [ ] **Step 2: 在 `config.rs` 末尾的 `tests` 模块中加测试**

在 `src-tauri/src/config.rs` 的 `#[cfg(test)] mod tests` 块末尾追加：

```rust
#[test]
fn sample_entry_created_defaults_to_false() {
    let c: Config = serde_json::from_str("{}").unwrap();
    assert!(!c.sample_entry_created);
}

#[test]
fn sample_entry_created_roundtrip() {
    let c = Config {
        sample_entry_created: true,
        ..Config::default()
    };
    let json = serde_json::to_string(&c).unwrap();
    let c2: Config = serde_json::from_str(&json).unwrap();
    assert!(c2.sample_entry_created);
}
```

- [ ] **Step 3: 运行 Rust 单元测试，确认通过**

```bash
cd src-tauri && cargo test config:: 2>&1 | tail -20
```

期望输出：`test result: ok. N passed; 0 failed`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: add sample_entry_created flag to Config"
```

---

### Task 2: Rust — journal.rs 新增 `write_sample_entry` 函数 + Tauri command

**Files:**
- Modify: `src-tauri/src/journal.rs`

- [ ] **Step 1: 在 `journal.rs` 末尾（`#[cfg(test)]` 之前）追加函数和 command**

```rust
/// 示例条目 Markdown 内容（固定文案）
fn sample_entry_content() -> String {
    r#"---
summary: 这是 AI 帮你整理的示例——试着录一段音或粘贴一段会议记录
tags: [示例, 产品, 会议]
---

# 产品评审会议纪要

## 会议结论

- 下一版本功能优先级已确定，重点投入 AI 摘要功能
- UI 改版方案通过评审，进入设计执行阶段
- 技术债处理排期至 Q2 下半段

## 待办事项

- @设计：输出首页改版高保真稿，截止下周五
- @后端：排期 API 优化，评估工作量

## 参会人员

产品、设计、前后端各一名

---

> 这条记录是示例，展示 AI 整理后的效果。你可以删除它，或直接录音 / 粘贴文件开始使用。
"#
    .to_string()
}

/// 在 workspace 的当月目录写入一条示例日志条目。
/// 若文件已存在（同名），直接返回 Ok 不覆盖。
pub fn write_sample_entry(workspace: &str, year_month: &str, day: u32) -> Result<String, String> {
    use crate::workspace;
    workspace::ensure_dirs(workspace, year_month)?;
    let filename = format!("{:02}-产品评审示例.md", day);
    let path = workspace::year_month_dir(workspace, year_month).join(&filename);
    if path.exists() {
        return Ok(path.to_string_lossy().to_string());
    }
    std::fs::write(&path, sample_entry_content()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 首次启动时调用：若 sample_entry_created 为 false，写入示例条目并置 flag 为 true。
/// 返回 true 表示本次写入了示例条目，false 表示 flag 已设置过（无操作）。
#[tauri::command]
pub fn create_sample_entry_if_needed(app: AppHandle) -> Result<bool, String> {
    use crate::config;
    use crate::workspace;
    let mut cfg = config::load_config(&app)?;
    if cfg.sample_entry_created {
        return Ok(false);
    }
    if cfg.workspace_path.is_empty() {
        return Ok(false);
    }
    let year_month = workspace::current_year_month();
    let day = chrono::Local::now().day();
    write_sample_entry(&cfg.workspace_path, &year_month, day)?;
    cfg.sample_entry_created = true;
    config::save_config(&app, &cfg)?;
    Ok(true)
}
```

注意：`chrono::Local::now().day()` 需要引入 `use chrono::Datelike;`。在函数体内加局部 use：

```rust
pub fn create_sample_entry_if_needed(app: AppHandle) -> Result<bool, String> {
    use crate::config;
    use crate::workspace;
    use chrono::Datelike;
    // ... 其余同上
```

- [ ] **Step 2: 在 `journal.rs` 的 tests 模块中新增测试**

在 `src-tauri/src/journal.rs` 末尾的 `#[cfg(test)] mod tests` 块中追加：

```rust
#[test]
fn write_sample_entry_creates_file() {
    let tmp = std::env::temp_dir().join(format!(
        "journal_sample_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let ws = tmp.to_str().unwrap();
    let result = write_sample_entry(ws, "2604", 1);
    assert!(result.is_ok(), "write_sample_entry failed: {:?}", result);
    let path = std::path::PathBuf::from(result.unwrap());
    assert!(path.exists(), "sample entry file should exist");
    let content = std::fs::read_to_string(&path).unwrap();
    assert!(content.contains("产品评审会议纪要"));
    assert!(content.contains("summary:"));
    std::fs::remove_dir_all(&tmp).ok();
}

#[test]
fn write_sample_entry_does_not_overwrite_existing() {
    let tmp = std::env::temp_dir().join(format!(
        "journal_sample_test_no_overwrite_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let ws = tmp.to_str().unwrap();
    // 先写一次
    let path_str = write_sample_entry(ws, "2604", 1).unwrap();
    // 改写文件内容
    std::fs::write(&path_str, "custom content").unwrap();
    // 再写一次，不应覆盖
    write_sample_entry(ws, "2604", 1).unwrap();
    let content = std::fs::read_to_string(&path_str).unwrap();
    assert_eq!(content, "custom content");
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 3: 运行测试**

```bash
cd src-tauri && cargo test journal:: 2>&1 | tail -20
```

期望：`test result: ok. N passed; 0 failed`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/journal.rs
git commit -m "feat: add write_sample_entry and create_sample_entry_if_needed command"
```

---

### Task 3: Rust — main.rs 注册新 command

**Files:**
- Modify: `src-tauri/src/main.rs:209-255`

- [ ] **Step 1: 在 `invoke_handler![]` 列表中追加新 command**

在 `src-tauri/src/main.rs` 的 `invoke_handler` 中，`ai_processor::install_engine,` 这行后面（第 254 行附近）加：

```rust
            journal::create_sample_entry_if_needed,
```

完整 handler 列表末尾应类似：

```rust
            ai_processor::check_engine_installed,
            ai_processor::install_engine,
            journal::create_sample_entry_if_needed,
        ])
```

- [ ] **Step 2: 确认编译通过**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error" | head -20
```

期望：无输出（无编译错误）

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: register create_sample_entry_if_needed tauri command"
```

---

### Task 4: 前端 — tauri.ts 增加 `createSampleEntryIfNeeded`

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 在 `src/lib/tauri.ts` 末尾追加函数**

```typescript
export const createSampleEntryIfNeeded = (): Promise<boolean> =>
  invoke<boolean>('create_sample_entry_if_needed')
```

- [ ] **Step 2: 确认 TypeScript 编译通过**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

期望：无输出

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add createSampleEntryIfNeeded frontend wrapper"
```

---

### Task 5: 前端 — App.tsx 调用 command + 传递回调给 DetailPanel

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在导入行增加 `createSampleEntryIfNeeded`**

在 `src/App.tsx` 第 13 行（现有 import 行）末尾增加 `createSampleEntryIfNeeded`：

```typescript
import { importFile, importAudioFile, prepareAudioForAi, triggerAiProcessing, triggerAiPrompt, cancelAiProcessing, cancelQueuedItem, getEngineConfig, checkEngineInstalled, getAsrConfig, checkWhisperkitCliInstalled, checkWhisperkitModelDownloaded, createSampleEntryIfNeeded } from './lib/tauri'
```

- [ ] **Step 2: 在 `App()` 内增加 `useState` 用于控制 CommandDock 输入框**

在现有 state 声明区（第 25 行附近）增加：

```typescript
const [dockOpen, setDockOpen] = useState(false)
```

- [ ] **Step 3: 增加 mount 时调用 `createSampleEntryIfNeeded` 的 effect**

在 `App.tsx` 中，AI 引擎可用性检查的 `useEffect` 之后加（约第 50 行之后）：

```typescript
// 首次启动：写入示例条目
useEffect(() => {
  createSampleEntryIfNeeded().then(created => {
    if (created) refresh()
  }).catch(() => {})
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: 将引导卡片回调传入 DetailPanel**

在 `App.tsx` 的 JSX 中，找到 `<DetailPanel entry={selectedEntry} onDeselect={() => setSelectedEntry(null)} />`（约第 349 行），替换为：

```tsx
<DetailPanel
  entry={selectedEntry}
  entries={entries}
  onDeselect={() => setSelectedEntry(null)}
  onRecord={handleRecord}
  onOpenDock={() => setDockOpen(true)}
  onSelectSample={() => {
    const sample = entries.find(e => e.title === '产品评审示例')
    if (sample) setSelectedEntry(sample)
  }}
/>
```

- [ ] **Step 5: 将 `dockOpen` 和 `setDockOpen` 传给 CommandDock**

`CommandDock` 当前通过内部 `useState` 管理 `inputOpen`。需要让外部可控制打开。找到 `<CommandDock` 的 props（约第 363 行），增加：

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
  asrReady={asrReady}
  audioRejected={audioRejected}
  externalOpen={dockOpen}
  onExternalOpenConsumed={() => setDockOpen(false)}
/>
```

- [ ] **Step 6: 确认 TypeScript 编译通过**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

期望：无输出（此时 DetailPanel 和 CommandDock 的 prop 类型还未更新，会有类型错误——这是预期的，下一个 Task 修复）

- [ ] **Step 7: Commit（先提交结构改动，类型错误在后续 task 修复）**

```bash
git add src/App.tsx
git commit -m "feat: call createSampleEntryIfNeeded on mount; wire guide card callbacks"
```

---

### Task 6: 前端 — CommandDock 支持外部控制 `inputOpen` + 视觉强化

**Files:**
- Modify: `src/components/CommandDock.tsx`

- [ ] **Step 1: 扩展 props interface，增加 `externalOpen` 和 `onExternalOpenConsumed`**

在 `CommandDock.tsx` 的 `CommandDockProps` interface 中追加两个可选字段：

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
  asrReady: boolean | null
  audioRejected?: boolean
  externalOpen?: boolean
  onExternalOpenConsumed?: () => void
}
```

- [ ] **Step 2: 在 `CommandDock` 函数体中解构新 props，并增加 effect 响应 `externalOpen`**

在函数签名的解构处增加 `externalOpen` 和 `onExternalOpenConsumed`：

```typescript
export function CommandDock({
  isDragOver, pendingFiles, onPasteSubmit, onFilesSubmit,
  onFilesCancel, onRemoveFile, onPasteFiles, recorderStatus, onRecord,
  asrReady, audioRejected, externalOpen, onExternalOpenConsumed,
}: CommandDockProps) {
```

在现有 `useEffect` 之后（`hasFiles` 监听后）加：

```typescript
// 外部触发打开 dock
useEffect(() => {
  if (externalOpen) {
    setInputOpen(true)
    onExternalOpenConsumed?.()
  }
}, [externalOpen]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: 视觉强化 idle 状态**

找到 `CommandDock.tsx` 中 `{activeMode === 'idle' && (` 的渲染块（约第 217 行），将其替换为：

```tsx
{activeMode === 'idle' && (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
  }}>
    <div style={{
      width: 32, height: 32,
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--dock-dropzone-hover-border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--dock-dropzone-text)' }}>粘贴会议记录、文章、随手笔记</div>
      <div style={{ fontSize: 10, color: 'var(--dock-dropzone-hint)', marginTop: 2 }}>AI 帮你归档 · 支持 txt · md · pdf · docx · 图片</div>
    </div>
    <div
      className="dock-kbd-pulse"
      style={{
        flexShrink: 0,
        fontSize: 11,
        color: 'var(--dock-kbd-text)',
        background: 'var(--dock-kbd-bg)',
        border: `0.5px solid var(--dock-kbd-border)`,
        borderRadius: 5,
        padding: '3px 8px',
        letterSpacing: '0.05em',
      }}>
      ⌘V
    </div>
  </div>
)}
```

- [ ] **Step 4: 写 CommandDock 测试（`src/tests/CommandDock.test.tsx`）**

打开 `src/tests/CommandDock.test.tsx`，在现有测试末尾追加：

```typescript
it('opens input when externalOpen becomes true', async () => {
  const { rerender } = render(
    <CommandDock
      isDragOver={false}
      pendingFiles={[]}
      onPasteSubmit={vi.fn()}
      onFilesSubmit={vi.fn()}
      onFilesCancel={vi.fn()}
      onRemoveFile={vi.fn()}
      onPasteFiles={vi.fn()}
      recorderStatus="idle"
      onRecord={vi.fn()}
      asrReady={true}
      externalOpen={false}
      onExternalOpenConsumed={vi.fn()}
    />
  )
  // 初始时不应该显示取消按钮
  expect(screen.queryByText('取消')).toBeNull()

  const consumed = vi.fn()
  rerender(
    <CommandDock
      isDragOver={false}
      pendingFiles={[]}
      onPasteSubmit={vi.fn()}
      onFilesSubmit={vi.fn()}
      onFilesCancel={vi.fn()}
      onRemoveFile={vi.fn()}
      onPasteFiles={vi.fn()}
      recorderStatus="idle"
      onRecord={vi.fn()}
      asrReady={true}
      externalOpen={true}
      onExternalOpenConsumed={consumed}
    />
  )
  await waitFor(() => {
    expect(screen.getByText('取消')).toBeInTheDocument()
  })
  expect(consumed).toHaveBeenCalled()
})
```

- [ ] **Step 5: 运行 CommandDock 测试**

```bash
npx vitest run src/tests/CommandDock.test.tsx 2>&1 | tail -20
```

期望：`✓ src/tests/CommandDock.test.tsx`，所有测试通过

- [ ] **Step 6: 确认 TypeScript 编译通过**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

期望：无 CommandDock 相关的类型错误

- [ ] **Step 7: Commit**

```bash
git add src/components/CommandDock.tsx src/tests/CommandDock.test.tsx
git commit -m "feat: CommandDock supports externalOpen prop; strengthen idle state visuals"
```

---

### Task 7: 前端 — DetailPanel 增加引导卡片

**Files:**
- Modify: `src/components/DetailPanel.tsx`

- [ ] **Step 1: 扩展 `DetailPanelProps` interface**

在 `DetailPanel.tsx` 的 `DetailPanelProps` interface（第 11 行）替换为：

```typescript
interface DetailPanelProps {
  entry: JournalEntry | null
  entries: JournalEntry[]
  onDeselect: () => void
  onRecord: () => void
  onOpenDock: () => void
  onSelectSample: () => void
}
```

- [ ] **Step 2: 在 `DetailPanel` 函数签名中解构新 props**

```typescript
export function DetailPanel({ entry, entries, onDeselect, onRecord, onOpenDock, onSelectSample }: DetailPanelProps) {
```

- [ ] **Step 3: 替换空状态渲染（`if (!entry)` 分支）**

找到 `DetailPanel.tsx` 中 `if (!entry) {` 的 return 块（第 152 行），替换整个 `if (!entry)` return 为：

```typescript
if (!entry) {
  const isEmpty = entries.length === 0
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--detail-bg)',
      userSelect: 'none',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Watermark */}
      <span style={{
        fontSize: '84vh',
        fontWeight: 900,
        letterSpacing: '0.06em',
        color: 'var(--item-text)',
        opacity: 0.035,
        lineHeight: 1,
        fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Source Han Serif CN", "STSong", "SimSun", "Songti SC", serif',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        position: 'absolute',
      }}>
        谨迹
      </span>

      {isEmpty && (
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '0 32px',
          width: '100%',
          maxWidth: 520,
        }}>
          <div style={{ fontSize: 12, color: 'var(--item-meta)', letterSpacing: '0.04em', opacity: 0.6 }}>
            通过以下方式开始记录
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            {/* 录音卡片 */}
            <button
              onClick={onRecord}
              style={{
                flex: 1, background: 'var(--detail-bg)', border: '1px solid var(--divider)',
                borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--item-meta)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎙️</div>
              <div style={{ fontSize: 11, color: 'var(--item-text)', fontWeight: 600, marginBottom: 4 }}>录音记录</div>
              <div style={{ fontSize: 10, color: 'var(--item-meta)', lineHeight: 1.6 }}>说出你的想法<br/>AI 自动整理成日志</div>
            </button>

            {/* 粘贴卡片 */}
            <button
              onClick={onOpenDock}
              style={{
                flex: 1, background: 'var(--detail-bg)', border: '1px solid var(--divider)',
                borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--item-meta)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 11, color: 'var(--item-text)', fontWeight: 600, marginBottom: 4 }}>粘贴 / 拖文件</div>
              <div style={{ fontSize: 10, color: 'var(--item-meta)', lineHeight: 1.6 }}>会议记录、日记<br/>AI 自动提炼关键信息</div>
            </button>

            {/* 看示例卡片 */}
            <button
              onClick={onSelectSample}
              style={{
                flex: 1, background: 'var(--detail-bg)', border: '1px dashed var(--divider)',
                borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 11, color: 'var(--item-text)', fontWeight: 600, marginBottom: 4 }}>看示例条目</div>
              <div style={{ fontSize: 10, color: 'var(--item-meta)', lineHeight: 1.6 }}>先了解 AI 整理<br/>结果长什么样</div>
            </button>
          </div>
        </div>
      )}

      {!isEmpty && (
        /* 原有底部提示，有条目时保留（已选中时不会进入此分支，此处是未选中态） */
        <div style={{
          position: 'absolute',
          bottom: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          color: 'var(--item-meta)',
          letterSpacing: '0.04em',
          opacity: 0.5,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
            <path d="M12 8v8" />
            <polyline points="8 12 12 16 16 12" />
          </svg>
          直接粘贴文本，或拖入文件（txt/md/pdf/docx 等）
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 写 DetailPanel 测试**

打开 `src/tests/DetailSheet.test.tsx`（现有测试文件，按项目惯例名字可能是 DetailSheet），在末尾追加以下测试。如果文件不存在，检查 `src/tests/` 目录下的 DetailPanel 相关测试文件：

```typescript
describe('empty state guidance cards', () => {
  const baseProps = {
    entry: null,
    onDeselect: vi.fn(),
    onRecord: vi.fn(),
    onOpenDock: vi.fn(),
    onSelectSample: vi.fn(),
  }

  it('shows guidance cards when entries is empty', () => {
    render(<DetailPanel {...baseProps} entries={[]} />)
    expect(screen.getByText('录音记录')).toBeInTheDocument()
    expect(screen.getByText('粘贴 / 拖文件')).toBeInTheDocument()
    expect(screen.getByText('看示例条目')).toBeInTheDocument()
  })

  it('hides guidance cards when entries exist', () => {
    const fakeEntry = {
      filename: '01-test.md', path: '/ws/2604/01-test.md',
      title: 'test', summary: '', tags: [], year_month: '2604',
      day: 1, created_time: '10:00', mtime_secs: 0, materials: [],
    }
    render(<DetailPanel {...baseProps} entries={[fakeEntry]} />)
    expect(screen.queryByText('录音记录')).toBeNull()
  })

  it('calls onRecord when 录音记录 card is clicked', async () => {
    const onRecord = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onRecord={onRecord} />)
    await userEvent.click(screen.getByText('录音记录').closest('button')!)
    expect(onRecord).toHaveBeenCalledOnce()
  })

  it('calls onOpenDock when 粘贴 card is clicked', async () => {
    const onOpenDock = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onOpenDock={onOpenDock} />)
    await userEvent.click(screen.getByText('粘贴 / 拖文件').closest('button')!)
    expect(onOpenDock).toHaveBeenCalledOnce()
  })

  it('calls onSelectSample when 看示例条目 card is clicked', async () => {
    const onSelectSample = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onSelectSample={onSelectSample} />)
    await userEvent.click(screen.getByText('看示例条目').closest('button')!)
    expect(onSelectSample).toHaveBeenCalledOnce()
  })
})
```

注意：确认测试文件顶部有 `import userEvent from '@testing-library/user-event'` 的引入。如没有，查看现有测试文件如何引入，保持一致。

- [ ] **Step 5: 运行 DetailPanel/DetailSheet 测试**

```bash
npx vitest run src/tests/DetailSheet.test.tsx 2>&1 | tail -30
```

期望：所有测试通过

- [ ] **Step 6: 运行全部前端测试**

```bash
npm test 2>&1 | tail -30
```

期望：所有测试通过，无失败

- [ ] **Step 7: 确认 TypeScript 编译通过**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

期望：无输出

- [ ] **Step 8: Commit**

```bash
git add src/components/DetailPanel.tsx src/tests/DetailSheet.test.tsx
git commit -m "feat: show onboarding cards in empty detail panel state"
```

---

### Task 8: 集成验收

**Files:** 无新改动

- [ ] **Step 1: 运行全部 Rust 测试**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

期望：`test result: ok. N passed; 0 failed`

- [ ] **Step 2: 运行全部前端测试**

```bash
cd .. && npm test 2>&1 | tail -10
```

期望：所有测试通过

- [ ] **Step 3: 手动验收清单**

启动开发服务器（`npm run tauri dev`）后逐条检查：

1. 首次启动（清空 config.json 中的 `sample_entry_created` 字段或删除 config.json）：左侧列表出现"产品评审示例"条目
2. 右侧空白区域（未选中条目时，有示例条目存在）：显示"直接粘贴文本"提示（非引导卡片）
3. 删除示例条目，列表为空：右侧显示三张引导卡片（录音 / 粘贴 / 看示例）
4. 点击"录音记录"卡片：触发录音
5. 点击"粘贴 / 拖文件"卡片：底部 CommandDock 输入框打开
6. 点击"看示例条目"：若示例条目存在，自动选中并展示；若已被删除，无响应（`entries.find` 返回 undefined，`setSelectedEntry(undefined)` 无效）
7. 第二次启动（config 中 `sample_entry_created: true`）：不再创建新示例条目
8. CommandDock idle 状态：主文案为"粘贴会议记录、文章、随手笔记"，副文案含"AI 帮你归档"

- [ ] **Step 4: Final commit**

```bash
git add -A
git status  # 确认无意外文件
git commit -m "chore: onboarding flow integration complete"
```
