---
title: 核心画像置顶
status: verified
source: gate-L1
created: 2026-06-12
---

## 背景

画像列表（TreeSidebar identity 分区）中，Soul（CLAUDE.md，Agent 设定）和 README.md（用户本人）是最重要的两个条目，当前和普通画像混排，需要快速定位。

## 需求

在画像列表顶部新增「核心画像」分组，固定展示 Soul 和 README 两项，与下方普通画像分开。选中后走现有 DetailView 逻辑，无需改造详情面板。

## AC

- AC-1: 画像分区顶部显示「核心画像」分组，包含 Soul 和 README.md 两个条目
- AC-2: 核心画像分组始终置顶，不参与字母排序
- AC-3: 点击核心画像条目，DetailView 正常展示对应内容（复用现有逻辑）
- AC-4: 普通画像列表中不再重复出现 Soul 和 README

## 非目标

- 不改造 DetailView 布局或渲染逻辑
- 不新增数据字段或后端命令
- （验收回写）核心画像条目禁用归档菜单——通过 UI 状态字段 `isCoreIdentity` 实现，非持久化数据字段，与 identity-archive AC-8「核心画像不可归档」一致，属合理防误操作
