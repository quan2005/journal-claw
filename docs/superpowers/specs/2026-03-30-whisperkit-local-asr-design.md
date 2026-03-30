# WhisperKit 本地 ASR 引擎设计

**日期**：2026-03-30
**状态**：已批准

---

## 背景

谨迹当前唯一的录音转写路径是 DashScope（阿里云 Qwen）云端 ASR，需要 API Key 且音频上传到云端。本设计引入 WhisperKit 作为第二个 ASR 引擎，完全本地运行，基于 Apple Silicon CoreML，支持说话人识别（diarization），开箱即用，无需用户安装任何额外工具。

---

## 目标

- 新增 `whisperkit` 作为并列 ASR 引擎，用户在设置里二选一
- 支持说话人识别，转写结果区分每位发言人
- 内置 `whisperkit-cli` 二进制到 app 安装包，零安装门槛
- 与现有 DashScope 路径完全并列，不破坏现有功能
- 转写结果同时落盘 sidecar（UI 展示）和格式化为 markdown（供 Claude CLI 整理）

---

## 不在范围内

- 实时流式转写（录音过程中）
- Windows / Linux 支持（whisperkit-cli 仅 macOS arm64）
- 自定义说话人姓名映射（用匿名标注 Speaker A/B/C）

---

## 架构

### 数据流

```
录音结束 → M4A
  ├─[asr_engine = dashscope]
  │   → DashScope API（云端）
  │   → transcript.json sidecar（纯文本）
  │   → Claude CLI prompt（文本内容）
  │
  └─[asr_engine = whisperkit]
      → whisperkit-cli sidecar（本地）
      → diarized transcript.json sidecar（带 speaker 字段）
      → markdown 纯文本（格式化后作为 prompt_text）
      → Claude CLI 整理为日志 .md
```

两条路共用：
- 相同的 `transcript.json` sidecar 格式（UI 展示复用）
- 相同的 `ai_processor.rs` 队列和触发逻辑
- 相同的 `transcription-progress` 事件通知 UI

### Sidecar 集成

`whisperkit-cli` 预编译二进制（MIT License，可自由分发）放入：

```
src-tauri/binaries/whisperkit-cli-aarch64-apple-darwin
```

`tauri.conf.json` 注册：

```json
{
  "bundle": {
    "externalBin": ["binaries/whisperkit-cli"]
  }
}
```

Rust 通过 `tauri::api::process::Command::new_sidecar("whisperkit-cli")` 调用，与现有 Claude CLI 调用模式对称。

---

## 详细设计

### 1. Config 新增字段（`config.rs`）

```rust
#[serde(default = "default_asr_engine")]
pub asr_engine: String,         // "dashscope" | "whisperkit"，默认 "dashscope"

#[serde(default = "default_whisperkit_model")]
pub whisperkit_model: String,   // "base" | "small" | "large-v3-turbo"，默认 "base"
```

新增对应的 `get_asr_config` / `set_asr_config` Tauri 命令。

### 2. `transcription.rs` 新增函数

`transcribe_with_whisperkit(app, m4a_path, model)` 流程：

1. 调用 sidecar：
   ```
   whisperkit-cli transcribe
     --audio-path <m4a>
     --diarization
     --output-type verbose_json
     --language zh
     --model-cache-dir <app_data_dir>/whisperkit-models
     --model <model>
   ```

2. 解析 JSON 输出（`segments` 数组，每条含 `speaker`、`start`、`end`、`text`）

3. 写 `.transcript.json` sidecar（路径与 DashScope 一致：`transcripts/<stem>.json`），格式扩展为包含 `speaker` 字段：
   ```json
   {
     "status": "completed",
     "text": "全文纯文本（无说话人标注，向后兼容）",
     "segments": [
       { "speaker": "Speaker A", "start": 0.0, "end": 3.2, "text": "大家好..." }
     ]
   }
   ```

4. 将 segments 格式化为 markdown 纯文本返回：

   ```markdown
   **Speaker A** (0:00)
   大家好，今天讨论三个议题...

   **Speaker B** (0:15)
   好的，我先介绍一下背景...
   ```

   格式规则：
   - `SPEAKER_00` → `Speaker A`，`SPEAKER_01` → `Speaker B`，以此类推
   - 时间戳精确到分秒（`M:SS`），不显示毫秒
   - 相邻同一说话人段落合并（避免碎片化）
   - 段落间空行分隔

5. 以 `prompt_text` 形式传给 `ai_processor` 队列，Claude CLI 收到的 prompt 前缀为格式化 markdown，后接整理指令。

### 3. `recorder.rs` 分支调用

`stop_recording` 的后处理逻辑（现 `spawn_blocking` 内）：

```rust
let cfg = config::load_config(&app)?;
match cfg.asr_engine.as_str() {
    "whisperkit" => {
        // 调用 whisperkit，拿到 markdown_text
        // 然后 process_material(..., prompt_text: Some(markdown_with_instruction))
    }
    _ => {
        // 现有 DashScope 路径不变
        transcription::start_transcription(...);
        process_material(..., prompt_text: None);
    }
}
```

### 4. 首次运行：模型下载

`whisperkit-cli` 首次调用时自动从 HuggingFace 下载 CoreML 模型，存储在：

```
<app_data_dir>/whisperkit-models/
```

下载进度通过现有 `transcription-progress` 事件推送，状态序列：
`"downloading_model"` → `"transcribing"` → `"completed"`

UI 文案：`"下载模型中（首次使用）…"` → `"转写中…"` → `"完成"`

模型大小参考（用户选择时展示）：

| 模型 | 大小 | 中文效果 | 推荐场景 |
|------|------|---------|---------|
| base | ~74MB | 一般 | 默认，快速 |
| small | ~244MB | 好 | 会议记录 |
| large-v3-turbo | ~809MB | 最佳 | 高质量需求 |

### 5. 设置 UI（`SectionVoice.tsx` 重建）

当前 `SectionVoice` 是完全禁用的占位组件，本次激活并重建：

- 移除 `opacity: 0.45 / pointerEvents: none`
- 移除"开发中"标签
- 引擎选择卡片（仿 `SectionAiEngine` 风格）：
  - **DashScope**（云端 · 阿里云）：选中后显示 API Key 输入框
  - **WhisperKit**（本地 · Apple Silicon）：选中后显示模型选择下拉 + 磁盘占用提示
- whisperkit-cli 已内置，无需安装按钮
- 保存按钮调用新增的 `set_asr_config` 命令

### 6. workspace CLAUDE.md 更新

`resources/workspace-template/.claude/CLAUDE.md` 新增录音处理章节：

```markdown
## 录音转写

收到带说话人标注的转写内容时（格式如下），按说话人整理对话，保留发言归属：

**Speaker A** (0:00)
发言内容...

整理为日志时，每位说话人的发言单独成段，标注说话人标识。
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src-tauri/binaries/whisperkit-cli-aarch64-apple-darwin` | 新增 | 预编译二进制 |
| `src-tauri/tauri.conf.json` | 修改 | 注册 externalBin |
| `src-tauri/src/config.rs` | 修改 | 新增 asr_engine、whisperkit_model 字段及命令 |
| `src-tauri/src/transcription.rs` | 修改 | 新增 whisperkit 转录路径，扩展 Transcript 类型 |
| `src-tauri/src/recorder.rs` | 修改 | stop_recording 按 asr_engine 分支调用 |
| `src-tauri/src/main.rs` | 修改 | 注册新增 Tauri 命令 |
| `src/lib/tauri.ts` | 修改 | 新增 getAsrConfig / setAsrConfig 前端封装 |
| `src/settings/components/SectionVoice.tsx` | 重建 | 激活语音转写设置，引擎选择 UI |
| `src/types.ts` | 修改 | Transcript 类型扩展 segments 字段 |
| `src-tauri/resources/workspace-template/.claude/CLAUDE.md` | 修改 | 新增录音转写处理指令 |

---

## 依赖与约束

- **License**：WhisperKit MIT License，二进制分发合规，需在 About 页面保留版权声明
- **平台**：仅 macOS arm64（aarch64），Intel Mac 不支持 whisperkit-cli
- **最低系统版本**：macOS 13.0（WhisperKit SpeakerKit 要求）
- **模型下载**：需要网络访问 HuggingFace，首次使用时触发，后续离线可用
- **包体积**：whisperkit-cli 二进制约 10-20MB，增加 app 安装包体积

---

## 开放问题

- Intel Mac 用户使用 whisperkit 引擎时，应展示明确的"不支持"提示，而非静默失败
- 模型下载失败（网络问题）的重试策略：建议沿用 DashScope 的 retry_transcription 模式
