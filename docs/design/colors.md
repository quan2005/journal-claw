---
title: 色板
description: JournalClaw 完整色彩 Token 参考，含浅色/深色双主题色值。
---

# 色板

## 强调色

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--accent` | `#ff3b30` | `#ff375f` | 录音状态（仅录制中） |
| `--record-btn` | `#B8782A` | `#C8933B` | 主交互色 — 按钮、选中态、活跃 UI |
| `--record-btn-hover` | `#A06820` | `#d9a44b` | 琥珀金 hover 态 |
| `--record-btn-icon` | `#f5f6f7` | `#0f0f0f` | 实心按钮上的图标色 |

琥珀金（`--record-btn`）是谨迹的起始色。录音红（`--accent`）专属于"正在录音"——语义分离。

## 表面与背景

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--bg` | `#f5f6f7` | `#0f0f0f` | 主应用背景 |
| `--titlebar-bg` | `#edf0f1` | `#161616` | 标题栏 / 拖拽区域 |
| `--sidebar-bg` | `#f0f2f3` | `#141414` | 左侧边栏 |
| `--dock-bg` | `#f0f2f3` | `#141414` | 底部命令栏 |
| `--detail-bg` | `= --bg` | `= --bg` | 右侧详情面板 |
| `--md-pre-bg` | `#f7f8f9` | `#141414` | 代码块背景 |
| `--queue-bg` | `#f7f8f9` | `#1c1c1e` | 处理队列容器 |
| `--context-menu-bg` | `#f5f6f7` | `#1e1e1e` | 右键菜单 |

## 文字

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--item-text` | `#1c1c1e` | `#e8e8e8` | 主要文字 — 列表、标题 |
| `--item-meta` | `#6a7278` | `#a2a6ae` | 次要文字 — 日期、标签 |
| `--duration-text` | `#a0a8ad` | `#48484a` | 三级文字 — 时长 |
| `--month-label` | `#6a7278` | `#353840` | 月份分组标签 |
| `--muted-text` | `#8A8078` | `#736D65` | 禁用 / 弱化文字 |

## 分割线与边框

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--divider` | `#d8dce0` | `#1e2228` | Section 分割、面板边框 |
| `--dock-border` | `#d8dce0` | `#252525` | 命令栏顶部边框 |
| `--detail-case-border` | `#d8dce0` | `#1e2228` | 详情面板卡片边框 |
| `--context-menu-border` | `#d8dce0` | `#2e3238` | 右键菜单边框 |

## 交互态

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--item-hover-bg` | `#F7F0E4` | `rgba(255,255,255,0.03)` | 列表项 hover |
| `--item-selected-bg` | `#F0E4CC` | `#1a1c20` | 列表项选中背景 |
| `--item-selected-text` | `#7A5800` | `#C8933B` | 选中项主要文字 |
| `--item-selected-meta` | `#A07828` | `#a07830` | 选中项次要文字 |
| `--record-highlight` | `#FBF3E5` | `rgba(200,147,59,0.06)` | 录音来源条目高亮 |
| `--record-highlight-bar` | `#B8782A` | `#C8933B` | 录音条目左边界 |
| `--item-icon-bg` | `#F5EDD8` | `#2c2c2e` | 图标容器 |

## 语义色

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--status-danger` | `#B5312A` | `#e06c60` | 错误 / 危险操作 |
| `--status-danger-bg` | `#FDE8E5` | `rgba(224,108,96,0.12)` | 错误背景 |
| `--status-warning` | `#8A6500` | `#C8933B` | 警告（深色下共用琥珀） |
| `--status-warning-bg` | `#FBF3E5` | `rgba(200,147,59,0.12)` | 警告背景 |
| `--status-success` | `#266B45` | `#5ba67a` | 成功 / 确认 |
| `--status-success-bg` | `#E5F2EA` | `rgba(91,166,122,0.12)` | 成功背景 |

## 文件类型色

| 类型 | 浅色 | 深色 |
|---|---|---|
| PDF | `#B5312A` | `#e06c60` |
| DOCX | `#3A5FA8` | `#5a8ae0` |
| Markdown | `#635850` | `#A89880` |
| 音频 | `#5F4290` | `#9a7ec7` |
| 图片 | `#266B45` | `#5ba67a` |

文件类型色仅用文件徽章——绝不用于装饰。
