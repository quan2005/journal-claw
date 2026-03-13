# Audio Processing — 设计文档

**日期：** 2026-03-13
**状态：** 已确认

---

## 概述

在 Journal 录音停止时自动对音频进行两步处理：

1. **降噪（nnnoiseless）** — 消除空调、风扇、电流等稳定背景噪音
2. **静音剔除** — 剪掉连续 ≥ 3 秒的无声片段

处理对用户完全透明，失败时静默跳过，保留原始音频。

---

## 处理管道

```
WAV finalize（现有）
  ↓
① 重采样到 48kHz 单声道（rubato）
  ↓
② nnnoiseless 降噪（480 samples/帧，逐帧处理）
  ↓
③ 3 秒静音剔除（RMS 窗口检测）
  ↓
afconvert → M4A（现有）
```

**顺序原因：** 先降噪再检测静音，避免背景噪音（RMS 不为零）干扰静音检测。

---

## 技术方案

### 降噪：nnnoiseless

- Mozilla RNNoise 的 Rust 移植，专为人声录音设计
- 要求输入：48kHz、单声道、f32 样本
- 帧大小：480 samples（= 10ms at 48kHz）
- 无需噪音底噪采样，开头说话不影响效果

### 重采样：rubato

- 将 cpal 采集的原始采样率（通常 44.1kHz 或 48kHz）和声道数转换为 48kHz 单声道
- 使用 `FftFixedIn` 重采样器，质量与速度平衡

### 静音剔除

- 窗口大小：100ms（= 4800 samples at 48kHz）
- 静音判定阈值：RMS < 0.01（约 -40dB）
- 最小剔除时长：3 秒（= 30 个连续静音窗口）
- 切点缓冲：每个剔除区间两端各保留 150ms，避免声音突兀截断
- 边界情况：若整段都是静音，保留最后 150ms，不产生空文件

---

## 代码结构

### 新增文件

**`src-tauri/src/audio_process.rs`**

```rust
pub fn process_audio(wav_path: &PathBuf) -> Result<(), String>
```

内部步骤：
1. 读取 WAV（hound）
2. 重采样到 48kHz 单声道（rubato）
3. nnnoiseless 降噪
4. 静音剔除
5. 写回同一 WAV 文件

### 修改文件

**`src-tauri/src/recorder.rs`**

在 `stop_recording` 的 WAV finalize 之后、afconvert 之前插入：

```rust
let _ = crate::audio_process::process_audio(&wav_path);
// 失败静默跳过，继续转换
```

**`src-tauri/src/main.rs`**

添加 `mod audio_process;`

### 新增 Cargo 依赖

```toml
nnnoiseless = "0.5"
rubato = "0.15"
```

---

## 错误处理

- 重采样失败 → 跳过整个处理流程，使用原始 WAV
- 降噪失败 → 跳过降噪，继续静音剔除
- 静音剔除失败 → 跳过，使用已降噪的 WAV
- 任何步骤失败均不影响最终 M4A 文件的生成

---

## 明确不做

- 不提供降噪开关（始终自动处理）
- 不暴露静音阈值配置（固定 3 秒）
- 不对已有录音做批量处理
- 不在 UI 显示处理进度
