---
title: 后端开发
description: JournalClaw Rust 后端开发指南：Tauri 命令注册、LLM 引擎、模块详解。
---

# 后端开发

## 技术栈

- Rust 2021 edition
- Tauri v2（桌面框架）
- reqwest（HTTP 客户端，LLM API 调用）
- cpal（音频采集）
- nnnoiseless + rubato（音频处理）
- serde / serde_json（序列化）
- tokio（异步运行时）
- tokio-tungstenite（WebSocket 客户端，飞书桥接）

## 命令注册

所有 IPC 命令在 `src-tauri/src/main.rs` 中注册：

```rust
#[tauri::command]
async fn start_recording(state: tauri::State<'_, AppState>) -> Result<(), String> {
    // ...
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            get_journal_entries,
            // ... 50+ 命令
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 添加新命令

```rust
// 1. 在对应模块中实现逻辑
// 2. 在 main.rs 中封装为 #[tauri::command] 函数
// 3. 添加到 invoke_handler! 宏中
// 4. 前端在 lib/tauri.ts 中添加封装
```

## LLM 引擎

`src-tauri/src/llm/` 是谨迹的核心。一个内置的 Anthropic Messages API 客户端，支持多厂商：

```
llm/
  mod.rs       # API 客户端：构造请求、解析响应、流式输出
  tool_loop.rs # Tool use 循环：AI 调用工具 → 获取结果 → 继续推理
```

### 支持的厂商

通过统一的 Messages API 协议抽象：

```rust
enum LlmVendor {
    Anthropic,
    Volcengine,
    Zhipu,
    DashScope,
}
```

不同厂商的差异（endpoint URL、认证 header、模型 ID 映射）在 `config.rs` 中配置，`llm/mod.rs` 根据配置动态选择。

### Tool Use 循环

内置 LLM 引擎支持 tool use（工具调用）循环：

1. LLM 返回 tool use 请求（如读文件、更新条目）
2. `tool_loop.rs` 执行工具调用并收集结果
3. 结果作为新的 user message 返回给 LLM
4. LLM 继续推理，直到不再请求工具

## 音频管线

```
cpal 采集（recorder.rs）
  → WAV 写入
  → nnnoiseless 降噪（audio_process.rs）
  → rubato 重采样（audio_process.rs）
  → 静默检测 + 去除（audio_process.rs）
  → afconvert 转码为 M4A（audio_pipeline.rs）
  → STT 引擎转写（transcription.rs）
  → LLM 编译（llm/）
```

## STT 引擎

`transcription.rs` 定义 STT 引擎 trait：

```rust
trait SpeechToText {
    async fn transcribe(&self, audio_path: &Path) -> Result<String>;
}
```

三种实现：
- **AppleSpeechAnalyzer** — 通过 Swift sidecar 调用 macOS SpeechAnalyzer
- **WhisperKit** — 通过 Swift sidecar 调用 Apple WhisperKit
- **DashScope** — HTTP API 调用阿里云百炼

## AI 处理队列

`ai_processor.rs` 实现异步 FIFO 队列：

- 素材提交 → 入队
- 单线程处理（一次编译一个素材，避免 rate limit）
- 处理完成后发出 `ai-processing-done` 事件
- 失败时记录错误并可重试

## 关键数据结构

### AppConfig

```rust
struct AppConfig {
    vendor: LlmVendor,
    api_key: String,
    endpoint_id: Option<String>,
    model: String,
    compile_temperature: f32,
    chat_temperature: f32,
    // ...
}
```

### JournalEntry

```rust
struct JournalEntry {
    path: PathBuf,
    title: String,
    tags: Vec<String>,
    date: NaiveDate,
    sources: Vec<Source>,
    summary: String,
}
```

## 模块依赖关系

```
main.rs
  ├── config.rs
  ├── llm/
  ├── conversation.rs → llm/
  ├── ai_processor.rs → llm/, journal.rs, materials.rs
  ├── recorder.rs → audio_pipeline.rs
  ├── audio_pipeline.rs → audio_process.rs, transcription.rs
  ├── transcription.rs
  ├── journal.rs
  ├── identity.rs
  ├── speaker_profiles.rs → identity.rs
  ├── todos.rs
  ├── auto_lint.rs → journal.rs, identity.rs
  ├── skills.rs
  ├── feishu_bridge.rs → ai_processor.rs
  ├── materials.rs → ai_processor.rs
  ├── permissions.rs
  ├── workspace.rs
  └── workspace_settings.rs
```
