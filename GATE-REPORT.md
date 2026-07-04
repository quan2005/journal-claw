---
date: 2026-06-29
story: stories/20260629-unified-chat-layout-polish/spec.md
verdict: PASS
scope: 'AC-1..AC-5 for unified chat layout polish; implementation files, tests, DEV-NOTES, and open-design blueprint'
---

# GATE-REPORT — P2 polish 统一对话面布局修复

## Verdict

PASS.

实现满足 AC-1..AC-5。`npm test` 仍以 exit 1 结束，但仅包含 spec 明确豁免的两个既有失败：`HistoryFloatingButton.test.tsx` 的 `left: 24px` 旧断言和 `SandboxPreview.test.ts` 的 Tabler Icons 路径断言；未发现本次新增失败。

我同时派发了两个只读 `opencode run` 子验收：

- `gate-layout-readonly`: AC-1 / HistoryFloatingButton 锚定链路，结论 PASS。
- `gate-auth-readonly`: AC-2..AC-4 / 授权 pill、composer 行、token 与交互，结论 PASS；观察项为 reduced-motion 单独块缺失、极窄屏未做 label 折叠。

## AC 核对

| AC                     | 结论                         | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 重叠修复          | PASS                         | spec 要求把历史按钮锚回内容区（`stories/20260629-unified-chat-layout-polish/spec.md:30`）。`UnifiedChatShell` 结构是 top bar 在上、content 容器在下，`ChatPanel` 被包在 content 容器内（`apps/web/src/components/UnifiedChatShell.tsx:176`, `apps/web/src/components/UnifiedChatShell.tsx:190`, `apps/web/src/components/UnifiedChatShell.tsx:204`）。`contentStyle` 真正加了 `position: 'relative'`（`apps/web/src/components/UnifiedChatShell.tsx:244`, `apps/web/src/components/UnifiedChatShell.tsx:255`）。`ChatPanel` 返回 Fragment，`historyControl` 是首个子节点（`apps/web/src/components/ChatPanel.tsx:416`, `apps/web/src/components/ChatPanel.tsx:419`），所以 `HistoryFloatingButton` 的 `position:absolute; top:8; left:8; zIndex:20`（`apps/web/src/components/HistoryFloatingButton.tsx:137`）现在锚定到内容容器而不是顶栏祖先。测试覆盖 content container computed position（`apps/web/src/tests/UnifiedChatShell.test.tsx:244`）。                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AC-2 授权 pill+popover | PASS                         | spec 要求非 select、紧凑 pill、4 个授权模式、当前项勾选、位于 composer 下方控件行（`stories/20260629-unified-chat-layout-polish/spec.md:31`）。`AuthModeToggle` trigger 是 button，不是 select（`apps/web/src/components/AuthModeToggle.tsx:70`），结构为色点 + 当前模式名 + chevron（`apps/web/src/components/AuthModeToggle.tsx:84`, `apps/web/src/components/AuthModeToggle.tsx:85`, `apps/web/src/components/AuthModeToggle.tsx:86`）。popover 使用 `role="menu"`（`apps/web/src/components/AuthModeToggle.tsx:103`），遍历 `AUTHORIZATION_MODES`（`apps/web/src/components/AuthModeToggle.tsx:108`; 模式定义 `apps/web/src/hooks/useAgentRun.ts:217`），每项是 `menuitemradio` + `aria-checked`（`apps/web/src/components/AuthModeToggle.tsx:114`），当前项渲染 check（`apps/web/src/components/AuthModeToggle.tsx:123`）。`ChatPanel` 在 bordered input box 结束后才渲染 `chat-composer-extras-row`（`apps/web/src/components/ChatPanel.tsx:971`, `apps/web/src/components/ChatPanel.tsx:979`），并用 spacer 推右（`apps/web/src/components/ChatPanel.tsx:981`, `apps/web/src/components/ChatPanel.tsx:1024`）。测试断言无 select、pill 在 extras row（`apps/web/src/tests/UnifiedChatShell.test.tsx:134`），以及 popover 4 项/勾选/选择关闭（`apps/web/src/tests/AuthModeToggle.test.tsx:38`, `apps/web/src/tests/AuthModeToggle.test.tsx:58`, `apps/web/src/tests/AuthModeToggle.test.tsx:71`）。 |
| AC-3 内置 pi 隐藏      | PASS                         | `composerExtras` 只在 `isCli` 时渲染 `<AuthModeToggle>`（`apps/web/src/components/UnifiedChatShell.tsx:168`），内置 pi 时为 `undefined`，`ChatPanel` 因短路不挂载 extras row（`apps/web/src/components/ChatPanel.tsx:979`）。测试覆盖 pi 不渲染 pill/row、切到 CLI 才出现（`apps/web/src/tests/UnifiedChatShell.test.tsx:261`, `apps/web/src/tests/UnifiedChatShell.test.tsx:270`）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| AC-4 谨迹 token        | PASS                         | spec 要求 radius、shadow、menu border、focus ring、`--record-btn`、字体与 pop-in 动效（`stories/20260629-unified-chat-layout-polish/spec.md:33`）。CSS 使用 `--radius-pill`/`--radius-lg`/`--radius-sm`（`apps/web/src/styles/auth-mode-toggle.css:22`, `apps/web/src/styles/auth-mode-toggle.css:95`, `apps/web/src/styles/auth-mode-toggle.css:119`），`--border-menu`（`apps/web/src/styles/auth-mode-toggle.css:94`），`--shadow-overlay`（`apps/web/src/styles/auth-mode-toggle.css:96`），`--focus-ring`（`apps/web/src/styles/auth-mode-toggle.css:43`, `apps/web/src/styles/auth-mode-toggle.css:134`），`--record-btn`（`apps/web/src/styles/auth-mode-toggle.css:58`, `apps/web/src/styles/auth-mode-toggle.css:140`, `apps/web/src/styles/auth-mode-toggle.css:158`），`--font-body`（`apps/web/src/styles/auth-mode-toggle.css:25`, `apps/web/src/styles/auth-mode-toggle.css:122`），以及 `auth-mode-toggle-pop-in`（`apps/web/src/styles/auth-mode-toggle.css:97`, `apps/web/src/styles/auth-mode-toggle.css:100`）。`rg "var\\(--accent\\)" apps/web/src/styles/auth-mode-toggle.css apps/web/src/components/AuthModeToggle.tsx` 无命中。全局 reduced-motion 兜底存在（`apps/web/src/styles/globals.css:2343`）。                                                                                                                                                                          |
| AC-5 不回退/绿         | PASS with allowed exemptions | `npm run build` 通过。`npm test`：desktop 3 files/13 tests passed，contracts 4 files/20 tests passed，daemon 88 files/546 tests passed，web 51 files passed + 2 failed / 375 passed + 2 failed；失败仅为 spec 明确豁免的 `HistoryFloatingButton.test.tsx:23`（expected `24px`, received `8px`）和 `SandboxPreview.test.ts:58`（expected `/assets/tabler-icons.css`）。单独 `cd apps/daemon && npx vitest run` 通过，88 files / 546 tests passed。新增/修改测试覆盖 AC-1、AC-2、AC-3 和 popover 交互（`apps/web/src/tests/UnifiedChatShell.test.tsx:243`, `apps/web/src/tests/AuthModeToggle.test.tsx:25`）。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Leader 诊断复核

### 问题 1：历史控件重叠

PASS. `position:relative` 没有加错到 shell，而是加在 header 的兄弟 content 容器上（`apps/web/src/components/UnifiedChatShell.tsx:190`, `apps/web/src/components/UnifiedChatShell.tsx:244`）。`HistoryFloatingButton` 仍保持内部 `top:8; left:8`（`apps/web/src/components/HistoryFloatingButton.tsx:137`），符合 Won't：不改按钮定位数值（`stories/20260629-unified-chat-layout-polish/spec.md:39`）。

锚定链路为：`UnifiedChatShell content div(position:relative)` -> `ChatPanel Fragment` -> `historyControl` -> `HistoryFloatingButton absolute div`。因为 content div 位于 top bar 下方，按钮 `top:8` 会落在对话内容区内，不会叠到 EngineSwitcher。`streamExtras` 仍在 scroll container 内正常流渲染（`apps/web/src/components/ChatPanel.tsx:572`），父级 relative 不改变滚动容器的 flex/overflow 行为。

### 问题 2：授权选择器

PASS. 统一对话面的授权选择器已从原生 select 改成 `AuthModeToggle` pill+popover（`apps/web/src/components/UnifiedChatShell.tsx:168`）。popover 四项来自 `AUTHORIZATION_MODES`（`apps/web/src/hooks/useAgentRun.ts:217`），标签复用 `authorizationModeLabel(m, t)`（`apps/web/src/components/AuthModeToggle.tsx:21`, `apps/web/src/components/AuthModeToggle.tsx:120`; resolver 在 `apps/web/src/components/AgentRunPanel.tsx:67`）。

`composerExtras` 的槽位语义从“输入框内部附加控件”更新为“composer extras row”里的任意 ReactNode（`apps/web/src/components/ChatPanel.tsx:75`），当前全仓只有 `UnifiedChatShell` 传入该槽（`rg -n "composerExtras" apps/web/src`），未发现其它调用被破坏。

## 找茬发现

- PASS: trigger 开关、点外部关闭、Esc 关闭都有实现（`apps/web/src/components/AuthModeToggle.tsx:42`, `apps/web/src/components/AuthModeToggle.tsx:49`, `apps/web/src/components/AuthModeToggle.tsx:79`）和测试（`apps/web/src/tests/AuthModeToggle.test.tsx:89`, `apps/web/src/tests/AuthModeToggle.test.tsx:97`）。
- PASS: 基础无障碍属性存在：trigger 有 `aria-haspopup="menu"` / `aria-expanded` / `aria-label`（`apps/web/src/components/AuthModeToggle.tsx:75`），popover 有 `role="menu"`（`apps/web/src/components/AuthModeToggle.tsx:105`），选项有 `role="menuitemradio"` / `aria-checked`（`apps/web/src/components/AuthModeToggle.tsx:114`）。
- Observation: 没有 focus trap。这里是非模态 menu/popover，不是 dialog；AC 未要求 trap，且 menuitemradio 可通过 Tab 到达，不作为 fail。
- Observation: 色点没有按授权等级区分颜色，全部使用单一 `--record-btn`（`apps/web/src/styles/auth-mode-toggle.css:53`）。这符合本项目单一信号橙和 AC-4 要求；若未来要表达 read-only/full-access 风险等级，需要扩展 spec。
- Observation: popover 菜单没有描述文案，只有模式名；因此不存在描述双语硬编码问题。模式名走 `authorizationModeLabel` + i18n（`apps/web/src/components/AgentRunPanel.tsx:67`）。
- Observation: `auth-mode-toggle.css` 没有局部 `@media (prefers-reduced-motion: reduce)`，但全局样式统一将动画/过渡缩短（`apps/web/src/styles/globals.css:2343`）。不作为 AC-4 fail。
- Observation: 极窄屏没有像 open-design 那样隐藏 label 的 container query；当前 trigger `max-width:160px`、label ellipsis、popover `max-width:min(280px,90vw)`（`apps/web/src/styles/auth-mode-toggle.css:19`, `apps/web/src/styles/auth-mode-toggle.css:62`, `apps/web/src/styles/auth-mode-toggle.css:88`），风险低，不影响发送键，因为 pill 在独立 extras row 而非 toolbar 内。
- PASS: HistoryFloatingButton 既有测试失败没有因本次修复变化为新增失败。当前失败仍是旧测试期望 `left: 24px` / `bottom: 100%`，实现保持 `top:8; left:8`（`apps/web/src/components/HistoryFloatingButton.tsx:137`），与 spec 的豁免项一致。

## 命令与输出摘要

```bash
npm run build
```

结果：PASS。workspace build 全部完成；保留 electron-builder author/icon/signing 警告与 Vite chunk size 警告。

```bash
npm test
```

结果：PASS with allowed exemptions。命令 exit 1，但只有两个 spec 豁免失败：

- `apps/web/src/tests/HistoryFloatingButton.test.tsx:23`: expected `left` `24px`, received `8px`.
- `apps/web/src/tests/SandboxPreview.test.ts:58`: expected `/assets/tabler-icons.css`.

通过摘要：

- `packages/contracts`: 4 files / 20 tests passed.
- `apps/desktop`: 3 files / 13 tests passed.
- `apps/daemon`: 88 files / 546 tests passed.
- `apps/web`: 51 files passed, 2 failed; 375 tests passed, 2 failed.

```bash
cd apps/daemon && npx vitest run
```

结果：PASS。88 files / 546 tests passed.

## 结论

本轮验收结论为 PASS，无 NEEDS-FIX 项。建议后续可考虑补一个局部 reduced-motion 断言和极窄屏 label 折叠策略，但这两项不是当前 AC 的阻断条件。
