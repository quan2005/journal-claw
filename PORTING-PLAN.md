# lobe-ui 能力移植计划

从 `/Users/yanwu/Projects/github/lobe-ui` 移植优秀模式到谨迹。
按优先级排序，每项标注来源文件、适配要点、预估工作量。

---

## P0 — 立即可用，改动小，收益高

### 1. useEventCallback — 稳定回调引用

**来源**: `lobe-ui/src/hooks/useEventCallback.ts`（12 行）
**放置**: `src/hooks/useEventCallback.ts`
**原因**: 谨迹的 `useConversation`、`useJournal` 中大量 `useCallback` + 长 deps 数组，容易遗漏依赖。此 hook 用 ref 保证引用稳定，彻底消除问题。

**适配要点**:
- 直接复制，零修改
- 逐步替换现有 `useCallback`（仅限事件处理器，不替换传给 useEffect deps 的函数）

**工作量**: 0.5h 复制 + 2h 逐步替换

---

### 2. 模块级 Markdown 缓存

**来源**: `lobe-ui/src/hooks/useMarkdown/utils.ts` 的 `contentCache` Map + LRU 淘汰
**放置**: `src/components/MarkdownRenderer.tsx` 内部模块作用域
**原因**: 当前 `MarkdownRenderer` 每次 props 变化都重新 `marked.parse()`。日志内容写入后极少变化，切换回已看过的日志时完全可以命中缓存。

**适配要点**:
- 在 `MarkdownRenderer.tsx` 顶部添加模块级 `Map<string, string>`
- key = `content` 的 hash（短文本直接用内容，长文本用简单 hash）
- 最大 50 条，超限淘汰最旧 20%
- `DetailPanel` 的 `react-markdown` 渲染结果是 JSX 不适合缓存，保持现有 `useMemo` 即可

**工作量**: 1h

---

### 3. Freeze 组件 — 冻结非活跃内容

**来源**: `lobe-ui/src/Freeze/Freeze.tsx`（~80 行）
**放置**: `src/components/Freeze.tsx`
**原因**: `DetailPanel` 切换日志时 `setContent(null)` → spinner → 异步加载 → 渲染。用 Freeze 包裹可以保留上一篇的 DOM，切回时瞬间恢复。

**适配要点**:
- 直接复制 `Freeze.tsx`，去掉 `'use client'` 指令（谨迹不是 Next.js）
- 去掉 lobe-ui 的 `type` import，内联 `FreezeProps = { frozen: boolean; children: ReactNode }`
- 在 `DetailPanel` 中：维护一个最近 N 篇（建议 3）的缓存栈，每篇用 `<Freeze frozen={!isActive}>` 包裹
- 需要调整 `DetailPanel` 的加载逻辑：不再 `setContent(null)`，而是保留旧内容 + 预加载新内容

**工作量**: 2h（Freeze 本身 0.5h + DetailPanel 改造 1.5h）

---

## P1 — 收益显著，需要适配

### 4. rAF 流式文字平滑（useSmoothStreamContent）

**来源**: `lobe-ui/src/Markdown/SyntaxMarkdown/useSmoothStreamContent.ts`（~250 行）
**放置**: `src/hooks/useSmoothStream.ts`
**原因**: 谨迹的 `conversation-stream` 事件直接触发 React setState，文字到达节奏取决于 Rust 推送频率，容易一顿一顿。此 hook 在"到达"和"显示"之间加一层 rAF 缓冲，让文字匀速流动。

**适配要点**:
- 移除 `useStreamdownProfiler` 依赖（profiler 是 lobe-ui 内部的，谨迹不需要）
- 移除 `StreamSmoothingPreset` 类型 import，内联类型定义
- 保留三档预设（balanced / realtime / silky），默认 `balanced`
- 集成点：在 `useConversation.ts` 的 `text_delta` 处理中，不直接 setState 渲染文本，而是更新一个 ref；在渲染侧用 `useSmoothStreamContent(rawText)` 获取平滑后的文本
- 注意：谨迹已有 `MarkdownStreamBuffer`（安全边界缓冲），两者互补不冲突 — buffer 解决"不在 fence 中间断开"，smooth 解决"字符匀速释放"

**集成方案**:
```
Rust event → MarkdownStreamBuffer（安全边界）→ rawText ref
                                                    ↓
                              useSmoothStreamContent(rawText) → displayText → render
```

**工作量**: 3h（移植 1h + 集成 useConversation 2h）

---

### 5. 代码高亮模块级缓存

**来源**: `lobe-ui/src/hooks/useHighlight.ts` 的缓存模式（非整个 hook）
**放置**: `src/components/MarkdownRenderer.tsx` 的 highlight.js 调用处
**原因**: `MarkdownRenderer` 用 highlight.js 做语法高亮，每次渲染都重新高亮。对于相同代码块（如切换回已看过的会话），缓存可以跳过高亮计算。

**适配要点**:
- 不移植 shiki（太重，highlight.js 够用）
- 只借鉴缓存模式：模块级 `Map<string, string>`，key = `lang-contentHash`
- 最大 200 条，超限淘汰最旧 20%
- 在 `marked` 的 `renderer.code` 回调中查缓存

**工作量**: 1.5h

---

### 6. CSS 变量驱动的组件布局参数

**来源**: lobe-ui 的 `ChatItem` 用 `--chat-item-avatar-size` 等 CSS 变量传递布局参数
**放置**: `src/components/ConversationDialog.tsx` 及相关样式
**原因**: 谨迹的会话面板中，头像大小、气泡宽度等通过 inline style 或 props 层层传递。用 CSS 变量可以在容器层设置一次，子组件自动继承。

**适配要点**:
- 在 `globals.css` 中添加会话相关 CSS 变量：
  ```css
  :root {
    --conv-avatar-size: 28px;
    --conv-bubble-max-width: 85%;
    --conv-gap: 12px;
  }
  ```
- 子组件直接用 `var(--conv-avatar-size)` 而非 props
- 响应式调整只需在容器层改变量值

**工作量**: 1.5h

---

## P2 — 锦上添花，可后续迭代

### 7. useDelayedAnimated — 动画退出缓冲

**来源**: `lobe-ui/src/Markdown/components/useDelayedAnimated.ts`
**放置**: `src/hooks/useDelayedAnimated.ts`
**原因**: 当流式输出结束时（`animated: true → false`），如果立即切换，正在播放的 CSS 动画会被截断。延迟 1s 切换可以让动画自然完成。

**适配要点**:
- 极简 hook（~15 行），直接复制
- 配合 P1-4（流式平滑）使用：streaming 结束后延迟 1s 再切换到静态渲染模式

**工作量**: 0.5h

---

### 8. useTextOverflow — 溢出检测

**来源**: `lobe-ui/src/hooks/useTextOverflow.ts`
**放置**: `src/hooks/useTextOverflow.ts`
**原因**: 谨迹的 `JournalItem` 标题可能溢出，目前用 CSS `text-overflow: ellipsis` 截断但没有 tooltip。此 hook 用 ResizeObserver 检测是否真的溢出，只在溢出时显示 tooltip。

**适配要点**:
- 直接复制
- 在 `JournalItem` 的标题元素上使用，溢出时显示原生 `title` 属性

**工作量**: 1h

---

### 9. 流式性能 Profiler（开发工具）

**来源**: `lobe-ui/src/Markdown/streamProfiler/profiler.ts`
**放置**: `src/utils/streamProfiler.ts`（仅开发模式加载）
**原因**: 优化流式渲染时需要量化数据。此 profiler 采集 FPS、每帧耗时、积压字符数，比 Chrome DevTools 更聚焦。

**适配要点**:
- 简化版：只保留 FPS 采样 + 帧耗时记录
- 通过 `import.meta.env.DEV` 条件加载，生产构建 tree-shake 掉
- 在 `ConversationDialog` 的 streaming 路径上可选启用

**工作量**: 2h

---

### 10. 增量语法高亮（shiki-stream）

**来源**: `lobe-ui/src/hooks/useStreamHighlight.ts` + `shiki-stream` 库
**放置**: 替换 `MarkdownRenderer` 中流式场景的 highlight.js
**原因**: 流式代码块每次追加文本都全量重新高亮，代码越长越卡。`shiki-stream` 只处理增量部分。

**适配要点**:
- 需要新增依赖：`shiki`（~800KB，但 lazy import）+ `shiki-stream`
- 仅在流式场景使用，静态渲染保持 highlight.js（体积小、已够用）
- 需要改造 `MarkdownRenderer` 的 code block 渲染逻辑，区分 streaming vs static
- 这是最大的改动，建议在 P0/P1 完成后再做

**工作量**: 4h

---

## 实施顺序

```
Week 1:  P0-1 useEventCallback
         P0-2 Markdown 缓存
         P0-3 Freeze 组件
Week 2:  P1-4 rAF 流式平滑 ← 体感提升最大的一项
         P1-5 代码高亮缓存
         P1-6 CSS 变量布局
Week 3+: P2 按需迭代
```

## 依赖变更

无新 npm 依赖（P0 + P1 全部零依赖移植）。
P2-10 如果实施，需要 `shiki` + `shiki-stream`。

## 验证方式

每项移植后：
1. `npm run build` 通过
2. `npm test` 通过
3. `npm run tauri dev` 手动验证：
   - 流式输出是否更平滑（P1-4）
   - 切换日志是否更快（P0-2, P0-3）
   - 长会话是否卡顿减少（P1-5）
