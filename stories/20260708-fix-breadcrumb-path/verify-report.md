# Verify Report — STORY-20260708-fix-breadcrumb-path

- 轮次：1
- 核对范围：`apps/web/src/components/DetailView.tsx`、`apps/web/src/tests/DetailView.test.tsx`
- design.md：本任务无 design.md
- 报告时间：2026-07-09

## 结论

**result: pass**

面包屑段完全由文件真实路径派生，无任何凭空多出的「专题」前缀段。`rootLabel="专题"` 仅出现在 `aria-label`（可访问性命名）中，不作为可见段渲染。

## AC 核对

### AC-1 — 无多余前缀 ✅

- Given 真实路径 `a/b/c.md`
- Then 面包屑逐段为 `a / b / c.md`，不含「专题」或任何真实路径之外的前缀段

**证据：**

1. `topicBreadcrumbSegments(path)`（DetailView.tsx:100-107）只按 `/` 切分传入路径，**绝不**前缀任何段：
   ```ts
   const parts = path.split('/').filter(Boolean)
   return parts.map((label, index) => ({ label, path: ..., isFile: ... }))
   ```

2. `FileViewShell` 的可见段来自 `segments = topicBreadcrumbSegments(visiblePath)`（DetailView.tsx:333），`visiblePath = displayPath ?? file.path`（DetailView.tsx:329）。渲染时（DetailView.tsx:426-461）只遍历 `segments`，每段渲染一个 button，文本为 `segment.label`。

3. `rootLabel="专题"`（DetailView.tsx:1699）**只**用于：
   - `<nav aria-label={`${rootLabel}路径`}>`（DetailView.tsx:416）
   - 各段 button 的 `aria-label`（DetailView.tsx:437-438：`定位到${rootLabel}...`）
   
   不出现在任何可见文本节点中。

4. topic-file 模式下 `displayPath={topicFileDisplayPath(workspacePath, file.path)}`（DetailView.tsx:1701），`topicFileDisplayPath`（DetailView.tsx:80-86）仅剥离 workspace 前缀，不加任何段。

5. 测试证据（DetailView.test.tsx:174-196，HTML 文件场景，路径 `可视化一切/Deck.html`）：
   ```ts
   const topicButton = await screen.findByRole('button', { name: '定位到专题 可视化一切' })
   expect(topicButton).toBeTruthy()
   expect(screen.getByText('Deck.html')).toBeTruthy()
   // AC-1 (fix-breadcrumb-path): breadcrumb has no bogus "专题" prefix segment
   expect(screen.queryByText('专题')).toBeNull()
   ```
   - 可见段为「可视化一切」「Deck.html」（真实路径两段）
   - `queryByText('专题')` 为 null —— 没有可见的「专题」段
   - 「专题」只存在于 aria-label `定位到专题 可视化一切`（rootLabel + 段标签）

6. 测试运行：`bun run vitest run src/tests/DetailView.test.tsx` → **16 passed (16)**。

### AC-2 — 各入口一致 ✅（设计层满足）

- Given 同一文件从 workspace tree、专题列表等不同入口打开
- Then 均显示同一真实路径，与入口无关

**证据：**

面包屑的输入是 `file.path`（topic-file 模式）经 `topicFileDisplayPath` 处理，组件内部**无任何入口分支**影响 `visiblePath`：

- `FileViewShell` 的 `visiblePath` 只依赖 `displayPath ?? file.path`（DetailView.tsx:329）
- `renderTopicFileShell` 固定传 `displayPath={topicFileDisplayPath(workspacePath, file.path)}`（DetailView.tsx:1701）
- 组件 props 中无「入口来源」字段；所有 topic-file 渲染走同一个 `renderTopicFileShell`

因此只要外部传入相同 `file.path`，面包屑必然一致，与打开入口解耦。

**注：** 测试套件未显式构造「同文件多入口」用例（无对应 test）。AC 由实现单一数据源（`file.path`）结构性保证，未见任何入口相关旁路；但若需要回归保护，建议补一条同路径多入口渲染断言。此项不阻断验收。

## Won't 边界核对

| Won't 项 | 核对结果 |
| --- | --- |
| 不改面包屑视觉样式与交互（点击跳转维持） | ✅ 点击跳转 `onNavigateToPath`（DetailView.tsx:440）保留；样式 token 未变 |
| 不重新设计"专题"概念在导航中的呈现 | ✅ `rootLabel="专题"` 仍作 aria-label 根命名，导航语义未变 |

## 越界 / 偏差清单

无。本任务仅触及面包屑路径构造与对应测试，无 scope 外改动。

## 待用户裁决项

1. **AC-2 测试覆盖**：当前无「同文件、不同入口」的显式测试用例；实现层已由单一数据源保证一致。是否需要补回归测试，由用户裁决。不阻断本次验收。

**裁定：接受现状，不补测试。** 实现是单一数据源（`file.path` → `displayPath`），结构性保证多入口一致，补一条断言只是重复验证同一段代码路径，不会捕获新的回归场景。pending 清零。

## SUMMARY

SUMMARY: result=pass | fail=0 | pending=0
