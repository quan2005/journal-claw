---
status: verified
date: 2026-07-08
slug: tree-select-regression
level: L1
---

# 文件树选中：内容不加载 + 选中反馈延迟

## 用户故事

作为 JournalClaw 用户，当我在左侧文件树点击一个文件时，我希望立即看到该行选中并且右侧正常显示文件内容。

## 背景与失败模式

[证据] story 20260706-workspace-disk-contract 把文件树根从 `topics/` 扩大到 workspace 根后：

1. `DetailView.tsx:72` 仍将不带 `topics/` 前缀的路径补上 `topics/` 再读取 → `topics/` 之外的文件读取路径错误，右侧永远转圈（用户截图证实）。
2. `TopicTree.tsx` / `TreeItem.tsx` 行背景有 `background-color 0.15s` 过渡，点击后选中底色淡入约 150ms，被感知为"操作延迟很严重"。

## 验收标准

- **AC-1** Given workspace 根下任意目录（含 `topics/` 之外）中的可预览文件，When 在文件树点击它，Then 右侧正常显示其内容（不再无限转圈）；`topics/` 内文件行为不回退。
- **AC-2** Given 文件树或日记列表中任意行，When 点击它，Then 选中底色立即出现（无淡入过渡），无可感知延迟。

## 边界（Won't）

- 不改内容加载协议与预览渲染；不动 hover 出现/消失的其它动效（chevron、操作按钮）；不解决大文件预览性能。
