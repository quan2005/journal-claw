---
story: ./story.md
design: ./design.md
date: 2026-07-30
round: 1
result: pass
scope: 'git diff 3f570813655d9ee71302da2537f3445ddae1e891；完整未提交 diff 及涉及的实现、测试与保留链路'
---

# 验收报告 — 精简工作区空态与面板分隔控件

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | ✅ pass | `apps/web/src/App.tsx:1079-1138` 保留左 panel/divider，`apps/web/src/App.tsx:1200-1230` 保留右 divider/panel；目标按钮、chevron 与按钮样式生产代码扫描为 0。`apps/web/src/tests/App.test.tsx:300-317` 断言两个 divider、两个 panel 均存在，四种折叠/展开按钮均不存在。Playwright 真实 Vite 渲染（1280px、daemon API 只读 mock）取得 `leftDivider/rightDivider/leftPanel/rightPanel=true`、目标折叠/展开 aria-label 列表 `[]`，左右 divider 计算样式均为 `cursor: col-resize`。                                                                                                                                                                                                                                                                                        |
| AC-2 | ✅ pass | `apps/web/src/components/DetailView.tsx:1415-1419` 仅在 journal 为空且有示例回调时启用示例区，非空未选中态不会进入含标题的 `apps/web/src/components/DetailView.tsx:1455-1555`；生产代码中的“粘贴 / 拖文件”扫描为 0。`apps/web/src/tests/DetailView.test.tsx:74-85` 覆盖非空未选中态，断言粘贴卡片与孤立标题均不存在。Playwright 以一条日志渲染时得到 `pasteCard=false`、`orphanHeading=false`。                                                                                                                                                                                                                                                                                                                                                                       |
| AC-3 | ✅ pass | `apps/web/src/components/DetailView.tsx:1416-1419` 精确限定空 journal，`apps/web/src/components/DetailView.tsx:1456-1553` 保留标题、可点击示例按钮及文案；`apps/web/src/App.tsx:731-741,1182` 仍注入真实 `handleSelectSample`。`apps/web/src/tests/DetailView.test.tsx:87-106` 断言无粘贴卡片并点击示例入口，回调恰好调用一次。Playwright 空 journal 真实渲染可见“创建示例条目”且无粘贴卡片，点击后请求记录出现 `POST /journal/sample => 200 OK`。                                                                                                                                                                                                                                                                                                                    |
| AC-4 | ✅ pass | `apps/web/src/components/WorkspaceView.tsx:703-725` 以“无消息、无队列、非 streaming”为空态条件并精确渲染“您的谨迹”；生产代码旧文案扫描为 0。`apps/web/src/tests/WorkspaceView.test.tsx:81-87` 同时断言新文案存在、旧文案不存在。Playwright 真实渲染取得 `greeting="您的谨迹"`、`legacyGreeting=false`。                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| AC-5 | ✅ pass | 快捷键与业务唤起仍在 `apps/web/src/App.tsx:481-542,723-730,749-763,1116-1119`；host drop → import/enqueue 链仍在 `apps/web/src/App.tsx:567-622`；左右 resize handler 在 `apps/web/src/App.tsx:231-322`，绑定点在 `apps/web/src/App.tsx:1128-1137,1202-1213`。`apps/web/src/tests/App.test.tsx:792-810` 覆盖 `Cmd+T` 关/开，`apps/web/src/tests/hostBridge.test.ts:49-82` 覆盖 native file-drop adapter，`apps/web/src/tests/ipc-contract.test.ts:231-235,492-505` 覆盖 import/enqueue HTTP 契约。Playwright 实测 `Meta+T` 令右 panel `320px → 0px（aria-hidden=true）→ 320px（aria-hidden=false）`；拖动后左 panel `320px → 357px`、右 panel `320px → 363px`。真实 OS native drop 未在本轮注入文件；该子链以基线零 diff、hostBridge/ipc 契约测试和 App 保留链路取证。 |

上述定向回归命令：

- `cd apps/web && bunx vitest run src/tests/App.test.tsx src/tests/DetailView.test.tsx src/tests/WorkspaceView.test.tsx src/tests/hostBridge.test.ts`：4 个文件、49 个测试通过。
- `cd apps/web && bunx vitest run`：55 个文件、397 个测试通过。

未发现 AC 使用 TODO、stub、placeholder 或本次新增静默降级；五条 AC 均有生产实现及测试/真实渲染证据。

## 范围完整性（不少，对照 story.md 范围）

- ✅ 三个目标可见入口从真实 DOM 删除：两个 divider 按钮由 `apps/web/src/App.tsx:1126-1138,1200-1213` 的空 divider 节点取代；粘贴卡片及其 `onOpenDock` 消费链从生产代码完全删除。
- ✅ 非空工作区保留水印且无孤立标题：`apps/web/src/components/DetailView.tsx:1415-1453`。
- ✅ 空工作区保留可用示例入口：`apps/web/src/components/DetailView.tsx:1455-1555`；Playwright 点击触发 `/journal/sample`。
- ✅ 空会话产品称谓唯一且条件未扩张：`apps/web/src/components/WorkspaceView.tsx:703-725`。
- ✅ 面板快捷键、业务唤起、响应式自动收起、宽度状态/持久化、divider resize、host file-drop 和 import/enqueue 均保留：`apps/web/src/App.tsx:168-196,231-322,481-622,723-763`。

因此 story 中 AC 未显式重复的兼容性、可靠性和三栏体验范围均有对应实现。

## 方案落实（不偏，对照 design.md）

- ✅ 采用 design A 的 DOM 删除而非 CSS 隐藏：生产 DOM 无目标按钮/卡片，也没有新增隐藏样式或可聚焦残留。
- ✅ `ChevronLeft`、`ChevronRight`、`sidebarToggleStyle` 与 `PANEL_TOGGLE_TOP` 已随 divider 按钮删除；`onOpenDock` 从 `DetailViewProps`、组件解构与 App 调用处删除，只有测试通过 legacy 类型强转验证旧 prop 也不会恢复 UI。
- ✅ `openChatPanel`、面板状态、断点、resize、持久化与 host file-drop 链均未被本次 diff 修改；`git diff --exit-code 3f570813655d9ee71302da2537f3445ddae1e891 -- apps/web/src/lib/hostBridge.ts apps/desktop packages/contracts apps/daemon` 返回 0。
- ✅ 不新增数据流、网络、依赖或异常分支；diff 只涉及三个目标生产组件、三个对应测试与 story 流程元数据。
- ✅ `cd apps/web && bun run typecheck` 返回 0；`bun run lint` 返回 0（0 errors、9 个既有 warnings）；本次六个 TS/TSX 变更文件的定向 Prettier 检查全部通过；`git diff --check 3f570813655d9ee71302da2537f3445ddae1e891` 返回 0。
- ⚠️ 技术门证据边界：`cd apps/web && bun run format:check` 因 10 个本次范围外文件返回 1，本次变更文件定向检查通过；`bun run build` 会写构建产物，与本轮“除报告外不得写文件”的约束冲突，未执行，改以 `tsc --noEmit` 取编译证据。两项不改变本报告的需求符合度结论，但不是“全仓硬门全绿”的声明。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ `apps/web/src/App.tsx` 的功能性 diff 仅删除目标 divider 按钮、相应图标/样式、只服务粘贴卡片的 `handleOpenChat` 与 `DetailView.onOpenDock` 传参。
- ✅ `apps/web/src/components/DetailView.tsx` 的功能性 diff 仅删除粘贴卡片并把示例入口收窄为空 journal；两个额外 diff 块只是 Prettier 折行。
- ✅ `apps/web/src/components/WorkspaceView.tsx` 的功能性 diff 仅替换 greeting；import 折行为等价格式化。
- ✅ 三个测试文件的功能性 diff 均对应 AC；`stories/20260730-ui-surface-cleanup/story.md` 仅含 `approved → in_progress` 流程状态与表格对齐。
- ✅ 未删除文件树展开/折叠、设置页返回、标题栏或聊天工具栏按钮；未触碰 daemon、Electron preload、hostBridge、协议、三栏宽度/token/断点或依赖。
- ℹ️ `apps/web/src/locales/zh.ts:61-64` 与 `apps/web/src/locales/en.ts:59-62` 仍保留已无生产消费者的 divider 按钮翻译键。它们不产生行为、不命中非目标，属于非阻断清洁项。

未发现无法归属 AC、design 范围或必要等价格式化的功能性改动。

## 冗余（不重，对照 story.md）

- ✅ 左右 divider 各一处，journal 示例入口一处，空会话 greeting 一处；无第二套并行 DOM/CSS 隐藏实现。
- ✅ 多条对话区唤起路径是 AC-5 明确要求保留的不同业务入口，不是同一 AC 的冗余实现。
- ✅ 测试中的 legacy `onOpenDock` 类型强转只用于反向证明旧 prop 不再产生卡片，不进入生产接口或运行逻辑。

## 结论

六项标准全部通过：不漏、不重、不偏、不倚、不多、不少均为 pass。实现与 story 用户意图、design 采用方案一致，未发现阻断偏差。

`result: pass`。Fail 项 0，待用户裁决项 0。

## 待用户裁决

无。
