# 实现计划：浅色主题优化（Impeccable 设计理念）

## 概述

按照设计文档中的颜色映射表，分步修改 `src/styles/globals.css` 中 `:root` 和 `[data-theme="light"]` 的 CSS 变量值，以及 `src/lib/tags.ts` 中浅色主题的标签 alpha 值。每步增量修改，确保暗色主题不受影响。

## 任务

- [x] 1. 修改背景与 Surface 层级变量
  - [x] 1.1 更新 `:root` 中的背景与 Surface 变量
    - 将 `--bg` 从 `#ffffff` 改为 `#f5f6f7`
    - 将 `--sidebar-bg` 从 `#f8f8f8` 改为 `#f0f2f3`
    - 将 `--dock-bg` 从 `#f8f8f8` 改为 `#f0f2f3`
    - 将 `--titlebar-bg` 从 `rgba(0,0,0,0.04)` 改为 `#edf0f1`
    - 将 `--item-icon-bg` 从 `#f2f2f7` 改为 `#eef1f3`
    - 将 `--detail-case-bg` 从 `#f5f5f7` 改为 `#f7f8f9`
    - 将 `--md-pre-bg` 从 `#f5f5f7` 改为 `#f7f8f9`
    - 将 `--queue-bg` 从 `#f0f0f2` 改为 `#f7f8f9`
    - 将 `--context-menu-bg` 从 `#ffffff` 改为 `#f5f6f7`
    - 将 `--record-btn-icon` 从 `#ffffff` 改为 `#f5f6f7`
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.6, 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 1.2 同步更新 `[data-theme="light"]` 中对应的背景与 Surface 变量
    - 与 1.1 相同的变量和值，确保 `:root` 和 `[data-theme="light"]` 保持一致
    - _需求: 1.1, 1.2, 1.3, 1.4, 3.1~3.8_

- [x] 2. 消除 Alpha 依赖 — 替换为不透明色
  - [x] 2.1 更新 `:root` 中的 alpha 变量为不透明色
    - 将 `--item-selected-bg` 从 `rgba(58,90,106,0.05)` 改为 `#ebeef0`
    - 将 `--item-hover-bg` 从 `rgba(0,0,0,0.04)` 改为 `#eff1f2`
    - 将 `--dock-dropzone-hover-bg` 从 `rgba(58,90,106,0.06)` 改为 `#ebeef0`
    - 将 `--record-highlight` 从 `rgba(58,90,106,0.06)` 改为 `#ebeef0`
    - 将 `--md-code-bg` 从 `rgba(0,0,0,0.055)` 改为 `#e8eaec`
    - 将 `--scrollbar-thumb` 从 `rgba(0,0,0,0.12)` 改为 `#d2d5d8`
    - 将 `--scrollbar-thumb-hover` 从 `rgba(0,0,0,0.22)` 改为 `#bec2c5`
    - 保留 `--sheet-overlay`、`--queue-shadow`、`--context-menu-shadow` 的 rgba 值不变
    - _需求: 2.1~2.9, 4.1, 4.2_
  - [x] 2.2 同步更新 `[data-theme="light"]` 中对应的 alpha 变量
    - 与 2.1 相同的变量和值
    - _需求: 2.1~2.9, 4.1, 4.2_
  - [x] 2.3 编写属性测试：Alpha-Free 不透明色（Property 2）
    - **Property 2: Alpha-Free 不透明色**
    - 对所有需消除 alpha 的变量，验证其值不包含 `rgba`、`hsla` 或任何 alpha 通道语法
    - **验证: 需求 2.1~2.7, 4.1, 4.2**
  - [x] 2.4 编写属性测试：Alpha 替换视觉保真度（Property 3）
    - **Property 3: Alpha 替换视觉保真度**
    - 对所有被替换的 alpha 变量，计算原始 rgba 在 --bg (#f5f6f7) 上的合成色与新值的 OKLCH 色差 ΔE，验证 ΔE < 2
    - **验证: 需求 2.10**

- [x] 3. 检查点 — 确保背景和 Alpha 消除改动正确
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 4. 更新分割线、边框与交互状态变量
  - [x] 4.1 更新 `:root` 中的分割线与边框变量
    - 将 `--divider` 从 `#e5e5ea` 改为 `#d8dce0`
    - 将 `--dock-border` 从 `#e5e5ea` 改为 `#d8dce0`
    - 将 `--detail-case-border` 从 `#e5e5ea` 改为 `#d8dce0`
    - 将 `--dock-kbd-border` 从 `#c8d8e0` 改为 `#b8c8d0`
    - 将 `--sheet-handle` 从 `#d1d1d6` 改为 `#b8c0c6`
    - 将 `--queue-border` 从 `#d1d1d6` 改为 `#d0d4d8`
    - 将 `--context-menu-border` 从 `#e5e5ea` 改为 `#d8dce0`
    - _需求: 5.1~5.5_
  - [x] 4.2 同步更新 `[data-theme="light"]` 中对应的分割线与边框变量
    - 与 4.1 相同的变量和值
    - _需求: 5.1~5.5_

- [x] 5. 更新辅助文字变量
  - [x] 5.1 更新 `:root` 中的辅助文字变量
    - 将 `--item-meta` 从 `#86868b` 改为 `#6a7278`
    - 将 `--month-label` 从 `#8e8e93` 改为 `#6a7278`
    - 将 `--sidebar-month` 从 `#8e8e93` 改为 `#6a7278`
    - 将 `--duration-text` 从 `#c7c7cc` 改为 `#a0a8ad`
    - 将 `--detail-section-label` 从 `#8e8e93` 改为 `#6a7278`
    - 将 `--dock-dropzone-text` 从 `#8e8e93` 改为 `#6a7278`
    - 将 `--dock-dropzone-hint` 从 `#aeaeb2` 改为 `#8a9298`
    - 将 `--detail-summary` 从 `#636366` 改为 `#586068`
    - 将 `--detail-case-key` 从 `#8e8e93` 改为 `#6a7278`
    - 将 `--md-quote-text` 从 `#6e6e73` 改为 `#586068`
    - 将 `--md-bullet` 从 `#636366` 改为 `#586068`
    - _需求: 7.1~7.5, 11.1, 11.2_
  - [x] 5.2 同步更新 `[data-theme="light"]` 中对应的辅助文字变量
    - 与 5.1 相同的变量和值
    - _需求: 7.1~7.5, 11.1, 11.2_
  - [x] 5.3 编写属性测试：Tinted Neutral 色相范围（Property 1）
    - **Property 1: Tinted Neutral 色相范围**
    - 对所有应带有墨青色调的浅色主题 CSS 变量（中性背景色、边框色、辅助文字色、交互状态色），将 hex 值转换为 OKLCH 后验证 hue 在 195°~210° 范围内（chroma > 0.003 时）
    - **验证: 需求 1.2, 4.5, 5.5, 7.5, 9.8**

- [x] 6. 更新 AI 胶囊、Dock 组件与其他 Tinted 变量
  - [x] 6.1 更新 `:root` 中的 AI 胶囊与 Dock 变量
    - 将 `--ai-pill-bg` 从 `#f0f4f6` 改为 `#eaf0f3`
    - 将 `--ai-pill-border` 从 `#c8d8e0` 改为 `#a8bcc8`
    - 将 `--dock-dropzone-border` 从 `#b0b0b4` 改为 `#98a4ac`
    - 将 `--dock-kbd-bg` 从 `#e8e8e8` 改为 `#e0e4e8`
    - _需求: 8.1~8.4_
  - [x] 6.2 更新 `:root` 中的其他 Tinted 调整变量
    - 将 `--md-h3` 从 `#48484a` 改为 `#404850`
    - 将 `--md-text` 从 `#2c2c2e` 改为 `#2a3038`
    - 将 `--md-em` 从 `#2c2c2e` 改为 `#2a3038`
    - 将 `--md-quote-bar` 从 `#d1d1d6` 改为 `#c0c8ce`
    - 将 `--md-checkbox-border` 从 `#c7c7cc` 改为 `#b8c0c6`
    - 将 `--md-checkbox-done-text` 从 `#aeaeb2` 改为 `#a0a8ad`
    - 将 `--ai-pill-active-bg` 从 `#e4ecf0` 改为 `#dce6ec`
    - 将 `--dock-paste-bg` 从 `#f0f4f6` 改为 `#eaf0f3`
    - _需求: 1.2, 8.1~8.4, 9.8_
  - [x] 6.3 同步更新 `[data-theme="light"]` 中对应的 AI 胶囊、Dock 和 Tinted 变量
    - 与 6.1、6.2 相同的变量和值
    - _需求: 1.2, 8.1~8.4, 9.8_

- [x] 7. 检查点 — 确保所有 CSS 变量改动正确
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 8. 更新标签颜色系统
  - [x] 8.1 修改 `src/lib/tags.ts` 中浅色主题的 alpha 值
    - 将 `textAlpha` 浅色值从 `0.78` 改为 `0.90`
    - 将 `bgAlpha` 浅色值从 `0.13` 改为 `0.18`
    - 保持暗色主题值 `textAlpha: 0.72`、`bgAlpha: 0.12` 不变
    - _需求: 6.1, 6.2, 10.3_
  - [x] 8.2 编写属性测试：标签调色板对比度（Property 4）
    - **Property 4: 标签调色板对比度**
    - 对 PALETTE 中所有 10 种颜色，使用新 alpha 值（textAlpha=0.90, bgAlpha=0.18）生成标签文字色与背景色，验证对比度 ≥ 3:1
    - **验证: 需求 6.3**

- [x] 9. 验证暗色主题不受影响
  - [x] 9.1 编写单元测试验证暗色主题不变性
    - 验证 `[data-theme="dark"]` 和 `@media (prefers-color-scheme: dark)` 中的所有变量值未被修改
    - 验证 tags.ts 中暗色主题 alpha 值（textAlpha: 0.72, bgAlpha: 0.12）不变
    - _需求: 10.1, 10.2, 10.3_
  - [x] 9.2 编写单元测试验证关键对比度
    - 验证 `--item-text` / `--bg` 对比度 ≥ 7:1 (AAA)
    - 验证 `--item-meta` / `--bg` 对比度 ≥ 4.5:1 (AA)
    - 验证 `--duration-text` / `--bg` 对比度 ≥ 3:1
    - 验证 `--item-selected-text` / `--item-selected-bg` 对比度 ≥ 4.5:1 (AA)
    - 验证 `--ai-pill-text` / `--ai-pill-bg` 对比度 ≥ 4.5:1 (AA)
    - 验证 `--divider` / `--bg` 对比度 ≥ 1.3:1
    - _需求: 1.5, 4.4, 5.3, 8.4, 11.2_
  - [x] 9.3 编写单元测试验证强调色不变
    - 验证 `--record-btn`、`--record-btn-hover`、`--item-selected-text`、`--md-h1`、`--md-h2` 等强调色值未被修改
    - _需求: 9.4~9.7_

- [x] 10. 最终检查点 — 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的子任务为可选，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证跨所有变量的通用正确性属性
- 单元测试验证具体示例和边界情况
