# ⌘K 对话框 UI 一致性修复 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ⌘K 对话框的所有硬编码样式值替换为设计系统 token，统一 Markdown 渲染样式，消除与主应用的视觉不一致。

**Architecture:** 纯 CSS/inline-style 层面的 token 替换，不涉及组件结构或逻辑变更。4 个文件，8 处修复。

**Tech Stack:** React (inline styles) + CSS (markdown.css) + CSS Custom Properties (globals.css)

---

### Task 1: ConversationDialog — 硬编码绿色 & 边框宽度

**Files:**
- Modify: `src/components/ConversationDialog.tsx:155-162`

- [ ] **Step 1: 替换 streaming badge 的硬编码值**

将 ConversationDialog.tsx 第 155-162 行的 streaming badge 样式从：

```tsx
<span style={{
  fontSize: '0.625rem', padding: '1px 6px', borderRadius: 100,
  border: '1px solid #00A650', color: '#00A650',
  display: 'inline-flex', alignItems: 'center', gap: 4,
}}>
  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00A650' }} />
  输出中
</span>
```

改为：

```tsx
<span style={{
  fontSize: '0.625rem', padding: '1px 6px', borderRadius: 100,
  border: '0.5px solid var(--status-success)', color: 'var(--status-success)',
  display: 'inline-flex', alignItems: 'center', gap: 4,
}}>
  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--status-success)' }} />
  输出中
</span>
```

- [ ] **Step 2: 验证构建**

Run: `cd /Users/yanwu/conductor/workspaces/journal/little-rock && npm run build`
Expected: 编译成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/ConversationDialog.tsx
git commit -m "fix: streaming badge 使用 --status-success token 替换硬编码绿色"
```

---

### Task 2: SessionList — 硬编码绿色 & 字号/字重 & 边框 & 表面色

**Files:**
- Modify: `src/components/SessionList.tsx`

- [ ] **Step 1: 替换 streaming dot 硬编码绿色**

SessionList.tsx renderItem 中的 dot 样式（约第 91-96 行），从：

```tsx
background: s.is_streaming ? '#00A650' : 'var(--item-meta)',
```

改为：

```tsx
background: s.is_streaming ? 'var(--status-success)' : 'var(--item-meta)',
```

- [ ] **Step 2: 替换 session title 字号/字重**

renderItem 中的 title div（约第 109-112 行）和 edit input（约第 101-105 行），从：

```tsx
fontSize: '0.75rem', fontWeight: 500,
```

改为：

```tsx
fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
```

同样修改 edit input 的 style（约第 101 行）：

```tsx
fontSize: '0.75rem', fontWeight: 500,
```

改为：

```tsx
fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
```

- [ ] **Step 3: 替换 timestamp 字号**

renderItem 中的 timestamp div（约第 117-119 行），从：

```tsx
fontSize: '0.625rem',
```

改为：

```tsx
fontSize: 'var(--text-xs)',
```

- [ ] **Step 4: 替换 section label 字号/字重**

"输出中" 和 "已完成" 的 section label（约第 148 行和第 161 行），从：

```tsx
fontSize: '0.5625rem', fontWeight: 600,
```

改为：

```tsx
fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
transform: 'scale(0.85)', transformOrigin: 'left center',
```

- [ ] **Step 5: 替换 "暂无会话" 字号**

空状态文字（约第 170 行），从：

```tsx
fontSize: '0.75rem',
```

改为：

```tsx
fontSize: 'var(--text-xs)',
```

- [ ] **Step 6: 新建会话按钮边框**

新建会话按钮（约第 137 行），从：

```tsx
border: '1px dashed var(--queue-border)',
```

改为：

```tsx
border: '0.5px dashed var(--queue-border)',
```

- [ ] **Step 7: SessionList 容器背景色**

SessionList 根容器（约第 131 行），从：

```tsx
background: 'var(--bg)',
```

改为：

```tsx
background: 'var(--queue-bg)',
```

- [ ] **Step 8: 验证构建**

Run: `cd /Users/yanwu/conductor/workspaces/journal/little-rock && npm run build`
Expected: 编译成功，无错误

- [ ] **Step 9: Commit**

```bash
git add src/components/SessionList.tsx
git commit -m "fix: SessionList 全面替换硬编码值为设计系统 token"
```

---

### Task 3: ConversationInput — 输入框背景透明化 & 附件硬编码绿色

**Files:**
- Modify: `src/components/ConversationInput.tsx`

- [ ] **Step 1: 替换 textarea 背景色**

ConversationInput.tsx textarea 的 style（约第 243 行），从：

```tsx
background: 'var(--bg)',
```

改为：

```tsx
background: 'transparent',
```

- [ ] **Step 2: 替换附件转写完成状态的硬编码绿色**

附件 chip 的 transcribed 状态（约第 207-210 行），从：

```tsx
background: att.status === 'transcribed'
  ? 'rgba(0,166,80,0.08)'
  : 'var(--segment-bg)',
border: att.status === 'transcribed'
  ? '0.5px solid rgba(0,166,80,0.25)'
  : '0.5px solid var(--queue-border)',
```

改为：

```tsx
background: att.status === 'transcribed'
  ? 'var(--status-success-bg)'
  : 'var(--segment-bg)',
border: att.status === 'transcribed'
  ? '0.5px solid var(--status-success)'
  : '0.5px solid var(--queue-border)',
```

同时将转写完成的 checkmark（约第 214 行），从：

```tsx
<span style={{ color: 'rgba(0,166,80,1)', fontSize: '0.6875rem' }}>✓</span>
```

改为：

```tsx
<span style={{ color: 'var(--status-success)', fontSize: '0.6875rem' }}>✓</span>
```

- [ ] **Step 3: 验证构建**

Run: `cd /Users/yanwu/conductor/workspaces/journal/little-rock && npm run build`
Expected: 编译成功，无错误

- [ ] **Step 4: Commit**

```bash
git add src/components/ConversationInput.tsx
git commit -m "fix: 输入框背景透明化 + 附件状态颜色改用 --status-success token"
```

---

### Task 4: Markdown 样式统一 — .md-content 迁移到 --md-* token

**Files:**
- Modify: `src/styles/markdown.css`

- [ ] **Step 1: 替换 inline code token**

markdown.css 中 `.md-content code:not(pre code)` 规则（约第 55-60 行），从：

```css
.md-content code:not(pre code) {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: var(--segment-bg, rgba(128,128,128,0.1));
  border-radius: 3px;
  padding: 0.1em 0.35em;
}
```

改为：

```css
.md-content code:not(pre code) {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: var(--md-code-bg);
  color: var(--md-code-text);
  border-radius: 3px;
  padding: 0.1em 0.35em;
}
```

- [ ] **Step 2: 替换 code block token**

`.md-content pre` 规则（约第 63-69 行），从：

```css
.md-content pre {
  margin: 0.5em 0;
  padding: 0.75rem 1rem;
  background: var(--segment-bg, rgba(128,128,128,0.08));
  border-radius: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

改为：

```css
.md-content pre {
  margin: 0.5em 0;
  padding: 0.75rem 1rem;
  background: var(--md-pre-bg);
  border-radius: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

同时将 `.md-content pre code`（约第 70-76 行）中添加 color：

```css
.md-content pre code {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--md-pre-text);
  background: none;
  padding: 0;
  border-radius: 0;
}
```

- [ ] **Step 3: 替换 blockquote token**

`.md-content blockquote` 规则（约第 79-84 行），从：

```css
.md-content blockquote {
  margin: 0.5em 0;
  padding: 0.25em 0 0.25em 0.75rem;
  border-left: 2px solid var(--queue-border, rgba(128,128,128,0.2));
  color: var(--item-meta);
}
```

改为：

```css
.md-content blockquote {
  margin: 0.5em 0;
  padding: 0.25em 0 0.25em 0.75rem;
  border-left: 2px solid var(--md-quote-bar);
  color: var(--md-quote-text);
}
```

- [ ] **Step 4: 替换 hr token**

`.md-content hr` 规则（约第 90-93 行），从：

```css
.md-content hr {
  border: none;
  border-top: 1px solid var(--queue-border, rgba(128,128,128,0.2));
  margin: 0.75em 0;
}
```

改为：

```css
.md-content hr {
  border: none;
  border-top: 0.5px solid var(--md-quote-bar);
  margin: 0.75em 0;
}
```

- [ ] **Step 5: 替换 link token**

`.md-content a` 规则（约第 96-102 行），从：

```css
.md-content a {
  color: var(--item-text);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--item-meta);
}
.md-content a:hover {
  text-decoration-color: var(--item-text);
}
```

改为：

```css
.md-content a {
  color: var(--md-link);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: color 0.15s var(--ease-out), opacity 0.15s var(--ease-out);
}
.md-content a:hover {
  color: var(--md-link-hover);
  opacity: 0.8;
}
```

- [ ] **Step 6: 替换 table border token**

`.md-content th, .md-content td` 规则（约第 108-111 行），从：

```css
border: 1px solid var(--queue-border, rgba(128,128,128,0.2));
```

改为：

```css
border: 0.5px solid var(--md-quote-bar);
```

同时将 `.md-content th` 的 background 从：

```css
background: var(--segment-bg, rgba(128,128,128,0.05));
```

改为：

```css
background: var(--md-code-bg);
```

以及 `.md-content tr:nth-child(even) td` 从：

```css
background: var(--segment-bg, rgba(128,128,128,0.03));
```

改为：

```css
background: var(--md-pre-bg);
```

- [ ] **Step 7: 添加 strong token**

`.md-content strong` 规则（约第 118 行），添加 color：

```css
.md-content strong {
  font-weight: var(--font-semibold, 600);
  color: var(--md-strong);
}
```

- [ ] **Step 8: 验证构建**

Run: `cd /Users/yanwu/conductor/workspaces/journal/little-rock && npm run build`
Expected: 编译成功，无错误

- [ ] **Step 9: Commit**

```bash
git add src/styles/markdown.css
git commit -m "fix: .md-content 迁移到 --md-* token 族，与详情面板 Markdown 风格统一"
```

---

### Task 5: 最终验证

**Files:**
- 无新改动，仅验证

- [ ] **Step 1: 运行前端测试**

Run: `cd /Users/yanwu/conductor/workspaces/journal/little-rock && npm test`
Expected: 所有测试通过

- [ ] **Step 2: 运行构建**

Run: `cd /Users/yanwu/conductor/workspaces/journal/little-rock && npm run build`
Expected: 编译成功

- [ ] **Step 3: 视觉检查清单**

启动 `npm run tauri dev`，手动验证：
- [ ] 深色模式：streaming badge 颜色为 `#5ba67a`（非 `#00A650`）
- [ ] 浅色模式：streaming badge 颜色为 `#266b45`
- [ ] SessionList 背景与对话框面板一致（无色差）
- [ ] 输入框无"洞"感（transparent 背景）
- [ ] 新建会话按钮边框为 0.5px
- [ ] Markdown code block 使用 `--md-pre-bg` 背景
- [ ] Markdown 链接使用 `--md-link` 颜色
- [ ] Markdown blockquote 使用 `--md-quote-bar` 边框色
