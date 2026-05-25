---
title: 组件规范
description: JournalClaw 核心组件的设计规范：录音按钮、列表项、AI 状态标识、来源徽章、分段控件等。
---

# 组件规范

## 录音按钮（主要 CTA）

应用中最重要的交互元素。实心琥珀金，圆形，居中于 Command Dock。

- **背景**：`--record-btn`（`#B8782A` / `#C8933B`）
- **图标**：`--record-btn-icon`（反转底色）
- **Hover**：`--record-btn-hover`，`transform: scale(1.04)`
- **录音中**：脉冲切换为 `--accent` 红（`#ff3b30` / `#ff375f`）
- **Focus**：`outline: 2px solid color-mix(in srgb, var(--record-btn) 68%, white)`
- **过渡**：`background-color 0.18s ease, transform 0.18s ease, opacity 0.18s ease`

## 列表项（知识条目卡片）

扁平行，无卡片外壳。层次靠间距和字重区分，不靠边框或阴影。

- **默认**：透明背景
- **Hover**：`--item-hover-bg`（`#F7F0E4` / `rgba(255,255,255,0.03)`）
- **选中**：`--item-selected-bg` + 左侧 `--record-highlight-bar` 色条
- **录音来源**：`--record-highlight` 背景 + `--record-highlight-bar` 左边界
- **图标容器**：`--item-icon-bg`，6px 圆角

## AI 状态标识

AI 处理状态的行内指示器。琥珀调性，紧凑。

- **背景**：`--ai-pill-bg`（`#FBF3E5` / `#1a1708`）
- **边框**：`--ai-pill-border`（`#D4A855` / `#3a3018`）
- **文字**：`--ai-pill-text`（`#8A6500` / `#C8933B`）
- **活跃态**：更深的背景（`--ai-pill-active-bg`），更强的边框

## Command Dock

底部操作栏，包含录音按钮、文件拖放区、文字粘贴区。

- **背景**：`--dock-bg`（与侧边栏一致，略深于主背景）
- **顶部边框**：`1px solid --dock-border`
- **拖放区边框**：`--dock-dropzone-border`，虚线
- **拖放区 hover**：`--dock-dropzone-hover-border`（琥珀），`--dock-dropzone-hover-bg`
- **粘贴活跃**：`--dock-paste-border`（琥珀），`--dock-paste-bg`
- **键盘提示**：`--dock-kbd-bg` / `--dock-kbd-text` / `--dock-kbd-border`（琥珀系）
- **脉冲提示**：`kbd-glow-pulse` 动画，2.4s ease-in-out，opacity 0.4→1

## 来源徽章

紧凑的行内标识，指示内容来源。每种类型有自己的语义色彩：

| 类型 | 浅色 bg / text / border | 深色 bg / text / border |
|---|---|---|
| 语音 | `#FBF3E5` / `#8A6500` / `#D4B878` | `#2a1f0f` / `#c8933a` / `#4a3010` |
| 文档 | `#e8f0fa` / `#3a6a9a` / `#c0d4ea` | `#0f1a2a` / `#4a8ac8` / `#1a3050` |
| AI | `#ededfa` / `#5a5a9a` / `#c8c8e8` | `#1a1a2a` / `#7a7ac8` / `#2a2a50` |

## 分段控件

视图模式切换的 Tab 风格。

- **默认**：`--segment-bg`（近透明），`--segment-text`
- **活跃**：`--segment-active-bg`（琥珀 10-12% 透明度），`--segment-active-text`（琥珀）
- 无边框、无阴影——纯透明度区分

## 右键菜单

- **背景**：`--context-menu-bg`
- **边框**：`1px solid --context-menu-border`
- **阴影**：`--context-menu-shadow`（浅色：`rgba(0,0,0,0.15)`，深色：`rgba(0,0,0,0.5)`）
- **圆角**：8px

## 滚动条

极致克制，4px 宽，轨道始终透明。

- **滑块**：`--scrollbar-thumb`（浅色：`#d2d5d8`，深色：`rgba(255,255,255,0.10)`）
- **滑块 hover**：`--scrollbar-thumb-hover`
- **轨道**：transparent
