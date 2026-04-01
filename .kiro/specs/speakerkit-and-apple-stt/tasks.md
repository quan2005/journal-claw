# 实施计划：内置 SpeakerKit 与 Apple 原生 STT 引擎

## 概述

将 SpeakerKit 说话人识别和 Apple SFSpeechRecognizer 语音转写引擎集成到谨迹桌面应用中。通过一个 Swift CLI sidecar (`journal-speech`) 统一封装两项能力，Rust 后端通过进程调用集成，前端扩展为三引擎选择 UI。

## 任务

- [x] 1. 创建 Swift CLI (`journal-speech`) 项目结构与核心实现
  - [x] 1.1 创建 Swift Package 项目骨架
    - 在 `src-tauri/swift-cli/` 下创建 `Package.swift`，声明 SpeakerKit 和 Speech 框架依赖
    - 创建 `Sources/main.swift` 入口文件，解析 `transcribe` 和 `diarize` 两个子命令及其参数（`--audio`、`--language`）
    - 输出统一 JSON 格式到 stdout，错误时输出 `{ "status": "failed", "error": "..." }` 并以非零退出码退出
    - _Requirements: 5.1, 5.3_

  - [x] 1.2 实现 `transcribe` 子命令（SFSpeechRecognizer）
    - 使用 `SFSpeechRecognizer` 进行设备端（on-device）语音识别
    - 支持 `--language zh-CN` 参数指定识别语言
    - 输出 JSON 包含 `status`、`text`（全文纯文本）、`segments`（含 `text`、`start`、`end` 时间戳）
    - 处理 SFSpeechRecognizer 不可用的情况（macOS 版本不兼容），返回明确错误信息
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.3 实现 `diarize` 子命令（SpeakerKit）
    - 使用 SpeakerKit 对音频进行说话人分离
    - 从 app bundle Resources 加载 SpeakerKit 模型（无需下载）
    - 输出 JSON 包含 `status`、`speakers`（含 `label`、`start`、`end`）
    - 处理单一说话人场景，保持输出格式一致
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.4 编译 Swift CLI 并注册为 Tauri sidecar
    - 编译产物命名为 `journal-speech-aarch64-apple-darwin`，放入 `src-tauri/binaries/`
    - 在 `src-tauri/tauri.conf.json` 的 `bundle.externalBin` 中注册 `binaries/journal-speech`
    - 在 `bundle.resources` 中添加 SpeakerKit 模型文件路径
    - _Requirements: 5.1, 5.4, 1.1_

- [x] 2. Checkpoint - 确认 Swift CLI 可独立运行
  - 确保 `journal-speech transcribe` 和 `journal-speech diarize` 子命令可正常执行并输出合法 JSON，如有问题请询问用户。

- [x] 3. 扩展 Rust 后端配置层支持 Apple 引擎
  - [x] 3.1 修改 `config.rs` 添加 `apple` 引擎选项
    - 将 `default_asr_engine()` 返回值从 `"whisperkit"` 改为 `"apple"`
    - 在 `sanitize_engine_config` 的 `valid_asr_engines` 中添加 `"apple"`
    - 在 `set_asr_config` 命令的 `valid_engines` 中添加 `"apple"`
    - _Requirements: 3.1, 7.3, 7.4_

  - [x] 3.2 实现默认引擎迁移逻辑
    - 在 `sanitize_engine_config` 或 `load_config` 中添加迁移逻辑：
      - 新用户：默认 `apple`
      - 升级用户 + whisperkit + cli 未安装 → 自动切换为 `apple`
      - 升级用户 + dashscope + API Key 已配置 → 保持不变
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 3.3 编写 ASR 引擎配置属性测试
    - **Property 4: ASR 引擎配置验证** — 验证 `set_asr_config` 仅接受 `"apple"`、`"whisperkit"`、`"dashscope"` 三个有效值
    - **Validates: Requirements 3.1**

  - [ ]* 3.4 编写 ASR 配置持久化属性测试
    - **Property 5: ASR 配置持久化往返** — 验证有效 AsrConfig 保存后再加载得到等价配置
    - **Validates: Requirements 3.6**

- [x] 4. 实现 Rust 后端 Apple STT 转写与 SpeakerKit 后处理
  - [x] 4.1 在 `transcription.rs` 中实现 `transcribe_with_apple_stt`
    - 通过 `tokio::process::Command` 调用 `journal-speech transcribe --audio <path> --language zh-CN`
    - 解析 JSON stdout 为 `Transcript` 结构
    - 实现超时控制：`max(duration_secs * 3, 60)` 秒，超时后终止子进程
    - 处理 CLI 不存在、输出非法 JSON、执行失败等错误
    - 通过 `transcription-progress` 事件推送 `"transcribing"` 状态
    - _Requirements: 2.1, 2.3, 2.4, 5.2, 5.5_

  - [x] 4.2 在 `transcription.rs` 中实现 `diarize_with_speakerkit`
    - 通过 `tokio::process::Command` 调用 `journal-speech diarize --audio <path>`
    - 解析 JSON stdout 为 `Vec<SpeakerSegment>` 结构（新增 `SpeakerSegment` 类型）
    - 实现超时控制，与转写超时逻辑一致
    - 通过 `transcription-progress` 事件推送 `"diarizing"` 状态
    - _Requirements: 1.2, 5.2, 6.4, 6.5_

  - [x] 4.3 实现 `merge_transcript_with_speakers` 合并函数
    - 将转写 segments 与说话人 segments 按时间戳匹配合并
    - 输出 segments 按 `start` 时间升序排列，每个 segment 都有 `speaker` 字段
    - 如果输入 segments 已包含 speaker 标签则不覆盖
    - _Requirements: 1.3, 4.2, 4.3, 4.5_

  - [ ]* 4.4 编写转写与说话人合并属性测试
    - **Property 1: 转写与说话人合并保持时间顺序且标注说话人** — 验证合并结果时间有序且说话人非空
    - **Validates: Requirements 1.2, 1.3, 4.2, 4.3, 4.4, 4.5**

  - [ ]* 4.5 编写 SpeakerKit 失败回退属性测试
    - **Property 2: SpeakerKit 失败时回退为原始转写** — 验证 diarization 失败时返回原始 Transcript 不变
    - **Validates: Requirements 1.5**

  - [ ]* 4.6 编写 Swift CLI JSON 解析往返属性测试
    - **Property 3: Swift CLI JSON 输出解析往返** — 验证 Transcript 序列化为 JSON 后再解析得到等价对象
    - **Validates: Requirements 2.4, 5.3**

  - [ ]* 4.7 编写超时计算属性测试
    - **Property 6: 超时计算正确性** — 验证任意正数音频时长的超时值等于 `max(duration * 3, 60)` 秒
    - **Validates: Requirements 5.5**

- [x] 5. 集成 Audio Pipeline 编排层
  - [x] 5.1 修改 `audio_pipeline.rs` 和 `transcription.rs` 集成新引擎
    - 在 `transcribe_audio_to_ai_markdown` 中添加 `"apple"` 分支，调用 `transcribe_with_apple_stt`
    - 转写完成后判断 segments 是否已含说话人标签：
      - 已含（whisperkit 提供）→ 跳过 SpeakerKit
      - 未含（apple / dashscope）→ 调用 `diarize_with_speakerkit`，失败时回退为无说话人标注
    - 将合并后的 Transcript 传入 `render_audio_ai_markdown` 生成 `*.audio-ai.md`
    - 进度事件依次报告 `"transcribing"` → `"diarizing"` → `"completed"`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 1.5_

  - [ ]* 5.2 编写音频 AI Markdown 产物属性测试
    - **Property 7: 音频 AI Markdown 产物包含必要字段** — 验证生成的 markdown 包含来源音频文件名、转写引擎名称、语言标识、说话人分离状态、转写内容正文
    - **Validates: Requirements 6.3**

- [x] 6. Checkpoint - 确认后端完整 pipeline 可运行
  - 确保 Apple STT 转写 → SpeakerKit 说话人分离 → 合并 → 生成 audio-ai.md 的完整流程正常工作，所有测试通过，如有问题请询问用户。

- [x] 7. 扩展前端三引擎选择 UI
  - [x] 7.1 修改 `src/lib/tauri.ts` 扩展 ASR 类型
    - 将 `AsrConfig.asr_engine` 类型从 `'dashscope' | 'whisperkit'` 扩展为 `'apple' | 'dashscope' | 'whisperkit'`
    - _Requirements: 3.1_

  - [x] 7.2 修改 `src/settings/components/SectionVoice.tsx` 实现三引擎卡片
    - 在 `ENGINES` 数组中添加 Apple 引擎卡片（`id: 'apple'`，label: `Apple 语音识别`，vendor: `系统内置 · 零配置`）
    - 将卡片布局从 `gridTemplateColumns: '1fr 1fr'` 改为 `'1fr 1fr 1fr'`
    - Apple 引擎选中时不显示额外配置项（无 API Key、无模型下载）
    - Apple 引擎就绪条件：macOS 版本 ≥ 13（可通过新增 Tauri command 检查，或前端默认视为就绪）
    - 保持 WhisperKit 和 DashScope 现有配置界面不变
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 7.3 修改 `src/App.tsx` 扩展 ASR 就绪检查逻辑
    - 在 `useEffect` 中的 ASR 就绪检查添加 `apple` 分支：Apple 引擎默认就绪（`setAsrReady(true)`）
    - _Requirements: 3.2_

- [x] 8. Final Checkpoint - 确保所有测试通过
  - 确保所有 Rust 单元测试和属性测试通过，前端 TypeScript 类型检查通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求条款以确保可追溯性
- Checkpoint 任务确保增量验证
- 属性测试使用 `proptest` 库（Rust），验证设计文档中定义的正确性属性
