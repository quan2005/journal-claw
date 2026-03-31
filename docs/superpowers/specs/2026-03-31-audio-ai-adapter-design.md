# 音频 AI 适配层设计

**日期**：2026-03-31
**状态**：已批准

---

## 背景

当前应用里，录音和导入音频虽然都落到 `raw/`，但后续处理并不统一：

- 录音路径在不同 ASR 引擎下存在分叉
- 导入音频路径会直接进入 AI 队列
- AI 当前不能稳定直接消费音频，因此需要一层音频专用适配

这次修改的目标不是建立通用素材标准化层，而是为“当前 AI 无法直接消费音频”提供一个可替换的临时适配层。

---

## 目标

- 录音和导入音频都只产出原始音频文件，统一放在 `raw/`
- 所有音频统一进入同一个 ASR 编排流程
- 为每个音频生成一个内容精简、AI 易读的 markdown 文件
- markdown 文件与原始音频放在同一个目录下
- AI 队列只消费该 markdown 文件，不再直接消费音频
- 保留现有转写状态、查看转写、重试转写等 UI 能力

---

## 不在范围内

- 文本、PDF、图片、视频等其他素材类型的统一标准化
- 录音实时流式转写
- 改造 AI 队列为多素材抽象框架
- 改变日志生成策略或 prompt 体系

---

## 设计原则

- 音频是唯一特例，不扩展成通用素材管线
- 适配层是临时性的，未来 AI 若原生支持音频，应可被旁路或删除
- 尽量复用现有 `ai_processor` 队列，不重写 AI 执行层
- 录音与导入音频在进入 AI 前必须完全同构

---

## 数据流

```text
录音 / 导入音频
  -> raw/<audio-file>
  -> 音频编排层
  -> ASR（DashScope / WhisperKit）
  -> raw/<audio-stem>.audio-ai.md
  -> AI 队列
  -> 日志条目 .md
```

### 文件落盘约定

示例：

```text
2603/raw/会议-a1b2c3d4.m4a
2603/raw/会议-a1b2c3d4.audio-ai.md
```

- 原始音频继续保留
- `*.audio-ai.md` 是提供给当前 AI 的适配文件
- 不再把 AI 专用 markdown 放到 `transcripts/` 子目录

---

## 模块职责

### 1. `audio_pipeline.rs`

新增音频专用编排模块，职责只有三项：

1. 接收已落盘的音频文件路径
2. 调用 ASR 生成转写并写出 `*.audio-ai.md`
3. 将该 markdown 路径送入现有 AI 队列

它不负责录音，不负责文件导入，也不负责 AI 执行细节。

### 2. `recorder.rs`

- 录音结束后只负责完成音频文件产出
- 后续统一调用 `audio_pipeline`
- 不再自行分支决定“直接喂 AI”还是“先转写再喂 AI”

### 3. `materials.rs` / 导入入口

- 导入音频只复制到 `raw/`
- 后续统一调用 `audio_pipeline`
- 不再由前端把音频路径直接塞进队列 UI

### 4. `transcription.rs`

- 保留 ASR 调用与转写状态管理
- 新增/重构为“生成音频 AI markdown”的能力
- 保留 `get_transcript` / `retry_transcription` 对前端的读取与重试支持

### 5. `ai_processor.rs`

- 尽量不改队列模型
- 音频场景下消费对象从 `*.m4a` 改为 `*.audio-ai.md`

---

## Markdown 产物格式

目标是“内容精简、AI 易理解”，而不是完整保真逐字稿。

建议结构：

```md
# 音频素材

- 来源音频: 会议-a1b2c3d4.m4a
- 转写引擎: whisperkit
- 语言: zh
- 说话人分离: 是

## 转写内容

**发言人 A**
今天先看一下项目排期……

**发言人 B**
我补充两个风险……
```

规则：

- 保留极少量元信息，帮助 AI 理解上下文
- 有说话人时按说话人聚合输出
- 无说话人时输出清洗后的连续正文
- 不写下载日志、调试日志、JSON 原文
- 不保留密集时间戳，只保留必要的说话人结构

---

## 事件与状态流

现有前端对音频处理的感知主要来自：

- `recording-processing`
- `recording-processed`
- `transcription-progress`
- `ai-processing`

新设计下：

- `recording-processing` 继续表示录音文件正在完成后处理
- `recording-processed` 表示原始音频已经落盘，可进入统一音频编排
- `transcription-progress` 仍由 ASR 阶段发出
- `ai-processing` 只针对 `*.audio-ai.md` 发出

队列 UI 中，音频任务在 ASR 完成前应显示为“转换中 / 转写中”，在生成 `*.audio-ai.md` 后再进入 AI 队列。

---

## 失败与重试

- ASR 失败时，不进入 AI 队列
- 保留失败状态，允许对原始音频执行“重试转写”
- 重试转写会重新生成 `*.audio-ai.md`
- 若成功，重新把 markdown 文件送入 AI 队列

---

## 兼容性要求

- 不破坏非音频素材的现有 AI 提交流程
- 不破坏录音详情页读取转写内容的能力
- 不依赖未来 AI 的音频原生能力
- 未来若 AI 可直接消费音频，可删除 `audio_pipeline`，并将入口改回直接投递音频

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src-tauri/src/audio_pipeline.rs` | 新增 | 音频专用编排层 |
| `src-tauri/src/main.rs` | 修改 | 注册新模块与命令 |
| `src-tauri/src/recorder.rs` | 修改 | 录音结束后统一走音频编排 |
| `src-tauri/src/materials.rs` | 修改 | 新增导入音频并触发编排命令 |
| `src-tauri/src/transcription.rs` | 修改 | 生成 `*.audio-ai.md`，并保留读取/重试能力 |
| `src-tauri/src/ai_processor.rs` | 修改 | 队列消费音频适配 markdown |
| `src/lib/tauri.ts` | 修改 | 新增音频编排 IPC 封装 |
| `src/App.tsx` | 修改 | 导入音频走统一后端编排，不再直接把音频塞入 AI 队列 |
| `src/hooks/useJournal.ts` | 修改 | 队列状态与事件收口 |
| `src/types.ts` | 修改 | 如有必要补充音频适配队列状态说明 |

