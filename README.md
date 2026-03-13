# Journal

macOS 桌面录音应用，一键录音，自动降噪，按时间轴管理所有录音。

## 功能

- 一键开始/停止录音
- 自动降噪（nnnoiseless RNN 模型）
- 自动去除静默片段
- 录音列表按月份分组展示
- 右键菜单：播放、在 Finder 中显示、删除
- 原生 macOS 标题栏（带红绿灯按钮）

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | [Tauri v2](https://tauri.app) |
| 前端 | React 18 + TypeScript + Vite |
| 音频采集 | cpal 0.17 |
| 降噪 | nnnoiseless 0.5 |
| 重采样 | rubato 0.15 |
| 编码 | hound（WAV 暂存）→ afconvert（M4A） |
| 元数据 | mp4ameta 0.13 |

## 音频处理流程

```
麦克风 → cpal 采集（f32） → hound 写入 WAV 暂存
  → rubato 重采样至 48 kHz
  → nnnoiseless 降噪
  → 去除静默片段（阈值 3 秒，缓冲 150 ms）
  → afconvert 编码为 M4A
  → 存储至 ~/Library/Application Support/journal/
```

## 目录结构

```
src/
  components/       React 组件（TitleBar, RecordingList, RecordButton 等）
  hooks/            useRecorder 状态管理
  lib/              format.ts（时间格式化）, tauri.ts（IPC 调用封装）
  styles/           全局样式
src-tauri/
  src/
    main.rs         入口，注册 Tauri 命令
    recorder.rs     录音控制（开始/停止）
    audio_process.rs  降噪、重采样、去静默
    recordings.rs   录音列表管理
    types.rs        共享数据类型
  capabilities/     Tauri 权限配置
  tauri.conf.json   应用配置
```

## 构建与运行

**前置依赖**

- Rust（stable）
- Node.js 18+
- macOS 12+（需要 `afconvert`，系统自带）

**开发模式**

```bash
npm install
npm run tauri dev
```

**构建**

```bash
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/` 下。

## 权限

首次运行时，macOS 会请求麦克风权限。如需手动开启，前往「系统设置 → 隐私与安全性 → 麦克风」。
