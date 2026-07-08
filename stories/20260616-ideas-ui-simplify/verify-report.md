# 验收报告 · 简化想法工作台 UI

- story: `stories/20260616-ideas-ui-simplify/story.md`（status: in_progress）
- design: 无
- 范围：`apps/web/src/components/IdeasWorkbench.tsx`、`apps/web/src/styles/globals.css`、`apps/web/src/tests/IdeasWorkbench.test.tsx`、`apps/web/src/tests/light-theme-unit.test.ts`
- 轮次：1（独立 subAgent，仅依据输入契约与指定范围取证）
- 测试执行：`bunx vitest run IdeasWorkbench.test.tsx light-theme-unit.test.ts` → **62 passed (62)**

---

## result: pass（含 1 项待用户裁决）

逐条 AC 结论与证据如下。所有结论基于实际文件/命令输出，未采信任何自述。

### AC-1 不再看到筛选标签栏 / 统计摘要 / 「新建想法」按钮 — ✅ pass

- 组件 JSX（`IdeasWorkbench.tsx`）中已无 `tabs` / `stats` / `new-button` / `filter` / 「新建想法」任何字面量或节点：`rg "新建想法|ideas-workbench-(tabs|stats|new-button|filter|create)|全部（未完成）|待探讨|有截止日期|已完成" apps/web/src/components/IdeasWorkbench.tsx` → 无匹配。
- CSS 中不再定义 `.ideas-workbench-tabs` / `.ideas-workbench-stats` 选择器：`globals.css` 全文 `rg "ideas-workbench-tabs|ideas-workbench-stats"` → 无匹配；`light-theme-unit.test.ts:301-302` 显式断言 `expect(css).not.toContain('.ideas-workbench-stats')` / `.ideas-workbench-tabs`，测试通过。
- 既有回归测试 `IdeasWorkbench.test.tsx:134-148` 断言 `container.querySelector('.ideas-workbench-stats')` / `.ideas-workbench-tabs` 为 null、且无 `新建想法` 按钮 → 通过。

### AC-2 描述文字（intro）不受 max-width 限制，跟随容器全宽 — ✅ pass

- summary 节点结构：`IdeasWorkbench.tsx:135-137` 中 `<p className="ideas-workbench-summary">` 是 `.ideas-workbench`（`display:flex; flex-direction:column`，`globals.css:1267-1268`）的直接 flex 子项，默认 `align-items: stretch`，故横向铺满容器。
- summary 自身规则 `globals.css:693-699`（`.automation-summary, .ideas-workbench-summary`）与 `globals.css:1310-1316`（`.ideas-workbench-summary`）均**未设置 `max-width` / `width`**，仅设置 `margin-top / color / font-size / line-height / overflow-wrap`。
- 对比：同区的 `.ideas-workbench-header, .ideas-workbench-main`（`globals.css:1276-1281`）显式带 `width: min(100%, var(--journal-workbench-max))`，证明 workbench-max 限制是「按需显式施加」，summary 未施加 → 全宽。
- 注意（信息项，非偏差）：header 与 summary 不在同一宽度框架内（header 居中且受 workbench-max 约束、summary 全宽）。AC 仅要求 summary 全宽，符合。

### AC-3 列表默认展示所有未完成项（等同 `filter === 'all'`）— ✅ pass

- `IdeasWorkbench.tsx:117-120`：`visibleTodos = filterIdeas(todoContext.todos, 'all')`，硬编码为 `'all'`，无任何用户可切换的 filter state。
- `filterIdeas` 的 `'all'` 分支（`IdeasWorkbench.tsx:48-49`）返回 `todos.filter((item) => !item.done)`，即「未完成」语义，与 story 一致。
- 回归测试 `IdeasWorkbench.test.tsx:144-147` 断言 3 条未完成项可见、`已完成想法` 不可见 → 通过；`IdeasWorkbench.test.tsx:113-117` 校验 `filterIdeas(ideas,'all')` 输出 3 条未完成项 → 通过。

### AC-4 底部常驻多行 textarea + 右侧加号提交按钮 + Enter 提交 — ✅ pass

- `IdeasWorkbench.tsx:166-192` 渲染 `.ideas-workbench-draft`：含 `<textarea ref={draftRef} aria-label="新想法内容" rows={1}>` 与 `<button className="ideas-workbench-draft-submit" aria-label="添加想法">`，按钮内为 `<Plus>`（lucide）。
- 常驻：`.ideas-workbench-draft` 为 `.ideas-workbench` 的 flex 子项，`flex-shrink:0`（`globals.css:1515`），无条件渲染（无 `drafting` state 控制显隐），常驻可见。
- Enter 提交：`onKeyDown`（`IdeasWorkbench.tsx:177-182`）在 `event.key === 'Enter' && !event.shiftKey` 时 `preventDefault()` 并调用 `submitDraft()` → `addTodo(text)`。
- 多行输入：Shift+Enter 不触发提交（同分支 `!event.shiftKey`），允许换行；`resizeTextarea`（`IdeasWorkbench.tsx:63-71`、`useLayoutEffect:113-115`）按 `scrollHeight` 自适应高度。
- 回归测试：`IdeasWorkbench.test.tsx:156-187` 同时覆盖「Enter 提交」与「按钮提交」两条路径，断言 `addTodo` 被以正确文本调用 → 通过。

### AC-5 输入文字为普通前景色（无 accent 高亮），光标跟随前景色 — ✅ pass

- `globals.css:1499-1509` `.ideas-workbench-draft textarea`：
  - `color: var(--ideas-text)`（`--ideas-text: var(--item-text)`，`globals.css:1261`）— 普通前景色，非 `--record-btn` accent。
  - `caret-color: var(--ideas-text)` — 显式与文字同色。
- 回归测试 `light-theme-unit.test.ts:307-313` 断言 `.ideas-workbench-draft` 存在；CSS token `--ideas-text` 解析为 `var(--item-text)` → 与正文同色，无 accent 高亮。

### AC-6 聚焦输入框，textarea 边框不产生高亮变化（无 focus ring / border-color 变化）— ⚠️ 待用户裁决

事实取证：

- `rg "ideas-workbench-draft textarea:focus|draft.*focus|focus.*draft" apps/web/src/styles/` → **无任何匹配**。CSS 未为 `.ideas-workbench-draft textarea` 定义 `:focus` / `:focus-visible` 规则。
- 因此 `border-color` 不会因聚焦而变化（无覆盖规则）✅。
- 但全局 reset（`globals.css:1-7`）**未禁用 outline**，CSS 也未对该 textarea 显式 `outline: 0`。浏览器 UA 默认 focus outline 仍会渲染（macOS Safari/Chrome 默认的 `-webkit-focus-ring-color` 蓝色光环）。
- 对照：`.ideas-workbench-edit-input:focus { border-color: transparent; outline: 0; }`（`globals.css:1553-1556`）显式抑制了行内编辑 textarea 的默认 outline；而 draft textarea 没有等价处理。
- 测试覆盖：`IdeasWorkbench.test.tsx` 与 `light-theme-unit.test.ts` 均无针对 draft textarea focus 表现的断言（jsdom 不渲染 UA 默认 outline，单测层面不可见）。

两种解读：

- **解读 A（按字面）**：AC 写明「无 focus ring」，应包含浏览器默认 outline。当前未抑制 → **fail**，需补 `.ideas-workbench-draft textarea:focus { outline: 0; }`（或在 reset 中统一处理）。
- **解读 B（按意图）**：AC 的目的是「不像 `.automation-input:focus` 那样主动加 `var(--focus-ring)` accent 高亮」（对照 `globals.css:1198-1201`）。当前实现确实未加任何自定义 accent ring → **pass**。

按保守原则计为 ⚠️ 待用户裁决，请明确 AC-6 是否要求抑制浏览器默认 outline。

---

## 越界 / 偏差清单

无实现越界。本次仅核对指定范围内的实现，未发现引入 story 非目标（toast、行内删除按钮、新交互）的代码改动。

## 待用户裁决项

1. **AC-6**：是否需要为 `.ideas-workbench-draft textarea` 显式 `outline: 0`，以抑制浏览器默认 focus ring？（见上「两种解读」）

**裁定（2026-07-08，主对话）：采纳解读 B。** AC-6 的原始诉求（brainstorming 阶段与用户确认）是"不要像其他输入框一样加橙色 accent 高亮"，不是"移除一切聚焦反馈"。移除浏览器默认 outline 会违反可访问性基本要求（键盘用户失去焦点可见性），项目规范也明确禁止 `outline: none` 且不提供替代方案。当前实现零自定义 accent ring、保留 UA 默认 outline，符合意图且不牺牲可访问性。按此裁定收敛，pending 清零。

## SUMMARY: result=pass | fail=0 | pending=0（AC-6 按解读 B 裁定收敛，理由见上）
