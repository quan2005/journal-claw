---
id: SPEC-20260615-workbench-widescreen-align
title: "想法 / 自动化宽屏适配对齐技能页（共享 1640 容器 + 统一边距）"
status: approved
source: gate
level: L2
created: 2026-06-15
related:
  - src/components/SkillsWorkbench.tsx              # 参照标准（内联 maxWidth 1640 / padding 52 56 80 / margin 0 auto）
  - src/components/IdeasWorkbench.tsx               # 受影响（CSS 驱动）
  - src/components/AutomationWorkbench.tsx          # 受影响（CSS 驱动）
  - src/styles/globals.css:157-170                  # --journal-workbench-max / page-top / page-bottom token
  - src/styles/globals.css:618-736                  # automation-header / automation-body / automation-stack
  - src/styles/globals.css:1220-1245                # .ideas-workbench 容器 + header/tabs/main 宽度
  - src/tests/light-theme-unit.test.ts:231,262-276  # 断言 --journal-workbench-max=1120px + ideas/automation 框架规则
---

# 想法 / 自动化宽屏适配对齐技能页

## 1. 背景与问题

**谁**：JournalClaw 用户，在宽屏（≥1440px）Mac 上通过 nav-rail 切换「技能 / 想法 / 自动化」三个工作台。

**现状为什么不行**：

三个工作台用了两套互不一致的宽屏容器约定：

| 维度 | 技能（参照） | 想法 | 自动化 |
|---|---|---|---|
| 内容容器最大宽 | `maxWidth: 1640px`（内联）[证据: `SkillsWorkbench.tsx:622`] | `min(100%, 1120px)` via `--journal-workbench-max` [证据: `globals.css:1242`] | `min(100%, 1120px)` via `--journal-workbench-max` [证据: `globals.css:731`] |
| 容器水平居中 | `margin: 0 auto` [证据: `SkillsWorkbench.tsx:622`] | `margin: 0 auto` ✅ | `margin: 0 auto` ✅（header 用 gutter 相加近似，stack 用 auto） |
| 顶部 padding | `52px` [证据: `SkillsWorkbench.tsx:622`] | `44px` via `--journal-page-top` [证据: `globals.css:1234,159`] | header `44px` / body `24px`（双层）[证据: `globals.css:629,720`] |
| 左右 padding | `56px`（固定）[证据: `SkillsWorkbench.tsx:622`] | `min(56px,5vw)` via `--journal-page-gutter` ✅ 更优 | 同想法 ✅ |
| 底部 padding | `80px` [证据: `SkillsWorkbench.tsx:622`] | `34px` via `--journal-page-bottom` [证据: `globals.css:1234,160`] | `34px` via `--journal-page-bottom` [证据: `globals.css:720`] |

**可观察后果**：在 1920px 屏幕上，技能页内容区 1640px，想法/自动化仅 1120px —— 两侧各多出 ~260px 留白，视觉上三个 tab 切换时内容宽度「跳变」，且想法/自动化上下边距明显比技能紧凑（尤其底部 34 vs 80，列表底部贴着窗口边缘）。用户原话：「想法、自动化没有适配宽屏，整体边距和宽屏适配样式要求和技能保持一致」。

**目标**：三个工作台在任意宽度 ≥1120px 的屏幕上，内容容器最大宽度、上下左右 padding 表现一致（视觉无跳变）；窄屏（<1040px）已有的响应式回退不回归。

**非目标**：
- 不改技能页 `SkillsWorkbench` 本身（它已是参照标准）。
- 不改 detail view 的 readable-max / prose-max 排版约定 [证据: `globals.css:131-170`，detail 用 `--journal-readable-max`，不依赖 `--journal-workbench-max`]。
- 不改 `--journal-page-gutter`（被 detail、markdown、mdx 多模块共享，且 `min(56px,5vw)` 的响应式特性比技能内联固定 56px 更优，保留）。
- 不动 nav-rail、TitleBar、左右栏布局（那些在 specs/20260615-panel-auto-toggle 另行处理）。
- 不改网格列数逻辑（auto-fill/auto-fit 的 minmax 维持现状，仅容器变宽后自然多排一列）。

## 2. 模糊性清除

| 原文 | 类型 | 改写（进 AC） |
|---|---|---|
| 「整体边距…一致」 | 无度量 | 顶部/底部 padding 与技能页逐像素一致：top 52px、bottom 80px、左右用现有 gutter（`min(56px,5vw)`） |
| 「宽屏适配样式…一致」 | 无边界 | 内容容器 `max-width` = 1640px（= 技能页），`margin: 0 auto` 居中；≥1640px 屏幕内容不再随窗口继续拉伸 |
| 「和技能保持一致」 | 隐含假设：是否要把内联样式也改成 token | 不改技能实现；做法是把 token 调到与技能值一致，让想法/自动化通过 token 对齐。技能页未来也可迁 token，但不在本 spec 范围 |

## 3. NFR 与影响面

- **性能**：N/A（纯 CSS token + 值调整，无运行时）。
- **兼容性 / 回归**：`--journal-page-top` / `--journal-page-bottom` 经检索**只**被 ideas + automation 使用 [证据: `grep` 仅命中 globals.css:629,720,1234,1774-1775]，无第三方消费者 → 直接改值安全。但为隔离影响、保持 token 语义清晰，本 spec 选择**保留** page-top/bottom 含义不变，**新增**专用 `--journal-workbench-pad-top/bottom` 让想法/自动化引用，避免「page-top 改成 52 后未来别处复用产生歧义」。`--journal-page-gutter` 保持不动。
- **可测试性**：`--journal-workbench-max` 当前被 `light-theme-unit.test.ts:231` 断言为 `1120px`，框架规则断言在 270-273。改值后必须同步更新这些断言（见 AC-5）。
- **可观测性**：N/A。
- **回滚**：单文件（globals.css）改动 + 测试同步，`git revert` 即可。

## 4. 待确认

无。方向与数值（1640 / 52 / 80）直接取自现有技能页内联值，无歧义。

## 5. 验收标准（AC）

> 实现完成后，逐条核对。每条须在真实 Tauri 窗口或忠实反映 cascade 的环境下成立。

- **AC-1　workbench 容器宽度对齐**
  当窗口宽度 ≥ 1640px 时，打开「技能」「想法」「自动化」三个 tab，三者主内容区（技能的 `.skills section > div`、想法的 `.ideas-workbench-header/main`、自动化的 `.automation-stack` / `.automation-header`）左右边缘对齐，最大内容宽度均为 1640px；继续放大窗口内容不再拉伸、保持居中。`--journal-workbench-max` 的计算值 = `1640px`。

- **AC-2　想法页边距对齐**
  当窗口宽度 ≥ 1640px 时，「想法」tab 顶部留白 = 52px、底部留白 = 80px、左右 = gutter（`min(56px,5vw)`），与技能页各边距视觉一致；`.ideas-workbench` 的 `padding-top`/`padding-bottom` 分别引用 `--journal-workbench-pad-top`(=52px) / `--journal-workbench-pad-bottom`(=80px)。

- **AC-3　自动化页边距对齐**
  当窗口宽度 ≥ 1640px 时，「自动化」tab 顶部留白 = 52px、底部留白 = 80px。注意自动化是「header + 可滚动 body」双层结构（`globals.css:629,720`）：header 的 `padding-top` 改 52px、body 维持顶部 24px 间距（作为 header 与 stack 的呼吸）但 `padding-bottom` = 80px。即整体首行内容到窗口顶 ≈ 52px，stack 末行到窗口底 ≈ 80px。

- **AC-4　窄屏响应式不回归**
  当窗口宽度 ≤ 1040px 时，自动化原有的 `@media (max-width:1040px)` 回退（header 转纵向、routine-row 列收窄）仍生效；≤720px 时 `--journal-workbench-pad-top/bottom` 跟随现有 mobile 回退（对应原 30px/24px 量级）。

- **AC-5　测试同步**
  `src/tests/light-theme-unit.test.ts` 中所有对 `--journal-workbench-max`（=1120px）及 ideas/automation 框架规则的断言更新为新值（1640px），`npm test` 通过；不残留指向 1120 的旧断言。

## 6. 实现要点（非约束，供实现参考）

1. `globals.css:157` `--journal-workbench-max: 1120px` → `1640px`。
2. 新增两个 token（紧邻现有 page token）：
   ```css
   --journal-workbench-pad-top: 52px;
   --journal-workbench-pad-bottom: 80px;
   ```
   并在 `@media (max-width:720px)` 回退块里给它们 mobile 值（30px / 24px，与现有 page-top/bottom 一致）。
3. `.ideas-workbench`（globals.css:1234）：`padding-top`/`padding-bottom` 改引用新 token。
4. `.automation-header`（629）：`padding` 顶值改 52px；`.automation-body`（720）：`padding-bottom` 改 80px。
5. 同步 `light-theme-unit.test.ts`：`--journal-workbench-max` 断言、ideas/automation 框架断言（值的字符串匹配更新，断言结构不变）。
6. 如发现 `--journal-page-top`/`--journal-page-bottom` 改完无其它引用，可在后续清理中移除——本 spec 不强制（避免扩大改动面）。
