---
story: ./story.md
design: ./design.md
round: 1
date: 2026-07-08
verifier: independent-subAgent (opencode)
result: fail
---

# Verify Report — STORY-20260708-workspace-tree-enhancements

独立核对，结论仅基于 story.md / design.md 契约与指定范围内的文件证据。

## result: fail

8/10 AC 通过；**AC-5（文件夹子项计数）与 AC-6（空文件夹提示）未实现**——design.md §6 明确要求在 `TopicTree.tsx` 落地，但代码中无对应渲染，且相关 locale 串 `emptyFolder` 为死串（已定义、从未消费）。类型检查全绿、目标测试全过（daemon 22/22、web 32/32），但测试通过 ≠ 验收通过：这两条 AC 找不到任何实现证据。

## 验收标准逐条核对

### AC-1 — 切换排序策略 ✅ pass

- `sortEntries` 支持 `name-asc`/`name-desc`/`mtime-desc`/`type-first`/`manual`：`apps/web/src/lib/sortTopics.ts:9-37`
- 排序菜单（4 策略 + 手动），点击更新 `treeSort`：`apps/web/src/components/TreeSidebar.tsx:786-851`
- 所有层级套用 `sortEntries`：`apps/web/src/components/TopicTree.tsx:62`
- 置顶区顺序由 `usePinned` 驱动、不随 `sortStrategy` 变化：`TreeSidebar.tsx:1111-1228`（pinned 列表来自 `pinnedItems`，排序仅作用于展开后子目录内容，不影响置顶项自身顺序）✓
- 测试：`TreeSidebar.test.tsx:231-247`（菜单展开 + active sort 更新为 `name-desc`）

### AC-2 — 排序策略持久化 ✅ pass

- 前端 get/set：`apps/web/src/hooks/useTreeSort.ts:7-11,24-50`（mount 读、`setStrategy` 立即写）
- runtimeClient case 映射到 settings：`apps/web/src/lib/httpRuntimeClient.ts:140-155`
- daemon 归一化 + 默认值兜底：`apps/daemon/src/settings/service.ts:141`（`normalizeTreeSort`）、`:187-199`（`VALID_TREE_SORTS` 含 manual，非法值回退 `name-asc`）、manual_order 透传 `:142-144`
- 跨会话验证（settings 文件 round-trip）：`settings/service.test.ts:153-173`
- 前端 hook 测试：`useTreeSort.test.tsx:19-46`

### AC-3 — 按类型识别文件图标 ✅ pass

- `json`/`yaml`/`yml`/`toml` → `config`：`apps/web/src/lib/fileKind.ts:68-72`
- 各类型有独立 SVG 线性符号（folder/folder-open/image/audio/video/markdown+mdx+text/code/config/html/pdf+docx/spreadsheet+csv/presentation/archive/other），`config` 为大括号专属符号不再兜底：`apps/web/src/components/FileTypeIcon.tsx:136-253`（config `:200-206`）
- 覆盖 12+ 类 ✓
- 测试：`TopicTree.test.tsx:39-75`（逐类型 aria-label 断言）、`fileKind.test.ts:5-15`

### AC-4 — 文件夹展开态图标反馈 ✅ pass

- `iconKind = isDir ? (isExpanded ? 'folder-open' : 'folder') : ...`：`apps/web/src/components/TopicTree.tsx:71-75`
- `folder-open` 独立图形：`FileTypeIcon.tsx:146-153`
- 测试：`TopicTree.test.tsx:168-173`（展开目录断言 `已展开的文件夹`）

### AC-5 — 文件夹子项计数 ❌ fail

- design.md §6 要求："`TopicTree.tsx` 拿到某文件夹的 children 后，行尾渲染 `children.length`（仅直接子项，不递归）"。
- **未实现**：`TopicTree.tsx:78-267` 行结构为 [拖拽把手?] → [chevron] → `FileTypeIcon` → 名称/输入框 → [@ / … 操作按钮]，**行尾无任何子项计数**。全树 grep `apps/web/src` 亦无针对树行子项计数的渲染。
- 无测试覆盖。
- 证据：`apps/web/src/components/TopicTree.tsx:193-266`（行尾仅为操作按钮区）

### AC-6 — 空文件夹提示 ❌ fail

- design.md §6 要求："展开后 `children.length === 0` 时渲染一行灰色斜体文案'空文件夹'"。
- **未实现**：`TopicTree.tsx:270-304` 当 `isDir && isExpanded && childState` 时，loading 显示"加载中…"，否则直接渲染递归 `<TopicTree entries={childState.entries}>`；`childState.entries` 为空时 `sorted` 为空数组、map 出无内容，**无任何空态文案**。
- 强信号：locale 串 `emptyFolder: '空文件夹'`（`apps/web/src/locales/zh.ts:19`）/ `'Empty folder'`（`en.ts:17`）已定义但**从未被消费**（全仓 grep 仅 2 处定义、0 处 `t('emptyFolder')` 调用）——疑似功能开了头未接线。
- 无测试覆盖。
- 证据：`apps/web/src/components/TopicTree.tsx:285-304`、`locales/zh.ts:19`、`locales/en.ts:17`

### AC-7 — 手动拖拽排序 ✅ pass

- `manual` 排序逻辑（尊重 manualOrder、未知项按 name-asc 追加）：`sortTopics.ts:27-36`
- 拖拽把手仅 `strategy==='manual'` 渲染，HTML5 `draggable` + `onDragStart`/`onDrop` 计算新顺序并回调 `onReorder`：`TopicTree.tsx:118-161`
- `TreeSidebar` 传 `onReorder={setManualOrderFor}`：`TreeSidebar.tsx:1168,1274`；`useTreeSort.setManualOrderFor` 整体 PUT：`useTreeSort.ts:52-56`
- 非 manual 时把手不出现 ✓
- 持久化：`workspace_tree_manual_order` 存 settings（`settings/service.test.ts:164-173`）
- 测试：`sortTopics.test.ts:28-35`、`TopicTree.test.tsx:199-230`

### AC-8 — 右键新建文件/文件夹 ✅ pass

- 菜单项（topic-folder 专属）：`TreeContextMenu.tsx:149-160` → `handleCreateFile`/`handleCreateFolder` 调 `onCreateFile`/`onCreateFolder(path)`
- 前端流程（占位输入 → 确认才发请求，符合 design §3"先展示临时占位、取消不留痕迹"）：`TreeSidebar.tsx:610-648`（`handleCreateFile`/`handleCreateFolder`/`handleCommitEdit`）
- daemon：`FilesService.createFile` `service.ts:318-337`、`createFolder` `:339-358`（`'create'` ChangeSet + 空内容、`target_exists` 409、`invalid_name`、`mkdirSync recursive:false`）
- 路由 `POST /files/create`（kind 分支 + 400 校验 + `handleFsError`）：`server.ts:1147-1171`
- runtimeClient case：`httpRuntimeClient.ts:590-602`
- 测试：`TreeContextMenu.test.tsx:7-33`、`files/service.test.ts:149-167`（含重名 409）

### AC-9 — 右键重命名 ✅ pass

- 菜单项（topic-file/topic-folder）：`TreeContextMenu.tsx:172-174` → `onRename(path)`
- inline 编辑态：`TopicTree.tsx:196-216`（input，Enter/blur 提交、Esc 取消）；`TreeSidebar.handleRename`/`handleCommitEdit` `:618-655`，提交调 `workspace_rename_file` 后 `loadTopics()` 刷新
- daemon：`FilesService.rename` `service.ts:360-389`、路由 `POST /files/rename` `server.ts:1173-1189`、runtimeClient case `httpRuntimeClient.ts:604-610`
- 树与文件系统名称同步 ✓
- 测试：`TreeContextMenu.test.tsx:35-56`、`TopicTree.test.tsx:175-197`

### AC-10 — 键盘导航 ✅ pass（附注）

- `role="tree"` + `tabIndex={0}` + `onKeyDown`：`TreeSidebar.tsx:1251-1257`；`role="treeitem"`：`TopicTree.tsx:82`
- `handleTreeKeyDown`：↓/↑ 可见行间移动、→ 展开或进首子项、← 折叠或回父级、Enter 切换目录/打开文件：`TreeSidebar.tsx:670-719`
- 焦点环用 `--focus-ring` token（非硬编码）：`TopicTree.tsx:101`；ref 聚焦匹配行 `:86-88`
- 测试：`TreeSidebar.test.tsx:216-229`（ArrowDown 移焦 + `data-path` 暴露）
- 附注（非 fail）：键盘容器只包裹主"专题"树 `TopicTree`（`TreeSidebar.tsx:1251`），未包裹"置顶"区展开的子树，故置顶子树内无键盘导航；Enter 对文件为选中/打开（AC 允许"打开…或进入重命名/选中状态"，满足）。

## 越界 / 偏差清单

1. **AC-5、AC-6 缺失（在范围内但未做）**——属"不漏"违规，非范围蔓延。详见上文。
2. **死 locale 串**：`emptyFolder`（zh/en）已定义但无消费点，是 AC-6 未完成的残留物，建议随 AC-6 一并接线或删除。
3. **实现分解与 design 受影响文件清单略有出入**（非偏差，记录备查）：design 列出 `TreeItem.tsx`、`useTopics.ts` 需改，实现者将"展开态图标/拖拽把手/inline 编辑/排序消费"逻辑统一迁入 `TopicTree.tsx` + `TreeSidebar.tsx`，未改 `TreeItem.tsx`/`useTopics.ts`。这是合理的实现层裁量，AC 覆盖不受影响。
4. **键盘导航覆盖面**：仅主专题树，置顶子树未纳入（见 AC-10 附注）。

## Won't 边界遵守情况

- 不做"每文件夹独立排序"：单一全局策略 ✓（`useTreeSort` 单 strategy）
- 不做"树内搜索高亮"：🔍 按钮存在但无逻辑 ✓（未越界实现）
- 不做"自定义图标/颜色"：仅类型驱动图标 ✓
- 不做"多选/剪切/撤销"：均未实现 ✓

**无边界越界。**

## 质量证据

- 类型检查：`apps/daemon` + `apps/web` `tsc --noEmit` 均 0 错误。
- 目标测试（与本故事相关）：
  - daemon：`settings/service.test.ts` + `files/service.test.ts` → **22 passed**
  - web：`sortTopics`/`fileKind`/`useTreeSort`/`TopicTree`/`TreeSidebar`/`TreeContextMenu` → **32 passed**
- 命令：`bunx vitest run <files>`（各 workspace 内）。

## 待用户裁决项

1. **AC-5 / AC-6 是否阻塞发布？** 两条 AC 均为 approved story 的明确验收点且 design 已给方案，当前完全未实现（非部分实现）。选项：(a) 打回补实现后再过验收门禁；(b) 若判定为可接受的可用性让步，需显式降级这两条 AC 并从 story 中移除/改期，否则不应标记 verified。**独立核对人立场：未实现即 fail，不建议放行。**

SUMMARY: result=fail | fail=2 | pending=0
