# Lecture Layout — 授课内容的思维与排版模式

授课 / 分享 / 讲座 / 培训类内容**沿用与其他三类相同的金橙暖色设计语言**（`structure-template.html` 的 `--ac:#C8933B`、`Noto Sans SC`、1100px `.page`、暗色快照切换机制）。**仅思维与排版有别**：

| 维度 | 产品 / 会议 / 知识（左右对照） | 授课 / 分享（单栏节律） |
|---|---|---|
| 每章骨架 | `.ch-body` 网格 2 列（`.ch-logic` + `.ch-ui`） | 单栏，`sub-label` 切块 |
| 章节编号 | 圆点 `.ch-num`（1 / 2 / 3）| `Part 01` 前缀文字 |
| 导航 | 无（长页滚动） | 顶部 sticky NavBar，章节 tab |
| 核心视觉 | 右侧 UI mockup / 决策树 / 关系图 | 演进 SVG + data-table 矩阵 + case-card |
| 立意方式 | `.ch-subtitle` 一句话回答 | `.summary-line` 立意 + 多个 `sub-label` 逐层推 |
| 收束 | 第 5 层终章回扣 | 每章末端 `.quote` 或 `.diff-alert` |

**为什么要分开两种排版？** 授课的叙述本身是左右耦合的（理论 + 案例 + 讲者原话 + 整理者提醒交织在同一节里），硬拆成左右栏会失去课堂节奏。授课的价值是「跟着讲者一步步推」——用单栏节律+sub-label 切块更自然。

> **重要**：不要为授课发明新的 CSS 变量或字体。所有色彩从 `structure-template.html` 的 `:root` 继承，`--ac` 金橙色就是唯一 accent。读者打开两种长页应感受到**同一个设计系统、同一个品牌**。

## 一、整体骨架

```
.page
  ├─ .page-header（Hero：标题 · slogan · 副标题 · meta）
  ├─ .lecture-nav（sticky，Part 01 / 02 / ... tabs）
  └─ .chapter × N （每章一个 Part）
       ├─ Part 编号 + 章节标题
       ├─ .summary-line（立意）
       ├─ .sub-label + 视觉块 × N
       └─ .quote 或 .diff-alert 收束（可选）
```

## 二、Hero（授课版）

与其他类型的区别：Hero meta 用 dot 分隔符列出**日期 · 机构 · 讲者 · 模块数**，让读者一眼抓住课程元信息。**不要把讲者简介单独做一节**——全压在 Hero 里，正文一上来就是 Part 01。

```html
<div class="page-header">
  <h1>{{课程/分享主题}}</h1>
  <div class="slogan">{{一句话核心主张}}</div>
  <p>{{章节漫游 — 用 ` · ` 分隔关键章节短语}}</p>
  <div class="hero-meta">
    <span>{{日期，如 2026-04-11}}</span><span class="dot">·</span>
    <span>{{机构 / 场合}}</span><span class="dot">·</span>
    <span>{{讲者}}</span><span class="dot">·</span>
    <span>{{模块数，如 8 个 Part}}</span>
  </div>
</div>
```

**新增 CSS**（补到 `structure-template.html` 的 style 末尾即可，全部用现有 token）：

```css
.hero-meta{
  display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;
  margin-top:14px;font-size:12px;color:var(--t3);
}
.hero-meta .dot{color:var(--bd);margin:0 2px}
```

## 三、Sticky NavBar

长课程通常 6-10 个 Part，读者需要跳读。NavBar 用现有 `--card-bg` / `--bd` / `--ac` token，完全融入金橙体系。

```html
<div class="lecture-nav">
  <div class="nav-inner">
    <a class="nav-tab active" data-target="p1" onclick="goto(0)">① {{章节短语 1}}</a>
    <a class="nav-tab" data-target="p2" onclick="goto(1)">② {{章节短语 2}}</a>
    <!-- ... 每个 Part 一个 tab，文字 4-8 字以内 -->
  </div>
</div>
```

```css
.lecture-nav{
  position:sticky;top:0;z-index:50;
  background:var(--bg-s);border-bottom:1px solid var(--bd);
  margin:0 -24px 32px;padding:0 24px;
}
.nav-inner{max-width:1100px;margin:0 auto;display:flex;gap:18px;overflow-x:auto;padding:12px 0;scrollbar-width:none}
.nav-inner::-webkit-scrollbar{display:none}
.nav-tab{
  flex-shrink:0;font-size:13px;color:var(--t3);text-decoration:none;
  padding:4px 0;border-bottom:2px solid transparent;cursor:pointer;transition:all .2s;
}
.nav-tab:hover{color:var(--t1)}
.nav-tab.active{color:var(--ac);border-bottom-color:var(--ac);font-weight:600}
```

配套 JS（IntersectionObserver 自动高亮，随主题切换不受影响）：

```js
const tabs = document.querySelectorAll('.nav-tab');
const sections = document.querySelectorAll('.chapter[id]');
function goto(i){ sections[i].scrollIntoView({behavior:'smooth',block:'start'}); }
new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const i=[...sections].indexOf(e.target);
      tabs.forEach((t,j)=>t.classList.toggle('active',i===j));
    }
  });
},{rootMargin:'-40% 0px -55% 0px'}).observe&&sections.forEach(s=>new IntersectionObserver(()=>{},{}).observe(s));
```

## 四、Part 标头 + Summary Line

```html
<div class="chapter" id="p1">
  <div class="part-head">
    <span class="part-num">Part 01</span>
    <span class="part-title">{{本 Part 主标题}}</span>
  </div>
  <p class="summary-line">{{立意句：一句话告诉读者本节该记住什么；句式如「从 A 到 B 再到 C」「核心命题 X；关键矛盾 Y」}}</p>
  <!-- sub-label 块 × N -->
</div>
```

```css
.part-head{display:flex;align-items:baseline;gap:14px;margin-bottom:8px}
.part-num{
  font-size:13px;font-weight:700;letter-spacing:1px;
  color:var(--ac);text-transform:uppercase;
}
.part-title{font-size:20px;font-weight:700;color:var(--t1)}
.summary-line{
  background:var(--quote-bg);border-left:3px solid var(--ac);
  padding:12px 16px;margin:16px 0 24px;
  font-size:14px;line-height:1.7;color:var(--t1);border-radius:0 6px 6px 0;
}
```

**summary-line 写作要求**：一句话 ≤ 60 字，句式如「从 A 到 B 再到 C」「核心命题 X；关键矛盾 Y」。是**立意**不是概述——告诉读者读完这一节该记住什么。

## 五、Sub-label（节内切块）

```html
<div class="sub-label">演进全景</div>
<!-- 视觉块 -->

<div class="sub-label">各阶段核心命题</div>
<!-- 视觉块 -->
```

```css
.sub-label{
  font-size:11px;font-weight:600;letter-spacing:2px;
  color:var(--t3);text-transform:uppercase;
  margin:28px 0 12px;
}
```

**节奏**：一个 Part 通常有 2-4 个 sub-label，每个切块后面挂一个视觉块（SVG / info-grid / data-table / case-card / timeline / compare 任选一）。

## 六、组件清单（按「表达什么用什么」查阅）

下列组件全部使用金橙暖色 token，和 `.ch-logic` / `.logic-quote` / `.logic-highlight` 同属一套视觉系统。

| 当你要表达 | 用这个组件 | 核心 token |
|---|---|---|
| 理论演进（A → B → C → ... → 最新） | 横向 SVG 节点链，末节点高亮 | 普通节点 `--card-bg` + `--bd`；高亮节点 `--ac-bg` + `--ac` |
| N 要素 / N 特征 / N 维度 | `.info-grid.col3~5` + `.icard` | `--card-bg` + `--bd`，编号色 `--ac` |
| 行×列都有信息（对比多个维度） | `.data-table`，末行可 `--ac` 高亮 | 表头 `--bg-h`，hover `--highlight-bg` |
| 二元对立 / A vs B | `.compare` + 两个 `.ccard` | 一张 `--ac` 边线，一张 `--green` 边线 |
| 层次递进 / 博弈回合 / 多步骤 | `.timeline` + `tl-dot` | 节点用 `--ac` / `--green` / `--orange` / `--red` 区分 |
| 讲者原话 / 经典结论 | `.logic-quote`（直接复用，加大字号）| `--quote-bg` + `--ac` |
| 整理者提醒 / 易错点 | `.diff-alert` + 图标 | `--highlight-bg` + `--orange` 图标 |
| 案例详细剖析 | `.case-card`（CASE STUDY 标签）| `--card-bg` + `--bd-l`，标签 `--ac` |
| 2×2 战略矩阵（红海/蓝海等） | `.info-grid.col2` + 四卡异色 | 白格 `--card-bg`；蓝格 `--ac-bg`；绿格 `--green-bg`；红格 `--red-bg` |

### 6.1 SVG 演进链

```html
<svg viewBox="0 0 1040 80" width="100%">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--t3)"/>
    </marker>
  </defs>
  <!-- 普通节点（重复 N-1 次，改 translate x 位置） -->
  <g transform="translate(0,14)">
    <rect width="120" height="52" rx="8" fill="var(--card-bg)" stroke="var(--bd)"/>
    <text x="60" y="24" text-anchor="middle" font-size="12" font-weight="600" fill="var(--t1)">{{阶段 A 名}}</text>
    <text x="60" y="40" text-anchor="middle" font-size="10" fill="var(--t3)">{{阶段 A 核心动作}}</text>
  </g>
  <!-- 箭头 -->
  <line x1="125" y1="40" x2="150" y2="40" stroke="var(--t3)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <!-- 高亮终点节点（最后一阶段 / 最新结论，加宽并用 --ac 色） -->
  <g transform="translate(880,8)">
    <rect width="160" height="64" rx="8" fill="var(--ac-bg)" stroke="var(--ac)" stroke-width="1.5"/>
    <text x="80" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ac-text)">{{终态名}}</text>
    <text x="80" y="46" text-anchor="middle" font-size="10" fill="var(--t2)">{{终态一句话注解}}</text>
  </g>
</svg>
```

### 6.2 info-grid + icard

```html
<div class="info-grid col3">
  <div class="icard">
    <div class="ic-key">01</div>
    <div class="ic-title">{{要点名}}</div>
    <div class="ic-sub">{{要点一句话说明，≤ 30 字}}</div>
  </div>
  <!-- 更多 icard，col3 时 3 个一排，col4 时 4 个一排 -->
</div>
```

```css
.info-grid{display:grid;gap:14px;margin:4px 0 8px}
.info-grid.col2{grid-template-columns:repeat(2,1fr)}
.info-grid.col3{grid-template-columns:repeat(3,1fr)}
.info-grid.col4{grid-template-columns:repeat(4,1fr)}
.info-grid.col5{grid-template-columns:repeat(5,1fr)}
@media(max-width:768px){.info-grid{grid-template-columns:repeat(2,1fr)!important}}
.icard{
  background:var(--card-bg);border:1px solid var(--bd);border-radius:8px;
  padding:16px 18px;transition:border-color .2s;
}
.icard:hover{border-color:var(--ac)}
.ic-key{font-size:12px;font-weight:700;color:var(--ac);letter-spacing:1px;margin-bottom:6px}
.ic-title{font-size:14px;font-weight:650;color:var(--t1);margin-bottom:6px}
.ic-sub{font-size:12px;color:var(--t2);line-height:1.7}
```

**ic-key 颜色语义**：默认 `--ac` 金橙；警示类可用 `--red`；正向 / 框架类用 `--green`；心智类用 `--orange`。仍在现有 token 内。

### 6.3 case-card（每节至少 1 个）

授课最大的价值是案例。每节必须至少 1 个 case-card 落地抽象理论。

```html
<div class="case-card">
  <div class="case-label">CASE STUDY</div>
  <div class="case-title">{{案例主体}}：{{一句话立论}}</div>
  <div class="case-body">
    · {{佐证要点 1}}<br>
    · {{佐证要点 2}}<br>
    · {{佐证要点 3}}
  </div>
</div>
```

```css
.case-card{
  background:var(--card-bg);border:1px solid var(--bd);border-left:3px solid var(--ac);
  border-radius:0 8px 8px 0;padding:16px 20px;margin:4px 0 8px;
}
.case-label{
  display:inline-block;font-size:10px;font-weight:700;letter-spacing:2px;
  color:var(--ac);background:var(--ac-bg);padding:3px 8px;border-radius:4px;margin-bottom:10px;
}
.case-title{font-size:14px;font-weight:650;color:var(--t1);margin-bottom:8px}
.case-body{font-size:13px;color:var(--t2);line-height:1.8}
```

### 6.4 quote（收束讲者原话）

直接复用 `structure-template.html` 已有的 `.logic-quote`，或稍微加重：

```html
<div class="logic-quote" style="font-size:14px;line-height:1.8;">
  「{{讲者原话前半}}<strong style="color:var(--ac);">{{核心短语}}</strong>{{讲者原话后半——一个完整句子，直接引语}}」
</div>
```

**每节 ≤ 2 个**，用多了贬值。

### 6.5 diff-alert（整理者提醒）

```html
<div class="diff-alert">
  <span class="da-icon">⚠</span>
  <div class="da-text">
    <strong>{{提醒主题}}</strong>：{{整理者对易错点 / 风险 / 反直觉结论的一句话提示}}
  </div>
</div>
```

```css
.diff-alert{
  display:flex;gap:12px;align-items:flex-start;
  background:var(--highlight-bg);border:1px solid var(--bd);border-left:3px solid var(--orange);
  border-radius:0 6px 6px 0;padding:12px 16px;margin:12px 0;
}
.da-icon{font-size:18px;flex-shrink:0;color:var(--orange)}
.da-text{font-size:13px;color:var(--t2);line-height:1.7}
.da-text strong{color:var(--t1)}
```

图标可选：`⚠`（警告）/ `💡`（启发）/ `✓`（正向）。与 `.logic-quote` 的区别——**diff-alert 是整理者/作者的提醒，quote 是讲者的原话**。

### 6.6 compare + ccard（A vs B）

```html
<div class="compare">
  <div class="ccard" data-accent="ac">
    <div class="cc-title">{{A 方名称}}</div>
    <div class="cc-body">{{A 方核心命题}}<br>要求：<strong>{{A 方关键词}}</strong><br>{{A 方补充}}</div>
  </div>
  <div class="ccard" data-accent="green">
    <div class="cc-title">{{B 方名称}}</div>
    <div class="cc-body">{{B 方核心命题}}<br>要求：<strong>{{B 方关键词}}</strong><br>{{B 方补充}}</div>
  </div>
</div>
```

```css
.compare{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:4px 0 8px}
@media(max-width:768px){.compare{grid-template-columns:1fr}}
.ccard{background:var(--card-bg);border:1px solid var(--bd);border-radius:8px;padding:16px 18px;border-left-width:3px}
.ccard[data-accent="ac"]{border-left-color:var(--ac)}
.ccard[data-accent="green"]{border-left-color:var(--green)}
.ccard[data-accent="red"]{border-left-color:var(--red)}
.ccard[data-accent="purple"]{border-left-color:var(--purple)}
.ccard .cc-title{font-size:14px;font-weight:650;color:var(--t1);margin-bottom:8px}
.ccard[data-accent="ac"] .cc-title{color:var(--ac-text)}
.ccard[data-accent="green"] .cc-title{color:var(--green)}
.cc-body{font-size:13px;color:var(--t2);line-height:1.8}
```

### 6.7 timeline

```html
<div class="timeline">
  <div class="tl-item">
    <div class="tl-left">
      <div class="tl-dot" data-c="red">1</div>
      <div class="tl-line"></div>
    </div>
    <div class="tl-content">
      <strong>{{第 1 层名}}</strong>
      <p>{{第 1 层一句话说明，可含「例：xxx」}}</p>
    </div>
  </div>
  <!-- 更多 tl-item，最后一项去掉 .tl-line -->
</div>
```

```css
.timeline{margin:4px 0 8px}
.tl-item{display:flex;gap:14px;align-items:flex-start}
.tl-left{display:flex;flex-direction:column;align-items:center;flex-shrink:0}
.tl-dot{
  width:28px;height:28px;border-radius:50%;border:2px solid var(--ac);
  color:var(--ac);background:var(--card-bg);
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
}
.tl-dot[data-c="red"]{border-color:var(--red);color:var(--red)}
.tl-dot[data-c="green"]{border-color:var(--green);color:var(--green)}
.tl-dot[data-c="orange"]{border-color:var(--orange);color:var(--orange)}
.tl-line{flex:1;width:2px;background:var(--bd);min-height:24px;margin-top:4px}
.tl-content{padding-bottom:20px}
.tl-content strong{font-size:14px;color:var(--t1)}
.tl-content p{font-size:13px;color:var(--t2);line-height:1.7;margin-top:4px}
```

### 6.8 data-table

```html
<table class="data-table">
  <thead><tr><th>{{维度 1}}</th><th>{{维度 2}}</th><th>{{维度 3}}</th><th>{{维度 4}}</th></tr></thead>
  <tbody>
    <tr><td data-hl="num">①</td><td>{{首行 · 列 2}}</td><td>{{首行 · 列 3}}</td><td>{{首行 · 列 4}}</td></tr>
    <!-- 中间行按同构填充 -->
    <tr class="last-row"><td data-hl="num">⑥</td><td><strong>{{末行 · 列 2（推荐 / 最新）}}</strong></td><td>{{末行 · 列 3}}</td><td>—</td></tr>
  </tbody>
</table>
```

```css
.data-table{
  width:100%;border-collapse:collapse;margin:8px 0;
  background:var(--card-bg);border:1px solid var(--bd);border-radius:8px;overflow:hidden;
}
.data-table th{
  background:var(--bg-h);font-size:12px;font-weight:650;color:var(--t1);
  padding:10px 14px;text-align:left;border-bottom:1px solid var(--bd);
}
.data-table td{font-size:13px;color:var(--t2);line-height:1.7;padding:12px 14px;border-bottom:1px solid var(--bd-l)}
.data-table tr:last-child td{border-bottom:none}
.data-table tr.last-row{background:var(--ac-bg)}
.data-table tr.last-row td{color:var(--t1)}
.data-table td[data-hl="num"]{color:var(--ac);font-weight:700}
```

**列数 2-4 最佳**，超 5 列 1100px 宽度下显拥挤，改用 info-grid 或拆两张。末行用 `.last-row` 高亮为「当前最新 / 推荐」是招牌用法。

## 七、节奏与密度

一个 Part 的内部节奏：

```
Part 编号 + 章节标题
  ↓
summary-line（立意）
  ↓
sub-label「主视觉名」+ [SVG / info-grid / data-table 任选一]
  ↓
sub-label「各阶段 / 各要素详解」 + [data-table 或 info-grid]
  ↓
sub-label「案例」 + [case-card × 1-2]
  ↓
quote 或 diff-alert 收束（可选）
```

每节 **3-5 屏高度**，太短失去「一节一主题」的仪式感，太长读者迷路。超 6 屏考虑拆为两个 Part。

## 八、章节规划原则

- **基本遵循讲者的授课顺序**——优秀的讲者本身已经按逻辑推演讲课，不需要重排
- **合并讲者的数字编号与你的 Part 编号**——用 `Part 01` `Part 02` 统一编号，不要用讲者说的「这是第三点」做标题
- **讲者简介 / 课程元数据全放 Hero**——正文一上来就是 Part 01
- **每个 Part 至少一个 case-card**——抽象理论必须用案例落地
- **终章做两件事**：合并 3-6 句讲者金句成一个大 quote 方阵 + 给一个可复用的能力 / 框架合成图（常见形态：首字母缩略词方阵、四象限矩阵、N 维雷达图等——选一种能让听众带走的判断工具）

## 九、常见错误

- **为授课另造 `--lecture-blue` 或 `Noto Serif SC`** → 错。全部使用 `structure-template.html` 已有 token，金橙是唯一 accent
- **页面宽度改成 920px** → 错。沿用 1100px `.page`，保持与其他类型视觉一致
- **把讲者简介做成独立章节** → 错。全压 Hero
- **一节没有 case 只有理论** → 错。授课最大价值是案例，每节至少 1 个 case-card
- **quote 滥用（一节 > 2 个）** → 贬值。只用在节末收束或极强烈观点处
- **沿用左右对照 `.ch-body` 网格** → 错。授课用单栏节律；左右对照是产品 / 会议 / 知识的排版
- **data-table 列数 > 5** → 1100px 宽度挤不下，改用 info-grid 或拆两张表
