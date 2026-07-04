# WORKFLOW: Phase 1 前端运行时保护层（Execution）

**Version**: 1.0
**Date**: 2026-06-25
**Author**: Workflow Architect
**Status**: Draft（待 execution agent 执行；Reality Checker 尚未对本 spec 与代码做闭环核对）
**Implements**: `stories/20260625-runtime-client-protection/story.md`（status: approved）

---

## Overview

本 workflow 是给「执行 subagent」和「verification subagent」的 build-ready 操作手册。目标：在 `src/lib/runtimeClient.ts` 引入 `JournalRuntimeClient` 抽象与 `TauriRuntimeClient` 默认实现，让 `useConversation` 通过该 client 订阅 `conversation-stream`，默认路径仍走 Tauri，对外导出的 `src/lib/tauri.ts` 既有函数签名保持兼容。不接 HTTP daemon、不改 Rust、不动 ChatPanel。

本文件只定义边界、判据、失败模式与验收映射；**不替执行 agent 做实现决策**（不写最终代码、不锁死字段命名细节，除非该细节是 AC 的判据）。

---

## Reality（Workflow Architect 已核实的事实，spec 全部基于此）

| 事实                                                                                                                                                                                                                                               | 来源                         | 对设计的影响                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/tauri.ts` 第 1 行 `import { invoke } from '@tauri-apps/api/core'`，全部导出函数都是 `invoke('cmd', {args})` 的薄包装                                                                                                                      | tauri.ts:1-735               | runtime client 的 `invoke<T>(cmd, args)` 必须与此调用形态 1:1 对齐，否则现有函数无法平滑复用                                                         |
| `useConversation.ts:2` `import { listen } from '@tauri-apps/api/event'`；`:143` `listen<ConversationStreamPayload>('conversation-stream', cb)`；`:591-593` cleanup 是 `unlisten.then(fn => fn())`（listen 返回 Promise\<UnlistenFn\>，是异步释放） | useConversation.ts           | runtime client 的 `subscribe` 必须把"Promise\<unlisten\>"包成"同步返回 unsubscribe"，否则 hook 的 useEffect cleanup 模式无法保持                     |
| `src/lib/tauri.ts` 既有未提交改动是**纯新增**（`:666-683` `AtMentionCandidate` + `listAtMentionCandidates`），未触碰任何既有导出                                                                                                                   | git diff                     | diff 卫生规则：本次改动也必须是小而聚焦的增量，不顺手重排既有 700 行                                                                                 |
| `@tauri-apps/api/event` 的直接 import 散落在 **19 个源文件**（hooks/components/settings/App/ProcessingQueue/SessionList/...），不仅 useConversation                                                                                                | grep `@tauri-apps/api/event` | **本 phase 只收 useConversation 一个**；其余 18 个文件的迁移超出 AC-2/AC-4 范围，必须显式列为 Out of Scope，不得顺手改                               |
| `src/tests/tauri.test.ts`、`src/tests/ipc-contract.test.ts` 用 `vi.mock('@tauri-apps/api/core')` 模式验证 invoke 转发                                                                                                                              | tauri.test.ts:6-8            | runtime client 测试复用同一 mock 套路，避免引入新 mock 模式                                                                                          |
| `src/tests/ChatPanel.test.tsx:13` 整体 `vi.mock('../lib/tauri')`；目前**没有** `useConversation.test.ts`                                                                                                                                           | ChatPanel.test.tsx           | 新增测试不得破坏 ChatPanel 既有 mock；useConversation 的 subscribe 路径需要新建独立测试文件                                                          |
| vitest 配置在 `vite.config.ts`：jsdom、globals、setupFiles=`./src/tests/setup.ts`                                                                                                                                                                  | vite.config.ts               | 新测试无需改 config                                                                                                                                  |
| story 的 AC-2 原文是"组件不再直接绑定 Tauri event 订阅"——story 正文与交棒清单都把范围限定在 `useConversation`                                                                                                                                      | story.md AC-2/AC-4           | "组件"在本 phase 等于"useConversation"，不是全部 19 个 import 点。**这是一条需要 verification-gate 注意但不需要用户决策的解读**（见 Open Questions） |

---

## Actors

| Actor                                      | Role in this workflow                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Execution agent (Claude / coding subagent) | 按 TDD 顺序实现 runtimeClient、改 useConversation、跑测试。本 spec 唯一的写代码角色       |
| Verification subagent (verification-gate)  | 按 §7 验收顺序逐条打勾，产出 verify-report.md                                             |
| `JournalRuntimeClient` (新类型)            | 定义 `invoke<T>` 与 `subscribe` 的抽象边界，不承载实现                                    |
| `TauriRuntimeClient` (新实现)              | 把 `@tauri-apps/api/core.invoke` 与 `@tauri-apps/api/event.listen` 包进统一接口；默认实现 |
| `useConversation` (现有 hook)              | 唯一被改造的消费方：把直接 `listen('conversation-stream')` 换成 `runtimeClient.subscribe` |
| `src/lib/tauri.ts` (现有单一入口)          | 既有导出签名冻结；本次只允许在文件内复用 runtime client 或新增导出，禁止改既有签名        |
| React test harness (vitest + jsdom)        | 提供 mock 边界，验证 subscribe 转发与 unsubscribe 语义                                    |

---

## Prerequisites

执行 agent 进入 STEP 1 前必须为真：

1. `stories/20260625-runtime-client-protection/story.md` 存在且 `status: approved`（已核实）。
2. `docs/adr/ts-daemon-agent-runtime-migration.md` 存在（已核实），`JournalRuntimeClient` 接口草案已在 ADR §JournalRuntimeClient 给出。
3. 工作树状态：`src/hooks/useConversation.ts` 干净；`src/lib/tauri.ts` 与 `src/types.ts` 仅有纯新增改动。执行前执行 agent 必须运行 `git status --short src/hooks/useConversation.ts src/lib/tauri.ts src/types.ts` 并把输出贴进最终报告。若 useConversation 出现非预期脏改动，**停止并上报**，不得继续。
4. `npm test`（全量）在改动前基线为绿（执行 agent 记录基线结果，至少记录 `src/tests/ChatPanel.test.tsx`、`src/tests/tauri.test.ts`、`src/tests/ipc-contract.test.ts` 三个文件的通过情况）。
5. 没有其它 agent 并发修改冲突热点文件（`src/lib/tauri.ts`、`src/hooks/useConversation.ts`、`src/types.ts`、`src/components/ChatPanel.tsx`、`src-tauri/src/conversation.rs`）。

---

## Trigger

由用户/编排者向执行 agent 派发 Phase 1 prompt（design.md §Phase 1 示例 prompt）。本 workflow 的 entry point 是执行 agent 打开本文件的那一刻。

---

## Workflow Tree

### STEP 0：读输入与基线（只读）

**Actor**: Execution agent
**Action**: 阅读 story.md / design.md（Phase 1 段）/ ADR §JournalRuntimeClient / tauri.ts 全量 / useConversation.ts 全量 / types.ts `ConversationStreamPayload`；运行 git status 基线；运行 `npm test -- src/tests/ChatPanel.test.tsx src/tests/tauri.test.ts src/tests/ipc-contract.test.ts` 记录基线。
**Timeout**: 无（本地操作）
**Input**: 文件路径见 §必读输入
**Output on SUCCESS**: 基线绿、useConversation 干净 → GO TO STEP 1
**Output on FAILURE**:

- `FAILURE(useConversation_dirty)`: useConversation 有非预期未提交改动 → **停止，上报 parent，不进入 STEP 1**。不尝试自行 stash/revert。
- `FAILURE(baseline_red)`: 上述三个测试基线有失败 → **停止，上报基线失败清单**。本 story 不为既有失败负责。

**Observable states**:

- 报告中：执行 agent 给出 git status 输出 + 三个测试文件的基线通过情况
- 代码：零改动

---

### STEP 1：写红测试 — runtimeClient wrapper（TDD 红 1）

**Actor**: Execution agent
**Action**: 新建 `src/tests/runtimeClient.test.ts`，先写测试，**测试必须失败**（因为 runtimeClient.ts 还不存在）。
**Timeout**: 无
**Input**: ADR §JournalRuntimeClient 接口草案；§handoff 交棒清单
**Output on SUCCESS**: `npm test -- src/tests/runtimeClient.test.ts` 报红（模块找不到或断言失败），且红色点正好是"转发 invoke / subscribe 行为" → GO TO STEP 2

**测试用例（具体名 + 断言点，执行 agent 必须实现，命名可微调但行为不可变）**：

| 用例名                                                            | 断言点                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `forwards invoke command and args to tauri invoke`                | mock `@tauri-apps/api/core` 的 `invoke`；调用 `tauriRuntimeClient.invoke('get_workspace_path')`；断言底层 `invoke` 被以 `('get_workspace_path', undefined)` 调用；再调用 `invoke('set_workspace_path', { path: '/x' })`；断言被以 `('set_workspace_path', { path: '/x' })` 调用                                                |
| `returns invoke resolved value`                                   | mock invoke resolves `'ok'`；断言 `await client.invoke('x')` === `'ok'`                                                                                                                                                                                                                                                        |
| `propagates invoke rejection`                                     | mock invoke rejects `new Error('boom')`；断言 `client.invoke('x')` rejects 同错误（不吞错）                                                                                                                                                                                                                                    |
| `subscribe forwards event name and handler to tauri listen`       | mock `@tauri-apps/api/event` 的 `listen`，让它 resolve 一个 spy `unlistenFn`；注册 handler；用 `vi.mocked(listen)` 断言被以 `('conversation-stream', expect.any(Function))` 调用                                                                                                                                               |
| `subscribe handler receives the payload emitted by tauri`         | 触发 mock listen 收到的回调时传入合成 `event`（含 `payload`），断言业务 handler 收到的就是 `event.payload`（即 `ConversationStreamPayload`）—— 执行 agent 自行决定 subscribe 对外是吐 `payload` 还是 `event`，但**必须与 useConversation 现有消费形态一致**，否则 STEP 3 会报行为回退                                          |
| `unsubscribe is synchronous and calls the tauri unlisten`         | listen resolve 的 `unlistenFn` 是 spy；`const off = client.subscribe('conversation-stream', () => {})`；**立即（同步，不 await）** `off()`；断言 `unlistenFn` 被调用一次。**这是 AC-2 的硬断言点**：Tauri 的 unlisten 是异步的，runtime client 必须包成同步返回 unsubscribe，否则 useConversation `useEffect` cleanup 模式失效 |
| `unsubscribe is idempotent`                                       | 同一个 off 调用两次；断言 `unlistenFn` 只被调用一次（防止 useConversation StrictMode 双挂载导致重复释放）                                                                                                                                                                                                                      |
| `default export TauriRuntimeClient is constructible without args` | `new TauriRuntimeClient()` 可用，不抛（默认实现单例/工厂形态由执行 agent 决定，但构造不能依赖外部参数）                                                                                                                                                                                                                        |

**允许新增文件**:

- `src/lib/runtimeClient.ts`（STEP 2 才写实现）
- `src/tests/runtimeClient.test.ts`

**Observable states**:

- Customer: 无（开发态）
- Operator（开发者）: `npm test -- src/tests/runtimeClient.test.ts` 红
- 代码: 仅新增测试文件
- Logs: vitest "X failed, Y passed"

---

### STEP 2：写绿实现 — runtimeClient.ts（TDD 绿 1）

**Actor**: Execution agent
**Action**: 实现 `src/lib/runtimeClient.ts`，让 STEP 1 的测试全绿。
**Timeout**: 无
**Input**: STEP 1 的测试断言点；ADR §JournalRuntimeClient 草案（见 §handoff 草案与取舍）
**Output on SUCCESS**: `npm test -- src/tests/runtimeClient.test.ts` 全绿，且实现**未改任何既有文件** → GO TO STEP 3
**Output on FAILURE**:

- `FAILURE(tests_still_red)`: 实现未让全部用例转绿 → 修正实现（不放宽测试） → 重跑。最多 2 轮，仍红则 ABORT_REPORT。
- `FAILURE(touched_existing_file)`: 实现过程中动到 tauri.ts/useConversation.ts/types.ts/ChatPanel → ABORT_REPORT（违反独占）。

**实现边界（必须满足，但不规定实现）**:

- 导出类型 `JournalRuntimeClient`（接口）与 `TauriRuntimeClient`（实现类/工厂，二选一由执行 agent 决定）。
- `invoke<T>(command, args?)` 必须直接转发给 `@tauri-apps/api/core` 的 `invoke`，**不得改写 args 结构**（tauri.ts 现有调用都是 `invoke('cmd', { key: val })` 形态，args 是一个 plain object，runtime client 不做 camelCase 转换、不做 key 重命名）。
- `subscribe<T>(event, handler)` 返回同步 `() => void`。内部把 listen 返回的 `Promise<UnlistenFn>` 缓存，listen resolve 后调用真正的 unlisten；**若在 listen resolve 前就 unsubscribe，必须用一个 flag 标记，resolve 后立即释放**（这是 Tauri event 的经典竞态，AC-2 的 subscribe 语义要覆盖它）。
- 默认导出一个 ready-to-use 的 Tauri runtime client 单例（或工厂），让 useConversation 能直接 import 使用。

**Observable states**:

- Operator: `npm test -- src/tests/runtimeClient.test.ts` 全绿
- 代码: 新增 `src/lib/runtimeClient.ts`

---

### STEP 3：改 useConversation — 经 runtime client 订阅（TDD 红→绿 2）

**Actor**: Execution agent
**Action**:

1. 先写红：新建 `src/tests/useConversation.test.ts`（当前不存在），断言"useConversation 不再直接 import `@tauri-apps/api/event`"+"仍订阅 conversation-stream 语义"。测试运行报红（因为 useConversation 还在直接 listen）。
2. 再改 useConversation：把第 2 行 `import { listen } from '@tauri-apps/api/event'` 与第 143 行 `listen<ConversationStreamPayload>('conversation-stream', ...)` 替换为通过 runtime client 订阅；保持 effect body 内的全部 case 处理逻辑与 cleanup 模式不变。
3. 转绿。

**Timeout**: 无
**Input**: STEP 2 产出的 runtimeClient；useConversation.ts 现有 listen 块（:142-601）
**Output on SUCCESS**: useConversation.test.ts 全绿 + runtimeClient.test.ts 仍全绿 + ChatPanel.test.tsx 不回退 → GO TO STEP 4
**Output on FAILURE**:

- `FAILURE(behavior_regression)`: ChatPanel.test.tsx 或 useConversation 既有行为（streaming flag、pending queue、artifact parser、tab migration）出现回退 → 回滚 useConversation 改动（`git checkout -- src/hooks/useConversation.ts`，因为 STEP 0 确认它干净），重新分析 subscribe 对外暴露的是 payload 还是 event，再试。最多 2 轮。
- `FAILURE(still_imports_tauri_event)`: grep 仍命中 `@tauri-apps/api/event` 在 useConversation.ts → 未完成替换，继续。
- `FAILURE(diff_too_big)`: 改动触碰 effect 内部 case 逻辑或其它无关代码 → ABORT_REPORT（违反 diff 卫生）。

**useConversation 测试用例（具体名 + 断言点）**：

| 用例名                                                 | 断言点                                                                                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `does not import @tauri-apps/api/event`                | 静态分析：读取 `src/hooks/useConversation.ts` 源码字符串，断言不含子串 `@tauri-apps/api/event`。**这是 AC-2 的硬判据**，必须用源码字符串断言或 grep，不依赖 mock |
| `subscribes to conversation-stream via runtime client` | mock runtimeClient 的 `subscribe`，捕获注册的 handler；断言 subscribe 被以事件名 `'conversation-stream'` 调用（第一个参数匹配）                                  |
| `routes text_delta into assistant message blocks`      | 通过 captured handler 触发一个 `{ event: 'text_delta', data: 'hi', session_id: sid }`；断言 hook 暴露的 messages 出现 assistant 消息含文本 'hi'                  |
| `sets streaming false on done`                         | 触发 `{ event: 'done', data: '', session_id: sid }`；断言 isStreaming === false                                                                                  |
| `unsubscribes on unmount`                              | 用 `@testing-library/react` 的 renderHook；unmount；断言 subscribe 返回的 `off` 被调用一次（runtime client subscribe 返回的 unsubscribe 被调用）                 |

> 注：执行 agent 可酌情增删用例，但**不得低于上述 5 条**，且第 1、2、5 条是 AC 判据，**禁止删减**。

**Diff 卫生硬规则（STEP 3 适用）**:

- 只允许改：第 2 行 import 行、第 142-143 行订阅入口、第 591-601 cleanup 块（以及因接口形态需要的最小周边）。
- 禁止改：effect 内部 case 分支（:146-588）、tab 管理、create/load/send/retry/cancel 等业务方法。
- 禁止：重排 import 顺序、跑 prettier 全文格式化、调整缩进风格。

**Observable states**:

- Customer: 无（开发态）
- Operator: useConversation.test.ts 全绿；grep `@tauri-apps/api/event src/hooks/useConversation.ts` 无命中
- 代码: useConversation.ts 改动限于 import + 订阅入口 + cleanup
- Logs: vitest 通过

---

### STEP 4：回归测试 + lint + 类型检查

**Actor**: Execution agent
**Action**:

1. `npm test`（全量，含 ChatPanel、tauri、ipc-contract、useConversation、runtimeClient、useJournal、useTopics、Automation、ProcessingQueue 等所有依赖 event mock 的测试）。
2. `npm run lint`。
3. `npm run build`（tsc + vite build）。

**Timeout**: npm test 默认；build 可能耗时较长，执行 agent 至少等满。
**Output on SUCCESS**: 三者全绿 → GO TO STEP 5
**Output on FAILURE**:

- `FAILURE(type_error)`: tsc 报错 → 多半是 runtime client 泛型或 useConversation 类型不匹配；修正实现，重跑。不改测试断言去消错。
- `FAILURE(other_test_red)`: 除本次新增外的测试变红 → 多半是 runtime client 的 subscribe 对外暴露形态（payload vs event）与既有消费方预期不符；修正 runtime client，不改既有测试。
- `FAILURE(lint)`: eslint 报错 → 修代码，不改 lint 规则。

**Observable states**:

- Operator: 三命令全绿；执行 agent 在报告中粘贴末尾摘要
- 代码: 无新增改动（除非修 bug）

---

### STEP 5：自证与交付

**Actor**: Execution agent
**Action**: 按 §7 验收顺序自证，把每条 AC 的证据（命令 + 输出摘要）写进交付报告。不写 .md 报告文件（本 spec 除外），证据直接放最终 assistant message。
**Output on SUCCESS**: AC-1~AC-4 全部可逐条打勾 → 交棒 verification-gate
**Output on FAILURE**: 见 ABORT_REPORT

---

### ABORT_REPORT

**Triggered by**: STEP 1/2/3/4 任一 FAILURE 不可自愈
**Actions**（按顺序）:

1. 若 useConversation 被改坏且 STEP 0 基线为干净：`git checkout -- src/hooks/useConversation.ts` 回到基线。
2. 若新增的 runtimeClient.ts / runtimeClient.test.ts / useConversation.test.ts 导致 build/test 全面崩溃：可选择保留（红测试是 TDD 正常产物）或删除；**决策依据是是否还能跑通基线测试**，能跑通就保留红测试 + 上报，不能跑通就删除新增文件并上报。
3. **禁止** `git checkout` 掉 `src/lib/tauri.ts` 的既有未提交改动（那是 AtMention 相关、本 story 之外的改动，不属于本 agent 的回滚范围）。
4. 上报：失败 STEP、失败命令、失败输出、已尝试的修复、当前工作树状态。
   **What operator sees**: parent agent 收到失败报告，决定是否重派或调整 story。

---

## State Transitions

```
[未开始] -> (STEP 0 基线绿) -> [保护层就绪待写]
[保护层就绪待写] -> (STEP 1 红) -> [wrapper 测试红]
[wrapper 测试红] -> (STEP 2 绿) -> [runtimeClient 落地]
[runtimeClient 落地] -> (STEP 3 红→绿) -> [useConversation 切换]
[useConversation 切换] -> (STEP 4 全绿) -> [可交付]
[可交付] -> (STEP 5 自证) -> [交棒 verification]
任一 STEP -> (不可自愈 FAILURE) -> ABORT_REPORT
```

---

## Handoff Contracts

### useConversation → JournalRuntimeClient.subscribe

**Signature (草案，执行 agent 决定最终形态但必须满足此语义)**:

```ts
type JournalRuntimeClient = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  subscribe<T>(event: string, handler: (payload: T) => void): () => void
}
```

**Constraints**:

- `subscribe` 的 handler 接收的 `payload: T` 必须是 Tauri `listen` 回调里 `event.payload`（即 `ConversationStreamPayload`），**不是**整个 `TauriEvent<T>`。理由：useConversation 现有代码 `event.payload` 解构（:144）直接消费 payload；保持一致可避免 STEP 3 行为回退。**若执行 agent 选择吐整个 event，则 STEP 3 的 useConversation 必须同步改解构方式，且 useConversation 测试的 `routes text_delta` 用例要相应调整——但这会被 §diff 卫生规则视为扩大改动，不推荐。**
- `subscribe` 返回的 unsubscribe 必须同步可调用（见 STEP 1 测试 `unsubscribe is synchronous`）。

### tauri.ts 既有函数 → runtimeClient.invoke（非强制，本次不要求）

本 phase **不强制** tauri.ts 既有函数改走 runtime client。AC-3 只要求签名兼容。执行 agent 可选择保持 tauri.ts 直接 `import { invoke } from '@tauri-apps/api/core'`（最小改动），也可选择让 tauri.ts 内部复用 runtime client（更彻底但 diff 更大）。**推荐最小改动**，把"tauri.ts 也走 runtime client"留给后续 phase，除非 STEP 4 出现类型冲突。

---

## Cleanup Inventory

本 workflow 新增/修改的资源清单（失败时按反序清理）：

| Resource                              | Created at step | Destroyed by                   | Destroy method                                                          |
| ------------------------------------- | --------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `src/tests/useConversation.test.ts`   | STEP 3          | ABORT_REPORT（仅当导致基线崩） | `rm` 或 `git checkout`                                                  |
| `src/hooks/useConversation.ts` 的改动 | STEP 3          | ABORT_REPORT（行为回退）       | `git checkout -- src/hooks/useConversation.ts`（STEP 0 已确认基线干净） |
| `src/lib/runtimeClient.ts`            | STEP 2          | ABORT_REPORT（仅当导致基线崩） | `rm`                                                                    |
| `src/tests/runtimeClient.test.ts`     | STEP 1          | ABORT_REPORT（仅当导致基线崩） | `rm`                                                                    |

**不得清理**:

- `src/lib/tauri.ts` 的既有未提交 `AtMentionCandidate` / `listAtMentionCandidates` 改动（非本 story 产物）。
- `src/types.ts` 的既有未提交改动。
- 任何 Rust 文件。
- `src/components/ChatPanel.tsx`。

---

## 失败模式与恢复路径（汇总）

| 失败模式                                                | 检测方式                                        | 严重度   | 恢复路径                                                                               |
| ------------------------------------------------------- | ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| useConversation 基线不干净                              | STEP 0 `git status`                             | Blocker  | 停止上报，不 stash                                                                     |
| 全量测试基线本就红                                      | STEP 0 `npm test` 基线                          | Blocker  | 上报，不顺手修既有失败                                                                 |
| runtime client 测试不转绿                               | STEP 2 重跑                                     | High     | 修实现 2 轮，仍红则 ABORT                                                              |
| useConversation 行为回退（streaming/queue/artifact 坏） | STEP 3 ChatPanel.test 或 useConversation 测试红 | Critical | `git checkout -- src/hooks/useConversation.ts` 回基线，重分析 subscribe 语义，2 轮上限 |
| grep 仍命中 `@tauri-apps/api/event` in useConversation  | STEP 3 grep 断言                                | High     | 继续替换未完成点                                                                       |
| 顺手改了 ChatPanel / Rust / package.json                | STEP 4 或 verification `git diff --name-only`   | Critical | 回滚越界改动；若已无法干净回滚则 ABORT                                                 |
| 改了 tauri.ts 既有导出签名                              | `git diff` 人工或 ipc-contract.test 报错        | Critical | 回滚该 hunk；ipc-contract.test 是安全网                                                |
| tsc 报错（runtime client 泛型）                         | STEP 4 build                                    | High     | 修实现类型                                                                             |
| diff 过大（重排 tauri.ts 700 行）                       | STEP 5 `git diff --stat` 人工核对               | Medium   | 要求执行 agent 重做到最小 diff                                                         |

---

## 验收映射（AC → 可执行检查）

verification-gate subagent 按下表逐条打勾。每条都给出"命令 + 期望"。

### AC-1 — 现有对话路径保持可用

| #     | 检查                           | 命令 / 方法                                                                                                    | 期望                                     |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| AC-1a | ChatPanel 集成测试不回退       | `npm test -- src/tests/ChatPanel.test.tsx`                                                                     | 全绿                                     |
| AC-1b | useConversation 行为测试不回退 | `npm test -- src/tests/useConversation.test.ts`                                                                | 全绿（含 streaming/queue/artifact 用例） |
| AC-1c | 全量前端测试不回退             | `npm test`                                                                                                     | 全绿（与 STEP 0 基线一致或更优）         |
| AC-1d | 不依赖 daemon                  | `grep -rn "daemon\|HttpRuntimeClient\|SSE\|EventSource" src/lib/runtimeClient.ts src/hooks/useConversation.ts` | 无命中                                   |

### AC-2 — 组件不再直接绑定 Tauri event 订阅

| #     | 检查                                       | 命令 / 方法                                                              | 期望                                                                          |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| AC-2a | useConversation 不再 import tauri event    | `grep -n "@tauri-apps/api/event" src/hooks/useConversation.ts`           | **无输出**（exit code 1）                                                     |
| AC-2b | useConversation 通过 runtime client 订阅   | `grep -n "subscribe" src/hooks/useConversation.ts`                       | 命中 `'conversation-stream'` 订阅点                                           |
| AC-2c | runtime client 的 subscribe 行为有测试覆盖 | `npm test -- src/tests/runtimeClient.test.ts`                            | 全绿，含 `unsubscribe is synchronous` 用例                                    |
| AC-2d | 默认实现仍走 Tauri                         | `grep -n "TauriRuntimeClient\|@tauri-apps/api" src/lib/runtimeClient.ts` | TauriRuntimeClient 内部使用 `@tauri-apps/api/core` 与 `@tauri-apps/api/event` |

### AC-3 — 外部 API 不破坏

| #     | 检查                                  | 命令 / 方法                                                                          | 期望                                                    |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| AC-3a | tauri.ts 既有导出函数可被既有测试通过 | `npm test -- src/tests/tauri.test.ts src/tests/ipc-contract.test.ts`                 | 全绿                                                    |
| AC-3b | tauri.ts diff 只含新增或零改动        | `git diff src/lib/tauri.ts`                                                          | 既有导出函数的签名行未出现在 `-` 行（仅新增行或零改动） |
| AC-3c | 不引入 HTTP daemon 作为默认路径       | `grep -rn "HttpRuntimeClient" src/lib/runtimeClient.ts src/hooks/useConversation.ts` | 无命中（HttpRuntimeClient 属于 Phase 2）                |
| AC-3d | tsc 通过（类型兼容）                  | `npm run build`                                                                      | 无类型错误                                              |

### AC-4 — 小范围独占修改

| #     | 检查                           | 命令 / 方法                                                                | 期望                                                                                                                                                                 |
| ----- | ------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-4a | 改动文件清单在允许范围内       | `git diff --name-only`（对比 STEP 0 基线后的新增改动）                     | 仅 `src/lib/runtimeClient.ts`、`src/lib/tauri.ts`（可选/零）、`src/hooks/useConversation.ts`、`src/tests/runtimeClient.test.ts`、`src/tests/useConversation.test.ts` |
| AC-4b | 不改 Rust                      | `git diff --name-only \| grep src-tauri`                                   | 无命中                                                                                                                                                               |
| AC-4c | 不改 ChatPanel                 | `git diff --name-only \| grep ChatPanel`                                   | 无命中                                                                                                                                                               |
| AC-4d | 不改 package.json              | `git diff --name-only \| grep package.json`                                | 无命中                                                                                                                                                               |
| AC-4e | 不新增 daemon                  | `git diff --name-only \| grep -i daemon`                                   | 无命中                                                                                                                                                               |
| AC-4f | diff 聚焦（tauri.ts 未被重排） | `git diff --stat src/lib/tauri.ts` 与 `git diff src/lib/tauri.ts` 人工核对 | tauri.ts 若有改动仅是新增行，不出现大段 `-`/`+` 重排                                                                                                                 |

> verification-gate 注意：AC-2a 的 grep 目标**只限 useConversation.ts**。其余 18 个仍直接 import `@tauri-apps/api/event` 的文件（App.tsx、useJournal、useTopics、SessionList、ProcessingQueue、settings/\* 等）**不在本 phase 范围**，不得判为 AC-2 失败。见 Open Questions Q1。

---

## 验收顺序（执行 agent 自证 / verification-gate 复核）

执行 agent 完成后，**按此顺序**自证并把每步证据贴进最终消息：

1. `git status --short` + `git diff --name-only` → 证明改动范围（AC-4a~f）
2. `grep -n "@tauri-apps/api/event" src/hooks/useConversation.ts` → 期望无输出（AC-2a）
3. `grep -n "subscribe" src/hooks/useConversation.ts` → 期望命中 conversation-stream 订阅（AC-2b）
4. `npm test -- src/tests/runtimeClient.test.ts` → 期望全绿（AC-2c）
5. `npm test -- src/tests/useConversation.test.ts` → 期望全绿（AC-1b）
6. `npm test -- src/tests/ChatPanel.test.tsx src/tests/tauri.test.ts src/tests/ipc-contract.test.ts` → 期望全绿（AC-1a / AC-3a）
7. `npm test`（全量）→ 期望全绿（AC-1c）
8. `npm run lint` → 期望无错
9. `npm run build` → 期望无类型错误（AC-3d）
10. 人工核对 `git diff src/lib/tauri.ts` 与 `git diff src/hooks/useConversation.ts`：diff 卫生（AC-3b / AC-4f）

verification-gate 复核时，按 AC-1~AC-4 表格逐条独立执行命令打勾，不信任执行 agent 的自述。

---

## Assumptions

| #   | Assumption                                                                                                | Where verified                                                                | Risk if wrong                                                                   |
| --- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A1  | ADR §JournalRuntimeClient 给出的 `invoke<T>` + `subscribe` 接口草案是本 phase 的权威边界                  | docs/adr/ts-daemon-agent-runtime-migration.md:59-63                           | 低；ADR 是 Proposed 但 story 已 approved                                        |
| A2  | `@tauri-apps/api/event` 的 `listen` 在 jsdom 测试中可被 `vi.mock` 替换，且返回 `Promise<() => void>` 形态 | src/tests/setup.ts 与既有 19 处 `vi.mock('@tauri-apps/api/event')` 模式       | 低；既有测试已验证此模式                                                        |
| A3  | useConversation 的 effect body（:146-588 case 逻辑）在切换 subscribe 后行为不变                           | useConversation.ts 现有实现 + STEP 3 测试覆盖                                 | 中；subscribe 对外暴露 payload vs event 若不一致会回退                          |
| A4  | story 的 AC-2 "组件"在本 phase 等价于 useConversation，不要求迁移其余 18 个 import 点                     | story.md AC-2/AC-4 + design.md Phase 1 允许改动文件清单（仅 useConversation） | 中；若 verification-gate 误解为全部 19 点，会误判失败。**已在本 spec 显式标注** |
| A5  | TauriRuntimeClient 可在不依赖外部配置的情况下构造（默认实现）                                             | ADR "TauriRuntimeClient：封装现有 invoke() 和 listen()"                       | 低                                                                              |
| A6  | 本 phase 不要求 tauri.ts 既有函数改走 runtime client                                                      | AC-3 只要求签名兼容                                                           | 低；推荐最小改动                                                                |

---

## Open Questions（需用户澄清前不应推进的歧义）

| #   | 问题                                                                                                                                                                                                                           | 当前默认值                                                                                            | 为何要问                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | AC-2 "组件不再直接绑定 Tauri event 订阅" 的"组件"范围：本 phase 仅 useConversation，还是要求迁移所有 19 个 `@tauri-apps/api/event` 直接 import 点（App.tsx/useJournal/useTopics/SessionList/ProcessingQueue/settings/\* 等）？ | **本 spec 默认仅 useConversation**，依据 design.md Phase 1 允许改动文件清单。其余 18 点留后续 phase。 | 范围决定 AC-4a 是否通过、diff 大小、以及 verification-gate 判据。若用户预期"全部迁移"，本 spec 的 STEP 3 与验收映射需要扩展为多文件批次，且 diff 卫生规则无法保持。**建议用户确认：Phase 1 只收 useConversation，其余按热点逐步迁移** |
| Q2  | runtime client 是否需要一个"全局单例 + 可替换"的注入点（例如 `setRuntimeClient(client)`），还是 useConversation 直接 import 默认 TauriRuntimeClient 单例即可？                                                                 | **默认后者**：直接 import 默认单例，不引入 DI 容器。                                                  | 若 Phase 2 daemon 试点需要在运行时切换 client，没有注入点会要再改一次 useConversation。但本 phase 不强制解决 Phase 2 问题。**建议用户确认：本 phase 不引入运行时切换机制，保持最小**                                                  |

> Q1 与 Q2 都已在 spec 内给出"安全默认值"，执行 agent 可按默认推进。但若用户的真实意图与默认不符，越早澄清成本越低。**这两条不阻塞执行，但建议在派发执行 agent 前由用户确认。**

---

## Spec vs Reality Audit Log

| Date       | Finding                                                                                                                                                                                                                  | Action taken |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 2026-06-25 | 初始 spec 创建。已读 story/design/ADR/tauri.ts/useConversation.ts/types.ts；已 grep 核实 19 个 event import 点；已核实 useConversation 基线干净、tauri.ts/types.ts 仅有纯新增改动；已核实无 useConversation.test.ts 存在 | —            |
