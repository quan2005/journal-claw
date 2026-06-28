---
name: 谨迹 (JournalClaw)
description: 一款面向知识工作者的 macOS 日志应用——现代、大胆、对话式 AI 优先，橙色为信号。
colors:
  primary: "#FF5701"
  primary-hover: "#E64A00"
  primary-dark: "#FF7A33"
  surface: "#FFFFFF"
  secondary: "#F6F6F1"
  tertiary: "#ECECE6"
  surface-dark: "#0F0F0F"
  text: "#111827"
  text-secondary: "#4B5563"
  text-tertiary: "#9CA3AF"
  divider: "#E5E7EB"
  success: "#16A34A"
  warning: "#D97706"
  danger: "#DC2626"
  info: "#2563EB"
typography:
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  detail:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  title:
    fontFamily: "'Playfair Display', 'Noto Serif SC', serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
  display:
    fontFamily: "'Playfair Display', 'Noto Serif SC', serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.2
  display-lg:
    fontFamily: "'Playfair Display', 'Noto Serif SC', serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.04
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "6px"
  lg: "8px"
  pill: "999px"
shadow:
  overlay: "0 4px 12px rgba(0,0,0,0.15)"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "8": "32px"
  "12": "48px"
---

# 设计系统：谨迹 (JournalClaw)

## 1. 概述

**设计意图：Modern · Bold · Agentic**

谨迹是一款对话式 AI 优先的日志应用。设计气质**现代、大胆**：清晰的行动号召、明确的产出、委托式的任务流。界面围绕「让 AI 帮你做事」组织，控件极简，结果清晰。

核心特征语言是**橙白对比体系**：纯白表面（`#FFFFFF`）承载内容，单一的**信号橙**（`#FF5701`）作为所有交互强调的唯一来源——按钮、选中态、活跃 UI、链接、聚焦环。橙色只出现在需要用户注意和行动的地方；其余一切皆为墨色文字与灰阶分层。文字主色是深墨 `#111827`，在白底上对比锐利、可读性优先。

字体选用**三栈各司其职**体系：**Playfair Display**（西文衬线，标题/Display 层级）承载「bold」气质的衬线个性，中文标题回退到 Noto Serif SC；**系统无衬线栈**（macOS 上即 SF Pro）负责所有 UI 正文——零加载成本、完美系统集成；**JetBrains Mono** 用于代码与等宽语义（技能 id、命令、技术标识）。Noto Serif SC 作为中文衬线保留，专属于编辑时刻与中文标题回退。字号标尺 `12/14/16/18/24/32/40` 覆盖从次元信息到大标题展示，节奏落在 8pt 网格上。

布局节奏遵循 **8pt 基础网格**：组内 8–16px，章节间 32–48px。4px 作为最小细粒度例外保留（图标内边距、密集列表行距）。深度通过**表面分层**（白 → `#F6F6F1` → `#ECECE6` 暖白三层）传达，而非投影；投影仅在浮层（菜单、对话框）出现，且功能导向。

本系统明确拒绝：紫蓝渐变、霓虹色、玻璃态、bounce 缓动、装饰性模糊、渐变文字、卡片套卡片、以及任何一眼就能认出「AI 做的 SaaS 模板」的套路。

**核心特征：**
- 单一信号橙 `#FF5701`（浅色）/ `#FF7A33`（暗色提亮）覆盖所有交互 accent
- 纯白表面 `#FFFFFF` + 暖白分层 `#F6F6F1`/`#ECECE6` + 墨色文字 `#111827`，对比锐利
- 字体三栈各司其职：Playfair Display（标题衬线）+ 系统无衬线（UI 正文）+ JetBrains Mono（代码）
- 8pt 间距网格（4px 细粒度例外）
- 表面分层传达深度，默认扁平，投影仅用于浮层
- 动效纪律：仅 `transform` + `opacity`，≤300ms，ease-out-quart（循环动画豁免 ease-in-out），尊重 `prefers-reduced-motion`

## 2. 配色

基于单一信号橙和随明暗主题切换的中性墨阶构成的配色体系。

### 主色
- **信号橙**（浅色 `#FF5701` / 暗色 `#FF7A33`）：唯一的交互 accent。用于录音按钮、选中的列表项、活跃的分段控件、AI 状态标记、链接、复选框、聚焦环。覆盖所有需要用户注意和行动的场景。
- **按钮文字**：橙填充上的文字用纯白 `#FFFFFF`（浅色模式 `#FF5701` 底）或暖白 `#FFF8F0`（暗色模式 `#FF7A33` 底），保证对比度。橙色本身（`#FF5701` on `#FFFFFF` ≈ 2.7:1）**不**直接用作小号正文文字色。

### 语义色（状态指示）
- **成功** `#16A34A`（浅色）/ `#4ADE80`（暗色）
- **警告** `#D97706`（浅色）/ `#FBBF24`（暗色）
- **危险** `#DC2626`（浅色）/ `#F87171`（暗色）——也用于删除/破坏性操作的 accent
- **信息** `#2563EB`（浅色）/ `#60A5FA`（暗色）

语义色仅在状态徽章、callout、文件类型图标等**语义场景**使用，不与信号橙争夺交互 accent 的位置。

### 中性色
- **表面**（浅色 `#FFFFFF` / 暗色 `#0F0F0F`）：主应用背景。
- **次表面**（浅色 `#F6F6F1` / 暗色 `#1C1C1E`）：浮起表面——处理队列、代码块背景、卡片底色。暖白基调，比纯白温润。
- **三表面**（浅色 `#ECECE6` / 暗色 `#2C2C2E`）：更深一层分隔。与次表面保持 ΔE≥3 的可感知分层。
- **墨文字** `#111827`（浅色）/ `#E8E8E8`（暗色）：主文字。
- **次文字** `#4B5563`（浅色）/ `#A2A6AE`（暗色）：次要文字——日期、标签、元信息。
- **三文字** `#9CA3AF`（浅色）/ `#6B7280`（暗色）：三级文字——时长、弱化标签。
- **分割线** `#E5E7EB`（浅色）/ `#1F2937`（暗色）：区块分割线和面板边框。

### 命名规则

**单橙规则。** 信号橙是有且仅有的唯一交互 accent。绝不在 accent 词汇中引入第二种彩色争夺注意力。橙覆盖一切交互强调场景，无一例外。语义色（成功/警告/危险/信息）仅在状态场景出现，不作交互 accent。

**墨阶分层规则。** 深度通过背景色阶差（`--bg` → `--bg-secondary` → `--bg-tertiary`，即 `#FFFFFF` → `#F6F6F1` → `#ECECE6` 暖白三层）传达，而非阴影。每种表面比其父级微妙地深一点。

## 3. 排版

**三栈各司其职：**
- **标题字体**：`'Playfair Display', 'Noto Serif SC', serif`——Playfair Display 是西文衬线，承载「bold」气质的衬线个性；中文标题自动回退到 Noto Serif SC（专为中文设计的衬线）。
- **正文字体**：`system-ui, -apple-system, BlinkMacSystemFont, sans-serif`（macOS 上为 SF Pro）——系统字体是「无形字体」，融入平台、不被察觉，零加载成本。
- **等宽字体**：`'JetBrains Mono', ui-monospace, monospace`——代码/技术语义专用。
- **中文衬线**：`'Noto Serif SC', serif`——专属于编辑时刻与中文标题回退。

**气质：** Playfair Display 为标题带来对话式 AI 产品的现代衬线个性，与系统无衬线正文形成层次对比。系统字体保证 UI 正文零加载、完美系统集成。JetBrains Mono 为代码块带来清晰的等宽可读性。三栈不混用——标题用 Playfair，正文用系统，代码用 JetBrains，中文衬线编辑时刻用 Noto Serif SC。

### 层级（Agentic scale：12/14/16/18/24/32/40）
- **Display-LG**（800, 2.5rem / 40px, 1.04）：页面级大标题（如「技能」「自动化」）。字体 Playfair Display。
- **Display**（800, 2rem / 32px, 1.2）：主展示标题。字体 Playfair Display。
- **Heading**（700, 1.5rem / 24px, 1.3）：区块标题，详情面板 H2/H3。字体 Playfair Display。
- **Body-LG**（400, 1.125rem / 18px, 1.6）：舒朗正文、描述。字体系统无衬线。
- **Detail**（400, 1rem / 16px, 1.75）：详情面板 Markdown 正文。65–75ch 最大行宽。字体系统无衬线。
- **Body**（400, 0.875rem / 14px, 1.5）：列表项、侧栏文字、UI 标签。主力字号。字体系统无衬线。
- **Label**（500, 0.75rem / 12px, 1.4）：时间戳、辅助信息、徽章文字。字体系统无衬线。
- **Mono**（400, 0.875rem / 14px, 1.5）：代码块、技能 id、命令、技术标识。字体 JetBrains Mono。

### 命名规则

**字重阶梯规则。** 层级通过字号差异和 400→500→600→700→800→900 阶梯建立。Playfair 标题用 700/800/900（bold 衬线气质），UI 正文用 400/500/600。允许 900 用于展示型大标题。

**三栈各司其职规则。** 所有 UI 文字按语义分配字体：标题/Display 层级用 Playfair Display（中文回退 Noto Serif SC）；UI 正文/标签用系统无衬线栈；代码/技术语义用 JetBrains Mono；中文衬线编辑时刻用 Noto Serif SC。**三栈不混用**——绝不把 Playfair 用在正文，绝不把 JetBrains Mono 用在导航标签，绝不把系统字体用在代码块。不引入三栈之外的字体家族。

## 4. 层级与深度

本系统默认扁平。深度通过**表面分层**传达——每个表面比其父级微妙地深一点（`#FFFFFF` → `#F6F6F1` → `#ECECE6` 暖白三层）——而非通过投影。

当阴影确实出现时（处理队列、上下文菜单、对话框），它们最小化且功能导向——绝不为装饰。

### 阴影词汇
- **环境微升**（`box-shadow: 0 1px 3px rgba(0,0,0,0.06)`）：处理队列。几乎不可察觉的抬起。
- **浮层**（浅色 `0 4px 12px rgba(0,0,0,0.15)` / 暗色 `rgba(0,0,0,0.5)`）：上下文菜单、表单、对话框。与下方表面清晰分离。

### 命名规则

**默认扁平规则。** 表面在静止状态下是扁平的。绝不将 box-shadow 作为装饰添加到卡片、列表项、面板或容器上。深度来自背景色阶差。

**橙色信号规则。** 选中或高亮列表项的主要深度信号是橙色背景着色（`--item-selected-bg` 橙色软底）+ 橙色文字。这是「此项活跃/需注意」的标志性交互模式。

## 5. 组件

### 结构化 token（强制消费）

为消除组件层「token 正确、实例各自硬编码」的离散偏离，以下结构化 token 必须在所有组件中消费，**禁止各自硬编码数值**：

- **圆角**：`--radius-sm`（6px，徽章/小控件）、`--radius-md`（6px，输入框）、`--radius-lg`（8px，菜单/对话框/卡片）、`--radius-pill`（999px，胶囊）。
- **浮层阴影**：`--shadow-overlay`（浅色 `0 4px 12px rgba(0,0,0,0.15)` / 暗色 `0 4px 12px rgba(0,0,0,0.5)`）——浮层（菜单、对话框、Toast）的唯一阴影值，禁止 `0 24px 80px` 等装饰性深阴影。
- **菜单边框**：`--border-menu`（`1px solid var(--divider)`）——上下文菜单、对话框的统一边框，禁止 0.5px 等不一致粗细。
- **聚焦环**：`--focus-ring`（`2px solid color-mix(in srgb, var(--record-btn) 55%, var(--bg))`）——所有 `:focus-visible` 必须用此 token，禁止 `outline: none` 或各自硬编码浓度（22%/60% 等）。
- **主操作按钮**：`--workbench-btn-primary-bg`（= `--record-btn`）/ `--workbench-btn-primary-bg-hover`（= `--record-btn-hover`）/ `--workbench-btn-primary-color`（`#fff`）——所有 Hub 页主操作（新建技能/想法/自动化等）的实心橙按钮统一消费此组 token，禁止各页硬编码填充色（曾出现技能页浅珊瑚、想法/自动化深 ghost 的不一致）。交互橙永远走 `--record-btn`，**不要**用 `--accent`（已重定义为危险红 `#DC2626`，非交互色）。

> **暗色二级文字对比下限。** 暗色主题正文副文本（`--text-secondary`）≥ 4.5:1，元信息/提示文本（`--text-tertiary`/`--muted-text`/`--muted-icon`，当前 `#747b86`）≥ 3:1（相对其所在表面背景）。低于此阈值的灰度需上调，不得让「上次成功/失败」等关键状态文本沉到不可读。

### 列表项（日志条目）
扁平行，无卡片装饰。通过间距、字重和橙色着色建立层级。

- **默认：** 透明背景。主文字 14px 字重 400。元信息（日期、标签）次要色。
- **悬停：** 背景切换为 `#FFF7F1`（浅色）/ `rgba(255,255,255,0.04)`（暗色）。
- **选中：** 背景 `#FFEDD9`（浅色，橙软底）/ `rgba(255,122,51,0.14)`（暗色）。文字切换为橙色系。

### AI 状态标记
紧凑的内联指示器，显示 AI 处理状态。橙色调，绝不分散注意力。

- **默认：** 背景 `#FFF4ED`（浅色）/ `rgba(255,122,51,0.12)`（暗色）。边框 `#FB923C` / `rgba(255,122,51,0.4)`。文字为橙色。
- **活跃（处理中）：** 背景加深至 `#FFEDD9` / `rgba(255,122,51,0.2)`。

### 分段控件 / 筛选 tabs
视图模式切换器。基于透明度——无边框、无阴影。

- **默认：** 近乎透明的背景。文字为次要色。
- **活跃：** 橙色背景 10% 透明度（浅色）/ 16%（暗色）。文字为橙色。无边框，无阴影。

### 来源徽章
紧凑的内联徽章，指示内容来源。每种类型有专属语义色。

- **语音：** 橙色调（`#FFF4ED` / `rgba(255,122,51,0.12)`）。
- **文档：** 蓝色调（`#EFF6FF` / `rgba(96,165,250,0.12)`）。
- **AI：** 紫色调（`#F5F3FF` / `rgba(167,139,250,0.12)`）。
- **形状：** `--radius-sm`（6px）圆角，`--text-xs`（12px label）字号，1px 实线边框。

### 上下文菜单 / 对话框
- **形状：** `--radius-lg`（8px）圆角，`--border-menu`（1px 实线 `--divider`）边框。
- **背景：** `#FFFFFF`（浅色）/ `#1C1C1E`（暗色）。
- **阴影：** `--shadow-overlay`（浮层唯一值）。

### 滚动条
- **宽度：** 4px。轨道：始终透明。
- **滑块：** 浅色 `#D1D5DB` / 暗色 `rgba(255,255,255,0.12)`。悬停：浅色 `#9CA3AF` / 暗色 `rgba(255,255,255,0.2)`。
- **圆角：** 2px。

### Browse 页眉（专题 / 画像 / Timeline）
浏览类页面（以扫读为主）用**紧凑单行页眉**，区别于 Hub 页（技能/想法/自动化）的 Playfair 巨标题——为列表让出垂直空间。

- **结构：** 单行 = 橙色小图标（`--record-btn`，唯一身份点）+ 页名标签（`--font-body`、`--text-xs`、`--font-semibold`、字距 0.05em）。`min-height` 30px，底部 `--border-menu` 细分隔线。无 Playfair 标题、无副标题段落。
- **组件：** 三页共用 `BrowsePaneHeader`（`icon` + `label` 两个 prop），仅图标/文案不同（专题=archive、画像=users、Timeline=scroll）。

## 6. 该做与不该做

### 该做：
- **该** 在所有交互 accent 场景使用信号橙（`--record-btn` = `#FF5701`）——按钮、选中态、活跃态、链接、复选框、聚焦环。
- **该** 保持表面分层（`--bg` → `--bg-secondary` → `--bg-tertiary`，即 `#FFFFFF` → `#F6F6F1` → `#ECECE6`）传达深度，而非阴影。
- **该** 用纯白 `#FFFFFF` 作主背景、墨色 `#111827` 作主文字，保证锐利对比。
- **该** 在橙填充按钮上用纯白（浅色 `#FFFFFF`）/ 暖白（暗色 `#FFF8F0`）文字。橙色不作小号正文文字色。
- **该** 按语义分配字体三栈：标题用 Playfair Display，正文用系统无衬线，代码用 JetBrains Mono，中文衬线编辑时刻用 Noto Serif SC。
- **该** 保持密度对比：紧凑列表（14px）与舒朗详情（16px，1.75 行高）。
- **该** 仅动画 `transform` 和 `opacity`——绝不动画 `width`、`height`、`padding` 或 `margin`。
- **该** 对所有非循环过渡使用 `cubic-bezier(0.16, 1, 0.3, 1)`（ease-out-quart），150–250ms。循环动画（呼吸/脉冲/shimmer/省略号等无限循环对称动画）豁免，可用 `ease-in-out`。
- **该** 实现 `prefers-reduced-motion` 回退——降级为即时透明度渐变。
- **该** 将语义色（成功绿/警告黄/危险红/信息蓝）仅用于状态徽章、callout、文件类型图标。
- **该** 消费结构化 token（`--radius-*`/`--shadow-overlay`/`--border-menu`/`--focus-ring`），禁止组件硬编码圆角/阴影/边框/聚焦环数值。
- **该** 所有 `:focus-visible` 使用 `--focus-ring` token，保证聚焦环粗细与浓度统一。

### 不该做：
- **不该** 引入第二种彩色交互 accent——信号橙是唯一的 accent 色。语义色不作交互 accent。
- **不该** 用 `#FF5701` 直接作小号正文文字色（对比度 2.7:1 不达标）——仅作填充背景；需强调提示时用 callout（橙软底 + 橙边框 + 墨色文字）。
- **不该** 混用字体三栈——绝不把 Playfair 用在正文，绝不把 JetBrains Mono 用在导航标签，绝不把系统字体用在代码块。不引入三栈之外的字体家族。
- **不该** 添加卡片阴影或卡片套卡片嵌套——深度来自表面分层。
- **不该** 使用 bounce 或 elastic 缓动——非循环过渡仅 ease-out-quart。
- **不该** 动画布局属性（`width`、`height`、`margin`、`padding`）——仅 `transform` + `opacity`。
- **不该** 使用装饰性模糊、渐变或发光效果。不要玻璃态（`backdrop-filter`）。
- **不该** 使用渐变文字（`background-clip: text` 配渐变）。仅纯色。
- **不该** 在代码/技术语义之外使用 JetBrains Mono。
- **不该** 把所有东西都包进卡片里。大多数东西不需要容器。
- **不该** 把模态框当作首选方案——先穷尽内联和渐进式替代方案。
- **不该** 各自硬编码聚焦环——`outline: none` 或浓度各异的 `color-mix` 都是违规，必须用 `--focus-ring`。
