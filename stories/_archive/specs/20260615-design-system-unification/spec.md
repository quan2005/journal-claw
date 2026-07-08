---
id: SPEC-20260615-design-system-unification
title: '设计系统全面统一：Playfair/JetBrains 字体 + 暖白分层 + 结构化 token + 组件对齐'
status: verified
source: gate
level: L3
created: 2026-06-15
related:
  - specs/20260614-agentic-design-language/spec.md # 被部分推翻（字体决策）
  - docs/DESIGN.md # 主战场：规范定稿
  - src/styles/globals.css # 令牌根文件
  - index.html # 字体加载
  - AGENTS.md # 设计基调段
---

# 设计系统全面统一：Playfair/JetBrains 字体 + 暖白分层 + 结构化 token + 组件对齐

## 1. 背景与问题

**谁**：整个 JournalClaw macOS 应用。

**现状**：`specs/20260614-agentic-design-language`（L3，已 verified）于 2026-06-14 完成设计语言从「琥珀金/墨水青」到「Agentic 橙白」的全量替换。骨架健康——token 体系落地、暗色 8 项核心色值零偏离、单橙 accent 规则守住。但留下三类系统性问题 [证据: 三轮探查报告]：

1. **规范与实现脱节**。DESIGN.md 把「录音按钮」列为「首要行动号召 / 最重要交互元素」，但 UI 完全没有此组件、无录音交互入口 [证据: grep `useRecorder/onStartRecording` 在 src/ 下 0 命中]。`--record-btn` token 存在且正确，但仅复用于发送按钮/选中条/设置 accent。spec 与产品形态脱节。

2. **文档体系失配**。上轮 spec 的文档影响面清单（§3 文档层）只列了 `docs/DESIGN.md` + `AGENTS.md`，**遗漏了 9 处依赖文档** [证据: docs-maintenance 放行判定第 5 条误判]：
   - `docs/design/` 下 6 个子文档（index/colors/typography/animation/components/layout）**全是旧「琥珀金/墨水青」体系**，与 DESIGN.md 全面冲突（13 处矛盾，见 §7）。
   - `docs/guide/themes.md` 整篇旧体系（用户可见文档）。
   - `README.md:43`「amber-gold accent, ink-cyan neutral palette」表述过时。
   - `llms.txt`（根 + docs/）「Design System」节指向 docs/design/ 旧体系，未提 DESIGN.md。
   - DESIGN.md 第 220 行（ease-out-quart）与 docs/design/animation.md:59（脉冲 ease-in-out）自相矛盾。

3. **组件层离散偏离 + P0 硬违规**。token 正确但实例各自硬编码，根因是**缺少结构化 token**（圆角/阴影/边框/聚焦环未提升为正式 token）[证据: 探查报告]：
   - 🔴 玻璃态 2 处：`Toast.tsx:63-64`、`SectionVoice.tsx:925` 用 `backdrop-filter: blur`。
   - 🔴 动画布局属性：`HistoryFloatingButton.tsx:148-155` 动画 width/height/max-height/border-radius。
   - 🔴 橙色用作 12px 正文：`SectionVoice.tsx:1245`（zhipuLimitHint），对比度 2.7:1 不达 WCAG AA。
   - 🟠 第三字体家族 `--font-serif: 'Noto Serif SC'` 被 9+ 处使用，违反「一字体系规则」（但用户决定保留衬线，需修订规则而非删字体）。
   - 🟠 分段控件被卡片化（`DetailView.tsx:2187` 外层 border+背景容器）。
   - 🟠 阴影词汇未收敛（4 处浮层三种阴影值，均非 spec 的 `0 4px 12px`）。
   - 🟡 `--focus-ring` token 定义 4 次但零引用；实际 focus 环粗细/浓度各异；onboarding 输入框 `outline: none`。
   - 🟡 来源徽章尺寸偏离（FileChip 圆角 5≠6、字号 14≠12、边框 0.5≠1）。
   - 🟡 列表项选中指示器不统一（JournalItem 2px borderLeft vs TreeItem 3px 竖条）。

**用户决策（4 轮澄清已确认）**：

- 推翻上轮 spec 的「只用系统字体」决策——**加载 Playfair Display（标题）+ JetBrains Mono（代码）**。
- 采纳新规范草稿的暖白 **Secondary `#F6F6F1`**，拉开 tertiary 保证分层。
- **删除 docs/design/ 整个旧体系**，DESIGN.md 为唯一权威。
- **从 DESIGN.md 移除录音按钮章节**。
- 一个 L3 spec 分 4 阶段执行。

**为什么是 L3**：触碰全局视觉契约（令牌系统是所有组件的共同数据契约）；推翻已 verified 的 L3 spec 决策；影响 56 处 `--font-mono` 引用 + 8 处 `--font-serif` 引用 + 9 处 `--bg-secondary` 引用；改写 DESIGN.md（项目宪法级文档）+ AGENTS.md「设计基调」段；删除 docs/ 下 6+1 个文档。

## 2. 目标与假设

通过 {改写 DESIGN.md 规范（字体三栈 + 暖白分层 + 结构化 token + 移除录音按钮章节 + 消除文档矛盾）；删除 docs/design/ 旧体系并同步 README/llms.txt；对齐 globals.css token 与 index.html 字体加载；逐组件消除离散偏离并修复 P0 硬违规}，影响 {全应用视觉气质 + 设计文档体系 + 组件实现一致性}，预期 {设计系统从「骨架健康、细节失血」变为「规范唯一权威、token 完整、组件零硬编码偏离、无 P0 违规」，且加载 Playfair Display + JetBrains Mono 后「modern bold」气质由字体个性承载}。

**假设（可证伪）**：

- **假设 A**：Playfair Display 是西文衬线，中文标题会回退到 `--font-serif` 栈里的 `'Noto Serif SC'`（已在 docs/index.html 加载，但应用主入口 index.html 未加载）。**证伪方式**：需在 index.html 补加载 Noto Serif SC，否则中文标题回退到系统宋体（Songti SC），观感可能退化。R1 覆盖。
- **假设 B**：加载 2 个 web font（Playfair + JetBrains + 补 Noto Serif SC）的 FOUT 与请求开销可接受。**证伪方式**：用 `font-display: swap` + preload，首屏先用系统字体，加载后无感切换；总增量约 80-120KB。R2 覆盖。
- **假设 C**：`--bg-secondary: #F6F6F1` 与 `--bg-tertiary: #ECECE6` 的 ΔE ≥ 3，表面分层可感知。**证伪方式**：实际渲染核对三档背景在浅色模式下的视觉区分度。R3 覆盖。
- **假设 D**：结构化 token（`--radius-*`/`--shadow-overlay`/`--border-menu`/`--focus-ring`）提升后，组件作者会消费它们而非继续硬编码。**证伪方式**：本次同步替换所有已知硬编码点；未来靠 DESIGN.md §5 规范约束。
- **假设 E**：Playfair Display Google Fonts 提供 wght 400-900 + italic，覆盖标题所需字重（700/800/900）；JetBrains Mono 提供 wght 100-800 + italic，覆盖代码所需（400/500）。

## 3. 范围（In Scope）

### 阶段 1：规范定稿（docs/DESIGN.md 改写）

**1.1 移除录音按钮章节**

- 删除第 5 节「组件 → 录音按钮（首要行动号召）」整个子节（DESIGN.md:166-173）。
- 原因：UI 未实现，spec 与产品脱节。录音走系统后端，UI 主入口是文字+文件输入。

**1.2 改写配色（第 2 节 + frontmatter）**

- 表面分层从 `#FFFFFF → #FAFAFA → #F4F4F5` 改为 `#FFFFFF → #F6F6F1 → #ECECE6`（暖白三层）。
- frontmatter `surface-dark` 等保持不变（暗色已零偏离）。
- 新增 frontmatter `secondary: "#F6F6F1"` 字段。

**1.3 改写排版（第 3 节 + frontmatter）**

- 字体三栈：
  - `--font-display: 'Playfair Display', 'Noto Serif SC', serif`（标题/Display 层级，承载 bold 衬线气质）
  - `--font-body: system-ui, -apple-system, BlinkMacSystemFont, sans-serif`（正文/UI，保持现状）
  - `--font-mono: 'JetBrains Mono', ui-monospace, monospace`（代码/技术语义）
  - `--font-serif: 'Noto Serif SC', serif`（中文衬线编辑时刻，保留）
- frontmatter typography 字段同步：`display/playfair`、`mono/jetbrains`。
- 修正「一字体系规则」为「三栈各司其职规则」：Playfair 仅用于标题/Display；系统字体仅用于正文/UI；JetBrains Mono 仅用于代码/技术语义；Noto Serif SC 仅用于中文衬线编辑时刻。绝不混用。
- 字重阶梯放开：Playfair 标题可用 700/800/900；正文 400/500/600；系统字体原生支持 100-900。

**1.4 新增「结构化 token」子节（第 5 节组件 → 新增）**

- 圆角 token：`--radius-sm: 6px`（徽章/小控件）、`--radius-md: 6px`（输入框）、`--radius-lg: 8px`（菜单/对话框/卡片）、`--radius-pill: 999px`。
- 阴影 token：`--shadow-overlay: 0 4px 12px rgba(0,0,0,0.15)`（浮层唯一值，浅色）/ 暗色 `0 4px 12px rgba(0,0,0,0.5)`。
- 边框 token：`--border-menu: 1px solid var(--divider)`（菜单/对话框统一 1px）。
- 聚焦环 token：`--focus-ring: 2px solid color-mix(in srgb, var(--record-btn) 55%, var(--bg))`——**强制消费**，所有 `:focus-visible` 必须用此 token，禁止各自硬编码浓度/粗细。

**1.5 消除文档矛盾（第 6 节 该做与不该做）**

- 新增条款：「循环动画豁免——呼吸/脉冲/shimmer/省略号等无限循环对称动画可用 `ease-in-out`；所有非循环过渡一律 `ease-out-quart`」。
- 这使 `AiStatusPill.tsx:77`、`ChatPanel.tsx:1755`、`SessionList.tsx:172`、`HistoryFloatingButton.tsx:296`、`SkeletonRow.tsx:20`、`globals.css:1887` 的 6 处 ease-in-out 合规化（不改代码）。
- 移除「不该做：不引入额外的字体家族」→ 改为「三栈各司其职，不引入三栈之外的字体」。

### 阶段 2：文档同步

**2.1 删除 docs/design/ 旧体系**

- 删除整个 `docs/design/` 目录（index.md / colors.md / typography.md / animation.md / components.md / layout.md）。
- 原因：6 个文档全是「琥珀金/墨水青」旧体系，与 DESIGN.md 13 处矛盾，保留即混乱。

**2.2 处理 docs/guide/themes.md**

- 重写为 Agentic 新体系（橙白主题、light/dark/system 三模式、暖白分层），或删除并在 guide/index.md 移除链接。
- [推测] 默认重写，因为 themes 是用户可见的「主题说明」文档，有存在价值。

**2.3 更新 README.md**

- `:43` 移除「amber-gold accent, ink-cyan neutral palette」→ 改为「Signal orange (#FF5701) accent, warm-white layered surfaces」。
- `:137` 链接 `docs/design/index.md` → 改指向 `docs/DESIGN.md`。

**2.4 更新 llms.txt（根 + docs/）**

- 「Design System」节：移除指向 docs/design/ 各文档的链接，改为单一指向 `docs/DESIGN.md`。
- 描述从「Ink-cyan neutrals, amber-gold, restrained aesthetics」改为「Signal orange, warm-white surfaces, modern bold, Playfair/JetBrains typography」。

**2.5 更新 AGENTS.md（若字体/色彩基调变化触及约定）**

- 「设计基调」段：补充字体三栈（Playfair/JetBrains）+ 暖白分层基调用词。
- 「关键约束」段：新增「结构化 token」约束——圆角/阴影/边框/聚焦环必须走 token，禁止组件硬编码。

**2.6 清理其他文档的旧体系残留**

- `docs/dev/frontend.md`：`--record-btn`「琥珀金交互色」→「信号橙交互 accent」；`--accent`「录音红」→「危险红」；色彩系统链接改指 `docs/DESIGN.md`。
- `docs/guide/recording.md`：「录音按钮状态」表（琥珀金/录音红色值）→「录音处理状态」（信号橙）。
- `docs/guide/settings.md`：「强调色 琥珀金」→「信号橙 #FF5701」。
- 原因：删 docs/design/ 后，这些文档里的旧体系残留与「DESIGN.md 唯一权威」目标矛盾，必须一并清理。

### 阶段 3：Token 层对齐（src/styles/globals.css + index.html）

**3.1 字体加载（index.html）**

- Google Fonts link 从只加载 IBM Plex Mono 改为加载：
  - `Playfair Display: wght@400;500;600;700;800;900`（标题）
  - `JetBrains Mono: wght@400;500`（代码，对齐现有 IBM Plex Mono 的 wght）
  - `Noto Serif SC: wght@400;500;600;700`（中文衬线回退，当前 docs/index.html 已加载但应用入口未加载）
- 保留 `font-display: swap` + preload + noscript fallback 模式。
- 移除 IBM Plex Mono 加载（被 JetBrains Mono 取代）。

**3.2 字体 token（globals.css）**

- `--font-mono: 'IBM Plex Mono' → 'JetBrains Mono', ui-monospace, monospace`（L30）。
- 新增 `--font-display: 'Playfair Display', 'Noto Serif SC', serif`。
- `--font-serif: 'Noto Serif SC', serif` 保留（L31）。
- `--font-body` 不变（L29）。

**3.3 配色 token（globals.css）**

- 浅色 `:root`：`--bg-secondary: #fafafa → #f6f6f1`（L53）；`--bg-tertiary: #f4f4f5 → #ecece6`（L54）。
- `--titlebar-bg: #f9fafb → #f6f6f1`（L59，与 bg-secondary 一致）。
- `--sidebar-bg: #f9fafb → #f6f6f1`（L102）。
- `--detail-case-bg: #fafafa → #f6f6f1`（L181 硬编码）。
- `--queue-bg: #fafafa → #f6f6f1`（L199 硬编码）。
- 暗色模式：`--bg-secondary: #1c1c1e` 和 `--bg-tertiary: #2c2c2e` 保持不变（暗色分层已健康，暖白是浅色专属调整）。

**3.4 新增结构化 token（globals.css）**

- 新增：`--radius-sm: 6px`、`--radius-md: 6px`、`--radius-lg: 8px`、`--radius-pill: 999px`。
- 新增：`--shadow-overlay: 0 4px 12px rgba(0,0,0,0.15)`（浅色）；暗色 `0 4px 12px rgba(0,0,0,0.5)`。
- 新增：`--border-menu: 1px solid var(--divider)`。
- `--focus-ring` 定义已在（L74/L283/L461/L2030），需让组件消费它（见阶段 4）。

**3.5 间距 token 修正（globals.css）**

- `--space-5: 24px → 20px`（L45，对齐 DESIGN.md frontmatter spacing "5": "20px"）。
- 移除冗余 `--space-6: 24px`（L46）——与 `--space-5` 同值，无存在意义；检查引用，迁移到 `--space-5`。

### 阶段 4：组件层对齐

**4.1 字体引用迁移**

- `var(--font-serif)` 8 处引用，按场景分流：
  - **标题场景**（journal-blocks hero h1 L51、markdownComponents h1/h2/h3 L125/139/153）→ 改 `--font-display`（Playfair）。
  - **中文编辑/引用场景**（JournalItem.tsx:64 列表项标题、journal-blocks L671/L1286、mdx.css:765 引用块）→ 保留 `--font-serif`（Noto Serif SC）。
- DetailView.tsx:1401 硬编码 `'Noto Serif SC', 'Source Han Serif SC', ...`（巨型水印「謹跡」）→ 改为 `var(--font-display)`（中文走栈内 Noto Serif SC 回退）。
- JetBrains Mono 硬编码清理：`bridges.ts:101/103`、`previewPreset.ts:27`、`TodoSidebar.tsx:350`（`'SF Mono', 'IBM Plex Mono'` → `var(--font-mono)`）、workspace-template 内联。

**4.2 分段控件去卡片化**

- `DetailView.tsx:2187-2188` 移除外层容器的 `border` + `background`（回归透明背景）。
- `DetailView.tsx:376` 和 `:2112` 移除活跃态 `border: '1px solid var(--divider-active)'`。

**4.3 阴影统一**

- 4 处浮层改 `var(--shadow-overlay)`：
  - `TreeContextMenu.tsx:187`（`0 4px 24px` → token）
  - `JournalContextMenu.tsx:109`（`0 4px 20px` → token）
  - `globals.css:2231-2233`（`.settings-modal-shell` `0 24px 80px` → token，**降级深阴影**）
  - `globals.css:1677-1684`（`.ideas-workbench-menu` 补 `var(--shadow-overlay)`）

**4.4 来源徽章对齐**

- `FileChip.tsx:58` 圆角 `5 → var(--radius-sm)`。
- `FileChip.tsx:63` 字号 `var(--text-sm) → var(--text-xs)`（14→12）。
- `FileChip.tsx:59` 边框 `0.5px → 1px`。

**4.5 列表项选中指示器统一**

- `JournalItem.tsx:46` `borderLeft: 2px solid var(--record-btn)` → 改为与 TreeItem 一致的 3px 绝对定位竖条。
- 补 hover transition（JournalItem 当前无 hover 过渡，即时切换）。

**4.6 菜单边框统一**

- `TreeContextMenu.tsx:186` `border: '0.5px solid' → var(--border-menu)`。

**4.7 聚焦环落地**

- `onboarding.css:262` `outline: none` → 移除；`:267-269` 补 `outline: var(--focus-ring)`。
- `nav-rail.css:67` `outline: 1px solid ... 60%` → `outline: var(--focus-ring)`。
- `globals.css:1168`（automation-input）`outline: 2px solid ... 22%` → `outline: var(--focus-ring)`。
- `globals.css:1587`（ideas-workbench-draft）同上。

**4.8 P0 硬违规修复**

- **玻璃态**：`Toast.tsx:63-64` 移除 `backdropFilter: 'blur(12px)'`，改纯色 `background: var(--bg-secondary)`；`SectionVoice.tsx:925` 同理。
- **布局动画**：`HistoryFloatingButton.tsx:148-155` 把 `width/height/max-height/border-radius` 动画改为 `transform: scale() + opacity`（展开态用 scale 定位 + overflow 裁切）。
- **橙色小号正文**：`SectionVoice.tsx:1245` `color: 'var(--record-btn)'` → 改为 callout 形式：橙软底（`var(--record-btn-soft-bg)` = `#FFF4ED`）+ 橙边框（`var(--record-btn-soft-border)` = `#FDBA74`）+ 墨色文字（`var(--text-primary)`），圆角 `var(--radius-sm)`。视觉参考 `docs/superpowers/mockups/q5-hint-fix-comparison.html` 方案 C。

**4.9 间距网格收敛（仅明显偏离）**

- workbench/settings/onboarding 的裸 px（13/22/34/46/52/80）收敛到最近的 `--space-*` token。
- 不追求像素级对齐，只处理明显偏离 8pt 网格的值。

## 4. 非目标（Out of Scope）

- **不**重写任何组件的 JSX 结构/交互逻辑（除 P0 硬违规修复必要的最小改动）。
- **不**改 Rust 后端 / IPC / 数据模型。
- **不**改布局结构（三栏布局、面板宽度、NavRail 结构不变）。
- **不**做新组件（录音按钮不补建，只从 spec 移除）。
- **不**改 sandbox/magicui 内的 CSS（`src/lib/sandbox/`）——隔离特性，不影响主应用。
- **不**做无障碍全量审计（仅 §4.8 的橙色小号正文必修）。
- **不**改 settings.html（二级窗口，无字体链接，自动继承主入口字体）。
- **不**做图标库替换（继续 lucide-react）。
- **不**处理在途的 `20260615-panel-auto-toggle`、`20260615-workbench-widescreen-align` spec 的内容（布局/交互层，与设计 token 无冲突）。
- **不**重写 `docs/dev/` 和 `docs/guide/` 下非 themes.md 的文档（除 §2.6 明确清理旧体系色彩残留的 frontend.md/recording.md/settings.md）。
- **不**改 Playfair Display / JetBrains Mono 的具体字重区间（用 §3.1 的默认值，实现后 HTML mockup 验收）。

## 5. 验收标准（Acceptance Criteria）

### 规范与文档（阶段 1+2）

- **AC-1**：当检查 `docs/DESIGN.md`，应不存在「录音按钮」章节（原第 5 节「组件 → 录音按钮」整个子节移除）；§2 配色含 `#F6F6F1` 作为 secondary surface；§3 排版含 Playfair Display（display）+ JetBrains Mono（mono）+ 系统字体（body）三栈说明。
- **AC-2**：当检查 `docs/DESIGN.md` 第 5 节，应存在「结构化 token」子节，定义 `--radius-sm/md/lg/pill`、`--shadow-overlay`、`--border-menu`、`--focus-ring` 四类 token 及其消费规则。
- **AC-3**：当检查 `docs/DESIGN.md` 第 6 节，应存在「循环动画豁免 ease-in-out」条款；「一字体系规则」应改写为「三栈各司其职规则」。
- **AC-4**：当检查 `docs/design/` 目录，应不存在（整个目录已删除）。
- **AC-5**：当检查 `README.md:43`，应无「amber-gold」「ink-cyan」表述；当检查 `README.md` 设计文档链接，应指向 `docs/DESIGN.md` 而非 `docs/design/index.md`。
- **AC-6**：当检查根 `llms.txt` 和 `docs/llms.txt` 的「Design System」节，应单一指向 `docs/DESIGN.md`，无指向 docs/design/ 的链接，描述含 Playfair/JetBrains/暖白基调。
- **AC-7**：当检查 `docs/guide/themes.md`，应为 Agentic 新体系（橙白主题、暖白分层），无「琥珀金/墨水青」残留。
- **AC-8**：当检查 `AGENTS.md`「设计基调」段，应含字体三栈 + 暖白基调；「关键约束」段应含「结构化 token」约束。

### Token 层（阶段 3）

- **AC-9**：当检查 `index.html` 的 `<head>`，应加载 Playfair Display（wght 400-900）+ JetBrains Mono（wght 400;500）+ Noto Serif SC（wght 400-700），不再加载 IBM Plex Mono；保留 `font-display: swap` + preload + noscript fallback 模式。
- **AC-10**：当检查 `src/styles/globals.css`，应存在 `--font-display: 'Playfair Display', 'Noto Serif SC', serif`；`--font-mono` 值应为 `'JetBrains Mono', ui-monospace, monospace`；`--bg-secondary` 浅色值应为 `#f6f6f1`；`--bg-tertiary` 浅色值应为 `#ecece6`。
- **AC-11**：当检查 `src/styles/globals.css`，应存在 `--radius-sm/md/lg/pill`、`--shadow-overlay`、`--border-menu` 结构化 token 定义（浅色 + 暗色双套）。
- **AC-12**：当检查 `src/styles/globals.css`，`--space-5` 应为 `20px`（对齐 frontmatter）；冗余的 `--space-6` 应已移除或合并。
- **AC-13**：当应用以暗色模式启动，`--bg-secondary`/`--bg-tertiary` 保持 `#1c1c1e`/`#2c2c2e`（暗色不变），分层可感知。

### 组件层（阶段 4）

- **AC-14**：当检查 `DetailView.tsx` 分段控件（toggleButtonStyle/detailToggleButtonStyle 及其外层容器），应无外层 border+背景容器，活跃态无额外 border（去卡片化）。
- **AC-15**：当检查 `Toast.tsx` 和 `SectionVoice.tsx`，应无 `backdropFilter`/`backdrop-filter` 属性（玻璃态清除），改用纯色背景。
- **AC-16**：当检查 `HistoryFloatingButton.tsx` 的 transition，应无 `width`/`height`/`max-height`/`border-radius` 属性动画，改为 `transform` + `opacity`。
- **AC-17**：当检查 `SectionVoice.tsx:1245`（zhipuLimitHint），应为 callout 形式——橙软底（`var(--record-btn-soft-bg)`）+ 橙边框（`var(--record-btn-soft-border)`）+ 墨色文字（`var(--text-primary)`），圆角 `var(--radius-sm)`；文字色非 `var(--record-btn)` 橙色。
- **AC-18**：当检查 4 处浮层（TreeContextMenu/JournalContextMenu/settings-modal-shell/ideas-workbench-menu），box-shadow 应统一为 `var(--shadow-overlay)`，无 `0 24px 80px` 等装饰性深阴影。
- **AC-19**：当检查 `FileChip.tsx`，圆角应为 `var(--radius-sm)`、字号应为 `var(--text-xs)`、边框应为 `1px`。
- **AC-20**：当检查 `JournalItem.tsx` 选中态，指示器应为 3px 竖条（与 TreeItem 一致），非 2px borderLeft；hover 应有 transition。
- **AC-21**：当检查 `onboarding.css`、`nav-rail.css`、`globals.css`(automation/ideas) 的 `:focus`/`:focus-visible` 规则，outline 应统一为 `var(--focus-ring)`，无 `outline: none` 或各自硬编码浓度。
- **AC-22**：当检查 `var(--font-serif)` 的 8 处引用，标题场景（journal-blocks hero、markdownComponents h1/h2/h3）应改为 `var(--font-display)`；中文编辑/引用场景（JournalItem 列表标题、mdx 引用块）保留 `var(--font-serif)`。
- **AC-23**：当检查 JetBrains Mono 硬编码点（bridges.ts/previewPreset.ts/TodoSidebar.tsx/workspace-template），应统一走 `var(--font-mono)` token。

### 整体质量

- **AC-24**：当运行 `npm run build`（tsc + vite build），应通过，无因 token 改名/删除导致的编译错误。
- **AC-25**：当运行 `npm test`（vitest），全部通过；若 Snapshot 测试含色值（如 `#fafafa`/`#IBM Plex Mono`）则更新 snapshot。
- **AC-26**：当运行 `npm run lint` + `npm run format:check`，本次改动不应**引入新的** lint error 或 format 违规（预先存在的历史负债 App.tsx `any` error、TreeSidebar/navigation/UIContext format 问题不在本 spec 范围，留作独立 chore）。本 spec 改动的行本身应符合 prettier/eslint。
- **AC-27**：当用 HTML mockup 渲染中英混排标题（如「谨迹 JournalClaw 设计系统」），英文走 Playfair Display、中文走 Noto Serif SC 回退，观感不退化（无系统宋体裸奔）。

## 6. 非功能需求（NFR）

| 维度          | 要求                                                                                                                                                               | 备注                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 性能          | 加载 3 个 web font（Playfair + JetBrains + Noto Serif SC）增量约 80-120KB；用 `font-display: swap` + preload 避免 FOUT 阻塞首屏。token 替换零运行时开销。          | [证据] 现状已加载 IBM Plex Mono ~20KB |
| 安全 / 权限   | 纯前端 CSS/TSX/HTML 改动，无 IPC/文件系统/网络变更（Google Fonts 走现有 CDN）。                                                                                    | N/A 无权限面变化                      |
| 数据 / 隐私   | 不涉及用户数据。Google Fonts 请求经现有 CDN，无新增数据上报。                                                                                                      | N/A                                   |
| 可靠性 / 降级 | web font 加载失败时回退：Playfair → Noto Serif SC → serif；JetBrains → ui-monospace → monospace；Noto Serif SC → 系统宋体。token 缺失走 `var(--token, fallback)`。 |                                       |
| 可观测性      | 无新增埋点；视觉回归靠 HTML mockup + 人工 + 现有测试。                                                                                                             |                                       |
| 回滚策略      | **git revert 单 commit/PR 即可**——token 是纯值替换，文档在 git，字体加载 link 可回退。无数据迁移、无不可逆操作。                                                   | **L3 强制：回滚 ✓**                   |
| 兼容性        | token **只改值不改名**（`--font-mono`/`--bg-secondary` 名字保留），所有引用文件零改动自动生效（除硬编码点需手工迁移）。字体加载 link 增删不影响 JS 逻辑。          | **L3 强制：兼容性 ✓**                 |
| 成本          | 零新依赖（Google Fonts 免费）。字体增量约 80-120KB 一次性下载，浏览器缓存。                                                                                        |                                       |
| 风控滥用      | N/A 单机应用，无多租户。                                                                                                                                           |                                       |
| 运营客服      | N/A                                                                                                                                                                |                                       |
| 多语言地区    | DESIGN.md 中文为主；字体三栈支持中英混排；色板无地区敏感性。Playfair Display 对中文回退 Noto Serif SC。                                                            |                                       |

**L3 强制项核对**：

- 数据契约（视觉契约）→ 兼容性（✓ token 只改值不改名）、回滚（✓ git revert）。
- 权限/计费/对外 API/不可逆迁移/跨团队指标 → 均 N/A（纯前端视觉 + 文档）。

## 7. 依赖与影响面

**依赖**：

- 无新依赖。Google Fonts CDN（已用于 IBM Plex Mono）。
- Playfair Display / JetBrains Mono / Noto Serif SC 均为 Google Fonts 免费字体。

**影响面（受影响模块/文件）**：

**Token 根**：`src/styles/globals.css`（2377 行）——`:root` + 3 处主题覆盖块。阶段 3 主要工作。

**经 token 自动生效**（无需改代码）：

- `--bg-secondary` 改值：9 处引用（journal-blocks.css ×7、mdx.css ×2）自动跟随暖白。[证据: grep]
- `--font-mono` 改值：56 处引用自动从 IBM Plex Mono 切换到 JetBrains Mono。[证据: grep 精确计数]
- `--space-5` 改值：引用处自动从 24px 变 20px。

**需手工迁移的硬编码**：

- `var(--font-serif)` 8 处 → 按场景分流到 `--font-display`/保留。[证据: 探查报告]
- JetBrains Mono 硬编码：`bridges.ts:101/103`、`previewPreset.ts:27`、`TodoSidebar.tsx:350`、workspace-template。
- `#fafafa` 硬编码：`globals.css:181`（--detail-case-bg）、`:199`（--queue-bg）。
- P0 硬违规 3 处：Toast.tsx、SectionVoice.tsx ×2、HistoryFloatingButton.tsx。
- 组件偏离 7 类：分段控件、阴影 ×4、FileChip、JournalItem、菜单边框、聚焦环 ×4。

**文档**：

- `docs/DESIGN.md`（全文增量改写）。
- `docs/design/`（整个目录删除，6 文件）。
- `docs/guide/themes.md`（重写或删除）。
- `README.md`（:43 表述 + :137 链接）。
- `llms.txt`（根 + docs/，「Design System」节）。
- `AGENTS.md`（「设计基调」+「关键约束」段）。

**关联 spec**：

- `specs/20260614-agentic-design-language`（**被部分推翻**：§9 Q3 字体决策从「只用系统字体」推翻为「加载 Playfair + JetBrains」）。spec §1 已记录推翻理由。

**与历史结论冲突（13 处文档矛盾，删除 docs/design/ 后自动消解）**：

| #   | 矛盾                                                                      | 消解方式                                     |
| --- | ------------------------------------------------------------------------- | -------------------------------------------- |
| A   | DESIGN.md §99 信号橙 vs docs/design/colors.md:13 琥珀金                   | 删 docs/design/                              |
| B   | DESIGN.md §111 纯白 vs docs/design/index.md:20 墨水青近白                 | 删 docs/design/                              |
| C   | DESIGN.md §114 墨文字 vs docs/design/colors.md:36                         | 删 docs/design/                              |
| D   | DESIGN.md §220 ease-out-quart vs animation.md:59 ease-in-out              | 删 docs/design/ + DESIGN.md 新增循环豁免条款 |
| E   | DESIGN.md §144 允许 700/800 vs typography.md:37 禁止                      | 删 docs/design/                              |
| F   | DESIGN.md §132 scale 12/14/16/18/24/32/40 vs typography.md:21-29 旧 scale | 删 docs/design/                              |
| G   | DESIGN.md §146 不引入字体家族 vs typography.md:16 Noto Serif SC           | 改写规则为三栈 + 删 docs/design/             |
| H   | DESIGN.md §169 录音按钮规格 vs components.md:12 旧色值                    | 删录音按钮章节 + 删 docs/design/             |
| I   | DESIGN.md §178 列表色 vs colors.md:55-56 旧值                             | 删 docs/design/                              |
| J   | DESIGN.md §103 语义色 vs colors.md:67-72 旧值                             | 删 docs/design/                              |
| K   | layout.md:51 圆角上限 12px vs DESIGN.md 无上限                            | 删 docs/design/                              |
| L   | colors.md:12 --accent 录音红 vs DESIGN.md §105 danger 红                  | 删 docs/design/                              |
| M   | docs/guide/themes.md 整篇旧体系                                           | 重写或删除                                   |

## 8. 风险与待人类决策的问题

- **R1 [证据·必修]**：Playfair Display 是西文衬线，中文标题会回退到 font-family 栈的下一个。栈设计为 `'Playfair Display', 'Noto Serif SC', serif`——但 Noto Serif SC 当前只在 `docs/index.html`（landing 页）加载，**应用主入口 `index.html` 未加载**。若不补加载，中文标题回退到系统宋体（Songti SC），观感可能退化（Songti SC 与 Noto Serif SC 字貌有差异）。**决策**：阶段 3.1 在 index.html 补加载 Noto Serif SC（wght 400-700）。AC-9 + AC-27 覆盖。
- **R2 [证据]**：加载 3 个 web font 增量约 80-120KB，引入 FOUT 风险。**决策**：用 `font-display: swap`（已在现有模式）+ preload，首屏先用系统字体，加载后无感切换；JetBrains Mono 与 IBM Plex Mono 字宽接近，代码块切换无明显跳动。Playfair 与系统无衬线切换在标题处可能有一次跳动，可接受。AC-9 覆盖。
- **R3 [推测]**：`--bg-secondary: #F6F6F1` 与 `--bg-tertiary: #ECECE6` 的 ΔE 需验证 ≥3。**决策**：阶段 3 完成后用 HTML mockup 核对三档背景在浅色模式下的视觉区分度；若不达标，微调 tertiary 至 `#E8E8E0` 或更深。
- **R4 [证据]**：本 spec 推翻 `20260614-agentic-design-language` §9 Q3 的「只用系统字体」决策。**决策**：spec §1 已记录推翻理由（用户提供新规范草稿要求加载 Playfair + JetBrains）。该推翻是用户显式决策，非擅自行动。
- **R5 [推测]**：`--space-5` 从 24px 改 20px 会缩小所有引用处的间距。**决策**：阶段 3 完成后核对引用处（journal-blocks.css、mdx.css 等）视觉无过密；若局部过密，该处改用 `--space-6`（但 `--space-6` 本身冗余待移除，需先评估引用）。
- **R6 [推测]**：移除 `--space-6` 可能导致引用处编译错误。**决策**：阶段 3.5 先 grep `--space-6` 引用，迁移到 `--space-5`（现 20px）或 `--space-8`（32px）后再移除。
- **R7 [证据]**：Snapshot/视觉测试若含硬编码色值（`#fafafa`）或字体名（`IBM Plex Mono`）会失败。**决策**：阶段 4 完成后运行 `npm test`，失败的 snapshot 更新（非逻辑错误）。AC-25 覆盖。
- **R8 [推测]**：`docs/guide/themes.md` 重写工作量。**决策**：[推测] 默认重写为 Agentic 新体系（用户可见文档有存在价值）；若用户倾向删除，guide/index.md 移除链接即可。Q1 待确认。

**L3 多角色评审**：

- **设计**：Playfair 中英混排观感（R1）；暖白分层是否破坏现有「纯白锐利」气质（R3）。风险已识别，HTML mockup 验收。
- **工程**：web font 加载性能（R2）；token 改值不改名的兼容性（✓）；`--space-6` 移除的引用迁移（R6）。风险可控。
- **PM**：录音按钮章节移除是否影响用户预期？[推测] 当前 UI 无此入口，移除 spec 章节是「对齐现实」非「删除功能」，无用户感知。
- **数据/运营/安全合规**：N/A（纯前端视觉 + 文档）。

## 9. 待确认

| #   | 问题                                     | 当前默认值                                                                                                                                | 状态                                                                                                                     |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Q1  | docs/guide/themes.md 处理方式            | 默认：**重写为 Agentic 新体系**（用户可见文档有存在价值）；备选：删除并在 guide/index.md 移除链接                                         | 待确认（可用默认）                                                                                                       |
| Q2  | Playfair Display 字重区间                | 默认：**wght 400;500;600;700;800;900**（覆盖标题所需 700/800/900 + 正文衬线 400/500）                                                     | 待确认（可用默认）                                                                                                       |
| Q3  | 暖白 tertiary 具体值                     | 默认：**`#ECECE6`**（与 secondary `#F6F6F1` 的 ΔE 约 3.5）；备选：`#E8E8E0`（ΔE 约 4.5，更安全）                                          | 待确认（实现后 mockup 微调）                                                                                             |
| Q4  | `--space-6` 移除后的引用迁移策略         | 默认：grep 引用，值 24px 的迁移到 `--space-5`（改后 20px）或 `--space-8`（32px）按上下文判断                                              | ✅ 已确认：保留 `--space-6: 24px`（10 处引用都是 3×8pt 章节间距，语义清晰），仅修正 `--space-5` 为 20px 对齐 frontmatter |
| Q5  | SectionVoice:1245 橙色小号正文的修复形式 | 默认：**callout 形式**（橙软底 `#FFF4ED` + 橙边框 `#FDBA74` + 墨色文字 `#111827`，圆角 `var(--radius-sm)`）——用户已通过 mockup 确认方案 C | ✅ 已确认                                                                                                                |

## 10. 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 2026-06-15 | 可开发    | 用户已通过 4 轮 AskUserQuestion 完成核心决策（字体加载 Playfair+JetBrains / 暖白 #F6F6F1 / 删 docs/design/ / 移除录音按钮章节 / 一个 L3 spec 分阶段）。三轮探查报告提供完整证据（主题 token / 组件实现 / 设计债 / 文档矛盾 / 新 token 落地 / 门禁流程）。Q1-Q5 有合理默认值。L3 强制项（兼容性·token 只改值不改名、回滚·git revert）已覆盖。R1（Playfair 中文回退）必修：index.html 补加载 Noto Serif SC。R2（web font FOUT）用 swap+preload 缓解。R3（暖白分层）实现后 mockup 验证。R4（推翻 verified spec）已记录理由。本 spec 与在途的 panel-auto-toggle/workbench-widescreen-align 无冲突（布局/交互层）。 |
