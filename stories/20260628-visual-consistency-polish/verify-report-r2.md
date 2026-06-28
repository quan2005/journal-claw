---
story: ./story.md
design: N/A
date: 2026-06-28
round: 2
result: pass
scope: "精确行范围（原始行号）：globals.css:192-196,294,460-461,473,614-615,846-858,1348-1360；skills-workbench.css:194-213；DetailView.tsx:1388-1404。工作区其它未提交 diff（含 speaker_id 移除、quick-add 删除、menu shadow 删除）明确不属于本轮范围。"
---

# 验收报告 — 视觉一致性与可达性打磨（codex 批次）

## 轮次 1 fail 项追踪

| R1 fail/待裁决 | 本轮状态 | 证据 |
|---|---|---|
| R1 fail：speaker_id 徽章移除（DetailView.tsx:2399-2464）功能性越界 | **已移出本轮核对范围** | 本轮 scope 仅含 DetailView.tsx:1388-1404（水印），speaker_id 改动（2399-2464）不在 scope 列表内。但该改动**仍物理存在于工作区**（`git diff apps/web/src/components/DetailView.tsx` 第二个 hunk @@ -2415,50 +2415,14 @@ 仍在），属提交卫生风险，见「待用户裁决」。 |
| R1 待裁决 #1：story 写 `var(--accent)`，代码用 `--record-btn` | 沿用，仍待裁决 | story.md:24 字面 `var(--accent)`；代码用 `--record-btn`（globals.css:195 `--workbench-btn-primary-bg: var(--record-btn)`）。视觉正确（#ff5701），未回写 story。 |
| R1 待裁决 #2：暗色主题按钮字色（原用 `--status-on-fill` 暗色变深字） | **已在本轮修复** | 本轮将 token 改为固定白 `--workbench-btn-primary-color: #ffffff`（globals.css:197），三页按钮暗色下也为白字，与 AC-1「白色文字」字面一致。三页均消费该 token（globals.css:853,860,1356,1362；skills-workbench.css:203）。 |

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1（按钮 accent 统一） | ✅ pass | 三页主操作按钮统一消费 `--workbench-btn-primary-*` token，实心 `--record-btn`（light=#ff5701 / dark=#ff7a33）背景 + `--workbench-btn-primary-color: #ffffff` 白字，无 color-mix 浅珊瑚/粉残留：<br>· 技能 `.sk-btn-primary` `skills-workbench.css:194-213`（`background: var(--workbench-btn-primary-bg, #ff5701)`、`color: var(--workbench-btn-primary-color, #fff)`）<br>· 想法 `.ideas-workbench-button-primary` `globals.css:1351-1357`<br>· 自动化 `.automation-button-primary` `globals.css:849-855`<br>· token 定义 `globals.css:195-197`<br>**同一圆角 token**：三页 base 类均 `border-radius: var(--workbench-btn-radius)`（globals.css:833、1334；skills-workbench.css:201）。R1 的 color-mix 残留（automation `:19%`、ideas `:16%`）已全部改为实心 `var(--workbench-btn-primary-bg)`。`npm run build` 通过。 |
| AC-2（对比度达标） | ✅ pass | 暗色 token 上调（4 处）：text-tertiary `#6b7280→#747b86`（globals.css:297 媒体查询、:476 显式 dark）；muted-text/muted-icon `#6b7280→#747b86`（globals.css:463-464、617-618）。WCAG 相对亮度法实测（主表面 `--bg:#0f0f0f`）：<br>· secondary `#a2a6ae` = **7.85:1** ≥ 4.5 ✅<br>· tertiary `#747b86` = **4.49:1** ≥ 3.0 ✅<br>· muted `#747b86` = **4.49:1** ≥ 3.0 ✅<br>· 次级表面 `--bg-secondary:#1c1c1e`：tertiary 3.99:1 ✅、secondary 6.97:1 ✅<br>（旧值 `#6b7280` 仅 3.96:1，本轮上调到 4.49:1，余量充足。） |
| AC-3（水印收敛） | ✅ pass | `DetailView.tsx:1388-1404` 水印 `opacity: 0.035` ≤ 0.04 ✅；`fontSize: '60vh'`（原 `84vh`，Won't 明确允许「只调不透明度/尺寸」）。全仓 `謹跡` 水印仅此 1 处（grep 取证），是 专题/核心画像/Timeline 三处空状态共享的唯一水印，一处修复覆盖三处。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ G1（按钮统一）：三页 primary 按钮落到 `--workbench-btn-primary-bg/bg-hover/color` + `--workbench-btn-radius/h/px`。
- ✅ G7（副文本对比度）：secondary/tertiary/muted 三组 token 全达 AA。
- ✅ G10（水印收敛）：opacity + 尺寸双降。
- ✅ 交棒「按钮统一应抽到结构化 token」：新增 3 个 `--workbench-btn-primary-*` token（globals.css:195-197），三页消费、未硬编码（符合 DESIGN.md §5）。
- ✅ 交棒「对比度调整须验证真实渲染链 computed style」：被调 token 均为字面 hex（`#747b86`/`#a2a6ae`），无 cascade 覆盖层，computed style = 字面值，实测成立。

## 方案落实（不偏，对照 design.md）

N/A — 本任务无 design.md，仅以 story.md 为准。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ **本轮 scope 内**：逐块归属——3 个新 token（globals.css:195-197）→ AC-1 基础设施；4 处对比度 token（globals.css:297,463-464,476,617-618）→ AC-2；automation/ideas primary 按钮（globals.css:849-861,1351-1363）→ AC-1；sk-btn-primary（skills-workbench.css:194-213）→ AC-1；水印（DetailView.tsx:1388-1404）→ AC-3。scope 内全部可归属，无越界。
- ⚠️ **scope 外、仍在工作区的未提交 diff（明确不计入本轮，但提示提交卫生）**：DetailView.tsx 的 speaker_id 移除 hunk（@@ -2415,50 +2415,14）、globals.css 的 `.ideas-workbench-quick-add` 整块删除（~65 行）、`.ideas-workbench-menu` 的 box-shadow 删除。这些不在本轮 scope 行范围内，详见「待用户裁决」。

## 冗余（不重，对照 story.md）

- ✅ 同一 AC 无重复实现：三页 primary 按钮各自声明但共用同一组 `--workbench-btn-primary-*` token，无并行实现。

## 结论

**result: pass（本轮核对范围内）** — AC-1 / AC-2 / AC-3 全部达成，六字标准在本轮 scope 行范围内全部通过，build 通过。

R1 的唯一 fail（speaker_id 越界）已通过**收窄 scope** 移出本轮核对范围；R1 待裁决 #2（暗色按钮字色）已在本轮实质修复（固定白字）。

**提交前必须处理的风险**（不改变本轮 pass 结论，但影响 commit 干净度）：DetailView.tsx / globals.css 各含 scope 外 hunk，整文件 `git add` 会把 speaker_id 移除等越界改动一并带入本 story 的 commit。须选择性暂存（`git add -p` 仅取 scope 内 hunk）或先回退 scope 外 diff。

## 待用户裁决

1. **提交卫生：scope 外 diff 仍在工作区（高优）**
   - 现状：`git diff apps/web/src/components/DetailView.tsx` 有 2 个 hunk（水印 [scope 内] + speaker_id 移除 [scope 外]）；`git diff globals.css` 有 scope 外的 quick-add 删除、menu-shadow 删除。
   - 选项 A（仅提交 scope 内）：`git add -p` 精选水印/token/按钮 hunk，speaker_id 等留待 M8-b 清理线。代价：提交操作更繁琐，但 commit 干净、不重蹈 R1 越界。
   - 选项 B（整文件提交）：speaker_id 移除随本 story 进入。代价：本 story commit 含无法归属的功能性改动，重演 R1 fail；且 story 无此意图。
   - 建议 A。本项不影响本轮 pass，但 commit 时若不处理，R1 fail 实质复活。

2. **`var(--accent)` 命名歧义（R1 沿用，低优）**
   - story.md:24 字面写 `var(--accent)（#FF5701）`，但 `--accent` 在 globals.css:79 已被重定义为 danger red，真实信号橙在 `--record-btn`（globals.css:80）。代码用 `--record-btn`（视觉正确）。
   - 接受实现：零代价，回写 story 把 `var(--accent)` 改成 `var(--record-btn)` 即可。
   - 不接受（改代码用 `var(--accent)`）：按钮变红，违背 story 背景证据「单一信号橙 #FF5701」。不建议。
   - 结论暂计 pass（视觉达成）。

3. **按钮文字对比度偏低（仅提示，非 AC 要求）**
   - 橙底白字对比：light `#ff5701`+`#fff` = 3.17:1、dark `#ff7a33`+`#fff` = 2.6:1、hover dark `#ff9355`+`#fff` = 2.2:1，均低于 AA 正文 4.5:1。
   - 但 AC-1 的 Then 子句只要求「实心 #FF5701 背景 + 白色文字 + 同一圆角 + 无残留」，**未要求按钮文字对比度**；AC-2 限定的是 secondary/tertiary/muted 正文副文本，不含按钮。此组合是 story 明文指定的设计，不计 fail。仅作可达性提示留档。
