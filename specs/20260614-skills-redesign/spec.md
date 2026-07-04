---
id: SPEC-20260614-skills-redesign
title: '技能系统重设计 — 富信息卡片网格 + 详情抽屉 + 真实数据 + 单技能开关（Agentic 风格）'
status: verified
source: gate
level: L3
created: 2026-06-14
related:
  - src/settings/components/SectionPlugins.tsx # 将删除
  - src/settings/SettingsLayout.tsx # 将移除 plugins 区块
  - src-tauri/src/skills.rs
  - specs/20260614-agentic-design-language/spec.md # 耦合：本 spec 用 Agentic 令牌（#FF5701 等）
  - src-tauri/src/llm/enable_skill.rs
  - src-tauri/src/llm/prompt.rs
  - src-tauri/src/workspace_settings.rs
  - /Users/yanwu/Downloads/JournalClaw 技能页面 (standalone).html # 视觉源
---

# 技能系统重设计

## 1. 背景与问题

**谁**：知识工作者，在 nav-rail 点「技能」查看/管理已安装的 AI 技能。

**现状为什么不行**：

- 唯一的技能 UI `SectionPlugins.tsx` 同时挂在 nav-rail「技能」中心面板 **和** Settings→Plugins，是一个只读的「项目组 + 全局组」两栏列表，每行只有 `name` + 单行截断 `description` [证据: `SectionPlugins.tsx`，`App.tsx:1065`]。
- 数据模型贫瘠：`SkillInfo { id, name, description, scope, dir_name }` 仅 5 个字段 [证据: `src/lib/tauri.ts:497`，`skills.rs:5`]。Rust 只解析 SKILL.md frontmatter 的 `name` + `description` 两个标量 [证据: `skills.rs:14` `parse_skill_frontmatter`]。
- 只有一个全局布尔 `global_skills_enabled`，没有单技能启用/停用 [证据: `workspace_settings.rs:60`]。
- 无触发方式、无详情。无法在 UI 里看到「这个技能什么时候会被调用、加载了哪些规则」。

**目标视觉**：用户提供的 HTML mockup（`/Users/yanwu/Downloads/JournalClaw 技能页面 (standalone).html`，源 JSX 已解码存 `/tmp/skills_app.jsx`）定义了新版面 —— eyebrow（AGENT SKILLS 胶囊）→ 大标题「技能」→ 描述 → 统计卡（已启用/全局/斜杠命令）→ 搜索 → 富信息卡片网格 → 点击卡片打开详情抽屉（说明/触发方式/产出/加载的规则）。

**本轮决策（2026-06-14）已大幅简化范围**：

- ① **无运行历史**（用户决策）→ 砍掉 mockup 里的「最近运行」区 + 卡片上的「触发次数」计数（后者依赖历史数据）。
- ② **无分类**（用户决策）→ 砍掉 mockup 里的分类 tabs（设计/整理/档案/元能力）+ `category` 字段。
- ③ **删除 Settings 里的技能配置**（用户决策）→ 删掉 Settings→Plugins 区块 + 孤立的 `SectionPlugins.tsx`，nav-rail「技能」成为唯一入口。
- ④ **Agentic 风格**（用户决策「一并升级」）→ 本页直接用 `#FF5701` 主色 + 8pt 网格 + system font（见 `specs/20260614-agentic-design-language/spec.md`），不再用旧金色 `--record-btn #B8782A`。

**本 spec 范围 = mockup 1:1 落地，且数据全部真实（用户决策 Q1=全量真实数据）。** 这意味着本次同时改后端数据契约、持久化、LLM 工具行为——属 L3。

## 2. 目标与假设

通过 {按 mockup 重写技能页前端（Agentic 风格）+ 扩展 SKILL.md frontmatter 契约（triggers/output/loads）+ 落地 per-skill 持久化开关 + 删除 Settings→Plugins}，影响 {用户在「技能」页的浏览与启停体验}，预期 {卡片展示真实触发/产出/加载规则，开关真实生效并影响 LLM 可用技能集合，技能管理入口收敛为 nav-rail 唯一}。

**假设（可证伪）**：

- 假设 A：SKILL.md 作者愿意在 frontmatter 补 `triggers / output` 字段。证伪方式：若仓库现有技能文件不补这些字段，则卡片对应区域退化为「无触发方式标注」占位，不报错。
- 假设 B：技能目录下文件结构稳定（`<scope>/skills/<dir>/SKILL.md` + 同目录可选 `references/`、`assets/`）。证伪方式：`scan_skills_dir` 遇到非预期结构时跳过而非 panic（现状已是 `continue`）。
- 假设 C：删除 Settings→Plugins 不破坏其它设置项（`SettingsLayout` 的 section 列表是数组式，移除一项即可）。证伪方式：`SettingsLayout.tsx` section 注册是开关式。

## 3. 范围（In Scope）

**前端**

- 新建 `src/components/SkillsWorkbench.tsx` 取代 nav-rail「技能」中心面板当前挂载的 `SectionPlugins`（App.tsx 改为 lazy 挂载 `SkillsWorkbench`）。
- 页面结构（Agentic 风格）：header（eyebrow「AGENT SKILLS」+ 大标题「技能」+ 描述 + 右侧统计卡 + 「打开目录」「新建技能」按钮）→ 筛选行（**仅搜索框，无分类 tabs**）→ 卡片网格 → 详情抽屉。
- `SkillCard`：icon 容器 + id（mono）+ scope 徽章 + title + 2 行 desc 截断 + 底部「**触发 chips**（无分类圆点、无触发次数）」+ 右上 Switch。
- `SkillDrawer`：modal 居中，660px 宽，分区：说明 / 触发方式 / 产出 / 加载的规则（FileChip 列表）。**无「最近运行」区**。
- 统计卡 3 格：已启用 / 全局 / 斜杠命令（与 mockup 一致，但「斜杠命令」计数 = triggers 含 slash 的技能数，与历史无关）。
- 视觉风格用 Agentic 令牌（`#FF5701` 主色、白底 `#FFFFFF`、system font 标题、8pt 节奏）。令牌映射见 §7。
- **删除 Settings→Plugins**：`src/settings/SettingsLayout.tsx` 移除 `plugins` section（id=`'plugins'`，icon `Puzzle`，label `t('plugins')`）+ 其 case 分支；删除孤儿文件 `src/settings/components/SectionPlugins.tsx`（含其内部的 `SkillGroup` 子组件）。
- 全局技能总开关（原在 SectionPlugins 里的 global toggle）迁移到 SkillsWorkbench 顶部（或在抽屉里），保留 `getGlobalSkillsEnabled`/`setGlobalSkillsEnabled` 两个 IPC 调用。

**后端（Rust）**

- 扩展 `SkillInfo` 结构体，新增可空字段：`triggers: Vec<TriggerInfo>`、`output: Option<String>`、`loads: Vec<LoadInfo>`、`enabled: bool`（聚合：项目技能默认 true；全局技能受 global 开关 + per-skill 停用名单共同决定）。**无 `category`、无 `runs`、无 `history`。**
- 用 `gray_matter`（已在 `Cargo.toml`）解析 frontmatter 的 `triggers`（YAML list）、`output`（标量）；`name` 缺失仍跳过该技能（现状不变）。
- `loads` = 扫描技能目录下的 `references/`、`assets/` 及根 `SKILL.md`，产出 `{name, type}` 列表（type ∈ `md`/`json`/`dir`，对齐 mockup）。
- 新增 per-skill 持久化：`workspace_settings` 增加 `disabled_skills: Option<Vec<String>>`（存被停用技能的 id，如 `project:journal`）。
- **无运行历史采集**：`enable_skill.rs` 不改 `execute` 逻辑；不新增 `skills-runs.jsonl`。
- `enable_skill::definition`、`llm::prompt::scan_skills`、`enable_skill::execute` 三处都在构建/执行时**剔除被停用的技能**：清单（definition/scan_skills）不列出停用技能；运行时（execute）拒绝加载停用技能（`disabled_skills` 命中 `project:<name>` 或 `global:<name>`，或全局开关关 + 全局技能），防止 LLM 凭记忆绕过。

**IPC（`src/lib/tauri.ts`）**

- `SkillInfo` interface 同步扩展（triggers/output/loads/enabled；无 category/runs/history）。
- 新增 `setSkillEnabled(id, enabled)`。
- `listSkills()` 返回值含全部新字段。
- `getGlobalSkillsEnabled`/`setGlobalSkillsEnabled` 保留（迁移到 SkillsWorkbench）。

## 4. 非目标（Out of Scope）

- **不**做应用内技能编辑器（新建/编辑统一走「打开目录」用 OS 文件管理器，沿用现状）。
- **不**改 SlashCommandMenu（`/` 自动补全里的技能列表）的视觉；它继续用 `SkillInfo.name`。后续可单独统一。
- **不**改 NavRail 的「技能」图标（`Zap`）/排序/键盘导航。
- **不**做技能的 CRUD（删除、重命名、移动）；仅启停 + 查看。
- **不**做跨 workspace 的技能同步/导入导出。
- **不**引入新的共享 UI 组件库（Button/Input/Switch 仍按 app 现状：inline style + `globals.css`；Switch 在本组件内私有实现，对齐 mockup 样式）。
- **不**做技能使用统计/趋势页、不做分类标签体系、不做运行历史。

## 5. 验收标准（Acceptance Criteria）

- **AC-1**：当用户点击 nav-rail「技能」，应渲染新版 `SkillsWorkbench`（Agentic 风格：`#FF5701` 主色、白底、system font 大标题「技能」、eyebrow「AGENT SKILLS」、描述、右侧统计卡 + 「打开目录」「新建技能」按钮），不再渲染旧 `SectionPlugins`。
- **AC-2**：[已废弃，本轮移除分类] ~~当 `<workspace>/.claude/skills/<dir>/SKILL.md` 含 frontmatter `category: design`……~~ 分类系统不做。
- **AC-3**：当 SKILL.md frontmatter `triggers` 为 YAML 列表 `["/lint"]`（或 `[{k: slash, t: "/lint"}]` 形式），卡片底部应渲染对应触发 chip（斜杠命令 chip 用 mono 字体 + `#FF5701` + `›` 前缀）。
- **AC-4**：当某技能目录存在 `references/journal.md`，该技能详情抽屉「加载的规则」区应列出该文件（FileChip 样式，mono，link tone）。
- **AC-5**：当用户点击卡片右上 Switch 将某项目技能从启用切到停用，应：(a) 卡片立刻变灰（opacity 0.62），(b) 调用 `setSkillEnabled(id, false)` 持久化，(c) 重启应用后仍为停用，(d) 该技能从 LLM `load_skill` 工具的可选清单中消失（`enable_skill::definition` 不再列出），且运行时 `enable_skill::execute` 拒绝加载（返回 error）。
- **AC-6**：[已废弃，本轮移除运行历史] ~~当 `enable_skill::execute` 成功加载……最近运行……~~ 运行历史不做。
- **AC-7**：当用户在搜索框输入关键字，技能列表应按 `id + title + desc` 模糊过滤；无匹配时显示「没有匹配的技能。」。
- **AC-8**：当 SKILL.md frontmatter 缺 `triggers / output`，卡片/抽屉对应区域应优雅降级（触发区为空、产出区隐藏），不报错、不阻塞列表渲染。
- **AC-9**：当「全局技能」总开关关闭，全局 scope 的技能不应出现在列表（保持现状语义）；开关开启后出现，且每张全局技能卡也支持独立 Switch（受双重控制）。
- **AC-10**：当点击「打开目录」按钮，应调用 `openSkillsDir('project')` 打开项目 skills 目录（沿用现有命令）；抽屉「编辑技能」按钮打开该技能 SKILL.md 所在目录。
- **AC-11**：暗色主题（`[data-theme='dark']`）下，所有新增卡片/抽屉/统计卡/chip 颜色应正确跟随（无白底硬编码、无红色误用）；主交互色为 Agentic 橙（`#FF5701`/暗色提亮档）。
- **AC-12**：当用户在抽屉按 Esc 或点击遮罩，抽屉应淡出关闭；再次点开另一张卡片应正常显示。
- **AC-13**（新增）：当用户打开 Settings 面板，应**不再**出现「技能插件」/「Plugins」section（id=`'plugins'`）；`src/settings/components/SectionPlugins.tsx` 文件被删除；`src/settings/SettingsLayout.tsx` 的 section 列表与 case 分支中无 `plugins` 残留。
- **AC-14**（新增）：全局技能总开关（原 SectionPlugins 内的 toggle）应迁移到 SkillsWorkbench 内可见可操作，调用同一个 `setGlobalSkillsEnabled` IPC，行为不变。

## 6. 非功能需求（NFR）

| 维度          | 要求                                                                                                                                                                                                               | 备注                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| 性能          | `list_skills` 仍是同步扫描两个目录；新增的 `loads`（每技能扫 references/）在 ≤50 技能下增量可忽略。若超 100 技能需评估——本次设阈值告警：扫描 >200ms 记 warn 日志。                                                 | [推测] 现状同步 fs 扫描已可接受             |
| 安全 / 权限   | per-skill 开关写入 `workspace_settings.json`，与现有 theme/pinned 同文件同权限；无新增网络/系统权限。`load_skill` 工具剔除停用技能属于权限收紧，不放宽。                                                           | [证据] `workspace_settings.rs` 现有写入路径 |
| 数据 / 隐私   | 不采集运行历史、不落盘任何新增数据（除 `disabled_skills` 名单）。                                                                                                                                                  |                                             |
| 可靠性 / 降级 | frontmatter 字段缺失、`gray_matter` 解析失败 → 降级为「该字段为空」，不抛错给前端。AC-8 覆盖。                                                                                                                     |                                             |
| 可观测性      | 新增「扫描 >200ms」warn。无新增埋点。                                                                                                                                                                              |                                             |
| 回滚策略      | 全前端 + Rust 字段新增，向后兼容：旧 `SkillInfo`（5 字段）在新代码下仍可工作（新字段为 None/空）；持久化的 `disabled_skills` 缺失=全启用。回滚=git revert，无数据迁移。                                            | [证据] `#[serde(default)]` 模式已是仓库惯例 |
| 兼容性        | `SkillInfo` 仅加字段不改字段，IPC 向后兼容。现有调用方（`SlashCommandMenu`、`enable_skill::definition`）不读新字段则无影响。删除 `SectionPlugins.tsx` 是破坏性的，但仅该文件被 SettingsLayout 引用，无外部消费者。 |                                             |
| 成本          | 无新依赖（`gray_matter` 已在）。无外部 API 调用。                                                                                                                                                                  | [证据] `Cargo.toml`                         |
| 风控滥用      | per-skill 停用只影响本机 LLM，无多租户/服务端滥用面。                                                                                                                                                              | N/A 单机应用                                |
| 运营客服      | 技能启停由用户自主操作，无服务端开关；故障=本地文件问题。                                                                                                                                                          | N/A                                         |
| 多语言地区    | mockup 文案为中文（「技能」「已启用」「触发」「成功/跳过/失败」），与 app 现有中文 UI 一致；i18n key 沿用 `useTranslation` 模式新增 `skills.*` 命名空间。                                                          |                                             |

**L3 强制项核对**：数据契约→兼容性（✓ 向后兼容）、回滚（✓ git revert + serde default）；权限→安全（✓ 只收紧）、可观测性（✓ warn 日志）。无计费/对外 API/不可逆迁移/跨团队指标。

## 7. 依赖与影响面

**依赖**：

- `gray_matter = "0.2"` 已在 `Cargo.toml` [证据] —— 用于解析 frontmatter 的 `triggers`（YAML list）、`category`、`output`。无需加 `serde_yaml`。
- lucide-react 图标库（app 现有）—— mockup 用到 `PenTool/Sparkles/Fingerprint/BookText/ListChecks/RefreshCw/LayoutTemplate/Zap/Search/Plus/FolderOpen/X/Pencil/FileText/ChevronRight/Bolt/Paperclip/MousePointerClick`，全部为 lucide 标准图标。
- 现有 `FileChip` 组件（`src/components/FileChip.tsx`）—— 抽屉「加载的规则」复用其 pill 样式（按 mockup `tone="link" mono`）。

**影响面（受影响模块）**：

- `src/App.tsx:1065` —— lazy import 从 `SectionPlugins` 改为 `SkillsWorkbench`。
- `src/lib/tauri.ts` —— `SkillInfo` 接口扩展（triggers/output/loads/enabled）；新增 `setSkillEnabled`。
- `src-tauri/src/skills.rs` —— `SkillInfo` 结构体扩展；`scan_skills_dir` 用 gray_matter 解析 triggers/output + 扫 references/ 产 loads；`list_skills` 注入 `enabled` 状态。
- `src-tauri/src/llm/enable_skill.rs` —— `definition` 收 disabled_skills 过滤（execute 逻辑不动，无历史采集）。
- `src-tauri/src/llm/prompt.rs:140` `scan_skills` —— 同样过滤停用技能。
- `src-tauri/src/workspace_settings.rs` —— 新增 `disabled_skills: Option<Vec<String>>` 字段 + 命令 `set_skill_enabled(id, enabled)`。
- `src-tauri/src/main.rs` —— 注册新命令。
- **删除** `src/settings/components/SectionPlugins.tsx`。
- **修改** `src/settings/SettingsLayout.tsx` —— 移除 `plugins` section 注册 + case 分支。

**令牌映射表（mockup → Agentic app 等价）** [证据: 本仓库 spec `20260614-agentic-design-language` + `globals.css` 探索]：

| mockup 变量                           | Agentic app 等价                             | 说明                                |
| ------------------------------------- | -------------------------------------------- | ----------------------------------- |
| `--accent`（mockup 金色）             | `--record-btn` = `#FF5701`（浅）/ 暗色提亮档 | 主 accent，与设计语言 spec 同步换血 |
| `--font-serif`（mockup 标题）         | `--font-body`（system font，bold 700/800）   | 用户决策：系统字体，不用 serif 标题 |
| `--font-mono`                         | `--font-mono` (IBM Plex Mono)                | 一致，id 用 mono                    |
| `--radius-xl` (12px)                  | `8px` 字面量                                 | app 无 radius token scale           |
| `--radius-md` (8px)                   | `6px` 字面量                                 |                                     |
| `--radius-sm` (6px)                   | `6px`                                        |                                     |
| `--file-tile-bg`                      | `--detail-case-bg`（Agentic 下为白底微分层） | icon 容器底色                       |
| `--detail-case-bg/-border`            | 同名（值随设计语言 spec 刷新）               |                                     |
| `--tag-bg/-text`                      | 同名                                         |                                     |
| `--divider/-hover`                    | 同名                                         |                                     |
| `--bg/-secondary/-tertiary`           | 同名（`--bg` → `#FFFFFF` 等）                |                                     |
| `--text-primary/-secondary/-tertiary` | 同名（`--text-primary` → `#111827` 等）      |                                     |
| `--item-selected-bg/-text`            | 同名                                         | tab/卡片激活态                      |
| `--status-success/-danger + -bg`      | 同名（无运行历史徽章场景，但保留语义色）     |                                     |

**与历史结论冲突**：

- `specs/` 现有 4 个 spec 均不涉及技能 UI。`20260612-identity-archive-group` 仅声明不改 identity-profiling skill 的 LLM 逻辑——本 spec 不改其逻辑，只在 UI 展示它。
- 与 `20260614-agentic-design-language` spec 耦合：本 spec 的令牌值依赖那个 spec 的换血。**实现顺序**：先做（或同时做）设计语言 spec 的 globals.css 换血，再落 SkillsWorkbench，确保令牌已是 Agentic 值。

## 8. 风险与待人类决策的问题

- **R1 [证据·已规避]**：~~`enable_skill::execute` 有 3 个调用点，历史追加需统一注入……~~ 本轮移除运行历史，此风险消失。
- **R2 [推测]**：mockup 卡片网格 `minmax(440px, 1fr)`，在窄窗口（<440px 内容区）会单列堆叠——可接受，无需额外响应式。
- **R3 [证据]**：删除 `SectionPlugins.tsx` + SettingsLayout 的 `plugins` section 是破坏性改动。需确认无其它文件 import `SectionPlugins`（`SettingsLayout.tsx` 与 `App.tsx` 两处）。`App.tsx` 的 import 改指向 `SkillsWorkbench`；`SettingsLayout.tsx` 的 import 与 case 一并删除。
- **R4 [推测]**：现有仓库技能的 SKILL.md 是否已含 `triggers/output` 字段未知。AC-8 已要求优雅降级；若用户希望卡片立刻饱满，需手工补这些 frontmatter（不在本 spec 范围）。
- **R5 [推测]**：`gray_matter` 解析 `triggers` YAML list 的 schema 需统一。本 spec 约定 frontmatter 写法为 `triggers: ["/lint"]`（字符串数组，简单）或 `triggers:\n  - k: slash\n    t: "/lint"`（对象数组，富）。解析时两种都支持，优先对象数组。
- **R6 [耦合]**：本 spec 的令牌值依赖 `20260614-agentic-design-language` spec 的 globals.css 换血。实现顺序：先做设计语言 spec，再做 SkillsWorkbench；或同时做但确保 globals.css 先提交。

## 9. 待确认

| #   | 问题                   | 当前默认值                                                  | 状态                  |
| --- | ---------------------- | ----------------------------------------------------------- | --------------------- |
| Q1  | 富字段数据来源         | 用户已答：**真实数据**（frontmatter 扩展；无历史）          | ✅ 已确认             |
| Q2  | 单技能 Switch 开关     | 用户已答：**这次做**                                        | ✅ 已确认             |
| Q3  | 「新建/编辑技能」按钮  | 用户已答：**打开目录**                                      | ✅ 已确认             |
| Q4  | Settings→Plugins       | 用户已答：**删除整个区块**（不升级，直接删）                | ✅ 已确认（本轮）     |
| Q5  | 运行历史               | 用户已答：**不要**（本轮）                                  | ✅ 已确认（本轮移除） |
| Q6  | 分类                   | 用户已答：**不要**（本轮）                                  | ✅ 已确认（本轮移除） |
| Q7  | 视觉风格               | 用户已答：**Agentic 一并升级**（耦合 design-language spec） | ✅ 已确认（本轮）     |
| Q8  | 全局技能总开关迁移位置 | 默认：SkillsWorkbench 顶部（保留 IPC 不变）                 | 待确认（可用默认）    |

## 10. 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                                                                                                                                                                                                                              |
| ---- | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 2026-06-14 | 待澄清    | 初版：全量真实数据/做开关/打开目录。                                                                                                                                                                                                                                  |
| 2    | 2026-06-14 | 可开发    | 用户 4 项决策落地：移除运行历史（AC-6 废弃）、移除分类（AC-2 废弃）、删除 Settings→Plugins（AC-13 新增）、Agentic 风格耦合（令牌映射改 #FF5701）。新增 AC-14 全局开关迁移。仅余 Q8 有合理默认值。L3 强制项（兼容性·向后加字段、回滚·git revert、安全·只收紧）已覆盖。 |
