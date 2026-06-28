# DEV-NOTES — P2 统一对话面 + 顶栏引擎切换

Story: `stories/20260628-unified-chat-engine-switch/spec.md`（status: approved）
执行版本：**完整版 / 深度融合执行面**（AC-6）

复刻 open-design 的 `InlineModelSwitcher` + `ChatPane` 交互，落到谨迹设计系统：
删掉右栏 Chat / Agent Run 两个 tab → 一个统一对话面；顶栏常驻引擎切换 chip；
内置 pi ↔ 外部 CLI agent 在同一面内切换并连续渲染，Agent Run 的目标/授权/timeline/
改动集全部内联。

---

## 1. 改动文件清单

### 新增
| 文件 | 作用 |
|---|---|
| `apps/web/src/components/EngineSwitcher.tsx` | 顶栏引擎/agent chip + popover（仿 InlineModelSwitcher，控制型组件） |
| `apps/web/src/components/UnifiedChatShell.tsx` | 统一对话面外壳：顶栏 chip + 按引擎路由 ChatPanel / AgentRunPanel |
| `apps/web/src/hooks/useAgentEngine.ts` | 引擎选择状态：daemon 加载 / 持久化（仿 useTheme，不用 localStorage） |
| `apps/web/src/styles/engine-switcher.css` | chip/popover 样式，全部走结构化 token |
| `apps/web/src/tests/EngineSwitcher.test.tsx` | 引擎切换 / agent 列表 / 不可用灰显+诊断 |
| `apps/web/src/tests/UnifiedChatShell.test.tsx` | 路由分流 / 授权内联 / 改动集内联 / engine+agentId 入参 |
| `apps/web/src/tests/useAgentEngine.test.tsx` | 持久化往返 / 离线回退 |

### 修改
| 文件 | 改动 |
|---|---|
| `apps/web/src/App.tsx` | 删除 Chat/Agent Run tab toggle（原 1235-1296），改为渲染 `<UnifiedChatShell>`；移除 `rightPanelMode` 解构；懒加载改为 UnifiedChatShell |
| `apps/web/src/components/AgentRunPanel.tsx` | 新增可选 props `{ engine?: RunEngine; agentId?: string\|null }`，透传进 `start()`；meta 行显示真实 agentId（不再硬编码 claude） |
| `apps/web/src/contexts/UIContext.tsx` | 移除已无用的 `rightPanelMode` / `setRightPanelMode`（grep 确认仅 App.tsx 使用） |
| `apps/web/src/lib/agentRuns.ts` | `CreateRunInput` 增加 `engine?: RunEngine`；`createRun` body 携带 `engine`（daemon 早已支持） |
| `apps/web/src/lib/httpRuntimeClient.ts` | `WorkspaceSettings` 增 `agent_engine?/agent_id?`；新增 `get_agent_engine`/`set_agent_engine` invoke 分支（部分 patch，互不覆盖） |
| `apps/web/src/lib/tauri.ts` | 新增 `getAgentEngine` / `setAgentEngine` 包装（runtimeClient → daemon /settings） |
| `apps/web/src/locales/zh.ts` + `en.ts` | 新增 `engineSwitcher*` 共 11 个 key（双语对齐，零英文 hardcode） |
| `apps/web/src/types/agentRun.ts` | 新增 `RunEngine = 'builtin' \| 'cli'` |
| `apps/web/src/tests/App.test.tsx` | 重写原 tab toggle 两个用例 → 引擎 chip + 内联 Agent Run；补 tauri/localAgents mock |
| `apps/daemon/src/settings/service.test.ts` | 新增 `agent_engine`/`agent_id` 持久化用例（AC-2 daemon 侧证据） |

---

## 2. AC 逐条满足

- **AC-1（删 tab，统一面）** — `App.tsx` 移除两按钮 toggle 与条件分支；`UnifiedChatShell` 是唯一右栏内容。`App.test.tsx` 断言不再有 `Chat`/`Agent Run` 按钮、`engine-switcher-chip` 存在、默认 builtin 时无 goal 表单。`UnifiedChatShell.test.tsx`「routing」用例覆盖 builtin↔cli 切换渲染。

- **AC-2（顶栏引擎 chip）** — `EngineSwitcher` 常驻于 shell 顶栏，单行显示「引擎模式 · 引擎/agent 名」；popover 内分段切换 builtin↔cli；cli 时仅列 `GET /agents` 检测项，不可用 agent 禁用并内联 `AgentDiagnosticRow`（复用 P1）。持久化经 `useAgentEngine → tauri → httpRuntimeClient → daemon PUT /settings`（`agent_engine`/`agent_id` 两 key，部分 patch 互不覆盖），不用 localStorage。daemon 侧持久化有 `settings/service.test.ts` 用例。

- **AC-3（路由正确）** — builtin → `<ChatPanel>`（useConversation → /conversation）；cli → `<AgentRunPanel engine="cli" agentId>`（useAgentRun → POST /runs，body 含 `engine:'cli'`+选中 agentId）。`UnifiedChatShell.test.tsx`「routing + changeset inline」断言 `createRun` 入参为 `{ engine:'cli', agentId:'codex', authorizationMode }`。

- **AC-4（授权内联）** — AgentRunPanel 的授权 `<select>`（read_only/workspace_write/full_access/wide_with_audit，复用 `AUTHORIZATION_MODES` + `agentRunMode*` i18n）在 cli 路径内联；`UnifiedChatShell.test.tsx`「inline authorization」断言 cli 时「工作区可写」「宽松（带审计）」出现、builtin 时不存在（pi 无授权概念）。

- **AC-5（不回退/绿）** — 见下「测试结果」。

- **AC-6（深度融合·完整版）** — AgentRunPanel 的目标输入、授权、执行 timeline、改动集/diff 全部在 `UnifiedChatShell` 内联渲染（不另开 tab/面板）；`UnifiedChatShell.test.tsx` 模拟一次 cli run 跑完后断言「File changes (1)」与 `notes/draft.md` 内联出现在同一对话面。

---

## 3. 测试结果

| 命令 | 结果 |
|---|---|
| `npm run build`（tsc + vite） | ✅ 全绿（contracts/daemon/desktop/web 均通过） |
| `apps/web` vitest（全量） | ✅ 361/363 通过；2 个失败为 **pre-existing 豁免项**：`HistoryFloatingButton`、`SandboxPreview`（与本次改动无关，baseline 同样失败） |
| `apps/daemon` vitest（全量） | ✅ 546/546 通过（含新增 settings 持久化用例） |
| `npx eslint`（apps/web） | ⚠️ 仅 1 个 **pre-existing** error（`App.tsx:23` DetailView 懒加载的 `(props:any)`，`git show HEAD` 确认基线即存在）；本次改动**零新增 lint error** |
| `prettier --check`（我的新文件） | ✅ 全部合规（修改的既有文件基线即 non-compliant，未做无关重排以保持最小 diff） |

新增测试覆盖矩阵：
- 引擎切换 → `EngineSwitcher.test.tsx`（5）
- 路由分流 → `UnifiedChatShell.test.tsx`「routing」(2)
- tab 移除 → `App.test.tsx`（2，重写）
- 授权内联 → `UnifiedChatShell.test.tsx`「inline authorization」(2)
- 改动集内联 → `UnifiedChatShell.test.tsx`「routing + changeset inline」(1)
- 持久化 → `useAgentEngine.test.tsx`(4) + `daemon settings/service.test.ts`(1)

---

## 4. 关键设计决策与 trade-off

1. **不合并两个 hook 的消息数组。** spec 的 Won't 明确「不重写底层 data hook」。因此统一面的「连续渲染」=同一外壳、同一可滚动区域、按引擎条件渲染 ChatPanel 或 AgentRunPanel，而非把对话消息与 run timeline 合并成一个数组。这满足 AC-6「不另开面板/tab、内联」的字面与精神；真正合并消息流属 P3（ACP/AG-UI）范畴。builtin pi 本身不产生 changeset，故改动集只在 cli 路径出现，符合预期。

   > ⚠️ **此条已被 FIX-1（round-2a）推翻**，见下「6. FIX-1 渲染层融合」。原「按引擎条件渲染 ChatPanel 或 AgentRunPanel」会在切引擎时卸载对话区，违反 AC-6 连续性；FIX-1 改为渲染层融合：ChatPanel 常驻，run 产物注入同一对话流。两条 data hook 仍未合并（仅渲染层汇流），Won't 仍成立。

2. **模型名暂不显示。** AC-2 提到「+ 当前模型」，但 P1 的 `AgentInfo` 按 `registry.ts` 注释**刻意省略了 `models`**（P2 conversation-surface concern），且 spec Won't 把「模型 live-listing」列为可选非必须。因此 chip 当前显示「引擎模式 · 引擎/agent 名」；待 P1 contracts 补 `models` 后可在 popover 内加模型选择（参考 open-design `agentModelSelection.ts`，本期未引入）。

3. **引擎持久化复用 daemon 通用 unknown-field 通道。** `SettingsService` 的 `[key:string]: unknown` + `{...raw}` 展开已能保留任意 key，故 `agent_engine`/`agent_id` 无需 daemon 侧特化代码，只需 web 侧 `get/set_agent_engine` invoke 分支 + 部分.patch（切引擎不覆盖已选 agent，反之亦然）。有 daemon 测试固化。

4. **AgentRunPanel 保持无参可用。** 新增 props 全部可选且默认 `engine='cli'/agentId='claude'`，故原 `AgentRunPanel.test.tsx`（无参渲染）全绿，零回归；UnifiedChatShell 传入用户选择覆盖默认。

5. **离线/测试环境安全降级。** `useAgentEngine` 在 daemon 不可达时回退 builtin 默认；`UnifiedChatShell` 的 `listLocalAgents` 失败被 catch → 空 agent 列表（不崩溃）。App 集成测试据此 mock。

6. **视觉走谨迹 token。** chip/popover 的 accent 用 `--record-btn`（非 `--accent` 危险红），圆角 `--radius-*`、浮层 `--shadow-overlay`、菜单边 `--border-menu`、聚焦 `--focus-ring`、字体三栈各司其职；旧 tab toggle 误用 `--accent` 的问题随删除一并消除。

---

## 5. 未提交

按指示**未 commit**，交 Leader 验收合并。所有改动在工作区可见（`git status`）。

---

## 6. FIX-1（round-2a）：AC-6 渲染层融合

### 问题（codex + Leader 复核确认）
原 `UnifiedChatShell.renderEngine` 用 `if(engine==='cli') return <AgentRunPanel>; return <ChatPanel>` 做**条件替换**——切引擎会卸载并重挂对话区，内置 pi 的对话气泡随之消失，不是「同一对话面的连续消息流」，违反 AC-6（完整版 / 深度融合执行面）。

### 目标与达成（渲染层融合，不重写 data hook）
让对话流成为**唯一常驻的可滚动容器**：

1. **ChatPanel 不再因切引擎卸载。** `UnifiedChatShell` 现在**无条件**渲染 `<ChatPanel>`——它始终挂载，对话气泡（`useConversation` 的 messages）跨引擎切换常驻。`renderEngine` 条件替换已删除。
2. **CLI run 产物作为「消息条目」注入同一对话流。** `useAgentRun` 从 `AgentRunPanel` **上提到 `UnifiedChatShell`**；其产物（run 状态/timeline/changeset/artifacts/memory/sources）经新的展示组件 `<RunStreamEntries>` 渲染，通过 `ChatPanel` 新增的 `streamExtras` 注入槽**渲染进同一个可滚动消息容器**（在 chat 气泡之后、同一滚动区）。
3. **composer 共享 + 内联授权。** 同一个 textarea + 发送钮服务两种引擎：`engine=builtin` → 纯对话输入（`onSend` 走 useConversation）；`engine=cli` → 该输入即 goal（placeholder 切为目标提示），`onSend` 路由到 `agentRun.start({goal:text, engine:'cli', agentId, authorizationMode})`；授权选择器（复用 `AUTHORIZATION_MODES`）经 `composerExtras` 注入槽**内联到 composer 顶部**，不另起独立表单区块。
4. **连续性可证。** 用户在内置 pi 聊几句（chat 气泡），切到外部 agent 发起一次 run，run 的 changeset 作为对话流里的条目出现，与之前的 chat 气泡**同区、连续滚动、共存可见**。

> ⚠️ 严格遵守「不合并两个 hook 的数据数组」：`useConversation.messages` 与 `useAgentRun.*` **从未合并**；只在**渲染层**把两者的产物汇入同一对话流视图（chat 气泡 + run-entry 卡片同区）。

### 改动文件
| 文件 | 改动 |
|---|---|
| `apps/web/src/components/AgentRunPanel.tsx` | 抽出**展示组件** `RunStreamEntries`（复用同文件 `TimelineRow/ChangeSetRow/SourceRow/ArtifactRow/MemoryRow` 与样式；自门控：idle 返回 null）；`AgentRunPanel` 的 run 体**委托**给它（DRY，零重复）；header 文字 badge 下移到 RunStreamEntries（header 仅留状态点+标题）；`authorizationModeLabel(m, t)` 提为模块内共享 helper（`TFn` 类型） |
| `apps/web/src/components/ChatPanel.tsx` | 新增 3 个可选注入槽：`streamExtras?`（渲染进消息滚动区，位于 chat 气泡之后）、`composerExtras?`（渲染进 composer 融合容器顶部）、`inputPlaceholder?`（覆盖 textarea placeholder，cli 时即 goal 提示）；auto-scroll effect 依赖加入 `streamExtras`，使 run 条目增长也驱动贴底滚动；空态条件改为 `messages.length === 0 && !streamExtras`（cli 有 run 产物时不显示对话空态） |
| `apps/web/src/components/UnifiedChatShell.tsx` | **重写**：删除 `renderEngine` 条件替换 → 无条件渲染 ChatPanel（常驻）；`useAgentRun` 上提到本层；`onSend` 按引擎路由（builtin→对话发送，cli→start run，run 进行中阻止二次 start）；`streamExtras = <RunStreamEntries/>`（仅 cli 且有 run 产物时物化，避免空态误判）；`composerExtras` = 内联授权 `<select>`；`inputPlaceholder` 切目标提示 |
| `apps/web/src/tests/UnifiedChatShell.test.tsx` | **重写**：不再 mock ChatPanel（旧测试把它 mock 掉所以测不出连续性——这是要修的）；新增真实 ChatPanel 所需的 `../lib/tauri`、`../lib/hostBridge` mock；用 `rerender` 在**同一挂载实例**上模拟引擎切换 |

### 连续性如何达成（技术要点）
- **不卸载证据**：`ChatPanel` 在 `UnifiedChatShell` 中位于恒定树位置、无条件渲染 → React 复用同一实例，切引擎不触发 unmount/remount。
- **同区共存证据**：run 产物经 `streamExtras` 渲染进 ChatPanel **自己的** `scrollRef` 滚动容器内部（非兄弟面板），与 chat 气泡共享同一可滚动 DOM。
- **数据隔离**：两个 hook 各自独立；`streamExtras` 只是把 `useAgentRun` 的**渲染结果**作为 ReactNode 注入，不触碰 `useConversation` 的数据。

### 测试结果（真实数字）
| 命令 | 结果 |
|---|---|
| `npm run build`（tsc + vite，含 contracts/daemon/desktop） | ✅ 全绿 |
| `npx vitest run src/tests/UnifiedChatShell.test.tsx AgentRunPanel.test.tsx ChatPanel.test.tsx` | ✅ **15/15 通过**（UnifiedChatShell 5、AgentRunPanel 7、ChatPanel 2） |
| `apps/web` vitest 全量 | ✅ **360/362 通过**；2 失败为 **pre-existing 豁免**：`HistoryFloatingButton`（定位断言）、`SandboxPreview`（tabler-icons.css 注入）——与本次改动无关，baseline 同样失败 |
| `npx eslint src/**/*.{ts,tsx}` | ⚠️ 1 error（`App.tsx:23` pre-existing `any`）+ 11 warnings（均为 pre-existing `react-refresh`/`react-hooks` 模式）；本次改动**零新增 error**，新增 1 个 `react-refresh/only-export-components` warning（导出 `authorizationModeLabel` helper），与既有 6 处同类 warning 一致、lint exit 0 |
| `prettier --check` | 新写文件（UnifiedChatShell.tsx/.test.tsx）✅ 合规；`AgentRunPanel.tsx`/`ChatPanel.tsx` 为**基线即 non-compliant**（`git show HEAD` 验证），按最小 diff 原则不做无关重排 |

### UnifiedChatShell.test.tsx 新覆盖（连续性为核心）
- **routing**：builtin 挂载对话面 + 隐藏 CLI goal/auth；cli 共享 composer 切 goal 输入 + 内联授权。
- **continuity（AC-6 核心）· 用例 1**：在 builtin 渲染 → `rerender` 切 cli，断言**同一个** chat 气泡 DOM 节点仍在文档中（`document.body.contains(bubble)` 为 true）→ 证明切引擎**不卸载**对话区。
- **continuity（AC-6 核心）· 用例 2**：切 cli 后从共享 composer 发起一次 run（`createRun` 入参 `{engine:'cli', agentId:'codex', authorizationMode:'workspace_write'}`），`run_finished` 后断言 **chat 气泡 + changeset path 在同一渲染里共存**（`getByText('你好 pi…')` 与 `getByText('notes/draft.md')` 同时成立）→ 证明 run 产物与对话气泡**同面连续**。
- **engine chip 常驻（AC-2）**。

### 明确不做（留给 round-2b）
模型显示(FIX-2)、i18n 清零(FIX-3)、token 清理(FIX-4)、测试卫生加固(FIX-5) 均未触碰。本轮只交付 AC-6 的渲染层融合。

---

## 7. round-2b：FIX-2 / FIX-3 / FIX-4 / FIX-5 清理

搭在 FIX-1 的新结构上（UnifiedChatShell 常驻 ChatPanel、useAgentRun 上提、RunStreamEntries 注入同一对话流、composer 共享）逐条清理，**未 commit**。

### 7.1 FIX-2（AC-2 chip 显示当前模型）
AC-2 要求 chip 单行显示「当前引擎 + 当前模型」。原 EngineSwitcher 只有引擎 + agent 名，补模型字段：
- **内置 pi**：`UnifiedChatShell` 挂载时经既有 `getEngineConfig()`（runtimeClient → daemon `/config/engine`，不用 localStorage）解析 active provider 的 `model`，传入 EngineSwitcher 新增的 `model?` prop，chip 显示该模型名。
- **外部 CLI agent**：无 live-listing（Won't），用保守 fallback——`model` 为 null 时 chip 显示本地化「默认 / Default」占位（`engineSwitcherModelDefault`），**字段永不缺**。
- chip 三段式单行：`{mode} · {primary} · {model}`，model 走 `--font-mono`（模型 id 是代码式 token），溢出 ellipsis。
- 改动：`EngineSwitcher.tsx`（props + chip 渲染 + aria/title）、`UnifiedChatShell.tsx`（加载 builtinModel + 透传）、`engine-switcher.css`（`.engine-switcher__chip-model`）、`locales/zh.ts`+`en.ts`（`engineSwitcherModelDefault`）。
- 测试：`EngineSwitcher.test.tsx` builtin 显示模型名 / cli 显示 fallback；`UnifiedChatShell.test.tsx` builtin 时 chip-model 解析为 daemon 配置的模型（mock `getEngineConfig` 返回 dashscope/qwen-max）。

### 7.2 FIX-3（i18n 清零 hardcode）
AgentRunPanel（含 RunStreamEntries）作为统一对话面主面，把残留硬编码英文全部移到 locales，新 key 用 `agentRun*` 前缀，双语对齐：
- **状态标签**：`STATUS_META`（含 label）拆为纯色 `STATUS_COLOR` + `statusLabel(status, t)` 解析器；状态色 `running` 顺手去掉 `var(--accent)` fallback（FIX-4 一并）。
- **区块标题**：Timeline / Output / File changes / Sources read / Artifacts / Memory → `agentRunSection*`（带 `{count}` 插值）。
- **事件标签**：useAgentRun 的 Run started / Run finished / Run failed → `agentRunEvent*`（hook 内新增 `useTranslation()`，依赖加入 `[run, t]`；setTimeline updater 参数 `t`→`prev` 避免与翻译 `t` 命名冲突）。
- **memory kind**：`MEMORY_KIND_LABEL` 常量表 → `memoryKindLabel(kind, t)` 解析器。
- 测试锁定的英文断言全部改为本地化字符串：`AgentRunPanel.test.tsx`（Done→已完成、File changes→文件改动、Sources read→读取的来源、Artifacts→产物、Memory→记忆）；`UnifiedChatShell.test.tsx`（/File changes/→/文件改动/）。

### 7.3 FIX-4（视觉 token）
AgentRunPanel 用户可见 run UI 的裸 `--accent`（危险红）一律换为信号橙 `--record-btn`（AGENTS.md §5）：
- 主按钮背景（`primaryButton`）、change 操作 fallback（edit/modify opColor）、badge fallback（`statusBadge` 默认色）、tool 标签（`toolIcon`）、source cite 色（`SourceRow`）、artifact 标签（`ArtifactRow`）、memory 标签（`MemoryRow`）。
- 状态色（`--status-danger`/`--status-success`/`--status-warning`）保留语义色不动。grep 确认 `AgentRunPanel.tsx` 已无任何 `var(--accent)`。

### 7.4 FIX-5（测试卫生）
- 删除 `App.test.tsx` 的 `DEBUG right panel buttons` 调试用例（`expect(true).toBe(true)` + console，且位于 describe 闭合之外的孤儿 it）。
- 加固 `useAgentEngine.test.tsx`：`vi.clearAllMocks`→`vi.resetAllMocks`，每个 `beforeEach` 显式重设 `mockGetAgentEngine`/`mockSetAgentEngine` 默认实现（防组合跑时上个用例的 mockResolved/Rejected 泄漏）。
- 补 web 侧持久化覆盖（codex 指出原仅 daemon 侧有测）：`httpRuntimeClient.test.ts` 测 `get_agent_engine`（默认 builtin/null + 读取分支）、`set_agent_engine`（部分 patch 互不覆盖）；`tauri.test.ts` 测 `getAgentEngine`/`setAgentEngine` 包装（各 patch 只带自己的字段）。

### 7.5 测试结果（真实数字）
| 命令 | 结果 |
|---|---|
| `npm run build`（tsc + vite，含 contracts/daemon/desktop/web） | ✅ 全绿 |
| `apps/web` vitest 全量 | ✅ **365/367 通过**；2 失败为 **pre-existing 豁免**：`HistoryFloatingButton`（定位断言）、`SandboxPreview`（tabler-icons.css 注入）——与 round-2a baseline 同样失败，与本次改动无关 |
| `apps/daemon` vitest 全量 | ✅ **546/546 通过** |
| `npx eslint`（改动的 12 个文件） | **0 error**；2 warning 均为 pre-existing 模式（`AgentRunPanel.tsx:67` 导出 helper 的 react-refresh、`useAgentRun.ts:189` 既有的 `run` 依赖） |

测试数量变化：baseline 362 → 删 1（DEBUG）+ 新增 6（EngineSwitcher ×2、UnifiedChatShell ×1、httpRuntimeClient ×2、tauri ×1）= **367**，其中通过 365。

新增/改动覆盖矩阵：
- FIX-2 模型：`EngineSwitcher.test.tsx`（+2）、`UnifiedChatShell.test.tsx`（+1）
- FIX-3 i18n：`AgentRunPanel.test.tsx`（5 处断言本地化）、`UnifiedChatShell.test.tsx`（1 处）
- FIX-5 持久化：`httpRuntimeClient.test.ts`（+2）、`tauri.test.ts`（+1）、`useAgentEngine.test.tsx`（加固）

---

## 8. FIX-3 收尾：RunStreamEntries 后端枚举标签本地化（round-2c，未 commit）

GATE-REPORT round-2 判 **FIX-3 / i18n: FAIL**——round-2b 只本地化了 run 状态/区块标题/事件/记忆类型，但 `RunStreamEntries` 里 4 处仍把后端枚举原样渲染成英文：changeset 操作（`cs.operation`）、changeset 状态（`cs.status`）、source 类型（`source.kind`）、artifact 类型（`artifact.type`）；`AgentRunPanel.test.tsx` 仍锁定英文 `blocked`/`failed`。本轮机械收尾。

### 8.1 改动
- **4 个 label resolver helper**（仿现有 `statusLabel`/`memoryKindLabel`，模块内 `function`，不 export——避免新增 `react-refresh` warning；未知枚举值 fallback 到 raw 字符串兜底）：
  - `changeOperationLabel(op, t)` — `apps/web/src/components/AgentRunPanel.tsx`
  - `changeStatusLabel(status, t)` — 同上
  - `sourceKindLabel(kind, t)` — 同上
  - `artifactTypeLabel(type, t)` — 同上
- **4 处 raw 渲染换 helper 调用**：`ChangeSetRow`（operation + status，并加 `useTranslation`）、`SourceRow`（kind，加 `useTranslation`）、`ArtifactRow`（type，加 `useTranslation`）。颜色/透明度判定（`cs.operation === 'remove'` 等）仍用 raw 枚举值——只有展示标签走 helper。
- **locales/zh.ts + en.ts** 新增 22 个 `agentRun*` key（双语对齐，zh 22 / en 22，grep 校验）：
  - 操作 4：`agentRunChangeOp{Create,Edit,Move,Remove}`（覆盖 `ChangeSetOperation` 全部已知值 create/edit/move/remove）
  - 状态 5：`agentRunChangeStatus{Applied,Blocked,Failed,Reverted,Recorded}`（覆盖 `ChangeSetStatus` 全部）
  - source kind 4：`agentRunSourceKind{Read,Reference,Search,Cite}`（覆盖 `SourceBindingKind` 全部）
  - artifact type 9：`agentRunArtifactType{Article,Outline,Report,Summary,Plan,Todo,Index,Card,Note}`（覆盖 `ArtifactType` 全部已知字面量；`| string` 前向兼容走 fallback）
  - 枚举来源以 `packages/contracts` 为单一真相（local mirror `apps/web/src/types/agentRun.ts` 对齐）。
- **测试** `AgentRunPanel.test.tsx`：
  - changeset 用例：`getAllByText('blocked')`/`'failed'` → `'已阻止'`/`'已失败'`，并补 `'编辑'`/`'删除'` 操作标签断言（原 cs-1=edit / cs-2=remove）。
  - Sources/Artifacts/Memory 用例：补 `'读取'`（source kind=read）+ `'摘要'`（artifact type=summary）本地化断言。

### 8.2 Won't
- 不动颜色/状态机/枚举本身；只改展示文案。
- 不本地化 opTag/statusTag 的 CSS `text-transform: uppercase`（英文走大写、中文无视觉影响，与现有 memory kind 标签同一表现）。

### 8.3 自验（真实数字）
| 命令 | 结果 |
|---|---|
| `npm run build`（tsc + vite） | ✅ 全绿（chunk-size warning 为 pre-existing） |
| `apps/web` vitest 全量 | ✅ **365/367 通过**；2 失败为 pre-existing 豁免：`HistoryFloatingButton`（定位断言）、`SandboxPreview`（tabler-icons.css）——与 round-2b baseline 完全一致，零回归 |
| `AgentRunPanel.test.tsx` 单文件 | ✅ **8/8 通过**（含新增本地化断言） |
| `npm run lint`（改动的 4 文件） | **0 新增 error/warning**；`AgentRunPanel.tsx:67` 的 `react-refresh` warning 为 `authorizationModeLabel` 导出所致，pre-existing（DEV-NOTES 7.5 已记录），4 个新 helper 均 module-local 未 export |
| grep 校验 | `{cs.operation}`/`{cs.status}`/`{source.kind}`/`{artifact.type}` JSX 渲染 **0 处残留**；zh/en 新 key 各 22 个对齐 |
