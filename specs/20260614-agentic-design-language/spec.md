---
id: SPEC-20260614-agentic-design-language
title: "设计语言全面替换为 Agentic（#FF5701 · system fonts · 8pt grid）"
status: verified
source: gate
level: L3
created: 2026-06-14
related:
  - docs/DESIGN.md            # 将被改写
  - AGENTS.md                 # 「设计基调」段将被改写
  - src/styles/globals.css    # 令牌根文件
  - index.html                # 字体加载
  - specs/20260614-skills-redesign/spec.md   # 令牌映射表需同步更新
  - /Users/yanwu/Downloads/JournalClaw 技能页面 (standalone).html  # Agentic 视觉源之一
---

# 设计语言全面替换为 Agentic

## 1. 背景与问题

**谁**：整个 JournalClaw macOS 应用。

**现状**：设计语言为「克制·沉静·专业」+ 金橙色（`#B8782A`/`#C8933B`）单一 accent + 墨水青中性色体系，定义在 `docs/DESIGN.md` [证据: 全文]，落实在 `src/styles/globals.css:9-246` 的 `:root` 令牌块 [证据]。

**目标**：按用户提供的 Agentic 设计语言描述全面替换——Primary `#FF5701`、Success `#16A34A`、Warning `#D97706`、Danger `#DC2626`、Surface `#FFFFFF`、Text `#111827`；8pt 间距网格；type scale 14/16/18/24/32/40；"modern, bold" 气质。用户已确认 [决策]：**全应用彻底替换** + **只用系统字体**（不加载 Playfair Display / JetBrains Mono）+ **改写 DESIGN.md/AGENTS.md** + **同步更新 skills spec**。

**关键冲突已处理**：
- `docs/DESIGN.md` §6 明确禁止 `#ffffff`/`#000000` 与衬线标题——本次按用户决策整体改写，旧禁令随之失效。
- skills-redesign spec（`status: clarifying`，未 approved）的令牌映射表（mockup 金→`--record-btn` #B8782A）将被同步改为映射到 `#FF5701`。
- 用户选择「只用系统字体」：Agentic 原描述的 Playfair Display（标题）与 JetBrains Mono（mono）**不加载**，标题用系统无衬线栈（保持现状的 `--font-body`），mono 继续用已加载的 IBM Plex Mono。这是对原 brief 的有意识偏离，spec 记录此偏离。

**为什么是 L3**：触碰全局视觉契约（令牌系统是所有组件的共同数据契约），影响 28 个引用 `--record-btn` 的文件 + 16 个含 inline-hex 的生产文件；改写 `AGENTS.md`（项目宪法级文档）+ `docs/DESIGN.md`。

## 2. 目标与假设

通过 {改写 globals.css 令牌为 Agentic 色板 + 8pt 间距 + 新 type scale + system fonts；清理 8 个生产文件的 inline-hex 走令牌；改写 DESIGN.md/AGENTS.md；同步 skills spec 令牌映射}，影响 {应用整体视觉气质}，预期 {全应用从金橙沉静切换为 Agentic 橙+白+现代粗体，暗色模式同步，文档与代码一致}。

**假设（可证伪）**：
- 假设 A：令牌值替换后，所有经 `var(--token)` 引用的组件视觉自动正确（无需逐组件改）。证伪方式：8 个 inline-hex 文件 + mdx/chart 渲染需手工核对（已知 16 文件 120 处 hex，见 §7）。
- 假设 B：`#FF5701`（橙）在浅色 `#FFFFFF` 背景上对比度足够用于按钮文字。**证伪需验证**：`#FF5701` on `#FFFFFF` 对比度约 2.7:1，**低于 WCAG AA 文字 4.5:1**——作为大面积按钮填充+白字组合时，文字该用深色 `#111827` 而非白色。spec §8 列为风险 R1，需实现时验证。
- 假设 C：macOS 系统字体栈在「modern bold」气质下可接受（无衬线标题）。这是用户已确认的偏离。
- 假设 D：现有依赖 `gray_matter`、`mdxjs` 等与新色板无关，无破坏性影响。

## 3. 范围（In Scope）

**令牌层（`src/styles/globals.css`，主要工作）**
- `:root`（浅色默认）令牌值替换：
  - 主 accent：`--record-btn: #B8782A` → `#FF5701`；`--record-btn-hover` → 深一档（如 `#E64A00`）；`--record-btn-icon` → `#111827`（浅色，深墨保证 WCAG AA ~5.9:1；见 §8 R1）。初稿曾写 `#FFFFFF`，与 §8 R1/AC-14 无障碍硬约束冲突——以 §8 R1（[证据·必修]）为准。暗色 `--record-btn-icon` 为 `#0F0F0F`。
  - `--accent: #ff3b30`（红）→ 重新定义语义：保留为「危险/删除」语义红（与 `--status-danger` 对齐 `#DC2626`），**不再作为交互 accent**（交互 accent 统一走 `--record-btn`=#FF5701）。
  - 表面：`--bg: #f5f6f7` → `#FFFFFF`；`--bg-secondary`/`--bg-tertiary` 调整为白底上的微妙分层（如 `#FAFAFA`/`#F4F4F5`），保持色调分层语义。
  - 文字：`--text-primary: #1c1c1e` → `#111827`；`--text-secondary`/`-tertiary` 调整为 `#111827` 的灰阶（如 `#4B5563`/`#9CA3AF`）。
  - 分割线 `--divider` 系列调整为白底灰阶（如 `#E5E7EB`）。
  - 状态色对齐 brief：`--status-success: #266b45` → `#16A34A`；`--status-warning: #8a6500` → `#D97706`；`--status-danger: #b5312a` → `#DC2626`；各自 `-bg` 配套调整为对应浅底。
  - 间距：现有 `--space-1..12` 已是 4/8/12/16/20/24/32/48（4pt 基础单位）。**brief 要求 8pt 基础网格**——将基础单位从 4pt 提到 8pt 意味着 `--space-1` 从 4px→8px，会放大所有间距。**默认处理 [推测]**：保留 4px 作为最小粒度（`--space-1: 4px`），但确保主要节奏点（组内 8/16，章节间 32/48/64）落在 8pt 网格上。即「8pt 节奏网格 + 4px 细粒度例外」。Q1 待确认。
  - Type scale：现状 12/13/14/16/20/24/30 → brief 14/16/18/24/32/40。映射：`--text-xs: 12px` 保留（次元信息需更小）；新增/调整 `--text-sm: 13px→14px`、`--text-base: 14px→14px`、新增 `--text-md: 16px→18px`？**默认处理 [推测]**：采用 brief scale 作为「展示型」scale（标题用 24/32/40），UI 正文保留紧凑 14px。新增 `--text-display-lg: 40px`、`--text-display: 32px`。Q2 待确认。
  - 字重：brief 列 100–900 全档。DESIGN.md 现禁止 <400 与 >600。**默认处理**：放开到 400–800，允许标题用 700/800（"bold" 气质需要），仍排除 <400（过细不可读）。
- 暗色模式三处覆盖块（`@media dark` line 248、`[data-theme='dark']` line 427、`[data-theme='light']` line 1998）同步改写：暗色表面用 `#0F0F0F`/`#1C1C1E` 系（保持现状暗色基调），橙 `#FF5701` 在暗色下提亮一档（如 `#FF7A33`）保证对比度。

**字体层（`index.html` + globals.css）[决策：只用系统字体]**
- `index.html:7-8` 的 IBM Plex Mono Google Fonts `<link>` **保留**（mono 继续用 IBM Plex Mono，已是好选择；brief 的 JetBrains Mono 不带来质的提升，省一次字体切换）。
- `globals.css` 字体令牌：`--font-body` 保持系统栈；`--font-mono` 保持 IBM Plex Mono；`--font-serif` 保留声明但不强制使用（与现状一致）。
- **偏离记录**：brief 的 Playfair Display（标题）不加载；标题用 `--font-body`（system-ui/SF Pro）。spec §9 Q3 记录。

**Inline-hex 清理（8 个重点文件，生产代码）**
- `src/components/FileTypeIcon.tsx`（48 处）—— 把文件类型色改为引用 `--file-*` 令牌（令牌本身在 globals.css 已存在，本次同步刷新令牌值）。
- `src/components/mdx/chart-impl.tsx`（34 处）+ `charts.tsx`（1 处）—— 图表配色改为 Agentic 色板（橙为主，配套 6–8 色序列，避免纯随机）。
- `src/settings/components/SectionSpeakers.tsx`（10）、`SectionPermissions.tsx`（9）—— 内联色走令牌。
- `Toast.tsx`（6）、`TreeSidebar.tsx`（3）、`TreeContextMenu.tsx`（2）、`ChatPanel.tsx`（1）、`MergeIdentityDialog.tsx`（1）、`MonthDivider.tsx`（1）、`TopicTree.tsx`（1）、`TreeItem.tsx`（1）、`SectionVoice.tsx`/`SectionFeishu.tsx`（各 1）—— 逐处替换为令牌。
- ~~`SectionPlugins.tsx`（1 处）~~ —— **本 spec 不处理**：该文件将被 `20260614-skills-redesign` spec 删除（用户决策「删除 settings 里的技能配置」），删文件即清 hex。
- 其余含 hex 的 8 个文件（各 1 处）快速核对，能走令牌的走令牌。

**文档层**
- 改写 `docs/DESIGN.md`：隐喻从「档案册/金橙」改为 Agentic（"对话式 AI 优先 / modern bold / 橙白"）；§1–6 全部重写；§6 禁令更新（允许 `#FFFFFF`/`#111827`，允许 700/800 字重，仍禁渐变文字/玻璃态/ bounce 缓动等通用反 slop）。
- 改写 `AGENTS.md`「设计基调」段：从「克制·沉静·专业」改为 Agentic 表述（"Modern · Bold · Agentic"），指向更新后的 `docs/DESIGN.md`。

**关联 spec 同步**
- `specs/20260614-skills-redesign/spec.md` §7 令牌映射表**已同步**（第 2 轮）：mockup accent → `#FF5701`，标题用 system font，移除 Noto Serif SC。该 spec 与本 spec 耦合交付（用户决策「一并升级」）。

## 4. 非目标（Out of Scope）

- **不**重写任何组件的 JSX 结构/交互——只改视觉表现层（令牌值 + inline-hex 替换）。
- **不**加载 Playfair Display / JetBrains Mono（用户决策：系统字体）。
- **不**改 Rust 后端 / IPC / 数据模型。
- **不**改布局结构（三栏布局、面板宽度、NavRail 结构不变）。
- **不**做新组件（SkillsWorkbench 仍归 skills spec；本次只确保它落地后自动套用 Agentic 令牌）。
- **不**改 sandbox/magicui 内的 CSS（`src/lib/sandbox/`）——隔离特性，不影响主应用。
- **不**做动效大改（保留 ease-out-quart + transform/opacity 纪律；brief 的「150–250ms」与现状 ≤300ms 一致）。
- **不**做无障碍审计全量整改（仅 §8 R1 的按钮对比度必修）。
- **不**改 settings.html（二级窗口，无字体链接，自动继承）。
- **不**做图标库替换（继续 lucide-react）。

## 5. 验收标准（Acceptance Criteria）

- **AC-1**：当应用以浅色模式启动，主背景应为 `#FFFFFF`（±令牌容差），主交互 accent（录音按钮、选中态、活跃 tab）为 `#FF5701`，主文字为 `#111827`——任何位置出现旧金橙 `#B8782A`/`#C8933B` 即不合格。
- **AC-2**：当应用以暗色模式（`[data-theme='dark']`）启动，表面为近黑（现状 `#0F0F0F` 系保留或微调），accent 橙提亮至暗色可读档（如 `#FF7A33`），无白底硬编码、无对比度失效。
- **AC-3**：当系统切换 light↔dark，所有令牌应平滑跟随（无残留异色），`useTheme` 钩子逻辑不变。
- **AC-4**：当渲染 Markdown 详情（`.md-content.mdx-content` 链路），标题/正文/代码块/引用配色应为 Agentic 色板（橙标题、`#111827` 正文、状态色对齐 brief），无残留金橙。
- **AC-5**：当查看 `FileTypeIcon` 各文件类型图标，颜色应来自 `--file-*` 令牌（令牌值刷新为 Agentic 调性），`FileTypeIcon.tsx` 内不再有未走令牌的 inline hex。
- **AC-6**：当渲染 mdx 图表（`chart-impl.tsx`），配色序列应以 `#FF5701` 为主色 + 6–8 色配套序列（非随机、非金橙），暗色下可读。
- **AC-7**：当检查 `docs/DESIGN.md`，全文应为 Agentic 风格规范（橙白、8pt、modern bold），不再出现「金橙」「墨水青」「档案册」表述；§6 禁令允许 `#FFFFFF`/`#111827` 与 700/800 字重。
- **AC-8**：当检查 `AGENTS.md`「设计基调」段，应为 Agentic 表述并指向新 DESIGN.md，不出现「克制·沉静·专业」。
- **AC-9**：当检查 `specs/20260614-skills-redesign/spec.md` §7，令牌映射表应为 `mockup accent → #FF5701`，标题字体应为 system font，无 `--record-btn #B8782A` 残留。
- **AC-10**：当运行 `npm run build`（tsc + vite build），应通过，无因令牌重命名/删除导致的编译错误。
- **AC-11**：当运行 `npm test`（vitest）+ `cd src-tauri && cargo test`，全部通过（视觉令牌变更不应破坏逻辑测试；若 Snapshot 测试含色值则更新 snapshot）。
- **AC-12**：当检查 16 个含 inline-hex 的生产文件，剩余 inline hex 应仅限「无法令牌化」的语义色（如 mdx 图表的特定数据序列色、文件类型的细微差异），核心 accent/bg/text 应全部走令牌。
- **AC-13**：当查看主要交互态（hover/active/focus/disabled），accent 反馈应为 `#FF5701` 系（hover 深一档、focus ring 橙色），过渡 150–250ms ease-out。
- **AC-14**：按钮文字对比度——`#FF5701` 填充按钮上的文字应为深色 `#111827`（非白色），保证 WCAG AA（≥4.5:1）；`#16A34A`/`#D97706` 填充按钮同理验证。

## 6. 非功能需求（NFR）

| 维度 | 要求 | 备注 |
|---|---|---|
| 性能 | 不新增 web font 加载（系统字体 + 现有 IBM Plex Mono）；令牌替换零运行时开销。 | [证据] 现状已是系统字体+1 web font |
| 安全 / 权限 | 纯前端 CSS/TSX 改动，无 IPC/文件系统/网络变更。 | N/A 无权限面变化 |
| 数据 / 隐私 | 不涉及用户数据。 | N/A |
| 可靠性 / 降级 | 令牌缺失回退：CSS `var(--token, fallback)` 模式；inline-hex 替换时保留 fallback。 | |
| 可观测性 | 无新增埋点；视觉回归靠人工 + 现有测试。 | |
| 回滚策略 | **git revert 单 commit/PR 即可**——令牌是纯值替换，无数据迁移、无不可逆操作。DESIGN.md/AGENTS.md 同在 git。 | L3 强制：回滚 ✓ |
| 兼容性 | 令牌**只改值不改名**（`--record-btn` 名字保留，值变 `#FF57001`），所有 28 个引用文件零改动自动生效。这是降低风险的关键设计。 | L3 强制：兼容性 ✓ |
| 成本 | 零新依赖。零字体下载新增。 | |
| 风控滥用 | N/A 单机应用，无多租户。 | |
| 运营客服 | N/A | |
| 多语言地区 | 文档双语（DESIGN.md 中文为主）；色板无地区敏感性。 | |

**L3 强制项核对**：数据契约（视觉契约）→ 兼容性（✓ 令牌只改值）、回滚（✓ git revert）；权限/计费/对外 API/不可逆迁移/跨团队指标 → 均 N/A（纯前端视觉）。

## 7. 依赖与影响面

**依赖**：
- 无新依赖。`gray_matter`/`mdxjs`/lucide-react 均已在。
- 系统字体栈（macOS SF Pro）由 OS 提供，零加载成本。

**影响面（受影响模块/文件）**：
- **令牌根**：`src/styles/globals.css`（2361 行）——`:root` + 3 处主题覆盖块。主要工作。
- **经令牌自动生效**（无需改代码）：28 个引用 `--record-btn` 的文件、13 个 `--font-body`、21 个 `--font-mono`、15 个 `--status-success`、14 个 `--status-danger`、8 个 `--status-warning` [证据: grep -rl 计数]。
- **inline-hex 需手工替换**（16 生产文件，120 处）[证据: 精确 grep]：
  - FileTypeIcon.tsx（48）、mdx/chart-impl.tsx（34）—— 重灾区
  - SectionSpeakers(10)、SectionPermissions(9)、Toast(6)、TreeSidebar(3)、TreeContextMenu(2)
  - 其余 8 文件各 1 处
- **文档**：`docs/DESIGN.md`（全文改写）、`AGENTS.md`（「设计基调」段）。
- **关联 spec**：`specs/20260614-skills-redesign/spec.md` §7（令牌映射同步）。
- **字体加载**：`index.html:7-8`（IBM Plex Mono `<link>` 保留，不改）。

**令牌映射决策表**（旧 → 新，浅色默认）：

| 令牌 | 旧值 | 新值 | 说明 |
|---|---|---|---|
| `--record-btn` | `#b8782a` | `#FF5701` | 主 accent，只改值不改名 |
| `--record-btn-hover` | `#a06820` | `#E64A00` [推测] | 深一档 |
| `--record-btn-icon` | `#f5f6f7` | `#111827` | 按钮上文字/图标（深墨，WCAG AA） |
| `--accent` | `#ff3b30`（交互红） | 语义重定义：危险红，对齐 `--status-danger` | 不再作交互 accent |
| `--bg` | `#f5f6f7` | `#FFFFFF` | 主背景 |
| `--bg-secondary` | `#f7f8f9` | `#FAFAFA` [推测] | 微分层 |
| `--bg-tertiary` | `#e5e5e7` | `#F4F4F5` [推测] | |
| `--text-primary` | `#1c1c1e` | `#111827` | 主文字 |
| `--text-secondary` | `#6a7278` | `#4B5563` [推测] | |
| `--text-tertiary` | `#a0a8ad` | `#9CA3AF` [推测] | |
| `--divider` | `#d8dce0` | `#E5E7EB` [推测] | |
| `--status-success` | `#266b45` | `#16A34A` | brief 指定 |
| `--status-warning` | `#8a6500` | `#D97706` | brief 指定 |
| `--status-danger` | `#b5312a` | `#DC2626` | brief 指定 |
| 各 `-bg` 配套 | 旧浅底 | 新浅底 | 配合主色 |

标注 `[推测]` 的值为合理默认，实现时可微调（Q4 待确认是否需逐值过审）。

**与历史结论冲突**：
- `docs/DESIGN.md` §6 禁令（禁 `#fff`/`#000`、禁 >600 字重）——本次改写后失效。
- `AGENTS.md`「设计基调」——本次改写。
- skills-redesign spec §7 令牌映射——本次同步更新。
- 其余 4 个 specs（identity-archive/topic-pin/core-profile/jit-specialist）不涉及视觉令牌，无冲突 [证据: grep specs/]。

## 8. 风险与待人类决策的问题

- **R1 [证据·必修]**：`#FF5701` on `#FFFFFF` 文字对比度 ≈ 2.7:1，低于 WCAG AA 4.5:1。**决策**：`#FF5701` 仅作填充背景（按钮/选中态），其上文字用 `#111827`（深色，对比度 ≈ 5.9:1 ✓）。`#FF5701` 不直接作小号正文文字色。AC-14 覆盖。
- **R2 [推测]**：`--accent`（红 `#ff3b30`）现有 4 个文件引用 [证据]。语义重定义为危险红后，需核对这 4 处原本是否当交互 accent 用——若是，改为 `--record-btn`（橙）；若本就是危险语义，对齐 `--status-danger`。
- **R3 [推测]**：mdx 图表（chart-impl.tsx 34 处 hex）配色序列需重新设计（橙为主 + 序列色）。本次给默认 6 色序列（如 `#FF5701`/`#16A34A`/`#D97706`/`#3B82F6`/`#8B5CF6`/`#EC4899`），实现时可调。
- **R4 [推测]**：8pt 网格与现状 4px 最小粒度的取舍（见 §3 间距段）。若严格 8pt，`--space-1` 从 4→8px 会放大所有间距，可能过松。默认「8pt 节奏 + 4px 细粒度例外」（Q1）。
- **R5 [证据]**：Snapshot/视觉测试若含硬编码色值会失败。`src/tests/` 需核对，失败的 snapshot 更新（非逻辑错误）。
- **R6 [推测]**：暗色模式下 `#FF5701` 在 `#0F0F0F` 上对比度 ≈ 5.2:1 ✓（可读），但作填充时白字对比度需验证。
- **R7 [设计偏离记录]**：brief 要求 Playfair Display 标题 + JetBrains Mono，用户选系统字体。Agentic 的「serif 标题个性」将缺失——气质主要靠 `#FF5701` + bold 字重 + 8pt 网格承载。这是用户已确认的有意识取舍。

## 9. 待确认

| # | 问题 | 当前默认值 | 状态 |
|---|---|---|---|
| Q1 | 8pt 网格严格度 | 默认：**8pt 节奏 + 4px 细粒度例外**（`--space-1` 保留 4px，主要节奏点落 8/16/32/48/64） | 待确认（可用默认） |
| Q2 | Type scale 映射 | 默认：UI 正文保留 14px 紧凑；新增 `--text-display-lg:40px`/`--text-display:32px`/`--text-heading:24px` 用于展示型标题；保留 `--text-xs:12px` 次元信息 | 待确认（可用默认） |
| Q3 | 字体偏离 | 用户已确认：**只用系统字体**（不加载 Playfair Display/JetBrains Mono）；mono 继续用 IBM Plex Mono。Agentic 原描述的 serif 标题不实现 | ✅ 已确认（偏离已记录） |
| Q4 | 令牌新值逐个过审 vs 一次性默认 | 默认：**一次性用 §7 表的默认值实现**，实现后用 HTML mockup 给你验收，不满意再微调（避免逐值往返） | 待确认（可用默认） |
| Q5 | `--accent` 语义重定义 | 默认：`--accent` 从「交互红」重定义为「危险红」对齐 `--status-danger`；交互 accent 统一走 `--record-btn`（橙）。R2 核对 4 个引用点 | 待确认（可用默认） |
| Q6 | mdx 图表配色序列 | 默认：6 色序列 `#FF5701`/`#16A34A`/`#D97706`/`#3B82F6`/`#8B5CF6`/`#EC4899`（橙为主，序列色兼顾区分度） | 待确认（可用默认） |

## 10. 门禁记录

| 轮次 | 日期 | Readiness | 主要缺口 |
|---|---|---|---|
| 1 | 2026-06-14 | 待澄清 | 应用范围（全应用✓）、字体（系统✓）、文档改写（✓）、skills spec 同步（✓）已确认；Q1/Q2/Q4/Q5/Q6 有合理默认值（8pt 节奏+4px 例外 / 新增 display scale / 一次性默认实现 / accent 重定义为危险红 / 图表 6 色序列）。L3 强制项（兼容性·令牌只改值不改名、回滚·git revert）已覆盖。R1 对比度必修。 |
| 2 | 2026-06-14 | 可开发 | skills-redesign spec 第 2 轮已落地（用户决策：无历史/无分类/删 Settings/Agentic 一并升级）；§3 inline-hex 清理表移除 `SectionPlugins.tsx`（该文件将由 skills spec 删除）；§7 令牌映射与本 spec 一致。本 spec 与 skills spec 耦合交付。 |
