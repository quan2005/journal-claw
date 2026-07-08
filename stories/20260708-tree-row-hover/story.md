---
status: verified
date: 2026-07-08
slug: tree-row-hover
level: L1
---

# 左侧文件树行 hover 底纹

## 用户故事

作为 JournalClaw 用户，当我在左侧边栏用鼠标扫过文件树（workspace 文件/目录行）时，我希望当前悬停的行有底纹变化，让我确认即将点击的目标。

## 背景与失败模式

[证据] `TreeItem.tsx:253-258`（日记条目行）已有 hover 底纹（`--item-hover-bg`）；`TopicTree.tsx:68`（文件树行）只有选中态背景，无 hover 态。同一侧边栏两类列表行为不一致，文件树扫过时无任何反馈，视觉一致性铁律（DESIGN.md）被违反。

## 验收标准

- **AC-1** Given 左侧文件树中任意未选中的文件/目录行，When 鼠标悬停其上，Then 该行背景变为与日记列表行 hover 一致的底纹（`--item-hover-bg`），移开后恢复透明。
- **AC-2** Given 已选中的行，When 鼠标悬停，Then 保持选中态背景不被 hover 覆盖。

## 边界（Won't）

- 不为触屏/键盘导航新增高亮逻辑；不改选中态、图标、动效时长；不解决行内操作按钮的样式问题（已有机制）。
