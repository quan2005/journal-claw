# DEV-NOTES — P2 polish · 统一对话面布局修复

Story: `stories/20260629-unified-chat-layout-polish/spec.md`
Date: 2026-06-29
Executor: opencode (glm-5.2)

## 改了哪些文件

| 文件                                           | 性质 | 改动概要                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/UnifiedChatShell.tsx` | 编辑 | AC-1: `contentStyle` 加 `position: 'relative'` + `data-testid="unified-chat-content"`。<br>AC-2/AC-3: 把内联原生 `<select>` 替换为 `<AuthModeToggle>`，仅在 `isCli` 时渲染。<br>移除 `authSelectorRowStyle` / `authLabelStyle` / `authSelectStyle` 三个废弃样式对象；删除不再使用的 `AUTHORIZATION_MODES` / `authorizationModeLabel` 导入。`HistoryFloatingButton` 内部定位数值未改（Won't）。 |
| `apps/web/src/components/AuthModeToggle.tsx`   | 新增 | 紧凑 pill + popover 组件（仿 `SessionModeToggle` 的 trigger 设计，用谨迹 token 重写）。色点（`--record-btn`）+ 当前授权模式名 + chevron；popover 列 4 个 `menuitemradio`，当前项带勾选；外部 pointerdown / Escape 关闭。复用 `AUTHORIZATION_MODES` + `authorizationModeLabel` i18n，零 hardcode。                                                                                              |
| `apps/web/src/styles/auth-mode-toggle.css`     | 新增 | token 驱动的样式：圆角 `--radius-pill` / `--radius-lg` / `--radius-sm`、阴影 `--shadow-overlay`、菜单边框 `--border-menu`、聚焦环 `--focus-ring`、accent 用 `--record-btn`（非 `--accent`）。包含 `auth-mode-toggle-pop-in` keyframe（参考 open-design `composer-toolbox-pop-in`，translateY+scale 160ms ease-out 进场动效）。                                                                 |
| `apps/web/src/components/ChatPanel.tsx`        | 编辑 | AC-2: `composerExtras` 从「输入框 bordered box 内顶部」移到「bordered box 下方独立控件行」。新行结构 = flex + spacer（`flex:1`）把 pill 推右 + `border-top: 0.5px solid var(--divider)` 分隔（参考 open-design `.composer-row`）。同步更新 `composerExtras` 的 JSDoc。                                                                                                                         |
| `apps/web/src/tests/UnifiedChatShell.test.tsx` | 编辑 | 把原 select-based 断言（查 `宽松（带审计）` 在输入框内）替换为 pill-based 断言（`auth-mode-toggle` testid + trigger label + `chat-composer-extras-row` + 无 `select`）。新增 3 个测试：AC-1 内容容器 `position: relative`、AC-3 内置 pi 时无 pill、AC-3 切换到 CLI 时 pill 才出现。                                                                                                            |
| `apps/web/src/tests/AuthModeToggle.test.tsx`   | 新增 | 7 个测试覆盖 AC-2：trigger 渲染当前模式、popover 列 4 个 `menuitemradio`、当前项 `aria-checked`/`is-active`、选择触发 onChange + 关闭、重选当前模式不触发、Escape 关闭、外部 pointerdown 关闭。                                                                                                                                                                                                |

未改：`HistoryFloatingButton.tsx`（只改锚定上下文，不改其内部定位数值）、`EngineSwitcher.tsx`、整个 composer 的其余部分（Won't）。

## 每条 AC 如何满足

### AC-1（修复重叠）✅

- 给 `UnifiedChatShell` 的内容容器 `contentStyle` 加 `position: 'relative'`。
- `HistoryFloatingButton` 用 `position: absolute; top: 8; left: 8; zIndex: 20`，原本锚定到更高祖先（叠到顶栏 `EngineSwitcher` chip）；现在锚定在内容区（顶栏之下）。
- 未改 `HistoryFloatingButton` 内部定位数值（Won't）。
- 测试：`UnifiedChatShell.test.tsx` AC-1 用例断言 `getComputedStyle(content).position === 'relative'`（spec 推荐的可断言路径）。

### AC-2（授权选择器重设计为紧凑 pill + popover）✅

- 新组件 `AuthModeToggle.tsx`：trigger = 色点（`--record-btn`）+ 当前模式名 + chevron-down；popover 列 4 个授权模式（`read_only` / `workspace_write` / `full_access` / `wide_with_audit`），当前项 `menuitemradio` + `aria-checked="true"` + check icon。
- 不是原生 `<select>`、不是全宽（pill `max-width: 160px`，靠右）。
- 位置：pill 坐落在 composer 的控件行（textarea 下方一行，flex + spacer 推右 + border-top 分隔），不在输入框 bordered box 内部。
- `ChatPanel` 把 `composerExtras` 从 bordered box 内（顶部）移到 bordered box 下方的独立控件行。
- 测试：`AuthModeToggle.test.tsx` 7 个用例覆盖渲染/popover 开关/4 模式/勾选当前/onChange。

### AC-3（内置 pi 时隐藏）✅

- `UnifiedChatShell.tsx`: `composerExtras = isCli ? <AuthModeToggle …/> : undefined`。
- `ChatPanel.tsx`: `{composerExtras && (<div …>)}` —— `composerExtras` 为 undefined 时整行不挂载。
- 测试：`UnifiedChatShell.test.tsx` 新增 2 个 AC-3 用例（内置时不渲染；切换到 CLI 才出现）。

### AC-4（视觉走谨迹 token）✅

- 圆角：`--radius-pill`（trigger）/ `--radius-lg`（popover）/ `--radius-sm`（option）。
- 阴影：`--shadow-overlay`。
- 菜单边框：`--border-menu`。
- 聚焦环：`--focus-ring`（trigger 与 option 的 `:focus-visible`）。
- accent：`--record-btn`（色点、check icon、active option 背景 `color-mix`），非 `--accent`（危险红）。
- 字体：`--font-body`（trigger / option 文本）。
- 动效：`auth-mode-toggle-pop-in` keyframe（translateY(6px) scale(0.98) → 0,0；160ms `--ease-out`），参考 open-design 的 `composer-toolbox-pop-in`。
- 不照搬 open-design 配色（用谨迹自己的 `--bg` / `--item-text` / `--divider` 等）。

### AC-5（不回退 / 绿）✅

- `npm run build`：✅ 通过（tsc + vite build 全绿）。
- `npm test`：375 passed / 2 failed（HistoryFloatingButton + SandboxPreview，两者均为 spec 明确豁免的 pre-existing 失败 —— 前者断言 `left: '24px'` 但组件实际是 `left: 8`、后者断言 tabler-icons 资源路径，与本次改动无关）。
- `cd apps/daemon && npx vitest run`：✅ 88 文件 / 546 测试全绿。
- 我新增/修改的 2 个测试文件（16 个用例）全绿。

## 测试结果（真实数字）

| 命令                               | 结果                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run build`                    | ✅ Done（tsc + vite build）                                                                                |
| `npm test`（apps/web）             | 375 passed / 2 failed（**两者均 spec 豁免**：`HistoryFloatingButton.test.tsx` + `SandboxPreview.test.ts`） |
| 我新增/修改的测试（独立跑）        | `UnifiedChatShell.test.tsx` 9 passed + `AuthModeToggle.test.tsx` 7 passed = **16/16 全绿**                 |
| `cd apps/daemon && npx vitest run` | ✅ 88 files / 546 tests passed                                                                             |
| `npx prettier --check`（变更文件） | ✅ All matched files use Prettier code style                                                               |
| `npx eslint`（变更文件）           | ✅ 0 errors / 0 warnings（仓库整体有 1 个 pre-existing App.tsx 错误，与本次无关）                          |

## 设计决策与权衡

1. **composerExtras 通用槽的语义调整**：从「输入框内顶部」改为「输入框下方控件行」。spec 明确允许此调整（「本期只有授权 pill 用它」），未来若需在 composer 下方加更多控件（如模型选择、温度调节），可直接塞进 `composerExtras` 复合节点。
2. **控件行右对齐用 spacer，非 `justify-content: flex-end`**：与 open-design `.composer-row` 的 `composer-spacer { flex: 1 }` 模式一致，便于未来在左侧插入工具按钮时无需改结构。
3. **popover 向上开（`bottom: calc(100% + 6px)`）**：composer extras 行在输入框下方，popover 向上开避免溢出窗口底部；与 open-design 的 SessionModeToggle 一致。
4. **不引入 open-design SessionModeToggle 代码**（Won't）：参考其交互模式，用谨迹 token 重写一个独立的 `AuthModeToggle`，避免引入 open-design 的 contracts / Icon / i18n 依赖。
5. **未改 HistoryFloatingButton 内部定位数值**（Won't）：只恢复其锚定上下文（`position: relative` on 内容容器）。该组件的 pre-existing 测试断言（`left: '24px'`）与当前实现（`left: 8`）本就不一致，属迁移 WIP，不在本次修复范围。

## 未 commit

按 Leader 指令，未执行 `git add` / `git commit`。等待验收。

---

# 增补 · AuthModeToggle 位置调整（pill 融入输入框）

Date: 2026-06-29（同日，P2 polish 之后的位置微调小任务）
Executor: opencode (glm-5.2)

## 背景

上一轮 P2 polish 把授权 pill 放在 composer bordered box **下方独立行**（spacer 推右 + borderTop 分隔）。Leader 验收后认为视觉上不够融合，要求把 pill **移回 bordered box 内部**的底部工具行，与 add-file / stop / send 同行，融合进输入框，不再另起一行。

## 改了什么

| 文件                                           | 改动                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/ChatPanel.tsx`        | 1) 给 Fused container（bordered input box）加 `data-testid="chat-composer-fused"`。<br>2) 把 `composerExtras` 渲染**移进** Fused container 内部底部工具行的右侧控制组，顺序为 `[auth pill][stop?][send]`（pill 在 send 之前、右对齐、与 send 同基线），仿 open-design `composer-row` 右侧布局。<br>3) 删除 Fused container 之外那个独立 extras 行（`composerExtrasRowStyle` / `composerExtrasSpacerStyle` 及其渲染块 + JSDoc）。<br>未改 `AuthModeToggle` 组件本身、`UnifiedChatShell`、toolbar 左侧 add-file。 |
| `apps/web/src/tests/UnifiedChatShell.test.tsx` | 把「pill 在 `chat-composer-extras-row`（输入框下方独立行）」的断言改为「pill 在 `chat-composer-fused`（输入框内部）」：用 `fused.contains(pill)` 验证 pill 与 send 同一 bordered 容器；并断言旧的 `chat-composer-extras-row` 不存在。AC-3 内置 pi 不渲染 pill 的用例改为断言 fused 容器内 `querySelector('[data-testid=auth-mode-toggle]')` 为 null。                                                                                                                                                           |

## pill 现在的位置

- 坐落在 composer **bordered input box 内部**底部工具行（与 add-file 同一行，`justify-content: space-between` 把 `[auth pill][stop?][send]` 组推到右侧）。
- pill 紧凑、右对齐、与 send 同基线，不挤占 textarea 空间（textarea 仍是 100% 宽，pill 在其下方的工具行里）。
- 内置 pi 时 `composerExtras` 为 undefined → 工具行该位置不渲染任何东西（AC-3 保持）。
- `AuthModeToggle` 的 popover 仍向上开（组件未改），pill 现在贴着输入框底部，向上展开合理。

## 测试结果

| 命令                                                       | 结果                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run build`（apps/web: tsc + vite build）              | ✅ Done                                                                                                            |
| `pnpm exec vitest run src/tests/UnifiedChatShell.test.tsx` | ✅ 9 passed / 9                                                                                                    |
| `pnpm exec vitest run`（apps/web 全量）                    | 375 passed / 2 failed（`HistoryFloatingButton` + `SandboxPreview`，均为 spec 豁免的 pre-existing，与本次改动无关） |

## 未 commit

按 Leader 指令，未执行 `git add` / `git commit`。等待验收。
