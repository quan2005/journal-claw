# Workspace Tree Prototype Alignment — 第二轮独立验收报告

- Story：`STORY-20260730-workspace-tree-prototype-alignment`
- 验收日期：2026-08-01（Asia/Hong_Kong）
- 验收角色：Codex 独立验收者；未参与本轮实现
- 工作树：`/Users/yanwu/Projects/github/journal_claw`
- 验收边界：只读审计实现、测试、diff 与证据；本文件是本轮唯一写入；未修改实现、story、design、测试或截图，未暂存、未提交
- 证据排除：未读取或依赖 `.superpowers/sdd/**`，未把旧 `verify-report.md` 的结论作为证据

## 1. 总体结论

**实现与自动化技术门禁通过；最终主观视觉门禁待用户确认。当前不可提交。**

- AC-1 至 AC-11 的当前实现事实与自动化技术证据均通过；未发现 Critical 或代码实现级 Important 缺陷。
- `bun run test` 新鲜执行为 **711/711 passed**；`bun run build`、`bun run lint`、故事范围 21 个文本文件的 Prettier、`git diff --check` 均 exit 0。
- 生产构建链和 Playwright fixture 成立：Playwright 通过 `npm run build && npx vite preview` 启动生产 bundle；fixture 全局拦截 daemon HTTP/SSE 与外网，只修改内存数据，不访问真实 workspace。为遵守“除本报告外不写文件”的边界，本轮只新鲜运行了不会刷新视觉截图的 3 个删除 E2E；既有视觉截图通过代码、尺寸、哈希和目视复核。
- 7 张 PNG（reference、浅色、浅色 hover、暗色、暗色 hover、暗色 focus、overlay）均为 **596×1100 px**；自动化几何、主题、hover、selected、focus 和 overlay 证据齐全。
- 当前对话中没有用户对本轮最终浅色、暗色与 overlay 截图作明确“通过/确认”的回复。设计明确要求最终由用户确认，并规定确认前不提交。因此自动化通过不能替代主观视觉验收。
- 全仓 `bun run format:check` exit 1，列出 67 个历史基线文件；**不包含本 story 的 21 个文本文件**，不能归因为本 story 失败，也未格式化任何无关文件。

## 2. AC-1..AC-11 证据表

| AC                         | 技术结论     | 实现与测试证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 根级标题与起始边距    | PASS         | 顶部只渲染“个人空间 + 常显排序”，没有 `Workspace`、Search、View layout 或额外工作空间分组：[`TreeSidebar.tsx:761`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:761)、[`TreeSidebar.test.tsx:184`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:184)。生产几何断言标题 x≈15、树 x≈8、宽≈282：[`workspace-tree.visual.spec.ts:343`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:343)。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AC-2 三层缩进与引导线      | PASS         | 34px、10px、marker/gap/guide offset 集中为 workspace token：[`workspace-tree.css:1`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:1)；递归 depth 与 wrapper：[`TopicTree.tsx:102`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TopicTree.tsx:102)、[`TopicTree.tsx:120`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TopicTree.tsx:120)；生产断言三层名称列差 10px、引导线 19/29px：[`workspace-tree.visual.spec.ts:400`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:400)。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AC-3 同级目录/文件名称对齐 | PASS         | 目录和文件共用固定 marker/name/trailing grid；目录条件分支只渲染 chevron，文件渲染类型 icon：[`WorkspaceTreeRow.tsx:69`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:69)、[`workspace-tree.css:96`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:96)、[`WorkspaceTreeRow.test.tsx:115`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:115)。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AC-4 文件类型 Glyph Tile   | PASS         | `glyph-tile` 唯一生产调用点在 workspace row：[`WorkspaceTreeRow.tsx:89`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:89)；所有 `FileTypeIconKind` 有完整 label、palette 和 glyph fallback：[`FileTypeIcon.tsx:12`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/FileTypeIcon.tsx:12)、[`FileTypeIcon.tsx:45`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/FileTypeIcon.tsx:45)、[`FileTypeIcon.tsx:143`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/FileTypeIcon.tsx:143)。tile 为 16px、`--radius-sm`，选中时切换 selected foreground：[`FileTypeIcon.tsx:273`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/FileTypeIcon.tsx:273)。范围外默认 variant 回归：[`WorkspaceTreeRow.test.tsx:173`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:173)。                                                                                                                                                                                                               |
| AC-5 行高与选中胶囊        | PASS         | 行高 34px、`--radius-pill`、选中消费 `--item-selected-bg`/`--item-selected-text`，无左侧 selection bar：[`workspace-tree.css:96`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:96)、[`workspace-tree.css:118`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:118)、[`WorkspaceTreeRow.test.tsx:80`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:80)。该 token 在浅/暗主题分别是规范定义的信号橙软底：[`globals.css:78`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:78)、[`globals.css:92`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:92)、[`globals.css:310`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:310)。生产断言每行 34px、胶囊宽 282px、半径≥17px：[`workspace-tree.visual.spec.ts:384`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:384)、[`workspace-tree.visual.spec.ts:494`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:494)。 |
| AC-6 尾部操作              | PASS         | DOM 固定顺序为 Ellipsis（更多）后 AtSign（引用），两者阻止行激活：[`WorkspaceTreeRow.tsx:141`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:141)。默认隐藏，hover/selected/focus 显示：[`workspace-tree.css:187`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:187)。单测与生产断言顺序、点击和显示：[`WorkspaceTreeRow.test.tsx:80`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:80)、[`workspace-tree.visual.spec.ts:522`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:522)。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| AC-7 展开/折叠             | PASS         | expanded 控制 chevron rotation 与 children wrapper 是否存在；折叠不渲染 wrapper，因此无残留引导线：[`TopicTree.tsx:71`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TopicTree.tsx:71)、[`TopicTree.tsx:120`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TopicTree.tsx:120)、[`workspace-tree.css:138`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:138)。组件/生产交互：[`TopicTree.test.tsx:229`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TopicTree.test.tsx:229)、[`workspace-tree.visual.spec.ts:564`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:564)。                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| AC-8 排序与键盘操作        | PASS         | 排序菜单、主树/pinned 键盘导航、Enter、右键、`@`、更多均保留：[`TreeSidebar.tsx:661`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:661)、[`TreeSidebar.tsx:717`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:717)。聚焦环在真实浏览器 computed 为 solid、约 2px：[`workspace-tree.visual.spec.ts:608`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:608)。回归测试：[`TreeSidebar.test.tsx:338`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:338)、[`TreeSidebar.test.tsx:388`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:388)、[`TreeSidebar.test.tsx:449`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:449)。                                                                                                                                                                                                                                                                                        |
| AC-9 暗色主题              | PASS（技术） | workspace CSS 使用语义/结构化 token，无固定浅色行背景：[`workspace-tree.css:10`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:10)。暗色语义 icon、selected、hover、focus 的 computed/对比度和截图由生产 Playwright 覆盖：[`workspace-tree.visual.spec.ts:571`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:571)。最终美观度仍属于用户主观视觉门禁，不由自动化代判。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| AC-10 目录无统计数字       | PASS         | `WorkspaceTreeRow` 无 count prop/DOM，目录尾部只可能有拖拽、更多、引用：[`WorkspaceTreeRow.tsx:127`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:127)。主树和 pinned 都复用该 row：[`TreeItem.tsx:198`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeItem.tsx:198)。测试与生产 DOM 均断言无 `.workspace-tree-child-count`：[`TopicTree.test.tsx:323`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TopicTree.test.tsx:323)、[`workspace-tree.visual.spec.ts:422`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:422)。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| AC-11 Web/Electron 删除    | PASS         | workspace 文件/目录显式使用 `hostConfirm`；Electron 优先 `electronAPI.ask`，plain Web 仅此操作 fallback `window.confirm`，SSR 无 `window` 返回 false；generic `hostAsk` 保持无宿主 false：[`TreeContextMenu.tsx:139`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeContextMenu.tsx:139)、[`hostBridge.ts:152`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/lib/hostBridge.ts:152)。确认后精确调用 `workspace_delete_file({relativePath: path})`，成功后 deselect、refreshPinned、loadTopics：[`TreeSidebar.tsx:558`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:558)。文件/目录确认与取消矩阵：[`TreeSidebar.test.tsx:283`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:283)、[`TreeSidebar.test.tsx:311`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:311)。本轮生产 E2E 新鲜执行取消文件、确认文件、确认目录 3/3 passed：[`workspace-tree.visual.spec.ts:635`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:635)。                           |

## 3. 架构、范围与回归

### 3.1 架构

- workspace 删除仍通过 `selectRuntimeClient().invoke('workspace_delete_file')`，组件未直连 daemon URL；Electron 能力仍只通过 `hostBridge.ts`。
- `git diff --name-only -- apps/daemon apps/desktop packages/contracts apps/web/src/lib/runtimeClient.ts apps/web/src/lib/httpRuntimeClient.ts package.json bun.lock` 无输出：daemon、协议、desktop preload、runtime client 契约和依赖均未改变。
- `hostAsk` 的函数体未变，plain Web 仍返回 false；新增 `hostConfirm` 只被 workspace topic 文件/目录删除选择，journal 等范围外删除继续走 `hostAsk`：[`hostBridge.ts:152`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/lib/hostBridge.ts:152)、[`TreeContextMenu.tsx:139`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeContextMenu.tsx:139)。
- 删除仍落到既有 `workspace_delete_file` → `/files` → ChangeSet 路径，没有复制 daemon 业务语义。

### 3.2 范围

- `glyph-tile` 的唯一生产调用位于 `WorkspaceTreeRow`；Journal/Identity 分支不使用 workspace presentation：[`WorkspaceTreeRow.tsx:89`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:89)、[`TreeItem.tsx:198`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeItem.tsx:198)、[`TreeItem.test.tsx:167`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeItem.test.tsx:167)。
- 目录只用 chevron；文件才用 Glyph Tile；目录 count 已从 workspace row 契约移除。
- 未发现新增 package/lockfile、第三方 icon/CSS 依赖或版本号变化。
- 工作树中大量 `.agents/`、`.claude/`、`.od-skills/` 等删除以及 untracked `output/` 已存在且与本 story 无关；本轮未触碰、未纳入可提交范围。

### 3.3 回归

- 主树与 pinned tree 共享 workspace row；pinned 文件/目录 chevron、操作、键盘导航有回归测试：[`TreeItem.test.tsx:7`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeItem.test.tsx:7)、[`TreeSidebar.test.tsx:428`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:428)。
- 排序、展开/折叠、选择、`@`、更多、右键和键盘七类能力均有组件或生产 E2E 证据。
- 生产 E2E 的 DELETE 只改变 fixture 的 `Map`；刷新后仍从同一内存 fixture 返回状态，不触碰磁盘 workspace：[`workspace-tree.visual.spec.ts:220`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:220)。

## 4. 测试与 mutation evidence

- `bun run test` 是当前权威入口；本轮没有运行 `bun test`。后者会错误混跑 Playwright/Vitest，不计为产品门禁。
- 全 workspace：contracts 20 + desktop 20 + daemon 236 + web 435 = **711 tests passed**。
- 目标测试覆盖标题、三层 depth、引导线、同级名称列、Glyph Tile、34px、胶囊、操作顺序、展开折叠、排序/键盘、主题 token、目录无 count 和删除矩阵。
- `tdd-evidence.md` 的两项隔离 mutation 证据真实说明测试敏感性：破坏 `topic-folder` 的 `hostConfirm` 分支会让 2 个测试失败；34px→35px 会让行节奏测试失败；恢复后转绿：[`tdd-evidence.md:35`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/tdd-evidence.md:35)、[`tdd-evidence.md:83`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/tdd-evidence.md:83)。
- 该文件明确是“实现完成后的测试敏感性验证”，**不能证明原始开发阶段的红→绿时序，也不能单独证明全部 AC**：[`tdd-evidence.md:7`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/tdd-evidence.md:7)。本报告只把它用于这两个 mutation 的敏感性判断。

## 5. 真实视觉证据

### 5.1 生产链与 fixture 安全

- Playwright `webServer.command` 为 `npm run build && npx vite preview --port 4173 --strictPort`，使用生产构建，不是静态复制品或开发 probe：[`playwright.config.ts:28`](/Users/yanwu/Projects/github/journal_claw/apps/web/playwright.config.ts:28)。
- `page.route('**/*')` 全局拦截网络；`127.0.0.1:17510` daemon HTTP/SSE 全部由 fixture fulfill；preview 只允许静态 GET/HEAD；Google Fonts 与所有其他外网均 abort，未处理 daemon 请求与意外网络请求必须为空：[`workspace-tree.visual.spec.ts:144`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:144)、[`workspace-tree.visual.spec.ts:263`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:263)、[`workspace-tree.visual.spec.ts:629`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:629)。
- fixture workspace 路径固定为 `/fixture`，目录和 DELETE 都只操作内存 `Map`：[`workspace-tree.visual.spec.ts:102`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:102)、[`workspace-tree.visual.spec.ts:197`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:197)、[`workspace-tree.visual.spec.ts:220`](/Users/yanwu/Projects/github/journal_claw/apps/web/e2e/workspace-tree.visual.spec.ts:220)。因此不会触碰真实 workspace。

### 5.2 截图清单

| 文件                     | 尺寸     | SHA-256                                                            | 证明状态                          |
| ------------------------ | -------- | ------------------------------------------------------------------ | --------------------------------- |
| `actual-light.png`       | 596×1100 | `466b5e32f724286cbc0c3b9458b5a6d2730dc8610a7ce74ca338421502468846` | 浅色、默认、选中                  |
| `actual-light-hover.png` | 596×1100 | `3b65f59fa5de793d0c5697e85151a28c3a35438acb21ff2ae3dd0fdb91b3c077` | 浅色 hover                        |
| `actual-dark.png`        | 596×1100 | `4c84d6dd68cd96e11a67ab7602cfc7a044cdea42746af141eddc0259dcfc8866` | 暗色、默认、选中                  |
| `actual-dark-hover.png`  | 596×1100 | `85f709358d4a91422b35df5bd95c3040fab778ee7f94e29f871def64432dc933` | 暗色 hover                        |
| `actual-dark-focus.png`  | 596×1100 | `8e41063eed7d65f6bc11eff66d01926fdc8f756973025b7e0f3162f3c7ff4d07` | 暗色键盘 focus                    |
| `overlay.png`            | 596×1100 | `d8cf5b74e75aa3ad1847caa270784b1aa5d77cd8c2275ffb8dd50f953a4ecb2c` | 浅色 actual/reference 50% overlay |
| `reference.png`          | 596×1100 | `a830faab4bd8b92422b6d11ce7a21651db12357075e9106529067804309ba99e` | 用户原型基准                      |

目视复核未见文字/图标截断、遮挡或目录统计数字；浅/暗、hover、selected 和 focus 均可辨。该判断只支持“技术证据可用”，不代替用户对美观、接近原型程度和最终接受度的主观确认。

## 6. 格式与工作树门禁

- 故事范围 21 个文本文件 `bunx prettier --check ...`：exit 0，全部符合格式。
- 全仓 `bun run format:check`：exit 1，67 个历史基线文件；输出中无本 story 的 21 个文本文件。`output/system-design/JournalClaw-System-Design-v0.1.md` 是用户的无关 untracked 文件，也在历史/无关列表内；未格式化。
- `git diff --check`：exit 0。
- `git diff --cached --name-only`：exit 0、无输出；没有暂存文件。
- E2E 前后截图 SHA-256 未变化；本轮 grep 只运行删除用例，没有刷新视觉证据。

## 7. 发现项

### Critical

无。

### Important

1. **最终主观视觉确认缺失，阻止提交。** 设计要求用户对最终真实渲染截图作确认，并明确“用户视觉确认和验收门禁通过前不提交”：[`design.md:243`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/design.md:243)、[`design.md:257`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/design.md:257)。story 当前门禁记录也写明“待最终视觉确认”：[`story.md:196`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/story.md:196)。本轮没有用户明确“通过/确认”回复，因此状态只能是：**技术门禁通过，最终视觉门禁待用户；不可提交。**

### Minor

1. **完整类型与删除边界的持久回归矩阵可更精确。** 实现通过穷举 `FileKind` 与统一 glyph-tile 分支覆盖所有支持类型，但类型测试没有单列 `config`，且只有 Markdown/HTML 显式锁定 `data-file-icon-variant="glyph-tile"`：[`fileKind.ts:1`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/lib/fileKind.ts:1)、[`TopicTree.test.tsx:123`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TopicTree.test.tsx:123)、[`WorkspaceTreeRow.test.tsx:115`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:115)。AC-11 的实现具备 SSR guard 和原样 `relativePath` 透传，但持久单测主要覆盖浏览器/Electron与根级路径，未单列 SSR、嵌套路径：[`hostBridge.ts:158`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/lib/hostBridge.ts:158)、[`TreeSidebar.test.tsx:283`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:283)。这是非阻塞测试精度债，不否定当前实现事实。
2. **`--focus-ring` 的文档与全局定义存在存量治理矛盾。** `docs/DESIGN.md` 把它描述为完整 `2px solid ...` shorthand：[`docs/DESIGN.md:186`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:186)；当前全局实际定义为颜色，workspace 样式与仓库既有样式以 `outline: 2px solid var(--focus-ring)` 消费：[`globals.css:83`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:83)、[`workspace-tree.css:53`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:53)。生产 E2E 已证实 computed outline 为 solid、约 2px，功能与视觉技术证据通过；该矛盾跨越既有调用点，属于存量 token 治理债，不作为本 story blocker。

## 8. 运行命令与退出码

| 命令                                                                                          | 退出码 | 结果                                                                       |
| --------------------------------------------------------------------------------------------- | -----: | -------------------------------------------------------------------------- |
| `bun run test`                                                                                |      0 | contracts 20、desktop 20、daemon 236、web 435；合计 711 passed             |
| `bun run build`                                                                               |      0 | 全 workspace 构建成功；仅既有 chunk-size 与 macOS 无签名提示               |
| `bun run lint`                                                                                |      0 | 0 errors、9 warnings；warnings 均位于本 story 范围外的既有文件             |
| `cd apps/web && bunx playwright test e2e/workspace-tree.visual.spec.ts --grep 'confirmation'` |      0 | 3/3 passed；生产 build + preview；取消文件、确认文件、确认目录；未刷新截图 |
| 21 个 story 范围文本文件 `bunx prettier --check ...`                                          |      0 | 全部符合 Prettier                                                          |
| `bun run format:check`                                                                        |      1 | 67 个历史/无关基线文件；无本 story 范围文件                                |
| `git diff --check`                                                                            |      0 | 无 whitespace error                                                        |
| `git diff --cached --name-only`                                                               |      0 | 无输出，未暂存                                                             |
| daemon/desktop/contracts/runtime/protocol/manifest 范围 `git diff --name-only -- ...`         |      0 | 无输出                                                                     |
| `sips -g pixelWidth -g pixelHeight evidence/*.png`                                            |      0 | 7 张均为 596×1100                                                          |
| `shasum -a 256 evidence/*.png`                                                                |      0 | 记录如 §5.2；E2E 前后未变化                                                |

## 9. 剩余 blocker 与可提交性

- 唯一剩余 blocker：**用户明确确认本轮最终浅色、暗色与 overlay 真实渲染截图。**
- 实现/自动化技术门禁：**通过**。
- 最终主观视觉门禁：**未通过（缺少用户确认，不是自动化失败）**。
- 可提交性：**不可提交**。

## 10. P2 follow-up（2026-08-01）

本节只读复审后续新增的三组测试；除本报告外未修改、暂存或提交任何文件。

### P2-1 — 完整 Glyph Tile 类型矩阵：CLOSED

- `workspaceGlyphTileCases` 覆盖当前全部可达文件 kind：`audio`、`video`、`text`、`markdown`、`mdx`、`pdf`、`docx`、`spreadsheet`、`presentation`、`image`、`html`、`code`、`config`、`csv`、`archive`、`other`；其中明确包含上一轮指出的 `config`、`mdx`、`other`：[`WorkspaceTreeRow.test.tsx:79`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:79)。该集合与生产 `FileKind` 的 16 个成员及 `fileTypeIconKindFromName` 的 MDX 特例一致：[`fileKind.ts:1`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/lib/fileKind.ts:1)、[`fileTypeIconKind.ts:3`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/lib/fileTypeIconKind.ts:3)。
- 每一例都渲染真实 `WorkspaceTreeRow`，没有 mock classifier 或 icon 组件，并从实际可访问 `img` 断言 `data-file-icon-variant="glyph-tile"` 与 exact `data-file-kind`：[`WorkspaceTreeRow.test.tsx:53`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:53)、[`WorkspaceTreeRow.test.tsx:177`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:177)。这不是只测独立 `FileTypeIcon` 的实现镜像。
- 目录对 `expanded=false/true` 两态参数化，明确断言 chevron 状态，同时排除 folder label、`data-file-icon-variant` 和 `data-file-kind`：[`WorkspaceTreeRow.test.tsx:134`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:134)。因此 collapsed/expanded 目录都不会误渲染 glyph。
- 测试重复受控：Markdown/HTML 的独立用例继续锁定 selected palette 与 HTML 专用语义色，完整矩阵只锁定分类/variant 契约；职责不同，未形成失控的重复断言。

### P2-2 — SSR 与嵌套 relativePath：CLOSED

- SSR 用例保存 `window` 原始 property descriptor 与对象引用，在 `try` 中删除 `globalThis.window`，断言 `hostAsk`/`hostConfirm` 均返回 false，并在 `finally` 中用原 descriptor 恢复；最后再断言对象引用一致：[`hostBridge.test.ts:139`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/hostBridge.test.ts:139)。即使中间断言失败，恢复路径仍执行；`afterEach(vi.restoreAllMocks)` 还会清理 confirm spy：[`hostBridge.test.ts:50`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/hostBridge.test.ts:50)。未发现全局污染。
- 删除矩阵的文件例使用嵌套路径 `帮助文档/AGENTS.md`，把 `path` 与 `expectedRelativePath` 明确锁定为相同完整相对路径：[`TreeSidebar.test.tsx:74`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:74)。
- 确认分支断言 exact `workspace_delete_file({ relativePath: '帮助文档/AGENTS.md' })`，并验证 deselect、pinned refresh、main tree reload：[`TreeSidebar.test.tsx:285`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:285)。取消分支由同一文件/目录矩阵运行，断言不调用 exact command 且不 deselect/refresh/reload：[`TreeSidebar.test.tsx:313`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:313)。两条分支都真实经过 context menu 与确认 callback，不是直接调用内部 handler。
- `beforeEach` 重置 root/pinned fixture、确认 mocks、runtime implementation，并在异步断言中使用 `waitFor`；未发现 P2 新用例的跨测试污染或顺序依赖：[`TreeSidebar.test.tsx:151`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:151)。

### Fresh focused verification

```text
cd apps/web
bunx vitest run src/tests/WorkspaceTreeRow.test.tsx src/tests/hostBridge.test.ts src/tests/TreeSidebar.test.tsx --reporter=verbose

Test Files  3 passed (3)
Tests       58 passed (58)
Exit code   0
```

Vitest 仍输出 `TreeSidebar.test.tsx` 中若干既有、非 P2 用例的 React `act(...)` warning；本次新增的 Glyph matrix、SSR 和删除矩阵均通过，未出现 P2 专属 warning 或失败。该存量测试噪声不重新打开上述两项 P2，也不改变总体结论。

### 非阻断 Minor 观察

1. `workspaceGlyphTileCases` 是人工维护的完整当前矩阵，没有编译期穷尽约束；未来若生产 `FileKind` union 新增成员，TypeScript 不会强制同步增加测试 case：[`WorkspaceTreeRow.test.tsx:79`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:79)。当前矩阵经逐项对照是完整的，因此不重新打开 P2-1；后续可考虑用以 kind 为 key 的穷尽 `Record` 降低漂移风险。
2. 两个 CSS helper 会幂等地把 workspace 样式注入 `document.head`，但文件结束前不主动移除：[`WorkspaceTreeRow.test.tsx:34`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/WorkspaceTreeRow.test.tsx:34)、[`TreeSidebar.test.tsx:21`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/tests/TreeSidebar.test.tsx:21)。Vitest 文件隔离和 helper 幂等性使本轮未出现跨文件污染或失败；这是测试卫生改进项，不影响三组 P2 断言真实性。

### Follow-up 结论

- 上一轮 Minor 1 中的两项测试精度债均已关闭。
- 未发现新的 Critical 或 Important 问题；上列 2 项 Minor 仅为非阻断测试卫生观察，不重新打开已关闭的 P2。
- 总体结论不变：**实现/自动化技术门禁通过；用户最终视觉确认仍是唯一 blocker；当前不可提交。**

## 11. Final acceptance / docs maintenance follow-up（2026-08-01）

> 本节记录 §1、§9、§10 之后发生的用户最终视觉确认与文档维护复审；本节结论取代上述章节中“待用户视觉确认”的时点结论。

### 最终用户验收记录：PASS

- Story 已新增直接事实记录：用户于 2026-08-01 对最终 596×1100 浅色、暗色与原型叠加证据明确回复“确认”：[`story.md:44`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/story.md:44)。
- 门禁轮次 10 与该事实一致，记录为“验收通过”，并明确主观视觉门禁已关闭：[`story.md:200`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/story.md:200)。
- AC-6 已按用户确认的最终 focus 截图与当前实现澄清：selected、hover 或键盘 focus 时显示尾部操作；三者均无时隐藏：[`story.md:108`](/Users/yanwu/Projects/github/journal_claw/stories/20260730-workspace-tree-prototype-alignment/story.md:108)。该表述与 workspace CSS 的 hover/selected/`:focus-visible`/`focus-within` 显示规则一致：[`workspace-tree.css:199`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:199)。

### Docs maintenance：PASS

`docs/DESIGN.md` 新增的“工作空间文件树”稳定规范与当前实现逐项一致，且没有把 Glyph Tile 或 workspace 几何扩散到范围外列表：

- **主树/置顶树：** 文档明确两者共享视觉与交互规则：[`DESIGN.md:199`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:199)。主树与置顶树都使用 `.workspace-tree`，置顶 topic 文件/目录经 `TreeItem` 复用 `WorkspaceTreeRow`：[`TreeSidebar.tsx:1066`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:1066)、[`TreeSidebar.tsx:1203`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:1203)、[`TreeItem.tsx:198`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeItem.tsx:198)。
- **标题与几何：** “个人空间 + 常显排序”、34px 行节奏、10px 层级缩进、7px inline、16px marker、5px gap 与集中 CSS token 完全一致：[`DESIGN.md:203`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:203)、[`workspace-tree.css:1`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:1)、[`TreeSidebar.tsx:771`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:771)。
- **目录：** 文档已精确写为“16px marker 槽内的 12px chevron glyph”，并禁止文件 glyph、文件夹 icon 和子项计数：[`DESIGN.md:205`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:205)。实现 SVG 为 12×12，marker 槽为 16px，目录分支不渲染 `FileTypeIcon`：[`WorkspaceTreeRow.tsx:69`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:69)、[`workspace-tree.css:128`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:128)。
- **文件与范围：** 文档限定 B · Glyph Tile 为 16px tile、72% glyph，并只用于 workspace 主树/置顶树：[`DESIGN.md:206`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:206)。`variant="glyph-tile"` 的唯一生产调用位于 `WorkspaceTreeRow`，其他 `FileTypeIcon` 调用保持默认 variant：[`WorkspaceTreeRow.tsx:89`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:89)、[`FileTypeIcon.tsx:273`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/FileTypeIcon.tsx:273)。
- **选中胶囊：** 文档要求 `--item-selected-bg` / `--item-selected-text` / `--radius-pill` 的完整信号橙软底胶囊、无左侧条：[`DESIGN.md:207`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:207)。实现直接消费相同 token，行高为 34px：[`workspace-tree.css:96`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:96)、[`workspace-tree.css:118`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:118)；浅/暗 token 与单一信号橙体系一致：[`globals.css:78`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:78)、[`globals.css:310`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:310)。
- **尾部操作、键盘与主题：** 文档记录 hover/selected/focus 显示“更多→引用”、按钮不触发行、主树/置顶树保留 roving tabindex、方向键、Enter、展开/折叠以及浅暗主题可辨：[`DESIGN.md:208`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:208)。实现的 DOM 顺序、事件隔离、显示条件与主/pinned 键盘 handler 一致：[`WorkspaceTreeRow.tsx:141`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/WorkspaceTreeRow.tsx:141)、[`workspace-tree.css:187`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:187)、[`TreeSidebar.tsx:661`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:661)、[`TreeSidebar.tsx:717`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/components/TreeSidebar.tsx:717)。
- **Focus token：** 文档现正确把 `--focus-ring` 定义为颜色 token：浅色由 `--record-btn` 55% 混合、暗色 60%，新建或本次修改的组件使用 `2px solid var(--focus-ring)`：[`DESIGN.md:186`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:186)。这与 `globals.css` 的实际定义及 workspace tree 的三个 focus rule 一致：[`globals.css:83`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:83)、[`globals.css:313`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/globals.css:313)、[`workspace-tree.css:53`](/Users/yanwu/Projects/github/journal_claw/apps/web/src/styles/workspace-tree.css:53)。文档同时把范围外的 legacy `outline: var(--focus-ring)` 明确列为独立治理债务，不要求本局部视觉 story 顺带迁移：[`DESIGN.md:276`](/Users/yanwu/Projects/github/journal_claw/docs/DESIGN.md:276)。因此未误扩大本 story 范围。

### Final scoped checks

| 命令                                                                                                | 退出码 | 结果                        |
| --------------------------------------------------------------------------------------------------- | -----: | --------------------------- |
| `bunx prettier --check stories/20260730-workspace-tree-prototype-alignment/story.md docs/DESIGN.md` |      0 | 两个维护文档均符合 Prettier |
| `git diff --check`                                                                                  |      0 | 无 whitespace error         |
| `git diff --cached --name-only`                                                                     |      0 | 无输出；未暂存              |

### 最终结论

- 最终用户视觉门禁：**通过**。
- Docs maintenance：**通过**。
- AC-1～AC-11、自动化技术门禁、P2 follow-up、最终主观视觉门禁和文档维护均已完成。
- **允许将 story 状态从 `in_progress` 标记为 `verified`。** 本复审只提供验收授权，不修改 story 状态。
- **本结论不代表授权暂存、提交、推送或发布。** 本轮未执行上述任何操作。
