---
title: 安装与配置
description: 下载安装 JournalClaw，配置 AI 提供商，设置工作区。
---

# 安装与配置

## 系统要求

- macOS 12（Monterey）及以上
- macOS 26+ 支持 Apple SpeechAnalyzer（更高精度的本地语音识别）
- 至少 500MB 可用磁盘空间

## 下载安装

从 [GitHub Releases](https://github.com/quan2005/journal/releases) 下载最新的 `.dmg` 文件，双击挂载后将谨迹拖入 Applications 文件夹。

首次打开时，macOS 可能提示"无法验证开发者"：
1. 打开系统设置 → 隐私与安全性
2. 在安全性区域找到谨迹，点击"仍要打开"

## 初次配置

### 1. AI 引擎

谨迹需要连接到一个 LLM 提供商才能进行 AI 编译和对话。

打开 **设置 → AI 引擎**，选择并配置一个提供商：

| 提供商 | 需要的信息 | 说明 |
|---|---|---|
| Anthropic | API Key | 官方 Claude API，推荐 |
| 火山方舟 | API Key + Endpoint ID | 字节跳动旗下 |
| 智谱 AI | API Key | 国内大模型 |
| 阿里云百炼 | API Key | 阿里云 DashScope |

API Key 安全存储在你的 macOS Keychain 中。

### 2. 工作区

工作区是你所有资料和知识条目的存储位置。

打开 **设置 → 通用**，设置工作区路径。建议选择专门的文件夹，例如 `~/Documents/Journal/`。

工作区目录结构：

```
workspace/
├── 2505/              # 2025年5月
│   ├── raw/           # 原始资料（录音、文档、粘贴）
│   └── 01-会议纪要.md  # 知识条目
├── identity/          # 画像数据
├── skills/            # 技能插件（SKILL.md）
└── config.json        # 工作区配置
```

### 3. 麦克风权限

首次使用录音功能时，系统会弹出权限请求。允许谨迹访问麦克风。

如果误拒绝：系统设置 → 隐私与安全性 → 麦克风 → 开启谨迹。

## 验证配置

配置完成后，尝试导入一段文字来验证 AI 引擎是否正常工作：

1. 在底部的 Command Dock 中粘贴一段文字
2. 点击提交
3. 观察 AI 处理状态
4. 检查时间线中是否出现了新的知识条目

## 下一步

[快速上手](/docs/guide/quick-start) — 了解完整的日常使用流程。
