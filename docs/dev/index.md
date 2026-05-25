---
title: 开发概览
description: JournalClaw 的开发指南入口，涵盖项目架构、环境搭建、前端和后端开发、构建发布。
---

# 开发指南

谨迹是一个 Tauri v2 桌面应用，前端 React 19 + TypeScript，后端 Rust。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 |
| 前端 | React 19 + TypeScript + Vite 7 |
| 样式 | 纯 CSS（CSS 变量 + tokens） |
| 后端 | Rust（50+ IPC 命令） |
| 音频采集 | cpal 0.17 |
| 音频处理 | nnnoiseless + rubato + afconvert |
| 语音转文字 | Apple SpeechAnalyzer / WhisperKit / DashScope |
| AI 引擎 | 内置 Anthropic Messages API 客户端（多厂商） |
| 序列化 | serde / serde_json |
| 测试 | vitest (前端) + cargo test (后端) + Playwright (E2E) |

## 目录结构

```
src/                     # 前端
  components/            # React 组件（30+）
  hooks/                 # useJournal, useRecorder, useTheme, useIdentity, useTodos, useConversation
  lib/tauri.ts           # 所有 IPC 调用封装（单一入口）
  types.ts               # 共享类型
  contexts/              # I18nContext（中/英）
  settings/              # 设置面板（9 个 Section）
src-tauri/src/           # Rust 后端
  main.rs                # Tauri setup，菜单，50+ invoke_handler 命令
  config.rs              # 应用配置（厂商、ASR、飞书、WhisperKit）
  llm/                   # 内置 LLM 引擎（Anthropic Messages API，工具循环）
  conversation.rs        # 聊天/Agent 会话，流式输出
  ai_processor.rs        # AI 处理队列，事件发射
  recorder.rs            # 录音控制（cpal → WAV → M4A）
  audio_pipeline.rs      # 音频预处理管线
  audio_process.rs       # 降噪 / 重采样 / 去静默
  transcription.rs       # 语音转文字（Apple / DashScope / WhisperKit）
  journal.rs             # 日志条目扫描与 YAML frontmatter 解析
  identity.rs            # 画像管理（人物、项目、概念）
  speaker_profiles.rs    # 设备端说话人识别
  todos.rs               # 待办事项，路径分组，截止日期
  auto_lint.rs           # 定时知识库维护
  skills.rs              # 技能插件发现（SKILL.md）
  feishu_bridge.rs       # 飞书 WebSocket 客户端
  materials.rs           # 文件导入与文字粘贴
  permissions.rs         # macOS 麦克风/语音识别权限检查
  workspace.rs           # 工作区路径工具函数
  workspace_settings.rs  # 工作区设置（主题、自动整理）
```

## 快速导航

- [架构全景](/docs/dev/architecture) — 数据流、IPC 模式、事件系统
- [环境搭建](/docs/dev/setup) — 依赖安装、开发模式、调试
- [前端开发](/docs/dev/frontend) — React 组件、Hooks、IPC 调用
- [后端开发](/docs/dev/backend) — Rust 命令、模块地图、LLM 引擎
- [构建与发布](/docs/dev/building) — 构建配置、签名、发布流程
