result: fail

# STORY-20260708-composer-multi-model R3 验收报告

验收基准：
- 本轮只复核 `stories/20260708-composer-multi-model/story.md` AC-5。
- AC-1、AC-2、AC-3、AC-4、AC-6 沿用 r2 结论，本轮不重复核对。
- 复核对象限定为 r2 指出的 ChatPanel composer 结构化 token 偏差，以及 composer 范围内是否仍有遗漏的硬编码圆角/聚焦环浓度。

## AC-5 — 输入框整体重设计落地

结论：fail

已修复的 r2 点名问题：
- `CHAT_PANEL_HIGHLIGHT_RING` 已从硬编码 `color-mix(... 22% ...)` 改为 `inset 0 0 0 1px var(--focus-ring)`：`apps/web/src/components/ChatPanel.tsx:48`。
- fused composer 容器圆角已从硬编码数值改为 `var(--radius-lg)`：`apps/web/src/components/ChatPanel.tsx:781`。
- 模型 pill 圆角已从硬编码数值改为 `var(--radius-pill)`：`apps/web/src/components/ChatPanel.tsx:986`。
- 模型菜单容器圆角已从硬编码数值改为 `var(--radius-lg)`：`apps/web/src/components/ChatPanel.tsx:1039`。
- 思考等级 pill 圆角已从硬编码数值改为 `var(--radius-pill)`：`apps/web/src/components/ChatPanel.tsx:1144`。
- 思考等级菜单容器圆角已从硬编码数值改为 `var(--radius-lg)`：`apps/web/src/components/ChatPanel.tsx:1168`。

token 用法核对：
- `docs/DESIGN.md` 要求结构化 token 强制消费，禁止组件硬编码圆角、阴影、边框、聚焦环数值：`docs/DESIGN.md:179-187`、`docs/DESIGN.md:248-249`、`docs/DESIGN.md:264`。
- `--radius-lg` 定义为菜单/对话框/卡片圆角，适用于 fused composer 容器与两个菜单容器；`--radius-pill` 定义为胶囊圆角，适用于模型 pill 与思考等级 pill：`docs/DESIGN.md:183`。
- `--focus-ring` 是颜色 token 定义，仓库中已有 `outline: var(--focus-ring)` 与 `outline: 2px solid var(--focus-ring)` 两类用法，例如 `apps/web/src/styles/nav-rail.css:67`、`apps/web/src/styles/globals.css:1200`、`apps/web/src/styles/auth-mode-toggle.css:44`。因此 `inset 0 0 0 1px var(--focus-ring)` 在 box-shadow 中消费该颜色 token，消除了 r2 指出的 22% 浓度硬编码。

仍未通过的原因：
- composer 的模型菜单内部菜单项仍硬编码圆角 `borderRadius: 6`：`apps/web/src/components/ChatPanel.tsx:1087`。
- composer 的模型菜单“管理模型”项仍硬编码圆角 `borderRadius: 6`：`apps/web/src/components/ChatPanel.tsx:1119`。
- composer 的思考等级菜单内部菜单项仍硬编码圆角 `borderRadius: 6`：`apps/web/src/components/ChatPanel.tsx:1189`。
- 这些节点属于本故事新增/调整的模型菜单与思考等级菜单内部交互项，仍落在 AC-5 的 composer 作用域内；AC-5 明确要求“遵循 docs/DESIGN.md 结构化 token”，所以本轮不能翻正。

## 越界/偏差清单

- 偏差：r2 点名的 6 处已改为 token，但 composer 的模型菜单/思考等级菜单内部仍有硬编码圆角遗漏，见 AC-5 失败点。
- 未发现本轮修复引入新的交互越界；本轮未重新核对 AC-1~AC-4、AC-6。

## 运行验证

```text
cd apps/web && bunx vitest run src/tests/ChatPanel.test.tsx
Test Files  1 passed (1)
Tests       3 passed (3)
Duration    1.44s
```

```text
cd apps/web && bunx tsc --noEmit
exit code 0, no output
```

## 待用户裁决项

- 无。剩余问题仍是 AC-5 契约内的结构化 token 要求，不作为待裁决项放行。

SUMMARY: result=fail | fail=1 | pending=0
