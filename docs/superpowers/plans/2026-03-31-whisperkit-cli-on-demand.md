# WhisperKit CLI On-Demand + ASR Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除内置 whisperkit-cli 二进制和 base 模型，改为运行时 `which` 检查 + 引导安装；同时修复音频重试跳过转写的 bug，并在 ASR 未 ready 时禁用录音和音频文件导入。

**Architecture:**
1. Rust 侧新增 `check_whisperkit_cli_installed` 命令，用 `which whisperkit-cli` 实现；`transcribe_with_whisperkit` 调用时若找不到路径直接返回带引导信息的错误。
2. `SectionVoice.tsx` 新增 whisperkit-cli 安装状态检测 + 安装引导文案（参考 AI 引擎安装卡片的现有 pattern）。
3. `App.tsx` / `CommandDock.tsx` 在 ASR not ready 时把录音按钮和音频拖入均设为 disabled。
4. 修复 `handleRetryQueueItem`：对音频类型的 item（`source_path` 形如 `.m4a/.wav` 等）走 `prepareAudioForAi` 全流程，而非直接 `triggerAiProcessing`。

**Tech Stack:** Rust (Tauri v2 command), React/TypeScript, Vitest + @testing-library/react

---

## File Map

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src-tauri/tauri.conf.json` | Modify | 删除 `externalBin` whisperkit-cli 和 `resources/whisperkit-models/` |
| `src-tauri/src/config.rs` | Modify | 新增 `check_whisperkit_cli_installed` 命令；`find_whisperkit_cli_path` 改为 `which whisperkit-cli`；删除 bundled 路径查找逻辑；删除 `download_whisperkit_model`（仍保留命令注册以免前端崩溃，改为提示用户手动安装）；移除 `find_whisperkit_model_dir` 中 bundled/source_resource 路径查找；移除 `whisperkit_cli_model_name` 中涉及内置模型的分支（仅保留模型名称映射逻辑） |
| `src-tauri/src/transcription.rs` | Modify | `transcribe_with_whisperkit`：CLI 路径改为调用新 `find_whisperkit_cli_path`；若路径不存在则返回带安装引导的错误 |
| `src-tauri/src/main.rs` | Modify | 注册新 `check_whisperkit_cli_installed` 命令 |
| `src/lib/tauri.ts` | Modify | 新增 `checkWhisperkitCliInstalled` 函数 |
| `src/settings/components/SectionVoice.tsx` | Modify | 加入 CLI 安装检测 + 安装引导 UI；WhisperKit 卡片 ready 判断需同时满足 cli installed + model downloaded；Base 模型去掉 `bundled: true` 和"内置"标签，改为普通可下载模型 |
| `src/App.tsx` | Modify | 新增 `asrReady` state；ASR not ready 时禁用录音入口和音频文件接受；修复 `handleRetryQueueItem` 音频重试逻辑 |
| `src/components/CommandDock.tsx` | Modify | 接受 `asrReady` prop；录音按钮 disabled 且 tooltip 文案提示；音频类型文件 drop 时若 ASR not ready 则拒绝并 toast |
| `src/types.ts` | Modify (if needed) | CommandDock props 新增 `asrReady` |

---

## Task 1: Rust — 新增 `check_whisperkit_cli_installed` 命令

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 在 config.rs 新增 CLI 路径查找函数和 Tauri 命令**

在 `config.rs` 中，找到现有的 `find_whisperkit_model_dir` 函数（约 line 144），在其后添加：

```rust
/// 在 PATH（含 /usr/local/bin, /opt/homebrew/bin）中查找 whisperkit-cli。
/// 返回绝对路径，若未找到返回 None。
pub fn find_whisperkit_cli_path() -> Option<String> {
    let output = std::process::Command::new("which")
        .arg("whisperkit-cli")
        .env("PATH", augmented_path())
        .output()
        .ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
}

#[tauri::command]
pub fn check_whisperkit_cli_installed() -> bool {
    find_whisperkit_cli_path().is_some()
}
```

- [ ] **Step 2: 注册命令到 main.rs**

在 `main.rs` 的 `invoke_handler![]` 列表中，找到 `config::check_whisperkit_model_downloaded,` 所在行，在其后添加：

```rust
config::check_whisperkit_cli_installed,
```

- [ ] **Step 3: 运行 cargo 编译验证**

```bash
cd src-tauri && cargo build 2>&1 | tail -20
```

Expected: 无 error，可以有 warning。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/main.rs
git commit -m "feat(rust): add check_whisperkit_cli_installed command"
```

---

## Task 2: Rust — `transcribe_with_whisperkit` 改为运行时 which 查找

**Files:**
- Modify: `src-tauri/src/transcription.rs`
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: 修改 `transcribe_with_whisperkit` 使用 `find_whisperkit_cli_path`**

在 `transcription.rs` 中，找到 `pub async fn transcribe_with_whisperkit` 函数（约 line 803）。

替换其中的 CLI 路径查找逻辑（原来是通过 `app.path().resource_dir()` 查找 bundle 内二进制）：

将这段代码：
```rust
    let cli_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| {
            d.join("binaries")
                .join("whisperkit-cli-aarch64-apple-darwin")
        })
        .filter(|p| p.exists())
        .or_else(|| {
            let p = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target/debug/whisperkit-cli");
            if p.exists() { Some(p) } else { None }
        })
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "whisperkit-cli".to_string());
```

替换为：
```rust
    let cli_path = match config::find_whisperkit_cli_path() {
        Some(path) => path,
        None => {
            let message = "未找到 whisperkit-cli，请先安装：brew install argmaxinc/whisperkit/whisperkit-cli".to_string();
            save_transcript(&app, &file_path, "failed", &message);
            return Err(message);
        }
    };
```

- [ ] **Step 2: 同样修改 `download_whisperkit_model` 中的 CLI 路径查找**

在 `config.rs` 中，`download_whisperkit_model` 函数（约 line 390）中有相同的 bundled 路径查找代码：

```rust
    let cli_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| {
            d.join("binaries")
                .join("whisperkit-cli-aarch64-apple-darwin")
        })
        .filter(|p| p.exists())
        .or_else(|| {
            let p = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target/debug/whisperkit-cli");
            if p.exists() { Some(p) } else { None }
        })
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "whisperkit-cli".to_string());
```

替换为：
```rust
    let cli_path = match find_whisperkit_cli_path() {
        Some(path) => path,
        None => {
            let msg = "未找到 whisperkit-cli，请先安装：brew install argmaxinc/whisperkit/whisperkit-cli".to_string();
            let _ = app.emit(
                "whisperkit-download-progress",
                serde_json::json!({
                    "model": model, "status": "error", "message": msg
                }),
            );
            return Err(msg);
        }
    };
```

- [ ] **Step 3: 编译确认**

```bash
cd src-tauri && cargo build 2>&1 | tail -20
```

Expected: 无 error。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/transcription.rs src-tauri/src/config.rs
git commit -m "feat(rust): resolve whisperkit-cli via which at runtime instead of bundled binary"
```

---

## Task 3: 移除 tauri.conf.json 中的内置 whisperkit 资源

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 编辑 tauri.conf.json**

将 `"bundle"` 段中的：
```json
    "resources": [
      "resources/whisperkit-models/"
    ],
    "externalBin": [
      "binaries/whisperkit-cli"
    ]
```

改为：
```json
    "resources": [],
    "externalBin": []
```

（如果完全移除这两个 key 的话，Tauri build 可能会报 schema error，保留空数组更安全。）

- [ ] **Step 2: 编译确认**

```bash
cd src-tauri && cargo build 2>&1 | tail -20
```

Expected: 无 error。如果 Tauri 有找不到 sidecar 注册的 warning，忽略（因为我们不再注册 externalBin）。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: remove bundled whisperkit-cli binary and whisperkit-models from app bundle"
```

---

## Task 4: 前端 — 新增 `checkWhisperkitCliInstalled` IPC + ASR ready 逻辑

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/settings/components/SectionVoice.tsx`

- [ ] **Step 1: 在 tauri.ts 新增函数**

在 `src/lib/tauri.ts` 末尾追加：

```typescript
export const checkWhisperkitCliInstalled = (): Promise<boolean> =>
  invoke<boolean>('check_whisperkit_cli_installed')
```

- [ ] **Step 2: SectionVoice.tsx — 新增 CLI 安装状态**

在 `SectionVoice.tsx` 的 import 中加入 `checkWhisperkitCliInstalled`：

```typescript
import { getAsrConfig, setAsrConfig, getWhisperkitModelsDir, checkWhisperkitModelDownloaded, downloadWhisperkitModel, checkWhisperkitCliInstalled, type AsrConfig } from '../../lib/tauri'
```

在组件内已有 state 之后添加：
```typescript
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null)
```

在 `useEffect` 的 `Promise.all` 中新增检查：
```typescript
    Promise.all([
      getAsrConfig().then(loadedConfig => {
        setCfg(loadedConfig)
        setPersistedCfg(loadedConfig)
      }),
      getWhisperkitModelsDir().then(setModelsDir),
      checkWhisperkitCliInstalled().then(setCliInstalled),
    ]).then(() => {
      refreshDownloadedModels()
      setLoading(false)
    })
```

- [ ] **Step 3: 修改 WhisperKit ready 判断**

将原来的：
```typescript
  const whisperkitReady = downloadedModels.has(cfg.whisperkit_model as WhisperModel)
```

改为：
```typescript
  const whisperkitReady = cliInstalled === true && downloadedModels.has(cfg.whisperkit_model as WhisperModel)
```

- [ ] **Step 4: 在 WhisperKit 配置区块顶部加 CLI 安装提示**

在 `{cfg.asr_engine === 'whisperkit' && (` 的 `<div style={{ marginBottom: 16 }}>` 之后，添加 CLI 未安装时的 banner：

```tsx
              {cliInstalled === false && (
                <div style={{
                  marginBottom: 14,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255,159,10,0.08)',
                  border: '1px solid rgba(255,159,10,0.3)',
                  fontSize: 11,
                  color: 'var(--item-meta)',
                  lineHeight: 1.6,
                }}>
                  <div style={{ fontWeight: 600, color: '#ff9f0a', marginBottom: 4 }}>未检测到 whisperkit-cli</div>
                  <div>请在终端运行以下命令安装：</div>
                  <code style={{
                    display: 'block',
                    marginTop: 6,
                    padding: '5px 8px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 5,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 10,
                    color: 'var(--item-text)',
                    userSelect: 'text',
                  }}>
                    brew install argmaxinc/whisperkit/whisperkit-cli
                  </code>
                  <div style={{ marginTop: 6, color: 'var(--duration-text)' }}>
                    安装完成后重新打开设置页面即可刷新检测状态。
                  </div>
                </div>
              )}
```

- [ ] **Step 5: Base 模型去掉 bundled 标签**

将 `WHISPER_MODELS` 数组中 `base` 的定义：

```typescript
  { id: 'base', label: 'Base', size: '内置', hint: '默认模型，已随应用打包，开箱即用', bundled: true },
```

改为：

```typescript
  { id: 'base', label: 'Base', size: '~142MB', hint: '默认模型，中文效果稳定，适合日常会议记录' },
```

- [ ] **Step 6: 前端编译检查**

```bash
npm run build 2>&1 | tail -30
```

Expected: 无 TypeScript error，无构建失败。

- [ ] **Step 7: Commit**

```bash
git add src/lib/tauri.ts src/settings/components/SectionVoice.tsx
git commit -m "feat(frontend): add whisperkit-cli install check and install guide in SectionVoice"
```

---

## Task 5: App.tsx — ASR ready state + 禁用音频入口

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/CommandDock.tsx`
- Modify: `src/types.ts` (if CommandDock props need update)

- [ ] **Step 1: 在 App.tsx 新增 asrReady state**

在 `src/App.tsx` 的 import 中加入 `checkWhisperkitCliInstalled, getAsrConfig, checkWhisperkitModelDownloaded`：

```typescript
import { importFile, importAudioFile, prepareAudioForAi, triggerAiProcessing, triggerAiPrompt, cancelAiProcessing, cancelQueuedItem, getEngineConfig, checkEngineInstalled, getAsrConfig, checkWhisperkitCliInstalled, checkWhisperkitModelDownloaded } from './lib/tauri'
```

在已有的 `const [aiReady, setAiReady] = useState<boolean | null>(null)` 之后添加：

```typescript
  const [asrReady, setAsrReady] = useState<boolean | null>(null)
```

新增检测 ASR ready 的 `useEffect`（在现有 `checkEngineInstalled` 的 useEffect 之后）：

```typescript
  // Check ASR readiness on mount and after settings are closed
  useEffect(() => {
    getAsrConfig().then(async cfg => {
      if (cfg.asr_engine === 'dashscope') {
        setAsrReady(cfg.dashscope_api_key.trim().length > 0)
        return
      }
      // whisperkit: need both CLI installed and model downloaded
      const [cliOk, modelOk] = await Promise.all([
        checkWhisperkitCliInstalled(),
        checkWhisperkitModelDownloaded(cfg.whisperkit_model),
      ])
      setAsrReady(cliOk && modelOk)
    }).catch(() => setAsrReady(false))
  }, [view]) // re-check after settings closed
```

- [ ] **Step 2: 把 asrReady 传给 CommandDock**

在 App.tsx JSX 中，找到 `<CommandDock` 的位置，加入 `asrReady` prop：

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
              />
```

- [ ] **Step 3: CommandDock.tsx — 接受 asrReady prop，禁用录音按钮和音频文件**

在 `CommandDock.tsx` 的 `CommandDockProps` interface 中添加：

```typescript
  asrReady: boolean | null
```

在函数签名中解构 `asrReady`：

```typescript
export function CommandDock({
  isDragOver, pendingFiles, onPasteSubmit, onFilesSubmit,
  onFilesCancel, onRemoveFile, onPasteFiles, recorderStatus, onRecord,
  asrReady,
}: CommandDockProps) {
```

录音按钮部分，找到 `<button` 的 `onClick={onRecord}` 所在的按钮，修改：

1. `disabled` 条件：当 `recorderStatus !== 'recording' && asrReady === false` 时禁用
2. `title` 提示：ASR not ready 时改为 `'请先在设置中配置语音转写'`

```tsx
          <button
            onClick={onRecord}
            disabled={recorderStatus !== 'recording' && asrReady === false}
            title={
              recorderStatus !== 'recording' && asrReady === false
                ? '请先在设置中配置语音转写'
                : recorderStatus === 'recording' ? '停止录音' : '开始录音'
            }
            aria-label={recorderStatus === 'recording' ? '停止录音' : '开始录音'}
            className="mic-btn"
            data-recording={recorderStatus === 'recording' ? 'true' : 'false'}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: recorderStatus === 'recording' ? 'var(--accent)' : 'var(--record-btn)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: recorderStatus !== 'recording' && asrReady === false ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              position: 'relative',
              outline: 'none',
              margin: '0 16px',
              WebkitAppRegion: 'no-drag',
              opacity: recorderStatus !== 'recording' && asrReady === false ? 0.4 : 1,
              boxShadow: recorderStatus === 'recording'
                ? '0 6px 18px rgba(255,59,48,0.24)'
                : '0 6px 18px rgba(200,147,59,0.22)',
              animation: recorderStatus === 'recording'
                ? 'rec-pulse 1.2s ease-in-out infinite'
                : 'pulse 3.2s ease-in-out infinite',
              transition: 'background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
            } as React.CSSProperties}
          >
```

- [ ] **Step 4: CommandDock 中拒绝音频文件（当 ASR not ready）**

在 `CommandDock.tsx` 内目前没有文件类型过滤逻辑，文件过滤在 `App.tsx` 的 `handleFilesSubmit` 和 `onPasteFiles` 处理。

在 App.tsx 的 `handlePasteFiles` 函数中添加音频文件过滤：

```typescript
  const handlePasteFiles = (paths: string[]) => {
    const audioExts = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.flac', '.mp4']
    const isAudio = (p: string) => audioExts.some(ext => p.toLowerCase().endsWith(ext))
    
    if (asrReady === false) {
      const hasAudio = paths.some(isAudio)
      if (hasAudio) {
        // 过滤掉音频，只接受非音频文件
        const nonAudio = paths.filter(p => !isAudio(p))
        if (nonAudio.length > 0) {
          setPendingFiles(prev => {
            const existing = new Set(prev)
            const newPaths = nonAudio.filter(p => !existing.has(p))
            if (newPaths.length === 0) return prev
            return [...prev, ...newPaths].slice(0, 6)
          })
        }
        // Toast 提示
        // 用一个临时 state 或者直接从 CommandDock 拿 showToast 不方便
        // 改为 App 层的 toast state（或复用 CommandDock 内部状态）
        // 最简单：直接设为 CommandDock 的 pendingFiles，音频已被过滤
        // 但无法直接 toast，加一个简单的 window.alert 不美观
        // 方案：在 App 层通过 dispatchEvent 让 CommandDock 显示 toast
        // 考虑到最小改动，在 App 层新增一个 toastMsg state 并传给 CommandDock
        return
      }
    }
    setPendingFiles(prev => {
      const existing = new Set(prev)
      const newPaths = paths.filter(p => !existing.has(p))
      if (newPaths.length === 0) return prev
      return [...prev, ...newPaths].slice(0, 6)
    })
  }
```

**更简洁方案**：直接在 App 层对拖入/粘贴的音频文件：若 ASR not ready 则丢弃 + 传一个 `audioRejected` prop 给 CommandDock 让其 toast。

在 App.tsx 中新增一个 state `pendingAudioRejected`：

```typescript
  const [audioRejected, setAudioRejected] = useState(false)
```

修改 `handlePasteFiles`（在 App.tsx，line 251 附近）：

```typescript
  const handlePasteFiles = (paths: string[]) => {
    const audioExts = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.flac', '.mp4']
    const isAudio = (p: string) => audioExts.some(ext => p.toLowerCase().endsWith(ext))
    
    let filteredPaths = paths
    if (asrReady === false) {
      const audioCount = paths.filter(isAudio).length
      if (audioCount > 0) {
        filteredPaths = paths.filter(p => !isAudio(p))
        setAudioRejected(true)
        setTimeout(() => setAudioRejected(false), 2500)
      }
    }
    
    setPendingFiles(prev => {
      const existing = new Set(prev)
      const newPaths = filteredPaths.filter(p => !existing.has(p))
      if (newPaths.length === 0) return prev
      return [...prev, ...newPaths].slice(0, 6)
    })
  }
```

在 `CommandDockProps` 中加入 `audioRejected?: boolean`，CommandDock 接收并在 `audioRejected` 为 true 时自动 showToast('语音转写未就绪，无法导入音频文件')。

实际实现：在 CommandDock.tsx 中添加 `useEffect`：

```typescript
  useEffect(() => {
    if (audioRejected) showToast('语音转写未配置，音频文件已忽略')
  }, [audioRejected])
```

App.tsx 中传入：
```tsx
                asrReady={asrReady}
                audioRejected={audioRejected}
```

- [ ] **Step 5: 前端编译**

```bash
npm run build 2>&1 | tail -30
```

Expected: 无 TypeScript error。

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/CommandDock.tsx
git commit -m "feat: disable recording and audio import when ASR is not ready"
```

---

## Task 6: 修复音频重试跳过转写的 bug

**Files:**
- Modify: `src/App.tsx`

**Background:**
当前 `handleRetryQueueItem`（`App.tsx` line 241）对所有类型的 item 都调用 `triggerAiProcessing(item.path, yearMonth)`。  
但对于音频文件，`item.path` 此时是 `.audio-ai.md` 文件的路径（经过转写后生成的），或者是音频文件本身的路径（转写失败时）。

实际流程应该是：
- 音频 item 处于 `converting`（转写中失败）状态时，`item.path` 仍是音频文件路径（`.m4a`）
- 音频 item 处于 `queued/failed` 状态但 path 是 `.audio-ai.md` 时，说明转写已完成，只需重新走 AI 阶段

所以正确逻辑是：
1. 如果 `item.path` 是音频文件（`.m4a`/`.wav` 等扩展名）→ 需要重新走转写+AI 全流程 → 调用 `prepareAudioForAi`
2. 如果 `item.path` 是 `.audio-ai.md` → 转写已完成，只需重新排队给 AI → 调用 `triggerAiProcessing`
3. 否则（普通文档）→ 调用 `triggerAiProcessing`

- [ ] **Step 1: 修改 handleRetryQueueItem**

在 `src/App.tsx`，将现有的 `handleRetryQueueItem`（约 line 241）：

```typescript
  const handleRetryQueueItem = async (item: QueueItem) => {
    const yearMonth = item.path.split('/').slice(-2, -1)[0] ?? ''
    retryQueueItem(item.path)
    try {
      await triggerAiProcessing(item.path, yearMonth)
    } catch (err) {
      markItemFailed(item.path, String(err))
    }
  }
```

替换为：

```typescript
  const handleRetryQueueItem = async (item: QueueItem) => {
    const yearMonth = item.path.split('/').slice(-2, -1)[0] ?? ''
    const audioExts = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.flac', '.mp4']
    const isAudioSourceFile = audioExts.some(ext => item.path.toLowerCase().endsWith(ext))
    
    retryQueueItem(item.path)
    try {
      if (isAudioSourceFile) {
        // Audio source file: need full pipeline (transcription + AI)
        await prepareAudioForAi(item.path, yearMonth)
      } else {
        // Already-transcribed material or non-audio: go directly to AI
        await triggerAiProcessing(item.path, yearMonth)
      }
    } catch (err) {
      markItemFailed(item.path, String(err))
    }
  }
```

- [ ] **Step 2: 前端编译**

```bash
npm run build 2>&1 | tail -20
```

Expected: 无 error。

- [ ] **Step 3: 单测**

在 `src/tests/` 目录中查看现有测试结构，如果有 App 相关测试则补充，否则跳过（此逻辑属于集成行为，手动验证即可）。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: retry audio queue item re-runs transcription instead of skipping to AI"
```

---

## Task 7: 验证 + 收尾

**Files:**
- 所有改动文件

- [ ] **Step 1: 完整前端编译测试**

```bash
npm run build 2>&1 | tail -30
```

Expected: 无 TypeScript error，无构建失败。

- [ ] **Step 2: Rust 单测**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

Expected: 全部通过（注意：`config_defaults` 测试中 `claude_cli_path` 应为 "claude"，`check_whisperkit_cli_installed` 无需单测因为依赖外部命令）。

- [ ] **Step 3: 手动验证 checklist（开发模式）**

```bash
npm run tauri dev
```

验证以下场景：
1. [ ] 设置 → 语音转写 → WhisperKit 卡片显示 CLI 安装状态
2. [ ] whisperkit-cli 未安装时，WhisperKit 卡片显示橙色 banner 和 brew 安装命令
3. [ ] whisperkit-cli 未安装时，录音按钮变灰 + disabled + hover tooltip 提示
4. [ ] whisperkit-cli 未安装时，拖入音频文件被拒绝并出现 toast
5. [ ] 模型未下载时（小/大模型），ASR not ready 判断生效
6. [ ] DashScope 有 API key 时 ASR ready，录音和音频正常
7. [ ] 音频文件转写失败后点"重试"走完整 pipeline（转写 → AI）
8. [ ] 非音频文件 AI 失败后点"重试"只走 AI 阶段

- [ ] **Step 4: 最终提交**

```bash
git add -A
git status  # 确认无意外文件
git commit -m "chore: final cleanup after whisperkit-cli on-demand migration"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 移除内置 whisperkit-cli → Task 2 + Task 3
- ✅ 运行时 `which` 检查 → Task 1 + Task 2
- ✅ 未安装时引导用户 → Task 4
- ✅ 音频转写 model 不内置，全部让用户下载 → Task 4 (Base 模型去掉 bundled 标签)
- ✅ ASR not ready 禁用录音 → Task 5
- ✅ ASR not ready 禁用音频文件导入 → Task 5
- ✅ 修复重试音频跳过转写的 bug → Task 6

**风险点：**
- `download_whisperkit_model` 命令仍然保留（前端 SectionVoice 仍然调用它），改为依赖运行时 `which whisperkit-cli` 找到路径后才能工作。若 CLI 未安装，调用 `downloadWhisperkitModel` 时会得到错误，前端已通过 CLI install check 来提前拦截 UI（禁用下载按钮）。
- Base 模型去掉 `bundled` 标签后，旧用户第一次启动会发现 Base 模型需要下载。这是预期行为（压缩包体积）。
- `find_whisperkit_model_dir` 中的 bundled 路径查找逻辑（通过 `resource_dir`）在 bundle 中不再有模型文件，所以会 fallback 到用户下载目录，行为正确，无需修改这个函数本身。
