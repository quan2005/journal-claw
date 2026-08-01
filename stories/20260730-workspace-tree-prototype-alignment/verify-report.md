---
story: ./story.md
design: ./design.md
date: 2026-08-01
round: 1
result: fail
scope: '当前工作树中的 WorkspaceTreeRow.tsx、FileTypeIcon.tsx、TopicTree.tsx、TreeItem.tsx、TreeSidebar.tsx、hostBridge.ts、workspace-tree.css、globals.css、5 个聚焦单测文件、workspace-tree.visual.spec.ts 与 evidence/；只读旁证 TreeContextMenu.tsx、httpRuntimeClient.ts、daemon FilesService/ChangeSet 实现与测试'
---

# 验收报告 — 工作空间文件树对齐参考原型

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC    | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | ✅ pass | `apps/web/src/components/TreeSidebar.tsx:771-818` 只渲染“个人空间”标题和常显排序按钮；`apps/web/src/styles/workspace-tree.css:10-46` 定义 30 px 标题行、7 px 内边距和 28 px 圆形排序区。真实生产构建断言标题、旧 `Workspace`/Search 消失及 298 px 面板、标题 x≈15、树 x≈8：`apps/web/e2e/workspace-tree.visual.spec.ts:340-365`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| AC-2  | ✅ pass | 深度由 `apps/web/src/components/TopicTree.tsx:102-160` 递归传递；10 px 缩进和引导线集中在 `apps/web/src/styles/workspace-tree.css:1-8,96-108,227-242`。真实三层 `data-depth`、相邻名称列 10 px、引导线 x≈19/29 的 ±2 px 断言见 `apps/web/e2e/workspace-tree.visual.spec.ts:400-433`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AC-3  | ✅ pass | 目录箭头和文件 Glyph Tile 共用固定 marker 槽：`apps/web/src/components/WorkspaceTreeRow.tsx:69-95`；grid 固定 marker/名称列：`apps/web/src/styles/workspace-tree.css:96-107,128-145`。同级根目录/根文件、一级目录/一级文件名称 x 相等由 `apps/web/e2e/workspace-tree.visual.spec.ts:412-420` 断言。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| AC-4  | ✅ pass | workspace 文件统一传 `variant="glyph-tile"`：`apps/web/src/components/WorkspaceTreeRow.tsx:89-94`；16 px tile、约 11.5 px glyph、结构化圆角、选中前景和稳定 data 属性见 `apps/web/src/components/FileTypeIcon.tsx:262-308`。支持类型覆盖见 `apps/web/src/tests/TopicTree.test.tsx:123-160`，Markdown/HTML 主题与选中态见 `apps/web/src/tests/WorkspaceTreeRow.test.tsx:115-228`；真实明暗色尺寸、语义色和选中可辨性见 E2E `:435-499,576-599`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AC-5  | ✅ pass | 34 px 行高、完整 `--radius-pill` 胶囊、选中 token 且无左侧条：`apps/web/src/styles/workspace-tree.css:96-125`、`apps/web/src/components/WorkspaceTreeRow.tsx:53-68`。真实 15 行高度/中心节奏及胶囊 x≈8、宽≈282、高 34、半径≥17 见 `apps/web/e2e/workspace-tree.visual.spec.ts:384-398,494-521`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| AC-6  | ✅ pass | DOM 顺序固定为“更多(…)”后“引用(@)”且两个按钮均阻止冒泡：`apps/web/src/components/WorkspaceTreeRow.tsx:141-163`；默认隐藏、hover/selected 显示：`apps/web/src/styles/workspace-tree.css:187-207`。点击隔离单测 `apps/web/src/tests/WorkspaceTreeRow.test.tsx:230-243`；真实 hover、选中、更多菜单与 `@` 输入见 E2E `:522-557`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AC-7  | ✅ pass | 箭头状态来自 `expanded`：`apps/web/src/components/WorkspaceTreeRow.tsx:69-87`、CSS 旋转 `apps/web/src/styles/workspace-tree.css:138-145`；children wrapper 只在展开时存在并随内容高度绘线：`apps/web/src/components/TopicTree.tsx:120-161`。组件展开/折叠覆盖 `apps/web/src/tests/TopicTree.test.tsx:228-264`，真实点击后子项显隐见 E2E `:564-569`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AC-8  | ✅ pass | 排序/menu 语义 `apps/web/src/components/TreeSidebar.tsx:771-817`；主树和 pinned 方向键/Enter `:661-757`；主/置顶重复 path 的焦点查询被 `apps/web/src/components/TopicTree.tsx:59-69` 作用域隔离。focus ring 使用 token：`apps/web/src/styles/workspace-tree.css:53-58,123-126,223-225`。排序、右键、更多、`@`、方向键、Enter 的真实回归见 E2E `:547-627`；主/置顶键盘单测见 `apps/web/src/tests/TreeSidebar.test.tsx:311-399,422-548`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| AC-9  | ✅ pass | workspace scoped CSS 未写主题专用固定浅色，状态消费语义 token：`apps/web/src/styles/workspace-tree.css:10-249`。真实暗色下图标对比、选中前景、hover 和 2 px 聚焦环见 `apps/web/e2e/workspace-tree.visual.spec.ts:571-620`；留证 `evidence/actual-dark.png`、`actual-dark-hover.png`、`actual-dark-focus.png` 均为 596×1100。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| AC-10 | ✅ pass | `WorkspaceTreeRow` 没有 count prop/DOM，尾部只有拖拽把手与 `…`、`@`：`apps/web/src/components/WorkspaceTreeRow.tsx:10-28,127-164`；主树和 pinned 都复用该行：`apps/web/src/components/TopicTree.tsx:102-118`、`apps/web/src/components/TreeItem.tsx:198-213`。有子目录无数字单测 `apps/web/src/tests/TopicTree.test.tsx:323-337`，真实 DOM 无 `.workspace-tree-child-count`：E2E `:422-424`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| AC-11 | ❌ fail | 实现链存在：确认/取消 `apps/web/src/components/TreeContextMenu.tsx:134-140`，Electron 优先/Web `window.confirm`/SSR false `apps/web/src/lib/hostBridge.ts:152-158`，文件与目录共用 `workspace_delete_file` 且成功后才 deselect/刷新 `apps/web/src/components/TreeSidebar.tsx:558-579`，HTTP 与可恢复 ChangeSet 链见 `apps/web/src/lib/httpRuntimeClient.ts:622-627`、`apps/daemon/src/files/service.ts:475-490`、`apps/daemon/src/changeset/service.ts:139-147`。但 AC 的“2 类对象 × 2 种宿主环境 100%”没有完整可执行证据：TreeSidebar 单测 `apps/web/src/tests/TreeSidebar.test.tsx:261-309` 与 E2E `apps/web/e2e/workspace-tree.visual.spec.ts:635-681` 只删除/取消 `AGENTS.md` 文件；Electron 单测只验证桥接询问 `apps/web/src/tests/hostBridge.test.ts:53-80`。复现 `rg -n "workspace_delete_file\|删除文件夹\|topic-folder" <上述 5 个单测和该 E2E>` 只命中 `TreeSidebar.test.tsx:277,303` 两个文件断言，无目录场景。按“找不到证据就是 fail”保守判失败。 |

新鲜运行证据：

```text
bun run --filter @journal/web test
# exit 0；56 files passed，426 tests passed

CI=1 bun run --cwd apps/web test:e2e e2e/workspace-tree.visual.spec.ts --project=chromium
# exit 0；3 passed（真实 production build + Chromium）
```

## 范围完整性（不少，对照 story.md 范围）

- ✅ 顶部单层结构、三层几何、Glyph Tile、完整选中胶囊、尾部操作、暗色态和目录无计数均有当前实现与真实渲染证据，见上表 AC-1～AC-10。
- ✅ 7 类既有能力没有被拆成空壳：排序 `TreeSidebar.tsx:775-815`；展开/折叠 `TopicTree.tsx:120-161`；选择、`@`、更多和右键 `WorkspaceTreeRow.tsx:63-67,141-163`；方向键/Enter `TreeSidebar.tsx:661-757`。真实串联回归为 E2E `:547-627`。
- ✅ manual sort、重命名、加载/空目录和紧凑路径消费仍在：拖拽 `TopicTree.tsx:77-100`，重命名 `WorkspaceTreeRow.tsx:98-120`，加载/空目录 `TopicTree.tsx:128-159`，展示名继续通过 `displayTopicName` `WorkspaceTreeRow.tsx:47,122-124`。对应单测 `WorkspaceTreeRow.test.tsx:246-270,311-329`、`TopicTree.test.tsx:266-320,339-379`。
- ✅ pinned workspace 行与主树同步，Journal/Identity 没有套用 workspace 视觉：`TreeItem.tsx:198-213` 仅 `topic-file` 提前返回共享行；隔离回归 `TreeItem.test.tsx:84-192`。
- ❌ 删除范围尚不能验收为完整：实现覆盖 file/folder，但动态证据只覆盖文件，故 AC-11 的四象限成功率无法建立；此项与 AC-11 为同一 fail，不重复计数。

## 方案落实（不偏，对照 design.md）

- ✅ **组件边界**：唯一共享原语 `apps/web/src/components/WorkspaceTreeRow.tsx:10-167`；主树直接使用 `TopicTree.tsx:102-118`，pinned 的 `topic-file` 分支使用 `TreeItem.tsx:198-213`，其他列表保留原实现。
- ✅ **scoped 几何/token**：尺寸集中在 `workspace-tree.css:1-8`，固定 grid、名称省略、圆角、focus、动效和 reduced-motion 分别见 `:96-126,147-164,187-249`；根递归节点只传整数 depth。
- ✅ **依赖与默认外观**：继续复用 `FileTypeIcon`/`VectorGlyph`/现有 palette 和已安装 `lucide-react`；默认 HTML icon 不受 Glyph Tile palette 影响的回归在 `WorkspaceTreeRow.test.tsx:173-186`。`git diff -- package.json apps/web/package.json bun.lock` 无输出。
- ✅ **架构/删除数据流**：组件只经 `selectRuntimeClient`，无 daemon URL；Web/Electron 确认及 `workspace_delete_file → DELETE /files → FilesService/ChangeSet` 代码链完整，见 AC-11 代码证据。
- ✅ **真实视觉链**：E2E 从真实 App 拦截 daemon HTTP/SSE fixture `workspace-tree.visual.spec.ts:144-331`，使用 DPR 2 `:334-337`，做 DOM bounding box ±2 px `:340-529`，生成明暗/hover/focus 截图和 50% overlay `:36-73,531-629`。`file evidence/*.png` 显示 7 张证据均为 596×1100；E2E 新鲜运行 3/3 通过。
- ❌ **删除测试最低覆盖未落实**：design `design.md:215-229` 要求 plain Web 确认/取消、Electron 分支以及 workspace 文件/目录精确调用；当前缺目录场景。修复应至少参数化 `TreeSidebar.test.tsx` 的 `topic-file/topic-folder × confirm true/false`，并锁定目录的 workspace-relative path、删除后 deselect/pinned refresh/tree reload；再补一条真实目录删除 Web E2E，避免共享分支被未来拆开时静默回归。此项计入 AC-11 的同一 fail。
- ❌ **TDD 红→绿顺序无可验事实**：design `design.md:213-215` 明确要求先红测试再最小实现；当前实现与测试同时处于未提交工作树，代码、Git 历史和允许读取的 evidence 均不能证明失败测试曾先运行。六字标准规定无证据即 fail。需要在隔离副本中对关键回归（至少目录删除与视觉几何）保存“撤掉实现时红、恢复实现后绿”的可复现命令输出；实现者自述不能替代。此项独立计 1 fail。
- ✅ **工程门禁**：`bun run --filter @journal/web test` exit 0（56/56 files，426/426 tests）；`bun run --filter @journal/web build` exit 0（仅 chunk-size warning）；`bun run --filter @journal/web lint` exit 0（0 errors、9 个范围外 warning）；聚焦 5 文件测试 exit 0（57/57）；指定文件 `bunx prettier --check ...` 与 `git diff --check -- ...` 均 exit 0。
- ❌ **最终用户视觉确认缺失**：design `design.md:231-256` 明确要求用户对最终真实渲染截图确认，且确认前验收门禁不能通过。代码、自动化和 PNG 只能证明证据已生成，不能代替用户裁决；此项列入「待用户裁决」并独立计 1 fail。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ `WorkspaceTreeRow`、scoped CSS、五个组件/桥接修改、测试、E2E 和 evidence 均可归属 AC-1～AC-11、design 组件方案或必要验证基础设施；没有 daemon、权限、持久化、版本、release、package 或 lockfile 改动。
- ✅ `FileTypeIcon` 的新 HTML token 只被 `glyph-tile` 分支采用，默认分支仍消费原 palette：`FileTypeIcon.tsx:269-280,311-333`；没有把 workspace 主题扩散到默认 `WorkspaceView`/`FileChip`。
- ❌ **共享 `hostAsk` 带来范围外行为变化，待裁决**：`hostBridge.ts:153-157` 令所有 plain-Web `hostAsk` 调用从固定 false 变成 `window.confirm`。除本 AC-11 外，它还影响 workspace 重命名错误分支 `TreeSidebar.tsx:628-633`，以及 story 明确排除的详情面板“重置助手提示词” `DetailView.tsx:2157-2175`。design `design.md:190-198` 要求修改共享 bridge，但 story `story.md:148-150` 将场景限定到 workspace 树并只授权恢复 workspace 删除；两层契约冲突按 story 优先、保守 fail。此项独立计 1 fail。
- ❌ **移除无行为布局按钮的授权含糊，待裁决**：HEAD 的 `View layout` 按钮无 onClick（`git show HEAD:apps/web/src/components/TreeSidebar.tsx` 原 859-876）；当前实现将其与 Search 一并移除，并由 `TreeSidebar.test.tsx:162-170` 锁定。design `design.md:72-81` 明确要求移除布局按钮，但 story AC-1 `story.md:69-74` 只点名 `Workspace`、搜索和额外“工作空间”标题，边界 `story.md:150` 又仅明确授权删除搜索入口。它可能是“顶部只保留标题+排序”的合理落实，也可能是 design 扩大意图；按规则不替用户决定，独立计 1 fail。

## 冗余（不重，对照 story.md）

- ✅ 主树与 pinned 没有两套行视觉：`TopicTree.tsx:102-118` 和 `TreeItem.tsx:198-213` 都归一到 `WorkspaceTreeRow`。
- ✅ Glyph Tile 是 `FileTypeIcon` 的单一可选 variant，未复制文件分类或引入第二套图标库：`FileTypeIcon.tsx:4-10,269-308`。
- ✅ Web/Electron 确认集中在 `hostAsk`，删除请求集中在 `TreeSidebar.handleDelete`；没有并行的 `delete_topic`/直连 daemon 实现。
- ✅ 主树与 pinned 的独立焦点 state 是两个独立 `role=tree` 的必要状态隔离，不是重复 AC 实现；重复 path 回归见 `TreeSidebar.test.tsx:482-501`。

## 六字结论

| 标准 | 结论    | 摘要                                                                                       |
| ---- | ------- | ------------------------------------------------------------------------------------------ |
| 不漏 | ✅ pass | AC-1～AC-11 均能定位到实现。                                                               |
| 不重 | ✅ pass | 行、图标 variant、确认和删除路由均为单一实现。                                             |
| 不偏 | ❌ fail | AC-11 四象限证据、design 要求的 TDD 事实和最终用户视觉确认未齐。                           |
| 不倚 | ❌ fail | AC-1～10 证据充分，AC-11 只有文件动态证据，完成度明显不均。                                |
| 不多 | ❌ fail | 共享 `hostAsk` 的全局 plain-Web 行为及布局按钮删除存在 story/design 范围冲突，须用户裁决。 |
| 不少 | ✅ pass | 除 AC-11 验证缺口外，story 明示和隐含范围均有对应实现；缺口未被重复计数。                  |

## 结论

`result: fail`。本轮共有 **5 个独立 fail 项**，其中 **3 项待用户裁决**：

1. **高风险**：AC-11/删除测试缺少目录，无法证明文件/目录 × Web/Electron 的 100% 成功率。
2. **中风险**：共享 `hostAsk` 改变详情面板等范围外 plain-Web 行为（待裁决）。
3. **中风险**：最终真实渲染截图尚未获得用户视觉确认（待裁决）。
4. **低风险**：移除无行为 `View layout` 的意图授权含糊（待裁决）。
5. **过程门禁**：没有可独立复现的 TDD 红→绿事实。

修复顺序：先补目录删除确认/取消与刷新测试并保存红绿证据；再由用户裁决共享 `hostAsk` 和布局按钮范围，接受则回写 story（意图/边界），不接受则收窄实现；最后对 6 张 actual/overlay 视觉证据明确接受或指出锚点偏差，之后重跑完整 test/build/lint/E2E 与 verification-gate。

## 待用户裁决

1. **是否接受共享 `hostAsk` 在整个 plain Web 应用中回退 `window.confirm`？**
   - 接受：workspace 删除最简且复用统一，但详情页重置助手提示词、workspace 错误提示等其他调用也获得浏览器确认行为；需在 `story.md` 更新场景/能力边界。
   - 不接受：维持 story 的 workspace-only 边界；需将 Web fallback 限定到删除确认路径或新增显式、受控参数，避免改变其他调用者。
   - 当前按不接受前的保守状态计 fail。

2. **是否接受删除旧的无行为 `View layout` 按钮？**
   - 接受：顶部真正只剩“个人空间+排序”，视觉更符合已选方案 B；需把此用户结果补入 `story.md` AC-1/边界。
   - 不接受：需恢复该按钮；代价是顶部不再是 design 定义的单层两元素结构。
   - 当前按未授权删除计 fail。

3. **是否接受最终真实渲染视觉结果？**
   - 请核对 `evidence/actual-light.png`、`actual-light-hover.png`、`actual-dark.png`、`actual-dark-hover.png`、`actual-dark-focus.png` 与 `overlay.png`。
   - 接受：记录确认事实后可解除该门禁；仍须修复其他 fail。
   - 不接受：指出具体标题、名称列、引导线、图标、胶囊或状态偏差，重新生成证据并复验。
   - 当前在明确接受前计 fail。

待用户裁决项数：**3**。
