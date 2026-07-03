# WS-2 分批任务书（opencode 并行，文件集互不相交）

公共上下文（每个任务附带）：
- 目标：删除 `apps/web/src/lib/tauri.ts` 兼容 shim 的引用。该文件保留旧 Tauri 函数名，仅委托 `apps/web/src/lib/runtimeClient.ts`（业务 command → daemon HTTP/SSE）与 `apps/web/src/lib/hostBridge.ts`（Electron preload 白名单能力）。
- 约束：只改 import 与调用点，**不改任何行为**；先读 tauri.ts 中对应函数的实现，将调用方改为直接使用其委托目标（runtimeClient 的方法 / hostBridge 的方法 / httpRuntimeClient 暴露的等价函数）；若某函数在 shim 里有非平凡逻辑（不只是转发），把该逻辑迁移到调用方或提炼到 runtimeClient 层，保持语义不变。
- 本批不删除 tauri.ts 本体（收尾批 B4 统一删）。
- 验收：批内文件不再出现 `lib/tauri` 引用；`pnpm --filter @journal/web typecheck` 与 `npx vitest run <本批相关测试>` 全绿；不得改动批外文件。

## B1 hooks 域（14 文件）
apps/web/src/hooks/useAgentEngine.ts, useAutomation.ts, useConversation.ts, useConversation.test.ts, useEventSync.ts, useIdentity.ts, useJournal.ts, useOnboarding.ts, usePinned.ts, useTheme.ts, useTodos.ts, useTopics.ts
apps/web/src/tests/useAgentEngine.test.tsx, useJournal.test.ts, useTopics.test.tsx

## B2 对话/内容组件域（17 文件）
apps/web/src/App.tsx, components/ChatPanel.tsx, UnifiedChatShell.tsx, HistoryFloatingButton.tsx, MarkdownRenderer.tsx, SessionList.tsx, DetailView.tsx, FileAttachments.tsx, AtMentionMenu.tsx
apps/web/src/tests/App.test.tsx, ChatPanel.test.tsx, UnifiedChatShell.test.tsx, HistoryFloatingButton.test.tsx, MarkdownRenderer.test.tsx, DetailView.test.tsx, AtMentionMenu.test.tsx, SessionList（如有测试）

## B3 树/工作台/设置域（24 文件）
components/TreeSidebar.tsx, TreeItem.tsx, TreeContextMenu.tsx, TopicTree.tsx, TodoSidebar.tsx, JournalContextMenu.tsx, MergeIdentityDialog.tsx, IdeasWorkbench.tsx, SkillsWorkbench.tsx, SoulView.tsx, WorkspaceView.tsx, OnboardingView.tsx
settings/components/SectionAbout.tsx, SectionAiEngine.tsx, SectionGeneral.tsx, SectionLocalAgents.tsx, SectionPermissions.tsx
tests/TreeSidebar.test.tsx, TopicTree.test.tsx, IdeasWorkbench.test.tsx, SkillsWorkbench.test.tsx, SoulView.test.tsx, WorkspaceView.test.tsx, SectionAiEngine.test.tsx, SectionGeneral.test.tsx, SectionLocalAgents.test.tsx

## B4 收尾（依赖 B1-B3 全部验收通过）
- 删除 apps/web/src/lib/tauri.ts、tests/tauri.test.ts；ipc-contract.test.ts 改为直接针对 runtimeClient/hostBridge 的契约测试（保留覆盖语义）。
- 全仓 grep `lib/tauri`、`tauri` 残余（文档由 WS-1 处理，代码归本批）。
- 死代码清理：核对 docs 引用实体，删除已下线能力残余。
- `pnpm -r test` + `pnpm build` + lint 全绿。

## WS-3 护栏（依赖 B4）
见 design.md WS-3 节。
