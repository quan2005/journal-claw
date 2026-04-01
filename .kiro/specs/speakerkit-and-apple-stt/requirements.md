# 需求文档

## 简介

本特性为谨迹桌面应用引入两项核心能力：

1. **内置 SpeakerKit 说话人识别**：将当前依赖 whisperkit-cli 命令行工具的说话人分离（diarization）替换为内置的 SpeakerKit 模型，消除用户手动安装 whisperkit-cli 的步骤，实现开箱即用的说话人识别。
2. **Apple 原生语音转写引擎**：新增基于 macOS 系统自带 Speech Framework（`SFSpeechRecognizer`）的语音转写引擎，作为默认转写引擎，无需下载任何模型，零配置即可使用。注意：最新 macOS 版本已推出新的语音识别引擎，但本期仅实现 `SFSpeechRecognizer` 支持，后续版本再考虑新引擎的兼容适配。

两项能力结合后，用户在 macOS 上首次打开应用即可录音、转写、识别说话人，无需安装第三方工具或下载模型。

## 术语表

- **Journal_App**：谨迹桌面应用，基于 Tauri + React 构建的音频录制与笔记整理工具
- **SpeakerKit**：Apple 提供的说话人识别框架，可对音频进行说话人分离（diarization），输出每段语音对应的说话人标签
- **SpeakerKit_Model**：SpeakerKit 运行所需的机器学习模型文件，内置于应用安装包中
- **Apple_STT_Engine**：基于 macOS Speech Framework（`SFSpeechRecognizer`）的语音转写引擎，使用系统内置的语音识别能力
- **WhisperKit_Engine**：基于 WhisperKit（whisperkit-cli）的本地语音转写引擎，当前已集成的 ASR 引擎之一
- **DashScope_Engine**：基于阿里云 DashScope API 的云端语音转写引擎，当前已集成的 ASR 引擎之一
- **ASR_Config**：语音转写引擎配置，包含引擎选择、API Key、模型选择等参数
- **Audio_Pipeline**：音频处理编排层，负责将音频文件经过 ASR 转写后生成 AI 可消费的 markdown 文件
- **Transcript**：转写结果数据结构，包含纯文本、说话人分段（segments）等信息
- **Settings_UI**：应用设置界面中的语音转写配置面板

## 需求

### 需求 1：内置 SpeakerKit 说话人识别

**用户故事：** 作为谨迹用户，我希望应用内置说话人识别能力，这样我不需要安装任何第三方工具就能在转写结果中区分不同说话人。

#### 验收标准

1. THE Journal_App SHALL 在应用安装包中内置 SpeakerKit_Model，用户安装应用后无需额外下载模型即可使用说话人识别功能
2. WHEN 音频转写完成后，THE Journal_App SHALL 调用 SpeakerKit 对音频进行说话人分离，输出每段语音对应的说话人标签（如 Speaker A、Speaker B）
3. WHEN SpeakerKit 完成说话人分离后，THE Journal_App SHALL 将说话人标签与转写文本按时间顺序合并，生成带说话人标注的 Transcript
4. WHEN 音频中仅有一位说话人时，THE Journal_App SHALL 在 Transcript 中标注单一说话人，保持输出格式一致
5. IF SpeakerKit 处理失败，THEN THE Journal_App SHALL 回退为不带说话人标注的纯文本转写结果，并在日志中记录错误原因

### 需求 2：Apple 原生语音转写引擎

**用户故事：** 作为谨迹用户，我希望应用使用 macOS 系统自带的语音识别能力作为默认转写引擎，这样我无需下载模型或配置 API Key 就能开始使用录音转写功能。

#### 验收标准

1. THE Journal_App SHALL 提供基于 macOS Speech Framework（`SFSpeechRecognizer`）的 Apple_STT_Engine 作为语音转写引擎选项
2. THE Apple_STT_Engine SHALL 作为新安装用户的默认转写引擎
3. WHEN 用户使用 Apple_STT_Engine 进行转写时，THE Apple_STT_Engine SHALL 使用设备端（on-device）语音识别模型处理音频，无需网络连接
4. WHEN 转写完成后，THE Apple_STT_Engine SHALL 返回包含纯文本和时间戳信息的 Transcript
5. THE Apple_STT_Engine SHALL 支持中文（zh-CN）语音识别
6. IF 当前 macOS 版本不支持设备端语音识别，THEN THE Journal_App SHALL 在 Settings_UI 中显示明确的不兼容提示，并引导用户选择其他引擎

### 需求 3：ASR 引擎配置扩展

**用户故事：** 作为谨迹用户，我希望在设置中能够在三种转写引擎之间自由切换，这样我可以根据自己的需求选择合适的引擎。

#### 验收标准

1. THE ASR_Config SHALL 支持三种引擎选项：Apple_STT_Engine、WhisperKit_Engine、DashScope_Engine
2. THE Settings_UI SHALL 以卡片形式展示三种引擎，每种引擎显示名称、来源标识和就绪状态
3. WHEN 用户选择 Apple_STT_Engine 时，THE Settings_UI SHALL 不显示额外配置项（无需 API Key 或模型下载）
4. WHEN 用户选择 WhisperKit_Engine 时，THE Settings_UI SHALL 显示模型选择和下载管理界面（保持现有行为）
5. WHEN 用户选择 DashScope_Engine 时，THE Settings_UI SHALL 显示 API Key 输入框（保持现有行为）
6. WHEN 用户切换引擎并保存后，THE Journal_App SHALL 在后续所有录音和导入音频的转写中使用新选择的引擎

### 需求 4：SpeakerKit 与转写引擎协同

**用户故事：** 作为谨迹用户，我希望说话人识别能力能与任意转写引擎配合工作，这样无论我选择哪种转写引擎都能获得说话人标注。

#### 验收标准

1. THE Journal_App SHALL 将说话人识别（SpeakerKit）作为独立于转写引擎的后处理步骤运行
2. WHEN 使用 Apple_STT_Engine 转写完成后，THE Journal_App SHALL 调用 SpeakerKit 对同一音频进行说话人分离，并将结果与转写文本合并
3. WHEN 使用 DashScope_Engine 转写完成后，THE Journal_App SHALL 调用 SpeakerKit 对原始音频进行说话人分离，并将结果与转写文本合并
4. WHEN 使用 WhisperKit_Engine 且 whisperkit-cli 已提供说话人分离结果时，THE Journal_App SHALL 优先使用 whisperkit-cli 的说话人分离结果，跳过 SpeakerKit 处理
5. THE Journal_App SHALL 在 Transcript 的 segments 字段中统一存储说话人标签，格式与现有 WhisperSegment 结构兼容

### 需求 5：Swift 原生桥接层

**用户故事：** 作为开发者，我希望通过 Swift 原生代码桥接 SpeakerKit 和 Speech Framework，这样 Rust 后端可以通过进程调用获取转写和说话人识别结果。

#### 验收标准

1. THE Journal_App SHALL 包含一个 Swift 编写的命令行工具（CLI），封装 SpeakerKit 和 SFSpeechRecognizer 的调用
2. WHEN Rust 后端需要进行 Apple 原生语音转写时，THE Journal_App SHALL 通过 `tokio::process::Command` 调用该 Swift CLI，传入音频文件路径和参数
3. THE Swift CLI SHALL 以 JSON 格式输出转写结果，包含纯文本、时间戳分段和说话人标签
4. THE Swift CLI SHALL 作为 Tauri sidecar 二进制内置于应用安装包中
5. IF Swift CLI 执行超时（超过音频时长的 3 倍），THEN THE Journal_App SHALL 终止该进程并返回超时错误

### 需求 6：Audio Pipeline 集成

**用户故事：** 作为开发者，我希望新引擎和说话人识别能力无缝接入现有的音频处理编排层，这样不需要改变录音和导入音频的上层流程。

#### 验收标准

1. THE Audio_Pipeline SHALL 根据 ASR_Config 中的引擎选择，调用对应的转写引擎（Apple_STT_Engine、WhisperKit_Engine 或 DashScope_Engine）
2. WHEN 转写完成后，THE Audio_Pipeline SHALL 调用 SpeakerKit 进行说话人分离（除非转写引擎已提供说话人结果）
3. THE Audio_Pipeline SHALL 将合并后的转写结果写入 `*.audio-ai.md` 文件，格式与现有音频 AI markdown 产物一致
4. THE Audio_Pipeline SHALL 通过 `transcription-progress` 事件向前端推送转写和说话人识别的进度状态
5. WHEN 使用 Apple_STT_Engine 时，THE Audio_Pipeline SHALL 在进度事件中依次报告 "transcribing"、"diarizing"、"completed" 状态

### 需求 7：默认引擎迁移

**用户故事：** 作为谨迹用户，我希望升级应用后默认转写引擎自动切换为 Apple 原生引擎，这样我可以立即体验零配置的转写能力。

#### 验收标准

1. WHEN 用户从旧版本升级且当前配置的 ASR 引擎为 WhisperKit_Engine 但 whisperkit-cli 未安装时，THE Journal_App SHALL 自动将默认引擎切换为 Apple_STT_Engine
2. WHEN 用户从旧版本升级且当前配置的 ASR 引擎为 DashScope_Engine 且 API Key 已配置时，THE Journal_App SHALL 保持用户的现有引擎选择不变
3. WHEN 新用户首次启动应用时，THE ASR_Config SHALL 默认选择 Apple_STT_Engine
4. THE Journal_App SHALL 在配置文件中将 `asr_engine` 的默认值从 "whisperkit" 更改为 "apple"
