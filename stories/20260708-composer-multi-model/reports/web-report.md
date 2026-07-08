# Web-side implementation report — composer-multi-model

Story: `STORY-20260708-composer-multi-model` (改动 3/4/5 — web 侧输入框重设计 + 持久化选择 + 发送透传)。

## 改动文件

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `apps/web/src/hooks/useComposerSelection.ts` | 新增 | mount 读 daemon settings，切换立即持久化的 hook（仿 `useTreeSort`）。导出 `ThinkingLevel`/`ComposerSelection` 类型。 |
| `apps/web/src/tests/useComposerSelection.test.tsx` | 新增 | 同构测试：mount 加载、失败回退 null/medium、setProviderId/setThinkingLevel 立即持久化。 |
| `apps/web/src/components/ChatPanel.tsx` | 修改 | 删除死 prop `composerExtras`（接口/解构/渲染/注释）；工具条插入模型 pill + 思考等级 pill；新增 `get_engine_config` 加载、点击外部关闭菜单、`THINKING_LEVEL_LABELS`/`groupProvidersByProtocol` 模块级辅助。 |
| `apps/web/src/hooks/useConversation.ts` | 修改 | `conversationSend` 签名扩展 `composerSelection?`；`send()` 与 pending-queue flush 两处调用前读一次 `get_composer_selection` 拿最新持久化值并透传。 |
| `apps/web/src/lib/httpRuntimeClient.ts` | 修改 | 新增 `get_composer_selection`/`set_composer_selection` case（读写 daemon settings 的 `composer_selected_provider_id`/`composer_thinking_level`）；`conversation_send` body 增加 `providerId`/`thinkingLevel`。 |
| `apps/web/src/tests/UnifiedChatShell.test.tsx` | 修改 | mock 的 `invoke` 默认返回 `Promise.resolve({})`，适配 ChatPanel mount 时新增的 `get_composer_selection`/`get_engine_config` 调用。 |

未触碰 `apps/daemon/*`（daemon 侧由并行任务负责）。

## 验收点对照

- **AC-2 输入框内切换模型**：模型 pill 点击展开按 protocol 分组的下拉（`groupProvidersByProtocol`），选中后 pill 立即显示新模型（纯前端 state）。✅
- **AC-4 默认模型 = 上次选择**：`useComposerSelection` mount 读 daemon settings（`composer_selected_provider_id`），`setProviderId` 立即写回。✅
- **AC-5 输入框整体重设计**：外层单层边框、底部工具条内联模型 pill + 思考等级 pill + 发送键；颜色仅模型指示圆点/选中态走 `--record-btn`，其余走中性 token。✅
- **AC-6 思考等级切换**：思考 pill 三档（低/中/高 → low/medium/high），同一 `useComposerSelection` 持久化路径。✅
- **AC-3 切换后下一条立即生效**：`send()` 在调 `conversationSend` 前读 `get_composer_selection`，把 `providerId`/`thinkingLevel` 透传到 `POST /conversation/send` body（由 daemon 侧 `applyComposerSelection` 在 runAgent 前应用）。✅

## useConversation.ts 实际发送改动细节（提示词要求确认）

提示词只给了大致方向，读实际代码后确认如下：

1. `conversationSend` 原签名 `(sessionId, message, images?)` → 扩展为 `(sessionId, message, images?, composerSelection?: { providerId?: string | null; thinkingLevel?: 'low'|'medium'|'high' })`，内部 invoke 传 `providerId: composerSelection?.providerId ?? null` 与 `thinkingLevel: composerSelection?.thinkingLevel ?? null`。
2. **主发送路径**（`send` 函数，原 `await conversationSend(realSid, text, images)`）：改为先 `await selectRuntimeClient().invoke('get_composer_selection').catch(() => ({providerId:null, thinkingLevel:'medium'}))` 拿最新持久化值，再带进 `conversationSend`。这里用 `await` 合法（`send` 是 `useEventCallback(async ...)`）。
3. **pending-queue flush 路径**（`done` 事件 case 内）：该 case 所在的 subscribe 回调**不是 async 函数**，不能直接 `await`。改写成 `.invoke().catch().then(selection => conversationSend(...)).catch(...)` 链式调用，避免引入 `await`（首次实现用 `await` 触发 TS1308，已修正）。
4. **读取策略**：两个发送点都不依赖 React 组件树里 `useComposerSelection()` 的 state（可能陈旧），而是在发送瞬间重新调一次 `get_composer_selection` 拿 daemon 端最新值——这与 design.md 的"持久化即真实状态"语义一致。

## 遇到的问题与修复

1. **TS2345（useComposerSelection.ts）**：`invoke<void>('set_composer_selection', selection)` 的 `ComposerSelection` 对象缺索引签名，不能赋给 `Record<string, unknown>`。修复：在 `setComposerSelectionRemote` 内显式构造 `{ providerId, thinkingLevel }` 对象字面量传入。
2. **TS1308（useConversation.ts queue flush）**：`done` 事件 case 非 async，`await` 非法。修复：改写为 `.then()` 链。
3. **UnifiedChatShell.test.tsx 2 failed**：该测试真实渲染 ChatPanel（不 mock 组件），mock 的 `invoke` 是裸 `vi.fn()` 返回 `undefined`。ChatPanel mount 时新增的 `get_composer_selection`/`get_engine_config` 调用对 `undefined` 取 `.then()` 抛 TypeError。修复：mock 默认 `mockResolvedValue({})`。
4. **点击外部关闭与 pill 自身 toggle 的冲突**：pill 按钮 `onClick` 加 `e.stopPropagation()`，下拉菜单容器 `onClick` 也加 `e.stopPropagation()`，防止全局 `click` 监听器在点菜单内部时误关闭；全局监听器只对页面其余区域生效。

## 测试命令完整输出

### `bunx vitest run`（apps/web）

```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web


 Test Files  55 passed (55)
      Tests  391 passed (391)
   Start at  23:20:00
   Duration  74.46s (transform 3.45s, setup 15.54s, import 7.96s, tests 42.53s, environment 67.60s)
```

含新增 `useComposerSelection.test.tsx`（4 用例：mount 加载 / 失败回退 / setProviderId 持久化 / setThinkingLevel 持久化）。

### `bunx tsc --noEmit`（apps/web）

```
EXIT=0 (no errors)
```

### `bunx eslint "src/**/*.{ts,tsx}"`（apps/web）

```
✖ 9 problems (0 errors, 9 warnings)
```

9 个 warning 均为 pre-existing，分布于 `App.tsx`/`AgentRunPanel.tsx`/`IdeasWorkbench.tsx`/`TodoSidebar.tsx`/`useAgentRun.ts`，与本任务改动文件无关；本任务新增/修改的文件零 warning 零 error。

SUMMARY: result=pass | steps_done=5/5
