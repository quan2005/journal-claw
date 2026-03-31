# Audio AI Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一录音和导入音频的后续处理路径，先生成同目录的 `*.audio-ai.md`，再让 AI 队列只消费该 markdown 文件。

**Architecture:** 新增一个音频专用编排层，把“音频 -> ASR -> AI markdown -> AI 队列”收敛到一个模块里。录音和导入音频都只负责落盘原始音频，再委托该编排层继续处理。

**Tech Stack:** Tauri, Rust, tokio, React, TypeScript, DashScope ASR, WhisperKit

---

### Task 1: 写入音频编排层骨架

**Files:**
- Create: `src-tauri/src/audio_pipeline.rs`
- Modify: `src-tauri/src/main.rs`

**Step 1: 新增 `audio_pipeline.rs`，定义统一入口**

- 提供一个后台入口，接收 `audio_path` 与 `year_month`
- 内部负责读取配置、选择 ASR 引擎、生成 AI markdown、触发 AI 队列

**Step 2: 在 `main.rs` 注册模块**

- `mod audio_pipeline;`
- 需要的话注册新的 Tauri 命令

**Step 3: 编译检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS，至少新模块被正确纳入构建

---

### Task 2: 重构转写产物为同目录 `*.audio-ai.md`

**Files:**
- Modify: `src-tauri/src/transcription.rs`

**Step 1: 提取“音频路径 -> AI markdown 内容”的公共函数**

- DashScope 与 WhisperKit 都返回统一的中间结果
- 统一渲染为内容精简 markdown

**Step 2: 增加 `*.audio-ai.md` 写盘逻辑**

- 输出路径：与音频同目录、同 stem
- 文件名：`<stem>.audio-ai.md`

**Step 3: 保留 transcript 读取与重试兼容**

- `get_transcript` 仍可读取 UI 需要的文本
- `retry_transcription` 针对原音频重新生成 AI markdown

**Step 4: 运行 Rust 测试**

Run: `cargo test --manifest-path src-tauri/Cargo.toml transcription -- --nocapture`
Expected: PASS

---

### Task 3: 让录音路径走统一编排

**Files:**
- Modify: `src-tauri/src/recorder.rs`

**Step 1: 保留录音后处理与音频落盘**

- 继续执行降噪 / 转码等已有逻辑

**Step 2: 删除录音后分叉的 ASR / AI 触发逻辑**

- 不在 `recorder.rs` 里直接处理 DashScope / WhisperKit 差异
- 改为统一调用 `audio_pipeline`

**Step 3: 验证构建**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

---

### Task 4: 让导入音频路径走统一编排

**Files:**
- Modify: `src-tauri/src/materials.rs`
- Modify: `src/lib/tauri.ts`
- Modify: `src/App.tsx`

**Step 1: 增加导入音频后触发编排的后端命令或前端封装**

- 保留原有 `import_file`
- 新增一个专用于音频的触发入口，避免前端直接把音频加入 AI 队列

**Step 2: 改前端导入音频路径**

- `importAudioFile` 后调用新的音频编排入口
- 不再直接 `addQueuedItem(audioPath, ...)`

**Step 3: 保持非音频素材原逻辑不变**

- 文本 / PDF / DOCX 仍走现有 `trigger_ai_processing`

**Step 4: 运行前端测试**

Run: `npm test -- --runInBand`
Expected: 至少本次修改相关测试通过

---

### Task 5: 收口队列状态与前端事件

**Files:**
- Modify: `src/hooks/useJournal.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`

**Step 1: 明确音频任务在转写阶段与 AI 阶段的状态**

- 转写中前显示 `converting`
- 生成 `*.audio-ai.md` 后再切到 `queued` / `processing`

**Step 2: 调整事件消费**

- `recording-processed` 不再等价于“AI 可处理”
- 只有 `*.audio-ai.md` 真正生成后，才把队列项升级为 AI 任务

**Step 3: 手工检查 UI 交互**

- 录音结束后队列状态正确
- 导入音频后不再直接显示音频进入 AI

---

### Task 6: 补测试与回归验证

**Files:**
- Modify: `src/tests/useJournal.test.ts`
- Modify: Rust tests as needed

**Step 1: 为统一音频编排补测试**

- 覆盖录音占位项升级逻辑
- 覆盖导入音频不会直接投递音频路径的行为

**Step 2: 跑关键验证**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
npm test -- --runInBand
```

Expected: PASS；若有现存无关失败，需明确记录

