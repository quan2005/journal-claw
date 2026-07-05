---
status: verified
slug: 20260628-agentrun-i18n
owner: opencode (技术执行)
source: 终局 UI 10 优化目标 — G2
---

# Agent Run / 自动化 文案 i18n 补齐（opencode 批次）

## 用户故事

作为一名使用中文界面的知识工作者，
我希望右侧 Agent Run 面板与自动化页的文案是中文（跟随当前语言），
以便整个产品语言一致，不再出现突兀的英文裸串让我觉得这是「半成品」。

## 背景与失败模式

[证据] `apps/web/src/components/AgentRunPanel.tsx` 硬编码英文：`Agent Run`(L67)、`What should the agent do?`(L80)、`Workspace write`(L29)、`Start run`(L97)，以及 `GOAL`/`AUTHORIZATION` label。
[证据] `自动化` 页右上「10 of 10」分页计数为英文裸串。
[证据] 项目已有 `apps/web/src/locales/en.ts` 与 `zh.ts` 作为 i18n 单一来源。

## 成功标准（GWT 验收）

- **AC-1**（Agent Run 中文化）Given 当前语言为中文，When 打开右侧 Agent Run 面板，Then 标题、GOAL/AUTHORIZATION label、输入占位、授权选项（如 Workspace write）、Start run 按钮全部显示中文文案。
- **AC-2**（自动化计数中文化）Given 自动化页模板区显示「N of M」计数，When 当前语言为中文，Then 显示中文等效表述（如「共 M 个 / 第 N 个」由实现按现有文案风格定）。
- **AC-3**（走 locale 单一来源）Given 上述文案，When 检查源码，Then 文案取自 `locales/zh.ts` / `en.ts`，组件内无新增英文 hardcode；en 与 zh 两侧 key 对齐。
- **AC-4**（构建/类型/测试不回退）Given 改动完成，When 运行 `npm run build` 与 `npm test`，Then 全部通过。

## 边界（Won't）

- 不改 Agent Run 的运行逻辑、授权枚举值（仅改展示文案）。
- 不改面板布局、配色、按钮状态机。
- 不顺手翻译其它页面未列出的英文串（本批次仅 Agent Run 面板 + 自动化计数）。

## 交棒 design（实现层）

- 授权模式枚举值（workspace_write 等）是 key，展示标签走 locale 映射，勿改枚举本身。
- 若 `自动化` 计数当前是模板字符串拼接，改为 locale 带参数函数，保持 en/zh 对齐。
