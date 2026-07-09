result: fail

# STORY-20260708-composer-multi-model R5 复验报告

验收基准：
- 本轮只复核用户点名的真实渲染树问题：`App.tsx` 实际渲染的右侧 Agent 输入框是否已经补齐模型 pill / 思考等级 pill。
- 不重复核对 AC-1 schema / 迁移；r2 已覆盖且本轮未改动该部分。
- 本轮由 codex 汇总裁决；按仓库 AGENTS 要求并行派发两个 `kimi -p` 只读子智能体做交叉核验，最终结论仍以本报告为准。

## AC-2 — 输入框内切换模型

结论：pass

真实渲染链取证：
- `App.tsx` 从 `WorkspaceView.tsx` 导入 `WorkspaceChatShell`：`apps/web/src/App.tsx:81`。
- `RightPanel` 只是渲染传入的 `chatContent`：`apps/web/src/components/RightPanel.tsx:8-30`。
- `App.tsx` 实际传入的 `chatContent` 是 `<WorkspaceChatShell ... onSend={send} ... />`：`apps/web/src/App.tsx:1300-1320`。
- `rg -n "UnifiedChatShell|ChatPanel|<WorkspaceChatShell|chatContent=|WorkspaceChatShell" apps/web/src -g '*.tsx'` 显示 `App.tsx` 主树只挂载 `WorkspaceChatShell`；`UnifiedChatShell` / `ChatPanel` 仅被测试、`UnifiedChatShell` 自身或注释引用，未在 `App.tsx` 主渲染树挂载。

模型 pill 取证：
- `WorkspaceChatShell` 读取 `get_engine_config` 并接入 `useComposerSelection()`：`apps/web/src/components/WorkspaceView.tsx:592-602`。
- 同一状态 `openPillMenu: 'model' | 'effort' | null` 控制两个菜单，打开一个会关闭另一个：`apps/web/src/components/WorkspaceView.tsx:595`、`apps/web/src/components/WorkspaceView.tsx:779-782`、`apps/web/src/components/WorkspaceView.tsx:862-865`。
- 页面其他位置点击关闭当前 pill 菜单：`apps/web/src/components/WorkspaceView.tsx:604-609`。
- 模型 pill 位于真实 toolbar 左侧、附件按钮之后：`apps/web/src/components/WorkspaceView.tsx:765-856`。
- pill 文案通过 `activePillModelId(engineConfig, providerId, modelId)` 显示当前模型：`apps/web/src/components/WorkspaceView.tsx:794-799`。
- 菜单按 `groupProvidersByLabel(engineConfig.providers)` 分组，并用 `entry.models.map((model) => ({ entry, model }))` 展开同一凭证下多个模型：`apps/web/src/components/WorkspaceView.tsx:807-815`。
- 点击模型项调用 `setSelection(entry.id, model)`，即同时写入 provider id 与 model id：`apps/web/src/components/WorkspaceView.tsx:820-828`；`useComposerSelection.setSelection` 会调用 `set_composer_selection` 持久化三元组：`apps/web/src/hooks/useComposerSelection.ts:55-63`。
- “管理模型…”会派发 `open-settings-section` 到 AI 设置页：`apps/web/src/components/WorkspaceView.tsx:841-852`；`App.tsx` 监听该事件并切到 settings：`apps/web/src/App.tsx:474-479`。

## AC-6 — 思考等级切换

结论：pass

证据：
- 思考等级 pill 同样挂在真实 `WorkspaceChatShell` toolbar 左侧：`apps/web/src/components/WorkspaceView.tsx:857-895`。
- pill 显示 `THINKING_LEVEL_LABELS[thinkingLevel]`：`apps/web/src/components/WorkspaceView.tsx:867`。
- 菜单列出 `low | medium | high` 三档，选中项显示 `✓`，点击调用 `setThinkingLevel(level)` 并关闭菜单：`apps/web/src/components/WorkspaceView.tsx:875-889`。
- `useComposerSelection.setThinkingLevel` 会乐观更新本地状态，并用当前 `providerId` / `modelId` 一并写入 daemon settings：`apps/web/src/hooks/useComposerSelection.ts:65-68`。

## AC-3 — 切换后下一条消息立即生效

结论：pass

发送链路取证：
- `WorkspaceChatShell.handleSend` 仍只调用 `onSend(text)`，没有传入模型参数：`apps/web/src/components/WorkspaceView.tsx:669-674`。这验证了发送链路不依赖调用方组件 plumbing。
- `App.tsx` 把 `useConversation.send` 作为 `onSend` 传给真实 `WorkspaceChatShell`：`apps/web/src/App.tsx:1302-1311`。
- `useConversation.send` 在真正 `conversationSend` 前读取 daemon 持久化的 `get_composer_selection`：`apps/web/src/hooks/useConversation.ts:978-989`。
- 读取结果被传给 `conversationSend(realSid, text, images, { providerId, modelId, thinkingLevel })`：`apps/web/src/hooks/useConversation.ts:990-994`。
- `conversationSend` wrapper 把三字段写进 `conversation_send` payload：`apps/web/src/hooks/useConversation.ts:14-31`。
- HTTP runtime 继续把三字段 POST 到 daemon：`apps/web/src/lib/httpRuntimeClient.ts:674-684`。
- daemon `/conversation/send` 将 body 中的三字段组成 `composerSelection` 并传给 `conversationService().send(...)`：`apps/daemon/src/server.ts:1454-1474`。
- `ConversationService.send` 在 `runAgent(... prompt ...)` 前执行 `applyComposerSelection(session, composerSelection)`：`apps/daemon/src/conversation/service.ts:254-256`。
- `applyComposerSelection` 按 `(providerId, modelId)` 解析模型并设置 `session.agent.state.model`，同时设置 `session.agent.state.thinkingLevel`：`apps/daemon/src/conversation/service.ts:269-288`。
- pending queue flush 也读取 `get_composer_selection` 后再调用 `conversationSend`：`apps/web/src/hooks/useConversation.ts:454-471`。

## AC-5 — 输入框整体重设计 / token 合规

结论：fail（低风险 CSS token 偏差）

通过项：
- 新增 `.workspace-chat__pill*` 主体规则基本消费结构化 token：`--divider`、`--radius-pill`、`--detail-case-bg`、`--item-text`、`--record-btn`、`--item-meta`、`--item-hover-bg`、`--bg`、`--border-menu`、`--radius-lg`、`--shadow-overlay`、`--radius-sm`、`--item-selected-bg`、`--divider`：`apps/web/src/styles/workspace.css:542-664`。
- DESIGN 明确要求圆角、浮层阴影、菜单边框、聚焦环消费结构化 token：`docs/DESIGN.md:183-186`、`docs/DESIGN.md:248-249`。
- 本轮新增 pill 规则未引入硬编码颜色值，也未引入硬编码 `:focus-visible` 聚焦环浓度。

偏差：
- `.workspace-chat__pill-dot` 使用 `border-radius: 50%`：`apps/web/src/styles/workspace.css:568-572`。严格按 DESIGN “圆角强制消费结构化 token”口径，应改为 `var(--radius-pill)`。
- `.workspace-chat__pill-menu-group` / `.workspace-chat__pill-menu-item` / `.workspace-chat__pill-menu-manage` 存在硬编码字号 `10px` / `12px`：`apps/web/src/styles/workspace.css:607`、`apps/web/src/styles/workspace.css:625`、`apps/web/src/styles/workspace.css:658`。本轮任务主要问圆角/颜色/聚焦环，字号不计入 fail 数，但建议一并收敛到字体 token。

## 构建物 / dev 进程一致性

结论：未发现需怀疑陈旧构建缓存的证据。

说明：
- 本轮仅做静态真实渲染链取证与 web 测试 / typecheck，未启动或检查现有 dev server。
- `App.tsx` 当前源码主树直接挂载 `WorkspaceChatShell`，不存在“只改未挂载 `ChatPanel`”的源码层盲区。

## 运行验证

```text
cd apps/web && bunx vitest run
Test Files  55 passed (55)
Tests       394 passed (394)
exit code 0
```

```text
cd apps/web && bunx tsc --noEmit
exit code 0
```

## 越界偏差

- 功能层面未发现越界：本轮移植没有新建第三套模型选择状态，`WorkspaceChatShell` 复用 `useComposerSelection` 与 `composerPills.ts`，发送链仍由 `useConversation.send` 统一读取 daemon selection。
- 维护风险：`ChatPanel.tsx` / `UnifiedChatShell.tsx` 仍保留一套未在 `App.tsx` 主树挂载的 composer 实现和测试。短期不影响用户真实 UI；长期如果继续维护两套 composer，容易再次出现“测试通过但真实 UI 未生效”的盲区。
- `WorkspaceChatShell` 未使用 `useComposerSelection.loading`，daemon selection 返回前会短暂显示默认 `medium` / active provider fallback。当前有默认值且不会空白，判定为低风险。

## 待裁决

- 是否接受本轮低风险 CSS token 偏差（`.workspace-chat__pill-dot { border-radius: 50%; }`）先不阻塞真实入口修复？若严格执行 DESIGN token，本轮应返修该一行后再复验。

SUMMARY: result=fail | fail=1 | pending=1
