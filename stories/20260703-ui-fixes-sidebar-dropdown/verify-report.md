---
story: ./story.md
design: N/A
date: 2026-07-03
round: 1
result: pass
scope: >-
  git diff -- apps/web/src/App.tsx apps/web/src/components/EngineSwitcher.tsx
  apps/web/src/styles/engine-switcher.css apps/web/src/tests/App.test.tsx
  apps/web/src/tests/EngineSwitcher.test.tsx
---

# 验收报告 — UI 修复：全屏 workbench 空目录树栏 + 引擎下拉被窗口底部裁剪

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 空栏消除 | ✅ pass | 实现：`App.tsx:965-972` 新增 `needsLeftSidebar` 谓词，仅当 `activeCategory` 为 `journal`/`identity`/`topics` 时渲染左侧目录树栏（panel + divider）；`App.tsx:1097-1173` 将该列整体包裹在 `{needsLeftSidebar && (...)}` 中， fullscreen workbench 分类下整列不挂载。测试：`App.test.tsx:355-425` 新增 3 个测试覆盖 fullscreen 分类隐藏 sidebar、list 分类保留 sidebar、宽度记忆在来回切换后保持不变。 |
| AC-2 下拉不被裁剪 | ✅ pass | 实现：`EngineSwitcher.tsx:62` 新增 `flipUp` 状态；`EngineSwitcher.tsx:84-107` 用 `useLayoutEffect` 测量 wrapper bottom 与 popover height，空间不足时设置 `flipUp`；`EngineSwitcher.tsx:180-183` 将 `is-up` class 绑定到 popover；`engine-switcher.css:110-115` 用 `.engine-switcher__popover.is-up { top: auto; bottom: calc(100% + 6px); }` 实现向上展开。测试：`EngineSwitcher.test.tsx:46-90` 提供 `mockGeometry` 并在 `EngineSwitcher.test.tsx:164-188` 新增两组测试覆盖「空间不足向上翻」与「空间充足向下」。 |

## 范围完整性（不少，对照 story.md 范围）

story.md 范围条目逐条核对：

- ✅ 想法/技能/自动化分类下不再出现空目录树栏，workbench 直接毗邻图标导航栏 —— `App.tsx:965-972` 与 `App.tsx:1097-1173` 实现。
- ✅ 切回流水/专题/画像时目录树栏正常恢复 —— `App.tsx:965-972` 包含 `journal`/`identity`/`topics`，测试 `App.test.tsx:355-425` 验证恢复。
- ✅ 输入框处引擎下拉在贴近底部时向上展开 —— `EngineSwitcher.tsx` + `engine-switcher.css:110-115` 实现。
- ✅ 所有选项可点选 —— 截图 `ac2-bottom.png` 显示 popover 完整可见且选项未被裁剪；`EngineSwitcher.test.tsx` 测试 popover 渲染与交互。

## 方案落实（不偏，对照 design.md）

N/A —— 本 story 无 design.md。

## 越界检查（不多，对照 story 非目标 + design 范围）

diff 中所有改动均可归属到 AC-1/AC-2 或必要基础设施：

- `App.tsx`：仅增加 `needsLeftSidebar` 条件渲染，未重排四栏结构、未改 workbench 内容本身。
- `EngineSwitcher.tsx`：仅增加空间感知翻转逻辑，未引入 Popper / 通用弹出层重构。
- `engine-switcher.css`：仅增加 `.is-up` 反向定位样式，未新增 DESIGN.md token，仍使用 `--shadow-overlay` 等现有变量。
- 测试文件：仅补充 AC-1/AC-2 对应测试桩与 mock（`list_automation_templates`/`list_routines`、`mockGeometry` 等必要测试基础设施）。

未命中 story 非目标（即实现避开了这些禁区）：

- ✅ 未重排四栏布局结构。
- ✅ 未改 workbench 内容本身。
- ✅ 未做下拉组件通用弹出层重构，仅加方向感知。
- ✅ 未处理其他弹出层。
- ✅ 无 DESIGN.md token 硬编码。

越界清单：无。

## 冗余（不重，对照 story.md）

- 同一 AC 无重复实现。AC-1 仅由 `App.tsx` 一处条件渲染完成；AC-2 仅由 `EngineSwitcher.tsx` 一处翻转逻辑完成。

## 自动化检查

```bash
pnpm --filter @journal/web test
```

结果：`Test Files 54 passed (54) / Tests 394 passed (394)`。

```bash
pnpm --filter @journal/web lint
```

结果：`✖ 9 problems (0 errors, 9 warnings)`。9 条 warning 均位于未改动文件（`App.tsx:911` 依赖数组、`AgentRunPanel.tsx`、`IdeasWorkbench.tsx`、`TodoSidebar.tsx`、`useAgentRun.ts`），与本次 diff 无关；diff 涉及的 5 个文件无新增 lint 错误。

## 真实渲染验证

启动命令：`npm run desktop:dev`（daemon + web dev server + Electron；Electron 在 headless 验证环境下由 SIGTERM 结束，web server 在验证期间可访问 `http://localhost:1420`）。

Playwright 验证脚本：`stories/20260703-ui-fixes-sidebar-dropdown/verify-playwright.mjs`（channel: chrome, headless: true）。

- **AC-1**：截图 `ac1-ideas.png` 显示 自动化（ fullscreen workbench ）分类下左侧目录树栏消失，workbench 紧邻 NavRail；截图 `ac1-flow.png` 显示切回 流水 后目录树栏恢复，宽度保持 320px。检查输出：`panel count=0`（想法/技能/自动化）、`panel count=1`（流水）、`before=320, after=320`。
- **AC-2**：截图 `ac2-bottom.png` 显示 conversation panel 底部输入区引擎 pill「外部 · OpenCode · 默认」点击后 popover 向上展开，完整可见，未被窗口底边裁剪。DOM 中 popover 带有 `is-up` class，且 `rect.bottom` 位于 viewport 内。单元测试同时覆盖「空间充足时不下翻」的回归场景。

验证限制说明：当前默认可访问视图仅渲染一个 `EngineSwitcher` 实例（`WorkspaceView` footer，即对话面板底部输入区）。右侧面板 `WorkspaceChatShell` 未再挂载独立的引擎切换 pill，因此 AC-2 中「顶栏引擎切换 pill 的下拉行为不回归」无法通过真实浏览器在顶栏实例上复现；该回归防护由 `EngineSwitcher.test.tsx:177-188` 在组件层以 mock 几何数据覆盖。

## 结论

全部 AC 在代码与测试层面均得到实现与验证，diff 无越界、无冗余、无新增 lint 错误。真实渲染验证了 AC-1 的空栏消除与 AC-2 的底部翻转；AC-2 的顶栏回归场景由单元测试在共享组件层覆盖。本轮验收结论为 **pass**。

## 待用户裁决

无。

---

# Round 2 — AC-2 rework 复验

## 本轮复验范围与原因

Round 1 对 AC-2 的验收结论为 pass，但验证仅覆盖了 **Chat 视图**（对话面板底部输入区）的 `EngineSwitcher`。实现者当时使用 `.is-up` 反向展开方案：当 popover 底部空间不足时，通过 `position:absolute; top:auto; bottom:calc(100% + 6px)` 向上展开。

用户实测发现：在 **Workspace 视图**（全屏 workbench，例如「技能」分类）中，`.is-up` 方案仍然导致 popover 被中间栏遮挡。根本原因是 Workspace 右侧对话面板的某个祖先节点设置了 `opacity<1`（或 transform/filter），形成了独立的 **stacking context**；`position:fixed` 虽然改变 containing block，但**不会**让元素脱离该 stacking context 的绘制子树，因此 popover 仍被中间栏 `z-index:50` 的下拉层覆盖。Round 1 未覆盖该场景，造成误判。

本轮只复验 AC-2，按 rework 方案重新核对：

- `apps/web/src/components/EngineSwitcher.tsx`
- `apps/web/src/styles/engine-switcher.css`
- `apps/web/src/tests/EngineSwitcher.test.tsx`

## AC-2 复验表

| 检查项 | 结论 | 证据 |
|---|---|---|
| popover 挂载到 `document.body` | ✅ pass | `EngineSwitcher.tsx:180` `createPortal(popoverEl, document.body)`；测试 `EngineSwitcher.test.tsx:207-220` 断言 `popover.parentElement === document.body`。 |
| popover 使用 `position: fixed` | ✅ pass | `engine-switcher.css:100` `position: fixed`；`EngineSwitcher.tsx:100-115` 通过 `useLayoutEffect` 计算视口 `top/left` 并写入 inline style；测试 `EngineSwitcher.test.tsx:177-188` 断言 `popover.style.position === 'fixed'`。 |
| z-index 使用 `--workbench-menu-z` | ✅ pass | `engine-switcher.css:101` `z-index: var(--workbench-menu-z)`；Playwright 实测 `getComputedStyle(popover).zIndex === "1010"`，未硬编码 DESIGN token。 |
| tab 按钮文本不折行 | ✅ pass | `engine-switcher.css:169` `.engine-switcher__seg-btn { white-space: nowrap }`；Playwright 实测两个 tab 按钮高度 25px、文本无换行符；截图 `ac2-workspace-after.png`、`ac2-chat-after.png` 中「内置 pi 引擎」「外部 Agent (CLI)」均单行显示。 |
| 菜单在 Workspace 视图完整浮于中间栏之上 | ✅ pass | 截图 `ac2-workspace-after.png` 显示 popover 完整显示在技能卡片网格（中间栏）之上，无遮挡；Playwright 断言 popover rect 完全在 viewport 内且 `z-index=1010`。 |
| 菜单在 Chat 视图完整可见 | ✅ pass | 截图 `ac2-chat-after.png` 显示 popover 完整可见；Playwright 断言 `position=fixed`、`parentTag=BODY`、rect 在 viewport 内。 |
| 空间感知翻转 | ✅ pass | `EngineSwitcher.tsx:108-114` 计算 `spaceBelow` 与 popover 高度，空间不足时向上翻转；测试 `EngineSwitcher.test.tsx:177-197` 覆盖「空间不足向上翻」与「空间充足向下」两种场景。 |

## 方案核对结论

rework 方案完全符合 story 边界：

- **Portal + fixed**：使用 React 内建 `createPortal`（`EngineSwitcher.tsx:14,180`），无新依赖。
- **JS 计算视口坐标**：`useLayoutEffect` 测量 wrapper 与 popover 的 `getBoundingClientRect`，计算 `top/left`（`EngineSwitcher.tsx:96-158`），无 drop-then-flip 闪烁。
- **z-index 走现有 token**：`engine-switcher.css:101` 使用 `--workbench-menu-z`，未硬编码 DESIGN.md token。
- **文本不换行**：`engine-switcher.css:169` 增加 `white-space: nowrap`。

## 自动化检查结果

```bash
pnpm --filter @journal/web test
```

结果：`Test Files 54 passed (54) / Tests 395 passed (395)`。

```bash
pnpm --filter @journal/web typecheck
```

结果：`tsc --noEmit` 无错误。

## 真实渲染验证

启动方式：本地启动 `pnpm --filter @journal/daemon dev`（端口 17510）+ `npm run dev`（端口 1420），使用 Playwright（channel: chrome, headless）访问 `http://localhost:1420`。

验证脚本：`stories/20260703-ui-fixes-sidebar-dropdown/verify-playwright-round2.mjs`（因 pnpm workspace 模块解析，执行时复制到 `apps/web/` 下运行，脚本本身保留在 story 目录）。

- **Chat 视图**：导航至「流水」分类，点击对话面板底部引擎 pill，popover 完整可见；DOM 断言 `position=fixed`、`parentTag=BODY`、`z-index=1010`；两个 tab 按钮均未折行。截图：`ac2-chat-after.png`（1440×900，mtime 2026-07-03 17:52:12，晚于 CSS 改动时间 16:59:26）。
- **Workspace 视图**：先固定右侧栏，再导航至「技能」分类，点击引擎 pill，popover 完整浮于技能卡片网格之上，无遮挡；DOM 断言同上。截图：`ac2-workspace-after.png`（1440×900，mtime 2026-07-03 17:52:16，晚于 CSS 改动时间）。

既有截图（mtime 15:41）因早于 `white-space: nowrap` 改动，已确认存在「外部 Agent (CLI)」折行，故本轮重新捕获并覆盖。

Playwright 全部检查项通过（`failCount: 0`）。

## 越界检查（不多）

本轮 diff 改动均落在 AC-2 范围内：

- `EngineSwitcher.tsx`：仅将 popover 抽出为独立变量并通过 `createPortal` 挂载到 body，新增 `useLayoutEffect` 计算坐标与关闭监听，未重构通用弹出层。
- `engine-switcher.css`：popover 改为 `position: fixed` 并继续使用 `--workbench-menu-z`；seg-btn 增加 `white-space: nowrap`；无新 DESIGN token 硬编码。
- `EngineSwitcher.test.tsx`：新增 portal/fixed/flip 测试桩，无越界。

未命中 story 非目标：

- ✅ 未重排四栏布局结构。
- ✅ 未改 workbench 内容本身。
- ✅ 未做下拉组件通用弹出层重构。
- ✅ 未引入 Popper / Floating UI 等新依赖。
- ✅ 无 DESIGN.md token 硬编码。

越界清单：无。

## 冗余（不重）

AC-2  rework 仅由 `EngineSwitcher.tsx` + `engine-switcher.css` 一处实现，无重复代码。

## 本轮结论

AC-2 rework 方案（portal + fixed + `--workbench-menu-z` + `white-space: nowrap`）在代码、测试、真实渲染三个层面均通过验证，解决了 Round 1 遗漏的 Workspace 视图 stacking-context 遮挡问题。本轮复验结论为 **pass**。

## 待用户裁决

无。
