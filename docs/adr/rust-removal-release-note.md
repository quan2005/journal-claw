# Rust 后端删除 release note 草稿

日期：2026-06-27

## 摘要

本版本完成 JournalClaw 的后端终局迁移：应用不再依赖 Rust/Tauri 后端，默认桌面宿主切换为 Electron，业务能力由 TypeScript daemon 提供。

## 对用户有什么变化

- 日志浏览、工作区文件、待办、主题、身份画像、自动化、AI run、ChangeSet、沉淀等默认路径改由本地 daemon 承载。
- 桌面窗口、菜单、文件选择、Reveal、系统打开、缩放和主题同步由 Electron host 承载。
- 应用发布包不再包含 Rust 后端、Swift sidecar、WhisperKit / Apple SpeechAnalyzer 相关二进制。
- 默认构建与测试不再需要 Rust toolchain、Xcode、Swift 或音频平台依赖。

## 替代能力

| 旧路径 | 新路径 |
|---|---|
| Native command 调用 | daemon HTTP + SSE runtime client |
| Rust 内建 LLM/tool loop | daemon pi 内建引擎 |
| Rust conversation | daemon Agent Run / conversation service |
| 系统文件操作 command | daemon file/material services + Electron host bridge |
| Rust automation runner | daemon automation service |
| Rust event emission | daemon SSE event stream |

## 下线能力

- 本地录音、语音转写、说话人识别和相关模型管理已下线。
- MDX 特有渲染/编译路径已下线，笔记按 Markdown 路径阅读。
- Tauri clipboard 文件路径读取已移除；文本和图片粘贴仍走浏览器事件路径，文件选择/拖放走 Electron host。

## 数据兼容

现有 workspace 文件格式保持可读，不需要重新导入。新 run events、ChangeSet、artifact index、memory/rule 记录仍是普通 workspace 文件，可备份和导出。

## 回滚

短期回滚步骤见 `docs/adr/rust-removal-rollback.md`。主干不再新增 Rust 后端能力。
