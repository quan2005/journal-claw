---
id: STORY-20260708-restore-app-icon
title: 恢复谨迹应用 icon 与应用名（替换 Electron 默认）
status: verified # draft → clarifying → approved → in_progress → verified
source: gate
level: L1
hypothesis_basis: data
design: ./design.md
created: 2026-07-08
related: []
---

# 恢复谨迹应用 icon 与应用名

> 一句话概括：**为谨迹用户把 Dock/任务栏上的 Electron 默认 icon 和 "Electron" 名字换回谨迹自己的品牌**

## 用户故事（Connextra）

作为 **在 macOS 上日常使用谨迹的用户**，
当我 **在 Dock / 程序切换器中查看或 hover 应用**，
我希望 **看到谨迹的 icon 和「谨迹 / JournalClaw」的名字**，
以便 **一眼认出应用，不与其他 Electron 应用混淆**。

## 真实用户问题（背景，讲故事）

Rust/Tauri 删除（M8-b）迁移到 Electron 时，原 `src-tauri/icons/`（icns/ico/全尺寸 png + `scripts/generate-icons.mjs`）被整体删除，Electron 宿主未配置 icon 与应用名，导致 dev 模式与打包产物（`JournalClaw.app` 内仍是 `electron.icns`）都顶着 Electron 默认脸、hover 显示 "Electron"。

[证据] `apps/desktop/release/mac-arm64/JournalClaw.app/Contents/Resources/electron.icns`；git 历史 `bbe354d^` 可完整恢复旧 icon 资产。
[证据] 用户拍板：**原样恢复**旧 icon（麦克风语义过时的问题留待后续品牌更新，不在本故事）。

### 现状失败模式

- 现在：Dock icon = Electron 默认，hover 名 = "Electron"。
- 为什么不够好：无法辨识，品牌缺失。

## 成功标准（脊柱 Q4）

- Dock/任务栏 icon：Electron 默认 → 谨迹旧 icon。
- hover/程序切换器名称："Electron" → 谨迹的应用名（JournalClaw / 谨迹）。

## 验收标准（Given-When-Then）

### AC-1 — dev 模式品牌正确

- **Given** 用户以 `npm run desktop:dev` 启动应用
- **When** 查看 Dock icon 并 hover
- **Then** 显示谨迹 icon 与应用名，而非 Electron 默认

### AC-2 — 打包产物品牌正确

- **Given** 用户安装/打开打包后的应用
- **When** 查看 Dock、程序切换器、About 窗口
- **Then** icon 与名称均为谨迹的

## 三类边界（Won't）

- **不为哪些用户做**：无排除。
- **不在哪些场景出现**：不涉及应用内 UI 的 icon 体系（那是 DESIGN.md 图标规范的事）。
- **不解决哪些相关但不同的问题**：不重新设计 icon（原样恢复，麦克风元素过时问题另立故事）；不做 Windows/Linux 打包适配之外的额外工作（按现有打包目标恢复即可）。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] 从 git 历史恢复资产的落位目录与 electron-builder / dev BrowserWindow 的 icon、productName 配置点

## 待确认（意图层）

| #   | 问题       | 当前默认值   | 状态     |
| --- | ---------- | ------------ | -------- |
| Q1  | icon 来源  | 原样恢复旧图 | 用户已答 |

## INVEST 自检（输出闸记录）

- [x] I / [x] N / [x] V / [x] E / [x] S / [x] T（AC 均可肉眼+打包验证）

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口 |
| ---- | ---------- | --------- | -------- |
| 1    | 2026-07-08 | 可开发    | 无       |
