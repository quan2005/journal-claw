# 谨迹营销页改版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改版 `docs/daynote-design-visual.html`，用三个场景各有专属 slogan 的差异化叙事结构替代原有混杂格式。

**Architecture:** 纯静态单文件 HTML。复用现有 CSS 类（`.scene`、`.ba`、`.story`、`.bq`），调整 HTML 结构和内容。无构建步骤，直接在浏览器开文件预览。

**Tech Stack:** HTML / CSS（无框架，无构建工具）

---

## 文件改动范围

| 文件 | 操作 |
|---|---|
| `docs/daynote-design-visual.html` | 修改：重写 `<body>` 内容；CSS 删除 `.flip`、`.perm` 相关样式，其余保留 |

---

### Task 1：删除废弃 CSS 类 + 整理 `<head>`

**Files:**
- Modify: `docs/daynote-design-visual.html`

现有 CSS 中 `.flip`、`.flip-word`、`.flip-sub`、`.perm` 等类在新版中不再使用，先清理，减少干扰。

- [ ] **Step 1: 删除 `.flip` 相关 CSS**

在 `<style>` 中删除以下代码块（第 89–99 行）：

```css
/* ── Flip ── */
.flip {
  text-align: center; padding: 64px 0;
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.flip-word {
  font-family: "Noto Serif SC", serif;
  font-size: clamp(1.5em, 3.5vw, 2.2em);
  font-weight: 900; line-height: 1.35;
}
.flip-sub { font-size: 0.88em; color: var(--muted); margin-top: 12px; line-height: 1.8; }
```

- [ ] **Step 2: 删除 `.perm` 相关 CSS**

在 `<style>` 中删除以下代码块（第 116–128 行）：

```css
/* ── Permission ── */
.perm {
  display: grid; grid-template-columns: 1fr auto auto; font-size: 0.82em;
  border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin: 32px 0;
}
.perm .ph { padding: 7px 14px; color: var(--muted); font-weight: 600; font-size: 0.82em; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px solid var(--border); background: var(--surface); }
.perm .pr { padding: 6px 14px; border-bottom: 1px solid var(--border); color: var(--muted); }
.perm .pr:nth-child(3n+1) { color: var(--text); }
.perm .hi { background: var(--accent-soft); color: var(--text); font-weight: 600; }
.perm .yes { color: var(--green); font-weight: 700; text-align: center; }
.perm .no  { color: var(--dim); text-align: center; }
.perm .ban { color: var(--red); font-weight: 700; text-align: center; }
.perm .own { color: var(--green); font-weight: 700; text-align: center; }
```

- [ ] **Step 3: 在浏览器打开文件确认页面正常渲染**

用浏览器打开 `docs/daynote-design-visual.html`，确认页面不报错、样式正常。

- [ ] **Step 4: Commit**

```bash
git add docs/daynote-design-visual.html
git commit -m "refactor: 删除营销页废弃 CSS 类（flip、perm）"
```

---

### Task 2：重写场景一「个人思考」

**Files:**
- Modify: `docs/daynote-design-visual.html`（替换原「STORY 1: 个人日常」章节）

- [ ] **Step 1: 替换场景一 HTML**

找到注释 `<!-- ━━ STORY 1: 个人日常 ━━ -->` 到下一个 `<!-- ━━ STORY 2` 之间的内容，替换为：

```html
<!-- ━━ SCENE 1: 个人思考 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<div class="wrap">
  <div class="sp"></div>
  <div class="kicker">场景一</div>
  <div class="h2">每一次思考<br>都值得被<span style="color:var(--accent)">谨迹</span></div>

  <div style="margin-top:24px;">
    <div class="scene">
      <div class="scene-time">09:30</div>
      <div class="scene-text">晨会，讨论本周优先级</div>
    </div>
    <div class="scene">
      <div class="scene-time">10:00</div>
      <div class="scene-text">产品评审会，录了 47 分钟</div>
    </div>
    <div class="scene">
      <div class="scene-time">14:00</div>
      <div class="scene-text">客户访谈，对方发来会议纪要 PDF</div>
    </div>
    <div class="scene">
      <div class="scene-time">16:30</div>
      <div class="scene-text">技术方案讨论，你在便签上记了几行</div>
    </div>
    <div class="scene">
      <div class="scene-time">18:00</div>
      <div class="scene-text"><strong>4 条录音、2 份文件、1 段文字。还没整理。</strong></div>
    </div>
    <div class="scene">
      <div class="scene-time" style="color:var(--accent);">18:01</div>
      <div class="scene-text" style="color:var(--accent);">全部拖进谨迹。下班。</div>
    </div>
  </div>
  <div style="height:20px;"></div>
  <div style="border-top:1px dashed var(--border);padding-top:20px;">
    <div class="scene">
      <div class="scene-time" style="color:var(--green);">次日</div>
      <div class="scene-text" style="color:var(--green);">打开谨迹——</div>
    </div>
    <div class="scene">
      <div class="scene-time" style="color:var(--green);">09:00</div>
      <div class="scene-text"><strong style="color:var(--green);">4 篇结构化会议纪要已生成</strong></div>
    </div>
    <div class="scene">
      <div class="scene-time"></div>
      <div class="scene-text"><strong style="color:var(--green);">待办清单已提炼</strong>：跟进张总方案、更新 Q2 排期、准备技术选型文档</div>
    </div>
    <div class="scene">
      <div class="scene-time"></div>
      <div class="scene-text"><strong style="color:var(--green);">产品选型方案初稿已生成</strong>，基于昨天评审会讨论内容</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 浏览器确认场景一渲染正常**

刷新 `docs/daynote-design-visual.html`，确认 kicker「场景一」、h2 slogan、时间线、虚线分割、绿色结果行均正确显示。

- [ ] **Step 3: Commit**

```bash
git add docs/daynote-design-visual.html
git commit -m "feat: 营销页场景一改版 — 个人思考时间线"
```

---

### Task 3：重写场景二「学习」

**Files:**
- Modify: `docs/daynote-design-visual.html`（替换原「STORY 2: 小组协作」章节）

- [ ] **Step 1: 替换场景二 HTML**

找到注释 `<!-- ━━ STORY 2: 小组协作 ━━ -->` 到下一个 `<!-- ━━ STORY 3` 之间的内容，替换为：

```html
<!-- ━━ SCENE 2: 学习 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<div class="wrap">
  <div class="sp2"></div>
  <div class="kicker">场景二</div>
  <div class="h2">每一次嘱咐<br>都值得被<span style="color:var(--accent)">谨迹</span></div>
  <div class="body">以前课上拼命手写，还是漏了关键点。<br>现在只管听讲。</div>

  <div class="ba" style="margin-top:28px;">
    <div class="ba-side">
      <div class="ba-label" style="color:var(--red);">以前</div>
      <ul class="ba-list">
        <li class="gone">课上拼命手写</li>
        <li class="gone">还是漏了关键点</li>
        <li class="gone">导师说的事记一半</li>
        <li class="gone">截止日期全靠记忆</li>
        <li class="gone">课后再花一小时整理笔记</li>
        <li class="gone">论文修改意见散落在脑子里</li>
      </ul>
    </div>
    <div class="ba-side">
      <div class="ba-label" style="color:var(--green);">现在</div>
      <ul class="ba-list" style="color:var(--text);">
        <li>打开录音，<strong>专心听讲</strong></li>
        <li><strong>课堂笔记自动生成</strong></li>
        <li>重点和考点自动标注</li>
        <li><strong>导师嘱咐变成待办</strong></li>
        <li>截止日期自动提炼</li>
        <li><strong>论文修改提纲自动生成</strong></li>
      </ul>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 浏览器确认场景二渲染正常**

刷新页面，确认 Before/After 两列对齐，删除线样式正确，移动端（浏览器缩小到 500px 以下）单列正常。

- [ ] **Step 3: Commit**

```bash
git add docs/daynote-design-visual.html
git commit -m "feat: 营销页场景二改版 — 学习 Before/After"
```

---

### Task 4：重写场景三「办公会议」

**Files:**
- Modify: `docs/daynote-design-visual.html`（替换原「STORY 3: 研发团队」章节）

- [ ] **Step 1: 替换场景三 HTML**

找到注释 `<!-- ━━ STORY 3: 研发团队 ━━ -->` 到 `<!-- ━━ THE FLIP ━━ -->` 之间的内容，替换为：

```html
<!-- ━━ SCENE 3: 办公会议 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<div class="wrap">
  <div class="sp2"></div>
  <div class="kicker">场景三</div>
  <div class="h2">每一场会议<br>都值得被<span style="color:var(--accent)">谨迹</span></div>

  <!-- 子故事一：个人效率 -->
  <div class="body" style="margin-top:8px;">一个人，一天，多场会。</div>
  <div style="margin-top:24px;">
    <div class="scene">
      <div class="scene-time">09:30</div>
      <div class="scene-text">晨会，本周排期</div>
    </div>
    <div class="scene">
      <div class="scene-time">11:00</div>
      <div class="scene-text">需求评审，47 分钟</div>
    </div>
    <div class="scene">
      <div class="scene-time">15:00</div>
      <div class="scene-text">客户对齐，对方发来补充文档</div>
    </div>
    <div class="scene">
      <div class="scene-time" style="color:var(--accent);">18:01</div>
      <div class="scene-text" style="color:var(--accent);">三段录音、一份文档，全部拖进谨迹。下班。</div>
    </div>
  </div>
  <div style="height:20px;"></div>
  <div style="border-top:1px dashed var(--border);padding-top:20px;">
    <div class="scene">
      <div class="scene-time" style="color:var(--green);">次日</div>
      <div class="scene-text"><strong style="color:var(--green);">三篇结构化纪要、一份待办清单——全部就绪。</strong></div>
    </div>
  </div>

  <!-- 子故事二：团队协作 -->
  <div class="sp"></div>
  <div class="body">一个团队，两次会，一份完整交付物。</div>

  <div class="story" style="margin-top:28px;">
    <div class="story-label" style="color:var(--accent);">第一次会议</div>
    <div class="story-step">
      <div class="story-num human">1</div>
      <div class="story-body"><strong>打开谨迹录音</strong>，小组讨论方案框架、论点逻辑、资料分工</div>
    </div>
    <div class="story-step">
      <div class="story-num human">2</div>
      <div class="story-body">散会。把所有私域资料拖进谨迹。</div>
    </div>
  </div>
  <div class="story" style="margin-top:2px;">
    <div class="story-label" style="color:var(--green);">AI 工作中</div>
    <div class="story-step">
      <div class="story-num ai">3</div>
      <div class="story-body"><strong class="g">会议纪要自动生成</strong>——讨论框架、分工、关键论点全部结构化</div>
    </div>
    <div class="story-step">
      <div class="story-num ai">4</div>
      <div class="story-body"><strong class="g">公域资料自动收集</strong>——行业数据、案例、文献</div>
    </div>
    <div class="story-step">
      <div class="story-num ai">5</div>
      <div class="story-body"><strong class="g">按讨论框架编写文稿和 PPT</strong></div>
    </div>
  </div>
  <div class="story" style="margin-top:2px;">
    <div class="story-label" style="color:var(--accent);">第二次会议</div>
    <div class="story-step">
      <div class="story-num human">6</div>
      <div class="story-body">大家过目初稿。<strong>再次打开录音</strong>，讨论优化意见。</div>
    </div>
    <div class="story-step">
      <div class="story-num ai">7</div>
      <div class="story-body"><strong class="g">AI 根据第二次讨论，自动优化文稿和 PPT 的每一处细节。</strong></div>
    </div>
    <div class="story-step">
      <div class="story-num done">✓</div>
      <div class="story-body"><strong>完成。</strong>没有人熬夜。没有人拼稿。</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 浏览器确认场景三渲染正常**

刷新页面，确认：个人效率小时间线 + 虚线分割 + 团队协作三个 Story Card 均正常显示，人类圆圈金色、AI 圆圈绿色、完成圆圈白色。

- [ ] **Step 3: Commit**

```bash
git add docs/daynote-design-visual.html
git commit -m "feat: 营销页场景三改版 — 办公会议 Story Card"
```

---

### Task 5：删除废弃板块（Flip + 权限表）

**Files:**
- Modify: `docs/daynote-design-visual.html`

- [ ] **Step 1: 删除「THE FLIP」板块**

找到注释 `<!-- ━━ THE FLIP ━━ -->` 到 `<!-- ━━ UI ━━ -->` 之间的整个 `<div class="wrap">` 块，完整删除。

- [ ] **Step 2: 删除「DIFFERENTIATOR」权限表板块**

找到注释 `<!-- ━━ DIFFERENTIATOR ━━ -->` 到 `<!-- ━━ WHY ━━ -->` 之间的整个 `<div class="wrap">` 块，完整删除。

- [ ] **Step 3: 浏览器确认页面结构**

刷新页面，确认三个场景之后直接接 UI 截图板块，UI 截图之后直接接信念板块，中间无多余空白或断层。

- [ ] **Step 4: Commit**

```bash
git add docs/daynote-design-visual.html
git commit -m "refactor: 删除营销页废弃板块（flip 过渡段、权限对比表）"
```

---

### Task 6：重写信念板块

**Files:**
- Modify: `docs/daynote-design-visual.html`（替换原「WHY」板块内容）

- [ ] **Step 1: 替换信念板块内容**

找到注释 `<!-- ━━ WHY ━━ -->` 板块，将三段 `.bq` 内容替换为：

```html
<!-- ━━ WHY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<div class="wrap">
  <div class="sp"></div>
  <div class="kicker">信念</div>
  <div class="h2">为什么这样做</div>

  <div class="bq" style="margin-top:32px;">
    <strong>它记住你说过的每一句话。</strong><br>
    <span class="a">跨会议、跨日期，从历史素材中主动产出你需要的东西。</span>
  </div>
  <div class="bq">
    <strong>你的灵感，都应当得到重视。</strong><br>
    <span class="a">任何零散的念头，不只是会议录音——每一个当下的想法都值得被捕捉和处理。</span>
  </div>
  <div class="bq">
    <strong>你的时间应该花在决策上，不是整理上。</strong><br>
    <span class="a">整理录音、提炼待办、起草方案——这些不该是你的活。</span>
  </div>
</div>
```

- [ ] **Step 2: 浏览器确认信念板块**

刷新页面，确认三段信念宣言均显示，金色左边框样式正确，文案与 spec 一致。

- [ ] **Step 3: Commit**

```bash
git add docs/daynote-design-visual.html
git commit -m "feat: 营销页信念板块重写 — 用户价值观驱动表达"
```

---

### Task 7：整体通读 + 结语微调

**Files:**
- Modify: `docs/daynote-design-visual.html`

- [ ] **Step 1: 通读全页，检查以下项目**

在浏览器中从头到尾滚动一遍：
- Hero slogan 是否正确（「每一次思考，都值得被谨迹」）
- 三个场景 kicker 编号是否连续（场景一 / 场景二 / 场景三）
- 场景间距是否一致（均使用 `.sp2`）
- UI 截图板块标题「打开就是这样。没了。」是否保留
- 信念板块三段文案是否与 spec 完全一致
- 深色 / 浅色主题切换是否正常

- [ ] **Step 2: 更新结语**

找到 `<!-- ━━ CLOSING ━━ -->` 板块，将结语内容更新为呼应三个 slogan：

```html
<!-- ━━ CLOSING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
<div class="wrap">
  <div class="sp2"></div>
  <div class="line"></div>
  <div class="closing">
    <p>
      <span class="w">谨迹</span><br><br>
      <span class="a">每一次思考</span><br>
      <span class="a">每一次嘱咐</span><br>
      <span class="a">每一场会议</span><br><br>
      <span class="g">都值得被谨迹</span>
    </p>
  </div>
</div>
```

- [ ] **Step 3: 浏览器最终确认**

刷新页面，完整通读一遍，确认结语三行 slogan 排列整齐，金色 + 绿色对比清晰。

- [ ] **Step 4: Commit**

```bash
git add docs/daynote-design-visual.html
git commit -m "feat: 营销页改版完成 — 结语更新，三句 slogan 收尾"
```
