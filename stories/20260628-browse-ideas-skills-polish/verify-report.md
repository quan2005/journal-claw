---
story: ./story.md
design: N/A
date: 2026-06-28
round: 1
result: fail
scope: '实现文件清单：apps/web/src/components/BrowsePaneHeader.tsx, apps/web/src/components/TreeSidebar.tsx, apps/web/src/components/IdeasWorkbench.tsx, apps/web/src/components/SkillsWorkbench.tsx, apps/web/src/styles/globals.css, apps/web/src/styles/skills-workbench.css, apps/web/src/locales/en.ts, apps/web/src/locales/zh.ts, apps/web/src/tests/IdeasWorkbench.test.tsx, apps/web/src/tests/TreeSidebar.test.tsx, apps/web/src/tests/SkillsWorkbench.test.tsx, apps/web/src/tests/light-theme-unit.test.ts'
---

# 验收报告 - Browse 页眉 + 想法去冗余 + 技能空态

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                | 结论 | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 Browse 页眉  | pass | `apps/web/src/components/BrowsePaneHeader.tsx:7-14` 定义可复用页眉组件，含 eyebrow/title/description；`apps/web/src/components/TreeSidebar.tsx:585-591`、`apps/web/src/components/TreeSidebar.tsx:664-670`、`apps/web/src/components/TreeSidebar.tsx:795-801` 分别在 Timeline、核心画像、专题分支共用该组件；`apps/web/src/locales/zh.ts:14-22` 与 `apps/web/src/locales/en.ts:12-20` 提供小写 eyebrow 和一句话描述；`apps/web/src/styles/globals.css:1253-1288` 使用页眉样式，标题为 `var(--text-xl)`；`apps/web/src/tests/TreeSidebar.test.tsx:114-134` 覆盖三页页眉渲染。                                                                                                                                                                |
| AC-2 想法去冗余   | pass | `apps/web/src/components/IdeasWorkbench.tsx:65-74` 定义含计数来源的 Tab；`apps/web/src/components/IdeasWorkbench.tsx:157-179` 渲染可点击 Tab 及计数，并把“新建想法”按钮放在同一 `.ideas-workbench-tabs` 行；`apps/web/src/styles/globals.css:1393-1405` 将筛选区设为 flex、含 spacer 和 token 化底边框；`apps/web/src/tests/IdeasWorkbench.test.tsx:125-144` 断言 `.ideas-workbench-stats` 不存在、三组旧统计 label 不存在、Tab 计数和“新建想法”存在；`apps/web/src/tests/IdeasWorkbench.test.tsx:165-175` 断言不再出现重复 section status bar；`apps/web/src/tests/light-theme-unit.test.ts:292-306` 断言 CSS 不含 `.ideas-workbench-stats`。                                                                                              |
| AC-3 技能空收藏态 | pass | `apps/web/src/components/SkillsWorkbench.tsx:345-346` 默认处于收藏 Tab 且读取收藏；`apps/web/src/components/SkillsWorkbench.tsx:390-414` 在 `favorites.length === 0` 时将收藏列表回退为 `skills`，否则仍按收藏过滤；`apps/web/src/components/SkillsWorkbench.tsx:416` 与 `apps/web/src/components/SkillsWorkbench.tsx:473-475` 只在收藏为空且已有技能时显示轻量提示；`apps/web/src/components/SkillsWorkbench.tsx:476-489` 继续复用现有 `SkillCard` 列表渲染；`apps/web/src/components/SkillsWorkbench.tsx:161-163` 保留卡片星标入口；`apps/web/src/locales/zh.ts:287` 与 `apps/web/src/locales/en.ts:261` 提供提示文案；`apps/web/src/tests/SkillsWorkbench.test.tsx:69-78` 断言已有技能列表、提示、grid、收藏按钮存在且“暂无收藏”不存在。 |
| AC-4 不回退       | fail | `npm run build` 已执行并以退出码 0 结束，输出包含 `apps/desktop build: Done`、`apps/daemon build: Done`、`apps/web build: Done`；`npm test` 已执行并以退出码 0 结束，输出包含 `packages/contracts 4 passed / 20 passed`、`apps/desktop 3 passed / 15 passed`、`apps/daemon 86 passed / 522 passed`、`apps/web 47 passed / 338 passed`。但 AC 同时要求“无新增硬编码数值”：`apps/web/src/styles/globals.css:197` 新增 `--workbench-btn-primary-color: #ffffff;`，`git diff -- apps/web/src/styles/globals.css` 可复现显示该行是新增硬编码色值；同文件已有 on-fill token `apps/web/src/styles/globals.css:265`、`apps/web/src/styles/globals.css:447` 可供复用或按主题覆盖。                                                                   |

## 范围完整性（不少，对照 story.md 范围）

- Browse 三页均有轻量页眉：见 AC-1 证据。
- 想法页删除统计卡并保留 Tab 作为唯一计数入口：见 AC-2 证据。
- 技能收藏为空时展示现有技能列表，并保留收藏引导：见 AC-3 证据。
- 不回退中的 build/test 已通过，但 token/硬编码约束未完全满足：见 AC-4 证据。

## 方案落实（不偏，对照 design.md）

N/A。本任务输入明确为无 design.md。

story.md 中“交棒 design（实现层）”条目核对如下：

- Browse 页眉抽为可复用组件：pass，`apps/web/src/components/BrowsePaneHeader.tsx:7-14`，三处共用见 `apps/web/src/components/TreeSidebar.tsx:585-591`、`apps/web/src/components/TreeSidebar.tsx:664-670`、`apps/web/src/components/TreeSidebar.tsx:795-801`。
- 想法删卡后按钮与筛选区对齐：pass，按钮位于 `.ideas-workbench-tabs` 内部且由 spacer 推到行尾，见 `apps/web/src/components/IdeasWorkbench.tsx:157-179` 与 `apps/web/src/styles/globals.css:1393-1405`。
- 技能空态默认列表复用现有列表：pass，`apps/web/src/components/SkillsWorkbench.tsx:390-414` 只改变过滤结果，`apps/web/src/components/SkillsWorkbench.tsx:476-489` 继续复用 `SkillCard`。
- 视觉改动 computed style 真实渲染链：未找到浏览器级 computed style 验证证据；本轮取证为源码、CSS contract unit test、`npm run build` 与 `npm test`。

## 越界检查（不多，对照 story 非目标 + design 范围）

- pass：Browse 列表内容、排序、点击行为未见改动归因。可复现命令 `git diff -- apps/web/src/components/TreeSidebar.tsx` 显示本 scope 中该文件的功能性变更集中于引入 `BrowsePaneHeader`、`useTranslation` 和三处分支页眉。
- pass：想法筛选逻辑与计数口径仍由 `getIdeaStats` 和 `filterIdeas` 承担，见 `apps/web/src/components/IdeasWorkbench.tsx:30-51`；`apps/web/src/tests/IdeasWorkbench.test.tsx:93-115` 覆盖统计与过滤口径。
- pass：技能收藏机制本身仍为 `favorites` state 加 localStorage 保存，见 `apps/web/src/components/SkillsWorkbench.tsx:367-375`；本次只改变收藏为空时的列表过滤回退，见 `apps/web/src/components/SkillsWorkbench.tsx:402-405`。
- 待用户裁决：scope 文件中存在无法归属到本 story 的同文件改动。`apps/web/src/locales/en.ts:393-405`、`apps/web/src/locales/zh.ts:418-430` 新增 Agent Run 与 Automation 文案；`git diff -- apps/web/src/locales/en.ts apps/web/src/locales/zh.ts` 还显示 MergeIdentity、Permissions、About 相关文案删除或改写；`apps/web/src/styles/globals.css:844-856` 改动 Automation 主按钮视觉。它们不对应 AC-1/2/3/4，也不在 Won't 允许范围内。若这些改动属于其他已批准 story，应从本验收 scope 排除并由对应 story 验收；若希望随本 story 合入，需要先回写 story 范围，否则按“不多”保守计 fail。

## 冗余（不重，对照 story.md）

- pass：Browse 页眉没有三页各写一套，证据为单组件 `apps/web/src/components/BrowsePaneHeader.tsx:7-14` 与三处共用调用。
- pass：想法统计没有同时保留卡片和 Tab；`apps/web/src/tests/light-theme-unit.test.ts:305` 断言 CSS 不含 `.ideas-workbench-stats`。
- pass：技能收藏空态没有新造列表组件，仍走 `SkillCard` 列表，见 `apps/web/src/components/SkillsWorkbench.tsx:476-489`。

## 结论

result: fail。

阻断项：

1. AC-4 的“无新增硬编码数值”未通过。`apps/web/src/styles/globals.css:197` 新增硬编码 `#ffffff`。建议改为现有 token，例如 `var(--status-on-fill)`，或在 story/design 明确允许新增该基础 token 并补足主题覆盖。
2. scope 中有无法归属到本 story 的 locale/automation 改动，需用户裁决是否排除出本轮验收范围或回写契约。

已通过项：

- AC-1、AC-2、AC-3 的用户可观察行为有源码与测试证据。
- `npm run build` 与 `npm test` 均已通过。

## 待用户裁决

1. scope 混入的非本 story 改动如何处理。
   - 接受为其他 story 的改动：成本是拆分验收范围或在对应 story 中验收，当前 story 可只保留 Browse/Ideas/Skills 相关证据。
   - 接受为本 story 的改动：成本是回写 story 范围，否则会长期形成实现与契约不一致。
