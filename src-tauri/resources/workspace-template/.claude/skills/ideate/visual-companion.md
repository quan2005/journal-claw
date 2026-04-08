# Visual Companion Guide (Ideate Canvas)

通过浏览器展示具有设计感的 mockup、架构图和对比选项，让灵感碰撞过程更加愉悦。

## Design Philosophy

**Design Canvas**: 把浏览器视口想象成 Figma 或 Linear 等高端设计工具的「演示画布」。它不仅要清晰传达逻辑，更要在交互与视觉上带给用户专业级产品的愉悦体验。

**核心美学：Pro Max Elegance**
- **Dot-Matrix Background**: 细腻的点阵背景，带来专业的「设计画板」隐喻。
- **Typography-First**: 极其严谨的字阶与行高（基于 SF Pro / Inter），靠排版建立层级，而不是靠花哨的颜色。
- **Subtle Interactions**: 用弹簧缓动（Spring Physics）代替生硬的过渡，Hover 上浮伴随平滑阴影，Active 点击微微缩小（Scale-down 0.98）。
- **Monochrome with One Accent**: 单色调极简界面，仅用一个干净的强调色（Accent）作为核心视觉焦点。

### 必须做到 (Do)

- **8pt/4pt 呼吸间距体系**：组内紧凑（gap: 8-16px），组间松弛（24-40px）。
- **可点击元素必须有视觉反馈**：通过 `transition` 控制 `transform`、`box-shadow`。
- **清晰的对比与无障碍设计**：保证文本（包括辅助文本）的对比度达到 4.5:1 (WCAG AA)。
- **降级处理**：加入 `@media (prefers-reduced-motion: reduce)`。

### 禁止出现 (Don't)

- 生硬的线框与原生的未经美化的表单控件。
- `transition: all` — 应当只针对 `transform`、`box-shadow` 和 `border-color` 施加变化。
- 纯黑（#000）或纯白（#FFF）作为大面积背景（应当使用细腻的浅灰或深灰）。
- 花哨的渐变、霓虹色或过度的背景模糊（除非讨论的需求明确需要）。

## When to Use

不要仅仅因为能用浏览器就使用它。只有当**视觉呈现比纯文本更能降低认知负荷**时，才切换到浏览器模式。

**用浏览器 (Visual Canvas)**：
- **布局选型 (Layouts)** — A/B 方案并排对比，带高保真卡片或线框容器。
- **视觉风格 (Styling)** — 颜色板展示、排版层级、组件形态探讨。
- **组件微动效 (Micro-interactions)** — 需要展示 hover/active/focus 状态的具体表现。
- **流程图与信息架构** — 如果文字过长，考虑用 Bento Grid 形式排布的卡片流程图呈现。

**用终端 (Terminal)**：
- 需求梳理、概念探讨、纯技术栈决策、优劣势逻辑罗列。

## How It Works

写自包含的 HTML 文件到 `yyMM/raw/DD-ideate-*.html`，然后用 `open` 命令在浏览器中打开。

- **不要复用文件名** — 每次迭代写新文件，如 `07-ideate-nav-v2.html`，以便于回溯。
- **自包含** — 必须将所有的 CSS/JS 写在同一个 HTML 中，方便用户离线预览或分享。

## The Loop

1. **选择适合的模板**：从 `skills/ideate/scripts/` 中选择最匹配当前讨论场景的模板文件。
2. **构思与编写 HTML**：根据对话上下文，创建新文件 `DD-ideate-{topic}-v{n}.html`。**必须用 Write 工具**，绝不能用 cat/heredoc。
3. **复制并修改**：将模板的完整内容（包括精美的 CSS）复制到新文件中，并替换 `<!-- CONTENT -->` 为你的设计内容。
4. **自动打开**：执行 `open yyMM/raw/DD-ideate-xxx.html`。
5. **终端对话反馈**：简要说明你在浏览器中展示了什么，例如："我刚为您展示了两种信息架构方案（单列流式 vs 侧边栏分屏），您更倾向于哪种感觉？"
6. **迭代打磨**：接收反馈并进入下一个讨论循环。

## Available Templates (场景模板)

我们提供了 4 种预置的高级模板，涵盖了从架构流转到高保真原型的各个阶段：

### 1. A/B Test Canvas (`ab-test.html`)
- **使用场景**：方案对决、概念选择、优劣势对比。
- **包含组件**：极简选项卡片（带有 Badge 徽标和点击选中状态）、Bento Grid 格式的 Pros/Cons（便当盒优劣势对比）。
- **适用讨论**："选择哪种侧边栏结构？"、"选用哪种数据存储策略？"

### 2. Wireframe Canvas (`wireframe.html`)
- **使用场景**：UI 布局推演、信息架构展示、组件结构探索。
- **包含组件**：精致的 macOS 风格画板容器（带有红黄绿控制点）、移动端骨架框（带刘海）、各种 Skeleton 线框积木（导航、按钮、卡片、输入框）。
- **适用讨论**："首页应该怎样排布？"、"这个表单的层级感觉对吗？"

### 3. Styleguide Canvas (`styleguide.html`)
- **使用场景**：视觉风格定调、设计令牌（Design Tokens）展示、配色与排版探索。
- **包含组件**：高保真色板（Color Swatches）、排版阶层样本（Typography Specimen）。
- **适用讨论**："品牌主色调选哪个？"、"使用哪种字体组合能传达更专业的感受？"

### 4. Flow Canvas (`flow.html`)
- **使用场景**：用户旅程（User Journey）、状态机转移、系统架构与数据流。
- **包含组件**：带有选中状态的卡片节点（Nodes）、平滑轻量的箭头连接、垂直的步骤流列表。
- **适用讨论**："登录注册的最佳转化路径是什么？"、"这个 API 的请求时序是怎样的？"

## Design Tips (Pro Max)

- **Fidelity Matching**：需求越早期，保真度越低（多用 `wireframe.html` 中的色块和线框）；细节讨论阶段，使用具体文字与精细排版。
- **Real Content is King**：在需要体会版式时，用真实的文案代替 `Lorem Ipsum`，这能极大增强设计的真实感和愉悦感。
- **Bento 布局法**：对于复杂页面的拆解，不要平铺，多尝试使用网格（Grid）和圆角卡片组合的 Bento Box 形式。
- **深色模式支持**：所有模板已经默认做了强大的 `@media (prefers-color-scheme: dark)` 支持。自己添加新元素时要确保在深/浅模式下边界分明（尤其是边框 `var(--border)` 的应用）。