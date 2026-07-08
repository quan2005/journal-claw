---
id: SPEC-20260615-workbench-layout-unification
title: '三工作台布局统一 — 共享组件 + Token 消费 + 交互一致性'
status: draft
source: gate
level: L2
created: 2026-06-15
related:
  - specs/20260615-workbench-widescreen-align/spec.md # 前置：容器宽度/padding 已对齐
  - specs/20260614-skills-redesign/spec.md # 技能页现状（inline style）
  - specs/20260614-agentic-design-language/spec.md # Agentic token 体系
  - docs/DESIGN.md # 设计规范
  - src/components/IdeasWorkbench.tsx
  - src/components/AutomationWorkbench.tsx
  - src/components/SkillsWorkbench.tsx
  - src/styles/globals.css
---

# 三工作台布局统一

## 1. 背景与问题

**谁**：JournalClaw 用户，在 nav-rail 切换「想法 / 自动化 / 技能」三个工作台时，视觉语言不一致——eyebrow 大小不同、标题字号不同、按钮规格不同、空状态设计不同、hover 反馈不同，切换时感觉是三个不同应用。

**现状为什么不行**：

`specs/20260615-workbench-widescreen-align` 已对齐容器宽度和外边距（1640px / 52px / 80px），但**内部组件层**仍高度不一致：

| 差异              | 想法                | 自动化                   | 技能                                         |
| ----------------- | ------------------- | ------------------------ | -------------------------------------------- |
| 样式实现          | CSS class           | CSS class                | **inline style** [证据: SkillsWorkbench.tsx] |
| Eyebrow 高度/字重 | 30px / 800          | 28px / 600               | 无固定高度 / 600                             |
| 标题字号          | 48px 固定           | 48px 固定                | clamp(44px,5vw,60px)                         |
| Summary 字号      | 18px                | 18px                     | 16px                                         |
| Button 高度       | 42px                | 42px                     | 38px                                         |
| Button padding    | 0 18px              | 0 18px                   | 0 16px                                       |
| 列表项 hover      | 背景变色            | 背景变色                 | translateY(-2px)+shadow                      |
| 空状态            | 虚线框+图标+文案    | 虚线框+图标+文案         | 纯灰色文字                                   |
| Stats 数字字号    | --text-md (16px)    | --text-md (16px)         | --text-xl (24px)                             |
| 色彩 token        | --ideas-\* 命名空间 | --automation-\* 命名空间 | 直接用通用 token                             |
| 响应式            | @media 1040/720px   | @media 1040px            | 无                                           |
| 浮层 z-index      | 1002                | 1000                     | 80                                           |
| 动效时长          | 160ms               | 160ms                    | 240ms                                        |

**目标**：建立一套三工作台共享的布局设计语言——统一 Header 规格、Button 规格、Stats 组件、空状态、交互反馈、token 命名，使切换时视觉无断裂感。

## 2. 目标与假设

通过 {(1) 为技能页创建 CSS class 消除 inline style；(2) 新增共享 workbench token；(3) 统一 Header/Button/Stats/Empty 各层级的尺寸参数；(4) 统一 hover/动效/z-index}，影响 {三个工作台的视觉一致性体验}，预期 {切换 tab 时视觉语言连贯、无断裂，且不丢失各页面特有的功能交互}。

**假设**：

- 假设 A：统一 eyebrow/title/summary 参数后，三页信息密度可比——各页标题区占据的视觉比例相近。证伪：如果想法页列表行数因 header 变高而明显减少，需调整。
- 假设 B：去掉技能卡片的 translateY 浮起效果后，卡片交互反馈仍清晰可感知。证伪：用户反馈觉得卡片 hover 无反应。
- 假设 C：统一 z-index 为 1000 不会与应用其他浮层冲突 [证据: globals.css 搜索 z-index，最高层级为 toast 9999、titlebar 999]。

## 3. 范围（In Scope）

### 3.1 新增共享 workbench token（globals.css）

```css
/* — Workbench 共享 token — */
--workbench-eyebrow-h: 28px;
--workbench-eyebrow-px: 14px;
--workbench-eyebrow-fw: 600;
--workbench-eyebrow-radius: var(--radius-pill);
--workbench-eyebrow-bg: color-mix(in srgb, var(--record-btn) 10%, var(--bg));
--workbench-eyebrow-color: var(--record-btn);
--workbench-title-size: var(--journal-title-size); /* 48px */
--workbench-title-weight: var(--journal-title-weight); /* 800 */
--workbench-title-color: var(--record-btn);
--workbench-summary-size: var(--journal-summary-size); /* 18px */
--workbench-summary-color: var(--text-secondary);
--workbench-header-gap: 24px;
--workbench-btn-h: 40px;
--workbench-btn-px: 18px;
--workbench-btn-radius: var(--radius-md);
--workbench-item-hover-bg: color-mix(in srgb, var(--record-btn) 4%, var(--bg));
--workbench-item-hover-border: color-mix(in srgb, var(--record-btn) 18%, var(--divider));
--workbench-item-transition: 160ms var(--ease-out);
--workbench-overlay-z: 1000;
--workbench-menu-z: 1010;
--workbench-stats-number: var(--text-lg); /* 18px */
--workbench-stats-label: var(--text-sm); /* 14px */
```

### 3.2 技能页去 inline style（SkillsWorkbench.tsx + 新建 skills-workbench.css）

将 SkillsWorkbench.tsx 中所有 inline style 迁移到 `src/styles/skills-workbench.css`（或合并进 globals.css 技能区块），使用 `.skills-workbench-*` 命名，消费共享 workbench token。

### 3.3 统一 Header 规格

三页的 eyebrow/title/summary 统一消费 `--workbench-eyebrow-*` / `--workbench-title-*` / `--workbench-summary-*` token。技能页的 `clamp(44px,5vw,60px)` 改为 `var(--workbench-title-size)` (48px)。

### 3.4 统一 Button 规格

三页的 primary/secondary button 统一：

- min-height: `var(--workbench-btn-h)` (40px)
- padding: `0 var(--workbench-btn-px)` (0 18px)
- border-radius: `var(--workbench-btn-radius)`
- 按钮组方向统一为**水平排列** flex, gap: 12px

### 3.5 统一 Stats 组件

三页统计格子统一：

- 数字：`var(--workbench-stats-number)` + font-weight 700
- 标签：`var(--workbench-stats-label)` + `var(--text-secondary)`
- 分隔线：`border-inline-end: 1px solid var(--divider)`
- 布局：CSS grid `repeat(n, 1fr)`, min-height: 50px

### 3.6 统一空状态

三页统一为「虚线框 + accent 圆角图标 + 主文案 + 副文案」模式：

- 容器：`border: 1px dashed var(--divider)`, `border-radius: var(--radius-lg)`, `min-height: 108px`, flex 居中
- 图标：40px 圆角方块，bg = `--workbench-eyebrow-bg`, color = `--record-btn`
- 主文案：`var(--text-sm)`, `var(--text-secondary)`
- 副文案：`var(--text-xs)`, `var(--text-tertiary)`

技能页当前纯文字空状态需补齐视觉。

### 3.7 统一 hover/active 反馈

- 列表项/卡片 hover：统一为 `background: var(--workbench-item-hover-bg)` + `border-color: var(--workbench-item-hover-border)`
- 去掉技能卡片的 `translateY(-2px)` + `box-shadow` 浮起效果
- transition 统一 `var(--workbench-item-transition)` (160ms)

### 3.8 统一 z-index 与动效

- 所有浮层（menu/dialog/drawer）：z-index = `var(--workbench-overlay-z)` (1000)
- 菜单层：z-index = `var(--workbench-menu-z)` (1010)
- 进入动效统一：`transform: scale(0.97)→1` + `opacity: 0→1`, duration 200ms, easing `var(--ease-out)`
- 退出：160ms reverse

### 3.9 统一色彩命名空间

- 保留 `--ideas-*` / `--automation-*` 作为局部覆盖，但令其值引用通用 workbench token
- 例：`--ideas-surface: var(--workbench-item-hover-bg)` 而非各自硬编码 color-mix

### 3.10 技能页补响应式

为 `.skills-workbench` 添加：

- `@media (max-width: 1040px)`：header 从两列变为 stack
- `@media (max-width: 720px)`：卡片网格变单列、padding 收紧

## 4. 非目标（Out of Scope）

- 不改三个页面的**功能逻辑**（想法的 inline edit、自动化的 routine 管理、技能的开关）。
- 不抽取 `<WorkbenchShell>` React 组件（本轮只统一 CSS token + class 层，React 组件抽取可作后续迭代）。
- 不改容器宽度/外边距（已由 `specs/20260615-workbench-widescreen-align` 覆盖）。
- 不改详情页（JournalDetail / IdentityDetail）的布局。
- 不影响暗色模式——token 值在暗色下自动通过 `color-mix` 适配。

## 5. NFR

| 维度        | 评估                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| 性能        | N/A——纯 CSS 改动，无运行时开销                                            |
| 安全/权限   | N/A                                                                       |
| 数据隐私    | N/A                                                                       |
| 可靠性/降级 | N/A                                                                       |
| 可观测性    | N/A                                                                       |
| 回滚        | 单次 git revert 即可（CSS + TSX 改动）                                    |
| 兼容性      | 不破坏现有测试；需同步 light-theme-unit.test.ts 中与 workbench 相关的断言 |
| 成本        | N/A                                                                       |
| 风控/滥用   | N/A                                                                       |
| 运营/客服   | N/A                                                                       |
| 多语言/地区 | N/A                                                                       |

## 6. 依赖与影响面

- **前置依赖**：`specs/20260615-workbench-widescreen-align`（status: approved，需先实施完容器对齐）。
- **影响文件**：`src/styles/globals.css`（token + ideas/automation class 调整）、`src/components/SkillsWorkbench.tsx`（去 inline style）、新建 `src/styles/skills-workbench.css`（或合并区块）、`src/tests/light-theme-unit.test.ts`（断言同步）。
- **无冲突**：与其他 approved/verified spec 无交叉。

## 7. 验收标准（AC）

- **AC-1　技能页无 inline style**
  `SkillsWorkbench.tsx` 中不存在 `style={{...}}` 的布局/排版相关内联样式（允许极少数动态计算值如 scroll position）。所有样式通过 `.skills-workbench-*` class 消费 token。

- **AC-2　Eyebrow 三页一致**
  三页 eyebrow pill 的 computed height = 28px、font-weight = 600、border-radius = 999px、background 为 accent 10% 混合。

- **AC-3　标题/Summary 三页一致**
  三页标题 font-size = 48px、font-weight = 800、color = `--record-btn`。Summary font-size = 18px、color = `var(--text-secondary)`。

- **AC-4　Button 三页一致**
  三页 primary button min-height = 40px、padding = 0 18px。按钮组水平排列，gap = 12px。

- **AC-5　Stats 三页一致**
  三页统计格子数字 font-size = 18px (--text-lg)、font-weight = 700。分隔线用 `border-inline-end`。

- **AC-6　空状态三页一致**
  技能页空状态有虚线框 + 图标 + 引导文案，与想法/自动化视觉结构一致。

- **AC-7　Hover 三页一致**
  三页列表项/卡片 hover 效果为背景变色 + 边框加深，无 translateY/box-shadow 浮起。Transition duration = 160ms。

- **AC-8　浮层 z-index 统一**
  想法 context menu、自动化 dialog、技能 drawer 的 z-index 统一在 1000–1010 区间。

- **AC-9　动效统一**
  自动化 dialog 和技能 drawer 的进入动效均为 scale(0.97→1) + opacity fade，duration 200ms。

- **AC-10　技能页响应式**
  窗口 ≤1040px 时技能页 header 从两列变为 stack；≤720px 时卡片网格变单列。

- **AC-11　测试通过**
  `npm test` 通过，`npm run build` 无 TS 报错。如 light-theme-unit.test.ts 有相关断言需同步更新。

- **AC-12　暗色模式无回归**
  暗色模式下三页视觉正常，token 值自动适配（color-mix 基于暗色 --bg 和 --record-btn 计算）。

## 8. 实现要点（非约束，供参考）

1. 在 globals.css `:root` 块尾部新增 `/* — Workbench 共享 token — */` 区块。
2. 新建 `src/styles/skills-workbench.css` 并在 main.tsx 或 globals.css import。
3. 修改 SkillsWorkbench.tsx：用 className 替换 style={{}}，引用新 CSS class。
4. 修改 globals.css 中 `.ideas-workbench-*` / `.automation-*` 规则：值改为引用新 token。
5. 统一 empty state 可考虑抽取一个 `WorkbenchEmpty` 纯展示组件（可选，非必须）。
