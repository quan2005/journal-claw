# ⌘K 对话框 UI 一致性修复

日期：2026-04-15
状态：设计完成，待实施

## 背景

⌘K 对话框（ConversationDialog）在视觉风格上与主应用存在多处不一致：硬编码颜色值、绕过设计 token 的字号/字重、边框宽度偏差、两套独立的 Markdown 样式系统、以及对话框内部的表面色分裂。

## 策略

方案 A：Token 替换 + Markdown 统一。保留对话框用 `--queue-bg` 作为浮层表面（合理的层级区分），将所有硬编码值替换为设计系统 token。

## 修复清单

### 1. 硬编码绿色 → `--status-success`

- **文件**：`ConversationDialog.tsx`、`SessionList.tsx`
- **现状**：流式状态指示器使用 `#00A650`，不在设计系统中，不跟随主题
- **改动**：`#00A650` → `var(--status-success)`（浅色 `#266b45` / 深色 `#5ba67a`）

### 2. SessionList 字号/字重 → Token

- **文件**：`SessionList.tsx`
- **现状**：`0.75rem`、`0.625rem`、`0.5625rem` 和 `fontWeight: 500/600` 硬编码
- **改动**：
  - `fontSize: '0.75rem'` → `var(--text-xs)`
  - `fontSize: '0.625rem'` → `var(--text-xs)`
  - `fontSize: '0.5625rem'` → `var(--text-xs)` + `transform: scale(0.85)`（保持小号标签感）
  - `fontWeight: 500` → `var(--font-medium)`
  - `fontWeight: 600` → `var(--font-semibold)`

### 3. 边框宽度统一 → 0.5px

- **文件**：`SessionList.tsx`、`ConversationDialog.tsx`
- **改动**：
  - 新会话按钮：`1px dashed` → `0.5px dashed`
  - Streaming badge：`1px solid` → `0.5px solid`

### 4. SessionList 表面色统一

- **文件**：`SessionList.tsx`
- **现状**：SessionList 用 `--bg`，对话框面板用 `--queue-bg`，深色模式下有明显色差
- **改动**：SessionList `background: var(--bg)` → `var(--queue-bg)`

### 5. 输入框背景透明化

- **文件**：`ConversationInput.tsx`
- **现状**：textarea 用 `--bg`，在 `--queue-bg` 容器里产生"洞"的感觉
- **改动**：textarea `background: var(--bg)` → `transparent`

### 6. SessionList hover 色调

- **决定**：不做改动。`var(--item-hover-bg)` 是全局统一的 hover 语言，保持一致。

### 7. Markdown 样式统一

- **文件**：`src/styles/markdown.css`
- **现状**：`.md-content`（对话框）使用通用 token（`--segment-bg`、`--item-text`、`--item-meta`），`.md-body`（详情面板）使用 `--md-*` token 族。同一段 markdown 在两处渲染效果不同。
- **改动**：将 `.md-content` 的 token 引用改为 `--md-*` 族：
  - code 背景：`--segment-bg` → `--md-code-bg`
  - code 文字：继承 → `--md-code-text`
  - 引用边框：`--queue-border` → `--md-quote-bar`
  - 引用文字：`--item-meta` → `--md-quote-text`
  - 链接颜色：`--item-text` → `--md-link`
  - 链接 hover：`--item-text` → `--md-link-hover`
- **保留**：对话框 markdown 字号保持 `--text-sm`（13px），不改为详情面板的 `--text-md`（16px）。对话框是紧凑的对话场景，字号小一级合理。

### 8. 流式指示器颜色统一

- **文件**：`ConversationDialog.tsx`、`SessionList.tsx`
- **现状**：Header badge 和 SessionList dot 使用不同的绿色和边框宽度
- **改动**：
  - 两者共用 `var(--status-success)` 颜色
  - Header badge 保留 pill 形式（有文字标签），SessionList 保留 dot 形式（空间有限）
  - 边框统一为 `0.5px`
  - 动画统一使用 `rec-pulse`

## 涉及文件

| 文件 | 改动类型 |
|---|---|
| `src/components/ConversationDialog.tsx` | token 替换、边框宽度 |
| `src/components/SessionList.tsx` | token 替换、字号/字重、边框、表面色 |
| `src/components/ConversationInput.tsx` | 输入框背景 |
| `src/styles/markdown.css` | `.md-content` token 迁移 |

## 不做的事

- 不新增 `--dialog-*` token 族（YAGNI）
- 不改变对话框的浮层层级（`--queue-bg` 是合理的）
- 不改变 hover 色调（全局一致）
- 不改变对话框 markdown 字号（保持紧凑）
- 不改变 `.md-body` 的任何样式
