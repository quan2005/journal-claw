---
name: 谨迹 (JournalClaw)
description: 一款面向知识工作者的 macOS 日志应用——克制的精准，金橙色的暖意。
colors:
  amber-gold: "#C8933B"
  amber-gold-hover: "#d9a44b"
  amber-gold-light: "#B8782A"
  ink-charcoal: "#0f0f0f"
  ink-sidebar: "#141414"
  ink-titlebar: "#161616"
  ink-raised: "#1c1c1e"
  warm-parchment: "#e8e8e8"
  warm-parchment-light: "#1c1c1e"
  cool-slate: "#a2a6ae"
  cool-slate-light: "#6a7278"
  muted-steel: "#48484a"
  muted-steel-light: "#a0a8ad"
  ink-divider: "#1e2228"
  ink-divider-light: "#d8dce0"
  amber-selected-bg: "#1a1c20"
  amber-selected-bg-light: "#F0E4CC"
  amber-hover-bg-light: "#F7F0E4"
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
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.amber-gold}"
    textColor: "{colors.ink-charcoal}"
    rounded: "50%"
    size: "32px"
  button-primary-hover:
    backgroundColor: "{colors.amber-gold-hover}"
  list-item-selected:
    backgroundColor: "{colors.amber-selected-bg}"
    textColor: "{colors.amber-gold}"
  pill-ai:
    backgroundColor: "#1a1708"
    textColor: "{colors.amber-gold}"
    rounded: "{rounded.sm}"
  badge-voice:
    backgroundColor: "#2a1f0f"
    textColor: "#c8933a"
    rounded: "{rounded.sm}"
---

# 设计系统：谨迹 (JournalClaw)

## 1. 概述

**创意隐喻：「档案册」**

谨迹的设计隐喻是一本档案册——那种黄铜扣装订、适合墨水的纸张上书写，每一条记录都经过深思熟虑，没有任何东西喧宾夺主。界面退居幕后，让内容自由呼吸。

其核心特征语言是**墨水青中性色体系**：所有灰色都带有微妙的冷青色调，坐落于精确的中性区间，触感如冷调工作室灯光下的高级纸张。浅色主题（`#f5f6f7`）几乎是难以察觉的米白；深色主题（`#0f0f0f`）是带有同样墨色底蕴的近黑——比纯黑温润，比炭灰清冷。

唯一的色彩 accent 是**金橙色**（浅色 `#B8782A` / 深色 `#C8933B`）——岁月洗练的黄铜、档案墨水和上好皮革的颜色。它只出现在需要的地方：录音按钮、选中状态、活跃 UI 元素。其余一切皆为中性。

字体选用 SF Pro（通过 `system-ui`）——系统字体，融入系统本身。不加载自定义字体，不引入 web font，零加载成本。IBM Plex Mono 用于代码块，承载语义精度而非风格表达。字号标尺紧凑且信息密度高，为三栏布局中每一像素的纵向空间精心校准。

布局在密集与舒朗之间交替：左侧日志列表使用 14px 正文搭配紧凑行间距，用于快速浏览；中间详情面板展开为 16px 正文、1.75 行高，用于舒适阅读。右侧面板承载 AI 会话和待办事项的紧凑工作区。这种对比是有意为之——浏览要快，阅读要舒适。

本系统明确拒绝：紫蓝渐变、霓虹 accent、玻璃态、bounce 缓动、装饰性模糊、渐变文字、卡片套卡片、hero 指标模板，以及任何一眼就能认出「AI 做的 SaaS 界面」。

**核心特征：**
- 墨水青中性色表面——所有灰色都带有微妙的冷青色调，杜绝死灰
- 唯一金橙色 accent（`#B8782A` / `#C8933B`）覆盖所有交互状态
- 系统字体栈——macOS 上自动使用 SF Pro，零加载成本，完美系统集成
- 深色模式为主要质量基准；浅色模式同等打磨
- 4px 基础间距单位，紧-松节奏（组内 8–12px，章节间 32–48px）
- 动效纪律：仅 transform + opacity，≤300ms，ease-out-quart，尊重 `prefers-reduced-motion`
- 三栏布局：可调宽的左侧列表 + 中间详情 + 可切换的右侧面板

## 2. 配色

基于单一金橙色 accent 和随明暗主题切换的墨水青中性色阶构成的配色体系。每一种中性色都承载微妙的冷青色调——这是本系统的标志性气质。

### 主色
- **金橙色**（深色 `#C8933B` / 浅色 `#B8782A`）：唯一的色彩 accent。用于录音按钮、选中的列表项、活跃的分段控件、AI 状态标记、停靠栏粘贴状态、键盘快捷键徽章、Markdown 标题（仅深色模式）、复选框和链接。覆盖所有交互 accent 场景。

### 中性色
- **墨炭**（深色 `#0f0f0f` / 浅色 `#f5f6f7`）：主应用背景。基底表面。
- **墨侧栏**（深色 `#141414` / 浅色 `#f0f2f3`）：左侧边栏和底部操作栏背景。比主背景浅/深一个台阶。
- **墨标题栏**（深色 `#161616` / 浅色 `#edf0f1`）：标题栏拖拽区域。与侧栏略有区分。
- **墨浮层**（深色 `#1c1c1e` / 浅色 `#f7f8f9`）：浮起表面——处理队列、代码块背景。
- **暖羊皮纸**（深色 `#e8e8e8` / 浅色 `#1c1c1e`）：主文字色。深色模式近白，浅色模式近黑。始终带色调，绝不用纯色。
- **冷板岩**（深色 `#a2a6ae` / 浅色 `#6a7278`）：次要文字——日期、标签、元信息。
- **哑钢**（深色 `#48484a` / 浅色 `#a0a8ad`）：三级文字——时长、弱化标签。
- **墨分割线**（深色 `#1e2228` / 浅色 `#d8dce0`）：区块分割线和面板边框。存在但几乎不被察觉。

### 命名规则

**金橙唯一规则。** 金橙色是有且仅有的唯一 accent。绝不在 accent 词汇中引入第二种彩色。金橙覆盖一切交互强调场景，无一例外。

**禁用纯黑规则。** `#000000` 和 `#ffffff` 禁止使用。每种中性色表面和文字都承载墨水青色调。深色模式下最深的表面是 `#0f0f0f`；浅色模式下最浅的表面是 `#f5f6f7`。纯黑或纯白看起来像是主题破损。

**墨水青中性色规则。** 所有灰色都带有微妙的冷青色调（OKLCH hue 195–250）。暖灰色调和死灰（OKLCH 中 a=b，色度为零）禁止使用。墨水青色调是本系统的气质——去掉它，应用便失去了标志性性格。

## 3. 排版

**正文字体：** system-ui, -apple-system, BlinkMacSystemFont, sans-serif（macOS 上为 SF Pro）
**等宽字体：** 'IBM Plex Mono', ui-monospace, monospace

**气质：** SF Pro 是无形字体——它是操作系统本身使用的字体，因此融入平台，不被察觉。无 web font 加载，无 FOUT，无自定义字体性格与内容竞争。IBM Plex Mono 为代码提供语义对比，而非风格装饰。搭配是功能性的、有意图的。

### 层级
- **Display**（600, 1.5rem / 24px, 1.2）：页面级大标题。极少使用。
- **Title**（600, 1.25rem / 20px, 1.3）：区块标题，详情面板 H2/H3。
- **Body**（400, 0.875rem / 14px, 1.5）：列表项、侧栏文字、UI 标签。主力字号。
- **Detail**（400, 1rem / 16px, 1.75）：详情面板 Markdown 正文。65–75ch 最大行宽，舒适阅读。
- **Label**（500, 0.75rem / 12px, 1.4）：时间戳、辅助信息、徽章文字。
- **Mono**（400, 0.8125rem / 13px, 1.5）：仅用于代码块和内联代码。绝不用于 UI 标签。

补充字号：13px（次要元信息）、30px（大标题，极少使用）。

### 命名规则

**无极端字重规则。** 字重 300 和 700+ 被有意识地排除。层级通过字号差异和 400→500→600 阶梯建立，而非通过粗体极端值。如果标题看起来不够标题，加大字号，而非加粗。

**一字体系规则。** 所有 UI 文字使用系统字体栈。IBM Plex Mono 专属于代码语义——绝不出现在导航、标签、按钮或正文中。衬线字体栈（Noto Serif SC）可用但默认不使用。不要引入额外的字体家族。

## 4. 层级与深度

本系统默认扁平。深度通过**色调分层**传达——每个表面比其父级微妙地深一点或浅一点——而非通过投影。眼睛将 `--bg` → `--sidebar-bg` → `--titlebar-bg` 读作层级，无需任何阴影渲染。

当阴影确实出现时（处理队列、上下文菜单），它们最小化且功能导向——绝不为装饰。

### 阴影词汇
- **环境微升**（`box-shadow: 0 1px 3px rgba(0,0,0,0.06)`）：处理队列。几乎不可察觉的抬起。
- **浮层**（浅色 `0 4px 12px rgba(0,0,0,0.15)` / 深色 `rgba(0,0,0,0.5)`）：上下文菜单、表单。与下方表面清晰分离。

### 命名规则

**默认扁平规则。** 表面在静止状态下是扁平的。绝不将 box-shadow 作为装饰添加到卡片、列表项、面板或容器上。深度来自背景色阶差和左侧竖条 accent 模式。

**左侧竖条规则。** 选中或高亮列表项的主要深度信号是一条 2px 金橙色左侧边框（`--card-selected-bar` / `--record-highlight-bar`）。这道垂直笔触无声地表达"此项活跃"，无需背景夸张处理。这是应用标志性的交互模式。

## 5. 组件

### 录音按钮（首要行动号召）
最重要的交互元素。实心金橙色圆形，位于输入栏中央。

- **形状：** 正圆（50% 圆角），32px × 32px。
- **默认：** `background: #C8933B`（深色）/ `#B8782A`（浅色）。图标颜色为近黑（`#0f0f0f`）或近白（`#f5f6f7`）——与金橙填充色反转。
- **悬停：** 背景切换为 `#d9a44b`（深色）/ `#A06820`（浅色）。`transform: scale(1.04)`。过渡：180ms ease。
- **录音中：** 背景切换为更深沉的金橙色调。微妙的脉冲动画（`kbd-glow-pulse`，2.4s ease-in-out，透明度 0.4→1）引起注意但无攻击性。
- **聚焦：** `outline: 2px solid color-mix(in srgb, var(--record-btn) 68%, white)`。

### 列表项（日志条目）
扁平行，无卡片装饰。通过间距、字重和左侧竖条模式建立层级。

- **形状：** 全宽行，无圆角、无阴影、无卡片背景。
- **默认：** 透明背景。主文字 14px 字重 400。元信息（日期、标签）13px 字重 400，次要色。图标容器：`#2c2c2e`（深色）/ `#F5EDD8`（浅色），6px 圆角。
- **悬停：** 背景切换为 `rgba(255,255,255,0.03)`（深色）/ `#F7F0E4`（浅色）。
- **选中：** 背景 `#1a1c20`（深色）/ `#F0E4CC`（浅色）。文字变为金橙色。一条 2px 金橙色左侧边框标记活动行。
- **录音来源：** 背景带有 `rgba(200,147,59,0.06)`（深色）/ `#FBF3E5`（浅色）色调。左侧竖条为金橙色。

### AI 状态标记
紧凑的内联指示器，显示 AI 处理状态。金橙色调，绝不分散注意力。

- **形状：** 4px 圆角，内边距 2px 8px，12px label 字重 500。
- **默认：** 背景 `#1a1708`（深色）/ `#FBF3E5`（浅色）。边框 `1px solid #3a3018`（深色）/ `#D4A855`（浅色）。文字为金橙色。
- **活跃（处理中）：** 背景加深至 `#1a1408`（深色）/ `#F0E4CC`（浅色）。边框增强至 `#6a4f20`（深色）/ `#B8782A`（浅色）。

### 分段控件
视图模式切换器。纯粹基于透明度——无边框、无阴影。

- **默认：** 近乎透明的背景（深色 `rgba(128,128,128,0.08)` / 浅色 `0.06`）。文字为次要色。
- **活跃：** 金橙色背景 10–12% 透明度。文字为金橙色。无边框，无阴影。

### 来源徽章
紧凑的内联徽章，指示内容来源。每种类型有其专属语义色系。

- **语音：** 背景 `#2a1f0f`（深色）/ `#FBF3E5`（浅色）。文字 `#c8933a`（深色）/ `#8A6500`（浅色）。边框 `#4a3010`（深色）/ `#D4B878`（浅色）。
- **文档：** 背景 `#0f1a2a`（深色）/ `#e8f0fa`（浅色）。文字 `#4a8ac8`（深色）/ `#3a6a9a`（浅色）。
- **AI：** 背景 `#1a1a2a`（深色）/ `#ededfa`（浅色）。文字 `#7a7ac8`（深色）/ `#5a5a9a`（浅色）。
- **形状：** 4px 圆角，12px label 字号，1px 实线边框。

### 输入栏（会话面板）
右侧面板底部的消息输入区域。极简单行，支持扩展。

- **形状：** 全宽，8px 圆角容器，内边距。背景匹配面板表面。
- **文本输入：** 14px 正文字号，占位符使用次要文字色，已输入文字使用主文字色。背景透明，无边框。
- **发送按钮：** 纯图标，28px，可用时为金橙色，禁用时为哑钢色。过渡：180ms ease。
- **麦克风按钮：** 纯图标，28px，默认哑钢色。录音时切换为更深沉的金橙色调。

### 上下文菜单
- **形状：** 8px 圆角，1px 实线边框。
- **背景：** `#1e1e1e`（深色）/ `#f5f6f7`（浅色）。
- **阴影：** 浮层级——深色 `rgba(0,0,0,0.5)` / 浅色 `rgba(0,0,0,0.15)`。

### 滚动条
- **宽度：** 4px。轨道：始终透明。
- **滑块：** 深色 `rgba(255,255,255,0.10)` / 浅色 `#d2d5d8`。悬停：深色 `rgba(255,255,255,0.18)` / 浅色 `#bec2c5`。
- **圆角：** 2px。最小化存在感——仅在滚动时可见。

## 6. 该做与不该做

### 该做：
- **该** 在所有交互 accent 场景使用金橙色（`--record-btn`）——按钮、选中态、活跃态、链接、复选框。
- **该** 保持所有中性色带墨水青色调——每种灰色在 OKLCH hue 195–250 范围内应有微妙的冷青底色。
- **该** 使用左侧竖条模式（2px 金橙色 `border-left`）标记选中和高亮的列表项。
- **该** 保持密度对比：紧凑列表（14px，紧凑内边距）与舒朗详情（16px，1.75 行高）。
- **该** 仅动画 `transform` 和 `opacity`——绝不动画 `width`、`height`、`padding` 或 `margin`。
- **该** 对所有过渡使用 `cubic-bezier(0.16, 1, 0.3, 1)`（ease-out-quart）。
- **该** 实现 `prefers-reduced-motion` 回退——降级为即时透明度渐变。
- **该** 将语义文件类型颜色（PDF 红、DOCX 蓝、音频紫）仅用于文件徽章。
- **该** 通过背景色阶差（`--bg` → `--sidebar-bg` → `--titlebar-bg`）传达深度，而非阴影。

### 不该做：
- **不该** 引入第二种彩色 accent——金橙色是唯一的 accent 色。不要有蓝色、绿色、紫色、红色 accent。
- **不该** 使用纯 `#000000` 或 `#ffffff`——使用墨水青调近黑（`#0f0f0f`）和近白（`#e8e8e8`）。
- **不该** 使用暖灰色调——中性色体系是墨水青，不是暖米色。
- **不该** 添加卡片阴影或卡片套卡片嵌套——深度来自色调分层和左侧竖条。
- **不该** 使用 bounce 或 elastic 缓动——仅 ease-out-quart。不要弹簧物理，不要过度弹跳。
- **不该** 动画布局属性（`width`、`height`、`margin`、`padding`）——仅 `transform` + `opacity`。
- **不该** 使用装饰性模糊、渐变或发光效果。不要玻璃态。
- **不该** 使用渐变文字（`background-clip: text` 配渐变）。仅纯色。
- **不该** 使用低于 400 或高于 600 的字重。
- **不该** 使用大于 1px 的 `border-left` 或 `border-right` 作为彩色侧边装饰条——左侧竖条模式是唯一例外，恰好 2px。
- **不该** 在代码块之外使用 IBM Plex Mono——它是语义性的，不是风格性的。
- **不该** 把所有东西都包进卡片里。大多数东西不需要容器。
- **不该** 使用重复的卡片网格（图标 + 标题 + 文字，无限重复）。
- **不该** 把模态框当作首选方案——先穷尽内联和渐进式替代方案。
- **不该** 在浅色模式下给 Markdown 标题加颜色——金橙色标题仅限深色模式。
