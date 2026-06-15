---
spec: ./spec.md
date: 2026-06-15
round: 1
result: fail         # pass | fail（六项全过才是 pass）
scope: "git diff HEAD（staged + unstaged 全部未提交改动）+ 新增未跟踪文件（docs/superpowers/mockups/*.html、specs/20260615-design-system-unification/）。核对命令：git diff HEAD --stat、git status、npm run build、npm run lint、npm run format:check、npx prettier <file>。"
---

# 验收报告 — 设计系统全面统一：Playfair/JetBrains 字体 + 暖白分层 + 结构化 token + 组件对齐

## AC 核对（不漏 / 不偏）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 | ✅ pass（含轻微残留说明） | `docs/DESIGN.md`：① §5 原章节「### 录音按钮（首要行动号召）」已被「### 结构化 token（强制消费）」替换（diff 第 204-217 行确认整段子节删除）。② §2 配色含 `#F6F6F1`（DESIGN.md:119「次表面（浅色 `#F6F6F1` ...）」、:130「`#FFFFFF` → `#F6F6F1` → `#ECECE6`」）。③ §3 排版含 Playfair Display（DESIGN.md:131「标题字体：`'Playfair Display', 'Noto Serif SC', serif`」）+ JetBrains Mono（:133「`'JetBrains Mono', ui-monospace, monospace`」）+ 系统字体（:132 正文）。—— 轻微残留：DESIGN.md:102「用于录音按钮、选中的列表项...」仍出现「录音按钮」一词，但这是 §2 主色用途描述的顺带提及，非 §5 组件章节，AC 字面要求「不存在录音按钮章节」已满足。 |
| AC-2 | ✅ pass | `docs/DESIGN.md` §5「### 结构化 token（强制消费）」子节定义全部四类：`--radius-sm/md/lg/pill`（:214）、`--shadow-overlay`（:215，浅色 `0 4px 12px rgba(0,0,0,0.15)` / 暗色 `0 4px 12px rgba(0,0,0,0.5)`）、`--border-menu`（:216）、`--focus-ring`（:217）+ 消费规则。 |
| AC-3 | ✅ pass | `docs/DESIGN.md` §6：① 「该对所有非循环过渡使用 ease-out-quart... 循环动画（呼吸/脉冲/shimmer/省略号等无限循环对称动画）豁免，可用 ease-in-out」（:250）。② 「一字体系规则」已改写为「三栈各司其职规则」（diff :191、:96「不该混用字体三栈」）。 |
| AC-4 | ✅ pass | `ls docs/design/` → `No such file or directory`；`git status` 确认 docs/design/{animation,colors,components,index,layout,typography}.md 6 文件均 deleted。 |
| AC-5 | ✅ pass | `grep -iE "amber-gold\|ink-cyan" README.md` → 0 命中（exit=1）；README.md:43 现为「Signal orange (#FF5701) accent, warm-white layered surfaces」；README.md:137 链接「[Design System](docs/DESIGN.md)」。 |
| AC-6 | ✅ pass | 根 `llms.txt:36`「- [DESIGN.md](docs/DESIGN.md): Single source of truth — signal orange...」单一指向；`docs/llms.txt`「## 设计系统」节单一「- [DESIGN.md](/DESIGN.md)」；均无 docs/design/ 链接，描述含 Playfair/JetBrains/暖白。 |
| AC-7 | ✅ pass | `docs/guide/themes.md` 全文重写：description「信号橙与暖白分层配色」；含「信号橙强调色」「表面分层（#F6F6F1/#ECECE6）」「字体三栈」；`grep -iE "琥珀金\|墨水青\|ink-cyan\|amber"` → 0 命中（exit=1）。 |
| AC-8 | ✅ pass | `AGENTS.md:13`「...暖白分层 `#F6F6F1`/`#ECECE6`...字体三栈各司其职——Playfair Display + 系统无衬线 + JetBrains Mono...」；:15「...含配色、排版、组件、结构化 token...」；:100 第 9 条「结构化 token 强制消费...圆角/浮层阴影/菜单边框/聚焦环必须走 token...」。 |
| AC-9 | ✅ pass | `index.html:7`：`family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap`；:8 noscript 同款。无 IBM Plex Mono。保留 preload+onload+noscript fallback 模式。 |
| AC-10 | ✅ pass | `src/styles/globals.css:31` `--font-display: 'Playfair Display', 'Noto Serif SC', serif`；:32 `--font-mono: 'JetBrains Mono', ui-monospace, monospace`；:62 `--bg-secondary: #f6f6f1`；:63 `--bg-tertiary: #ecece6`。 |
| AC-11 | ✅ pass | `src/styles/globals.css` 浅色 `--radius-sm/md/lg/pill`（:52-55）、`--shadow-overlay`（:56）、`--border-menu`（:57）已新增；暗色 `--shadow-overlay` 双套：:275（`@media` 块）+ :454（`[data-theme='dark']` 块）均为 `0 4px 12px rgba(0,0,0,0.5)`。 |
| AC-12 | ✅ pass（受 Q4 决策覆盖） | `src/styles/globals.css:46` `--space-5: 20px`（注释「aligns with DESIGN.md frontmatter」）。`--space-6: 24px` 保留（:47），符合 spec §9 Q4 已确认决策「保留 `--space-6: 24px`，仅修正 `--space-5` 为 20px」——此决策覆盖 AC-12 文面「冗余的 `--space-6` 应已移除或合并」。DESIGN.md frontmatter 也已同步移除 spacing "6"。 |
| AC-13 | ✅ pass | `src/styles/globals.css:273` `--bg-secondary: #1c1c1e`、:274 `--bg-tertiary: #2c2c2e`（`@media` 块）；:452/453 同值（`[data-theme='dark']` 块）。暗色零偏离。 |
| AC-14 | ✅ pass | `DetailView.tsx` 分段控件外层容器（:2176-2181 与 :545-550）已移除 `borderRadius: 8` / `background: 'var(--segment-bg)'` / `border: '1px solid var(--divider)'`，仅余 `display/alignItems/gap/padding`。活跃态（toggleButtonStyle :372-373、detailToggleButtonStyle :2104-2105）改为 `border: '1px solid transparent'`，无额外 active border。去卡片化完成。 |
| AC-15 | ✅ pass | `grep -nE "backdropFilter\|backdrop-filter" Toast.tsx SectionVoice.tsx` → 0 命中。Toast.tsx:54 `background: 'var(--bg)'` 纯色；SectionVoice.tsx:919 `background: 'var(--detail-case-bg)'` 纯色（移除 gradient + blur）。 |
| AC-16 | ✅ pass | `HistoryFloatingButton.tsx`：展开态改为绝对定位子容器（:155-176）用 `transform: scale(0.4→1)` + `opacity`，transition（:173）「transform 0.25s var(--ease-out), opacity 0.2s var(--ease-out), background 0.2s var(--ease-out)」——无 width/height/max-height/border-radius。外层容器（:140-148）width/height 固定 btnSize。 |
| AC-17 | ✅ pass（决策细化） | `SectionVoice.tsx:1244-1252` zhipuLimitHint 为 callout：`background: 'var(--record-highlight)'`（=#FFF4ED，globals.css:88）、`border: '1px solid var(--dock-dropzone-border)'`（=#FDBA74，globals.css:127）、`color: 'var(--text-primary)'`（墨色）、`borderRadius: 'var(--radius-sm)'`。文字色非 `var(--record-btn)`。—— 决策细化：spec §4.8/AC-17 文面写的是 `var(--record-btn-soft-bg)` / `var(--record-btn-soft-border)`，但实际实现用语义相邻的 `--record-highlight` / `--dock-dropzone-border`（值完全一致 #FFF4ED / #FDBA74）。主提示中「Q5 已确认」也用的是 `--record-highlight` + `--dock-dropzone-border`，故值与确认决策一致。 |
| AC-18 | ✅ pass | 4 处浮层 box-shadow 均为 `var(--shadow-overlay)`：`TreeContextMenu.tsx:183`、`JournalContextMenu.tsx:110`、`globals.css:1695`（.ideas-workbench-menu）、`globals.css:2243`（.settings-modal-shell，原 `0 24px 80px` 深阴影已降级）。 |
| AC-19 | ✅ pass | `FileChip.tsx:58` `borderRadius: 'var(--radius-sm)'`；:59 `border: 1px solid ${colors.border}`；:63 `fontSize: 'var(--text-xs)'`。 |
| AC-20 | ❌ fail | **JournalItem.tsx 未被本次改动触及**（`git diff HEAD -- src/components/JournalItem.tsx` 输出为空；`git status` 中无该文件）。当前 `JournalItem.tsx:51` 仍为 `borderLeft: isSelected ? '3px solid var(--record-btn)' : '3px solid transparent'`——即仍是 **borderLeft 机制**，未改为与 TreeItem 一致的「3px 绝对定位竖条」。对照 TreeItem.tsx:260-273 实现的是 `<span>` 绝对定位（`position: 'absolute'; width: 3; transform: scaleY(0→1); transition: transform 0.2s`）。spec §4.5 明确要求「改为与 TreeItem 一致的 3px 绝对定位竖条」+「补 hover transition」。当前 borderLeft 切换无 transform 动画。注：宽度虽已为 3px（早前 80c57b0 提交改过），但机制（borderLeft vs 绝对定位竖条 + scaleY 动画）与 TreeItem 不一致，§4.5 的对齐意图未实现。 |
| AC-21 | ✅ pass | `onboarding.css:266` 已移除 `outline: none`（原 :262）→ :268 补 `outline: var(--focus-ring)`；`nav-rail.css:67` `outline: var(--focus-ring)`；`globals.css:1179`（automation-input）、`:1598`（ideas-workbench-draft）均 `outline: var(--focus-ring)`。`grep outline: none onboarding.css nav-rail.css` → 0 命中。 |
| AC-22 | ✅ pass | `var(--font-serif)` 8 处分流：标题场景 4 处改 `--font-display`——journal-blocks.css:51（hero h1）、markdownComponents.tsx:125/139/153（h1/h2/h3）；中文编辑/引用场景 4 处保留 `--font-serif`——JournalItem.tsx:70（列表标题）、journal-blocks.css:671/1286、mdx.css:765（引用块）。DetailView.tsx:1398 巨型水印硬编码字体栈改为 `var(--font-display)`。 |
| AC-23 | ✅ pass（sandbox 由非目标覆盖） | `TodoSidebar.tsx:350` `'SF Mono', 'IBM Plex Mono', var(--font-mono)` → `var(--font-mono)`。bridges.ts:101/103、previewPreset.ts:27 仍含 `"IBM Plex Mono"`——但二者均位于 `src/lib/sandbox/`，命中 spec §4 非目标「不改 sandbox/magicui 内的 CSS（`src/lib/sandbox/`）」，故不计为缺口。`grep IBM Plex` 在 src 非 sandbox 区域 → 0 命中。workspace-template 无相关引用。 |
| AC-24 | ✅ pass | `npm run build`（tsc + vite build）→ `✓ built in 6.39s`，无编译错误。 |
| AC-25 | ✅ pass（本次无新失败） | `grep -rE "fafafa\|IBM Plex Mono\|f9fafb" src/tests/` → 0 命中，本次 token 改名/改值未触及任何 snapshot 断言。已知预先存在的 React.act 兼容失败与本次无关（任务指示不跑 test）。本次 0 新增测试失败。 |
| AC-26 | ⚠️ 待用户裁决（结论按保守原则暂计 fail） | `npm run lint`：1 error（`App.tsx:9` `any` 类型）+ 7 warnings；`npm run format:check`：7 文件 fail。**取证结论：全部为非本次 spec 引入的预先存在问题**——① lint error 在 App.tsx（不在本 spec diff，`git diff HEAD -- App.tsx` 为空）；TodoSidebar 的 2 warnings 在 :243/:254（react-refresh 导出，HEAD 即存在），本 spec 改的是 :350。② format:check 7 文件中，3 文件（TreeSidebar.tsx、navigation.ts、UIContext-category.test.tsx）完全不在本 spec diff；4 文件（DetailView.tsx、TreeContextMenu.tsx、SectionVoice.tsx、nav-rail.css）虽在本 spec diff，但 `npx prettier <file>` 比对显示 prettier 想改的行（DetailView:1627/1672 长 span、TreeContextMenu:93 长 ternary、SectionVoice:772 长 ternary、nav-rail.css:88 keyframes 单行）**均不在本 spec 改动行**——即本 spec 的编辑本身符合 prettier，fail 的是文件内既有的历史代码。AC-26 文面「应通过」未满足，但本 spec 未引入新违规。 |
| AC-27 | ✅ pass | `docs/superpowers/mockups/design-system-unification-acceptance.html` 存在（19148 bytes）：:7 加载 Playfair+JetBrains+Noto Serif SC（同 wght 区间）；:39 `--font-display: 'Playfair Display', 'Noto Serif SC', serif`；:225 `<h1>JournalClaw</h1>` + :226 `<div class="hero-title-zh">谨迹 · 设计系统统一</div>` 中英混排标题渲染链就绪。 |

**AC 小计**：24 pass / 1 fail（AC-20）/ 1 待裁决（AC-26）/ 1 pass-受决策细化说明（AC-17）。

## 范围完整性（不少）

对照 spec §3 四阶段范围逐条核对：

- **阶段 1（DESIGN.md 改写）**：1.1 移除录音按钮章节 ✅；1.2 暖白配色（#F6F6F1/#ECECE6 + frontmatter secondary/tertiary）✅；1.3 字体三栈（frontmatter title/display/display-lg→Playfair，mono→JetBrains）✅；1.4 结构化 token 子节 ✅；1.5 循环动画豁免 + 三栈规则 ✅。
- **阶段 2（文档同步）**：2.1 删 docs/design/ 6 文件 ✅；2.2 themes.md 重写 ✅；2.3 README :43 + :137 ✅；2.4 根 + docs/llms.txt ✅；2.5 AGENTS.md 设计基调 + 关键约束 ✅。
- **阶段 3（Token 层）**：3.1 index.html 字体加载（Playfair+JetBrains+Noto Serif SC，移除 IBM Plex Mono）✅；3.2 globals.css --font-display/--font-mono ✅；3.3 配色（浅色 bg-secondary/tertiary/titlebar-bg/sidebar-bg/detail-case-bg/queue-bg 全改暖白，暗色不变）✅；3.4 结构化 token（--radius-*/--shadow-overlay/--border-menu 浅+暗双套）✅；3.5 --space-5: 20px ✅（--space-6 按 Q4 保留）。
- **阶段 4（组件层）**：4.1 字体引用迁移 ✅；4.2 分段控件去卡片化 ✅；4.3 阴影统一 4 处 ✅；4.4 FileChip 对齐 ✅；4.5 列表项选中指示器 ❌（JournalItem 未改，见 AC-20）；4.6 菜单边框（TreeContextMenu :186 → var(--border-menu)）✅；4.7 聚焦环 4 处 ✅；4.8 P0 硬违规（Toast/SectionVoice 玻璃态、HistoryFloatingButton 布局动画、SectionVoice 橙色小号正文 callout）✅；4.9 间距网格收敛——spec 写「仅明显偏离，不追求像素级」，本次未见大规模裸 px 收敛改动，属低优先可接受。

**不少结论**：除 §4.5（=AC-20）未实现外，其余范围条目均有对应实现。

## 非目标越界检查（不多）

命中非目标或无法归属本 spec AC 的改动逐项列出：

- ⚠️ **`docs/dev/frontend.md`（疑似非本 spec 改动 / 轻微越界）**：diff 把「`--record-btn` 琥珀金交互色」「`--accent` 录音红」改为「信号橙交互 accent」「危险红」，并把「完整色彩系统见 /docs/design/colors」改为「见 DESIGN.md」。spec §4 非目标明确写「**不**重写 `docs/dev/` 和 `docs/guide/` 下非 themes.md 的文档」。该改动方向正确（消除旧体系残留、对齐 DESIGN.md 唯一权威），与 spec §1 动机一致，但字面命中非目标。
- ⚠️ **`docs/guide/recording.md`（疑似非本 spec 改动 / 轻微越界）**：把「录音按钮状态」表（琥珀金/录音红色值）改为「录音处理状态」（信号橙发送按钮/AI 状态标识）。同上，命中 §4 非目标「不重写 docs/guide/ 下非 themes.md 文档」。该改动还顺带调整了交互描述（「点击开始录音或发送素材」），略超纯文档色彩对齐范畴。
- ⚠️ **`docs/guide/settings.md`（疑似非本 spec 改动 / 轻微越界）**：「强调色 琥珀金（仅此一色）」→「信号橙 #FF5701（仅此一色）」。同上命中非目标。
- ℹ️ **新增 `docs/superpowers/mockups/q5-hint-fix-comparison.html`（未跟踪）**：spec §4.8 引用此 mockup 作为 Q5 callout 方案的视觉参考（方案 C），属 AC-17 的辅助产物，归属合理，非越界。
- ℹ️ **`docs/DESIGN.md` frontmatter spacing 移除 "6"**：属 §3.5（--space-6 处理）的文档同步，归属合理。

**不多结论**：3 处 docs 改动（frontend.md/recording.md/settings.md）字面命中 §4 非目标，建议用户裁决（见「待用户裁决」）。其余改动均可归属。

## 冗余与均衡（不重 / 不倚）

- **不重**：未发现同一 AC 的并行重复实现。token 定义在 globals.css 集中一处（浅色 :root + 暗色两块），组件消费点单一。`--shadow-overlay`/`--border-menu`/`--focus-ring` 均无重复定义冲突。
- **不倚**：AC-20（JournalItem 选中指示器）处于**完全未实现**状态（文件零改动），非占位/stub 而是遗漏，属「不倚」fail。其余 AC 完成度均衡，无半成品。AC-26 的 lint/format fail 是历史负债而非本次敷衍。

## 结论

**result: fail**（六项中「不漏/不偏/不倚」三项受 AC-20 影响；「不多」受 3 处 docs 越界影响，待裁决）。

按风险排序的修复建议：

1. **【必修·P0】AC-20 / §4.5 JournalItem 选中指示器未迁移**。当前 `JournalItem.tsx:51` 仍为 `borderLeft: 3px solid`，未改为与 TreeItem 一致的绝对定位竖条 + scaleY 动画。修复：参照 `TreeItem.tsx:260-273`，在 JournalItem 内增 `<span>` 绝对定位（left:0/top:9/bottom:9/width:3/borderRadius:2/transform:scaleY/transition:transform），移除 borderLeft；同时确认 hover transition 覆盖选中条切换。代价：单文件改动，风险低。
2. **【建议·P2】AC-26 lint/format**。本 spec 未引入新违规，但 working tree 不通过。可选：(a) 顺手 `npm run format` 修复 4 个本 spec 改过的文件（DetailView/TreeContextMenu/SectionVoice/nav-rail）的既有格式问题——但这会扩大改动面；(b) 保持现状，等独立 chore PR 统一清理。App.tsx 的 `any` error 与 TreeSidebar/navigation/UIContext 的格式问题与本 spec 无关，不应在本 PR 处理。
3. **【可选·P3】DESIGN.md:102 残留「录音按钮」一词**。§2 主色用途描述「用于录音按钮、选中的列表项...」中的「录音按钮」可改为「发送/录音入口」以彻底对齐「UI 无录音按钮」的现实，但属文面优化，不影响 AC-1 通过。

## 待用户裁决

1. **AC-26 lint/format fail 归属**。证据：全部 7 format + 1 lint error 均为预先存在（见 AC-26 证据行），本 spec 编辑本身合规。两边代价：
   - **计入 pass**：理由是「本 spec 未引入新违规」，AC-26 意图（不因 token 改名/删除导致编译/规范错误）已满足。代价：working tree 仍不通过 CI format gate，需独立 chore。
   - **计入 fail（保守，当前结论）**：理由是 AC 字面「应通过」。代价：本 spec 需额外承担历史负债清理，或阻塞合并。
   - 建议用户表态后回写 spec（如把 AC-26 细化为「本次改动不引入新 lint/format 违规」）。

2. **3 处 docs 越界（frontend.md/recording.md/settings.md）**。证据：diff 内容是旧体系色彩表述修正 + 链接改指 DESIGN.md，方向与 spec §1 动机一致，但字面命中 §4 非目标「不重写 docs/dev/ 和 docs/guide/ 下非 themes.md 文档」。两边代价：
   - **接受（回写 spec §3/§4）**：把这 3 文件补进范围、从非目标移除。代价：spec 范围扩张，但消除「琥珀金/录音红」残留的用户可见文档不一致，与「DESIGN.md 唯一权威」目标自洽。
   - **拒绝（回退 3 文件改动）**：严格遵守非目标。代价：docs/dev/frontend.md 的「琥珀金交互色」「/docs/design/colors 链接」等旧体系残留继续存在，与删 docs/design/ 的清理动作矛盾。
   - 按保守原则当前计为越界（不影响 result，因 fail 已由 AC-20 决定）。
