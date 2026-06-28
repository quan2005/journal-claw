---
story: ./story.md
design: N/A
date: 2026-06-28
round: 1
result: fail
scope: "git diff HEAD against apps/web/src/styles/globals.css、apps/web/src/styles/skills-workbench.css、apps/web/src/components/DetailView.tsx 三个文件"
---

# 验收报告 — 视觉一致性与可达性打磨（codex 批次）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1（按钮 accent 统一） | ✅ pass | 三个 Hub 主操作按钮均已改为实心 `var(--record-btn)`(#FF5701) 背景 + `var(--status-on-fill)` 文字、共用 `var(--workbench-btn-radius)` 圆角 token，无 color-mix 粉/珊瑚填充残留：<br>· 技能 `.sk-btn-primary` `skills-workbench.css:194-213`（`background: var(--record-btn, #ff5701)`、`color: var(--status-on-fill, #fff)`、`border-radius: var(--workbench-btn-radius)`）<br>· 想法 `.ideas-workbench-button-primary` `globals.css:1348-1360`（同 token）<br>· 自动化 `.automation-button-primary` `globals.css:846-858`（同 token）<br>三页按钮在任一主题下表现一致。`npm run build` 通过。 |
| AC-2（对比度达标） | ✅ pass | 暗色主题 token（`globals.css:466-616`）：`--text-secondary: #a2a6ae`（未改）、`--text-tertiary/--muted-text/--muted-icon` 由 `#6b7280` 上调为 `#747b86`。以 WCAG 相对亮度法在主表面 `--bg:#0f0f0f` 上计算：<br>· secondary `#a2a6ae` = **7.85:1** ≥ 4.5:1 ✅<br>· tertiary/muted `#747b86` = **4.49:1** ≥ 3:1 ✅<br>· 复核次级表面 `--detail-case-bg:#141414` = 4.32:1、`--bg-secondary:#1c1c1e` = 3.99:1，均 ≥ 3:1 ✅ |
| AC-3（水印收敛） | ✅ pass | `DetailView.tsx:1388-1404` 水印 `opacity: 0.035` ≤ 0.04 ✅；`fontSize` 由 `84vh` 降至 `60vh`（Won't 明确允许"只调不透明度/尺寸"）。该水印是 专题/核心画像/Timeline 三处空状态**共享**的唯一 DetailView 空状态水印（全仓 `謹跡` 水印仅 `DetailView.tsx:1403` 一处，见 grep 取证），一处修复覆盖三处。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ G1（按钮统一）：三页 primary 按钮均已落到 `--record-btn` + `--status-on-fill` + `--workbench-btn-radius`。
- ✅ G7（副文本对比度）：secondary/tertiary/muted 三组 token 均达 AA。
- ✅ G10（水印收敛）：opacity 与尺寸双降。
- ✅ 交棒要求"按钮统一应抽到结构化 token / 复用现有 primary 按钮类"：三页均消费 `--workbench-btn-h/--workbench-btn-px/--workbench-btn-radius/--record-btn/--status-on-fill`，未硬编码（符合 DESIGN.md §5）。

## 方案落实（不偏，对照 design.md）

N/A — 本任务无 design.md，仅以 story.md 为准。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ❌ **`identity.speaker_id` 徽章移除（功能性改动，无法归属到任一 AC）**：`DetailView.tsx:2399-2464` 删除了 identity 详情头的 speaker_id chip + 麦克风图标，并调整了 `marginBottom` 判断条件。本 story 范围是 G1/G7/G10 视觉打磨，Won't 明确"不改动按钮的交互行为、点击逻辑、文案"且未涉及 identity 字段展示。该字段仍存在于数据模型（`types.ts:69`、`App.tsx:882`、`DetailView.test.tsx:365` 仍传 `speaker_id: 'spk-1'`），属 M8-b Swift sidecar 下线的遗留清理，应归入那条线而非本视觉批次。判为越界。
- ⚠️ 删除 `.ideas-workbench-quick-add` 整块 CSS（约 65 行，原 `globals.css:1619-1685`）：全仓 grep 无任何 `.ideas-workbench-quick-add/-input/-submit` 引用，属死代码清理。与三 AC 无关但无害，归"必要基础设施"。
- ⚠️ 删除 `.ideas-workbench-menu` 的 `box-shadow: var(--shadow-overlay)`（`globals.css:1713`）：菜单仍保留 `border: var(--border-menu)`，属轻微视觉收尾，与 AC 无直接关系。

## 冗余（不重，对照 story.md）

- ✅ 同一 AC 无重复实现：三页 primary 按钮各自独立声明但共用同一组 token，无并行实现。

## 结论

**result: fail** — 三条 AC（G1/G7/G10）本身全部达成且 build 通过，但存在一项无法归属的功能性越界改动（speaker_id 徽章移除），按六字标准"不多"判 fail。

修复建议（按风险排序）：
1. **【高】speaker_id 移除归属问题**：二选一——(a) 将该改动从本批次剥离、回退 `DetailView.tsx:2399-2464`，留待 M8-b 清理线单独处理；(b) 若确认要在此批次一并下线，须回写 story.md 补一条 AC 并说明理由（当前 story 无此意图）。建议 (a)。

## 待用户裁决

1. **AC-1 的 `var(--accent)` 命名歧义**：story AC-1 字面写"实心 `var(--accent)`（#FF5701）背景"，但代码库中 `--accent` 已被重定义为 danger red `#dc2626`（`globals.css:79`），真正的信号橙落在 `--record-btn:#ff5701`。实现用的是 `--record-btn`（视觉正确）而非字面 `--accent`（会变红）。
   - 接受实现（回写 story 把 `var(--accent)` 改成 `var(--record-btn)`）：零代价，实现已正确。
   - 不接受（改实现去用 `var(--accent)`）：按钮会变红，违背 story 背景证据"单一信号橙 #FF5701"。不建议。
   - 结论暂计 pass（视觉达成），待用户表态后回写 story。

2. **AC-1 暗色主题文字色**：AC-1 写"白色文字"，暗色主题下 `--status-on-fill:#0f0f0f`（深墨），三页按钮一致呈"橙底深字"。这是主题适配的刻意选择（`globals.css:306-308` 注释），三页横向一致，但与 AC 字面"白色"在暗色下不符。
   - 接受：保持主题一致性，零代价。
   - 不接受：暗色下强制白字会降低橙底对比。
   - 结论暂计 pass（横向一致达成），待用户表态。

3. **speaker_id 越界（见结论）**：是否接受把该清理留在本批次（需补 AC），还是回退剥离。
