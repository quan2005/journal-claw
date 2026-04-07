# Visual Companion Guide

通过浏览器展示 mockup、架构图和选项对比的可视化伴侣。

## Design Philosophy

生成的 HTML 应该看起来像**高端设计工具的演示模式**，而非「AI 生成的网页」。

**核心原则：Quieter — 每个像素都有意图，但绝不张扬。**

### 必须做到

- **Tinted neutrals** — 所有灰色带微暖石色调（warm stone），不用纯灰
- **单一 accent** — 模板使用 indigo，克制使用，仅用于选中态和焦点
- **Typography-led hierarchy** — 靠字号 + 字重建立层级，不堆颜色
- **Rhythmic spacing** — 组内紧（8–12px），组间松（24–40px）
- **Targeted transitions** — 指定具体属性 + ease-out-quart，不用 `transition: all`
- **Reduced motion** — 永远加 `@media (prefers-reduced-motion: reduce)` 降级

### 禁止出现

- `transition: all` — 始终指定 `border-color`, `background-color`, `opacity` 等具体属性
- `ease` 或 `ease-in-out` — 用 `cubic-bezier(0.16, 1, 0.3, 1)`
- `transform: translateY(-2px)` + `box-shadow` 卡片上浮 — 只用 `border-color` 变化
- 纯灰 `#333` / `#666` / `#999` — 用模板里的 warm stone 色值
- 纯黑 `#000` 或纯白 `#fff` 作为大面积底色
- 渐变文字、发光效果、玻璃态
- bounce / elastic 缓动
- 统一 `border-radius: 12px` — 按语义分级（sm: 6px, md: 10px, lg: 14px）
- 按钮或导航条用 accent 色填充 — 线框图里 mock 元素用 neutral 色

## When to Use

逐问题判断，不是逐会话。判断标准：**用户看到它比读文字更容易理解吗？**

**用浏览器** — 内容本身是视觉的：

- **UI mockup** — 线框图、布局、导航结构、组件设计
- **架构图** — 系统组件、数据流、关系图
- **并排对比** — 两种布局、两种配色、两种设计方向
- **设计打磨** — 关于外观、间距、视觉层次的问题
- **空间关系** — 状态机、流程图、实体关系图

**用终端** — 内容是文字或表格：

- **需求和范围问题** — "X 是什么意思？"、"哪些功能在范围内？"
- **概念选择** — 用文字描述的方案对比
- **权衡列表** — 优缺点、对比表格
- **技术决策** — API 设计、数据建模、架构选型
- **澄清问题** — 答案是文字而非视觉偏好的问题

关于 UI 话题的问题不一定是视觉问题。"你想要什么样的向导？"是概念问题——用终端。"这两个向导布局哪个感觉对？"是视觉问题——用浏览器。

## How It Works

写自包含 HTML 文件到 `yyMM/raw/DD-ideate-*.html`，然后用 `open` 命令在浏览器中打开。无需 server。

- `yyMM` = 年月目录（如 `2604`）
- `DD` = 当天日期（如 `07`）
- 语义后缀：`07-ideate-layout.html`、`07-ideate-style-v2.html`

用户在浏览器中查看后，在终端里反馈。

## The Loop

1. **写 HTML** 到 `yyMM/raw/` 下的新文件：
  - 文件名模式：`DD-ideate-{topic}.html`（如 `07-ideate-platform.html`）
  - **不要复用文件名** — 每个画面用新文件
  - 迭代版本加后缀：`07-ideate-layout-v2.html`
  - 写自包含 HTML（所有 CSS 和 JS 内联）
  - 用 Write 工具 — **不要用 cat/heredoc**
2. **在浏览器中打开：**
  ```bash
   open yyMM/raw/DD-ideate-xxx.html
  ```
3. **告诉用户画面内容：**
  - 简要描述画面上有什么（如"展示了 3 种首页布局方案"）
  - 请用户在终端回复反馈
4. **获取反馈** — 用户在终端中回复偏好
5. **迭代或推进** — 如果反馈需要修改当前画面，写新文件（如 `07-ideate-layout-v2.html`）。当前步骤确认后再进入下一个问题。

## Writing HTML Files

每个 HTML 文件必须自包含。**从 `skills/ideate/scripts/frame-template.html` 复制完整 CSS**。

**完整示例：**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ideate</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
      --duration-fast: 150ms;
      --duration-normal: 200ms;
      --bg: #f7f6f3;
      --surface: #ffffff;
      --surface-dim: #edebe7;
      --border: #ddd9d3;
      --text: #1c1917;
      --text-2: #6f6963;
      --text-3: #a39d97;
      --accent: #4338ca;
      --accent-subtle: rgba(67, 56, 202, 0.06);
      --accent-on: #ffffff;
      --radius-sm: 6px;
      --radius-md: 10px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1816;
        --surface: #262320;
        --surface-dim: #33302c;
        --border: #3d3935;
        --text: #ede9e3;
        --text-2: #9a958f;
        --text-3: #6b6660;
        --accent: #a5b4fc;
        --accent-subtle: rgba(165, 180, 252, 0.08);
        --accent-on: #1a1816;
      }
    }

    html {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 3rem 2rem;
      max-width: 720px;
      margin: 0 auto;
    }

    h2 { font-size: 1.75rem; font-weight: 600; letter-spacing: -0.015em; line-height: 1.25; margin-bottom: 0.5rem; }
    .subtitle { color: var(--text-2); font-size: 1rem; line-height: 1.55; margin-bottom: 2rem; }

    .options { display: flex; flex-direction: column; gap: 0.625rem; }
    .option {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      transition: border-color var(--duration-normal) var(--ease-out),
                  background-color var(--duration-normal) var(--ease-out);
    }
    .option:hover { border-color: var(--accent); }
    .option.selected { background: var(--accent-subtle); border-color: var(--accent); }
    .option .letter {
      background: var(--surface-dim);
      color: var(--text-2);
      width: 1.625rem; height: 1.625rem;
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 0.75rem; flex-shrink: 0;
      transition: background-color var(--duration-normal) var(--ease-out),
                  color var(--duration-normal) var(--ease-out);
    }
    .option.selected .letter { background: var(--accent); color: var(--accent-on); }
    .option .content { flex: 1; }
    .option .content h3 { font-size: 0.9375rem; margin-bottom: 0.125rem; }
    .option .content p { color: var(--text-2); font-size: 0.8125rem; margin: 0; line-height: 1.5; }

    /* 完整 CSS（cards, mockup, split, pros-cons 等）见 frame-template.html */

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: 0.01ms !important; }
    }
  </style>
</head>
<body>

<h2>Which layout works better?</h2>
<p class="subtitle">Consider readability and visual hierarchy</p>

<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Single Column</h3>
      <p>Clean, focused reading experience with generous margins</p>
    </div>
  </div>
  <div class="option" data-choice="b" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content">
      <h3>Two Column</h3>
      <p>Sidebar navigation with main content area</p>
    </div>
  </div>
</div>

<script>
function toggleSelect(el) {
  var container = el.closest('.options') || el.closest('.cards');
  var multi = container && container.dataset.multiselect !== undefined;
  if (container && !multi) {
    container.querySelectorAll('.option, .card').forEach(function(o) {
      o.classList.remove('selected');
    });
  }
  if (multi) { el.classList.toggle('selected'); }
  else { el.classList.add('selected'); }
}
</script>

</body>
</html>
```

## CSS Classes Available

Frame template 提供以下 CSS 类。**实际使用时从 frame-template.html 复制完整 CSS，不要自己重写色值。**

### Options (A/B/C choices)

```html
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Title</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

**多选：** 添加 `data-multiselect` 到容器：

```html
<div class="options" data-multiselect>
  <!-- users can select/deselect multiple -->
</div>
```

### Cards (visual designs)

```html
<div class="cards">
  <div class="card" data-choice="design1" onclick="toggleSelect(this)">
    <div class="card-image"><!-- mockup content --></div>
    <div class="card-body">
      <h3>Name</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

### Mockup container

```html
<div class="mockup">
  <div class="mockup-header">Dashboard Layout</div>
  <div class="mockup-body"><!-- your mockup HTML --></div>
</div>
```

### Split view (side-by-side)

```html
<div class="split">
  <div class="mockup"><!-- left --></div>
  <div class="mockup"><!-- right --></div>
</div>
```

### Pros/Cons

```html
<div class="pros-cons">
  <div class="pros"><h4>Pros</h4><ul><li>Benefit</li></ul></div>
  <div class="cons"><h4>Cons</h4><ul><li>Drawback</li></ul></div>
</div>
```

### Wireframe building blocks

线框图用 neutral 色调，不用 accent 填充：

```html
<div class="mock-nav">Logo | Home | About | Contact</div>
<div style="display: flex;">
  <div class="mock-sidebar">Navigation</div>
  <div class="mock-content">Main content area</div>
</div>
<button class="mock-button">Primary Action</button>
<button class="mock-button-secondary">Secondary</button>
<input class="mock-input" placeholder="Input field">
<div class="placeholder">Placeholder area</div>
```

### Typography and sections

- `h2` — page title（1.75rem, -0.015em tracking, 600 weight）
- `h3` — section heading（1.0625rem, 600）
- `h4` — sub heading（0.8125rem, 600）
- `.subtitle` — secondary text below title（1rem, `--text-2`）
- `.section` — content block with bottom margin
- `.label` — uppercase label（0.6875rem, 500, 0.08em tracking）
- `.note` — italic annotation with top border

### Annotation

```html
<p class="note">A refined note about the options above.</p>
```

### Divider

```html
<hr>
```

## Design Tips

- **Scale fidelity to the question** — wireframes for layout, polish for polish questions
- **Explain the question on each page** — "Which layout feels more professional?" not just "Pick one"
- **Iterate before advancing** — if feedback changes current screen, write a new version
- **2-4 options max** per screen
- **Use real content when it matters** — placeholder content obscures design issues
- **Keep mockups simple** — focus on layout and structure
- **Generous whitespace** — `max-width: 720px`, `padding: 3rem 2rem`，让内容呼吸
- **Border, not shadow** — 用 `1px solid var(--border)` 分隔，不用 box-shadow

## File Naming

- Pattern: `DD-ideate-{topic}.html`（如 `07-ideate-layout.html`）
- Never reuse filenames — each screen must be a new file
- For iterations: `07-ideate-layout-v2.html`, `07-ideate-layout-v3.html`

## Reference

- Frame template (CSS reference): `skills/ideate/scripts/frame-template.html`

