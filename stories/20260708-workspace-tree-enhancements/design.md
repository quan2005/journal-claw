---
story: ./story.md
status: approved
created: 2026-07-08
---

# Design: Workspace 文件树排序、图标与操作效率增强

对应 story `STORY-20260708-workspace-tree-enhancements` 的交棒清单，逐项给实现方案。原则：复用已有的 settings KV 存储、已有的 ChangeSet 写入模式、已有的右键菜单 prop 模式——不新增架构层。

## 1. 排序策略持久化（AC-1, AC-2）

**复用现成的 `WorkspaceSettings` 通用 KV 存储**（`apps/daemon/src/settings/service.ts:23` 已有 `[key: string]: unknown` 索引签名，`pinned` 字段就是这么存的），不新建接口。

- 新 key：`workspace_tree_sort: 'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first'`（默认 `'name-asc'`）。
- `normalizeSettings`（`service.ts:115-137`）里加一条归一化，非法值兜底为默认值。
- 前端新增 `apps/web/src/hooks/useTreeSort.ts`，仿 `useTheme.ts` 的 get/set 模式，调 `runtimeClient.invoke('get_workspace_tree_sort')` / `set_workspace_tree_sort`；`httpRuntimeClient.ts` 里加两个 case，映射到 `getSettings()`/`updateSettings({ workspace_tree_sort })`，与 `get_workspace_theme` 完全同构。
- 排序函数 `apps/web/src/lib/sortTopics.ts`：`sortEntries(entries: TopicEntry[], strategy, manualOrder?: Record<string, number>): TopicEntry[]`，纯函数、无副作用，`useTopics.ts` 的 `listDir` 结果传入即可，不改 daemon 返回顺序。
- 置顶区排序逻辑不动（`usePinned.ts` 现状保留）。

## 2. 手动拖拽排序（AC-7）

**沿用 `pinned` 的 order 字段思路，但存储位置不同**：pinned 是扁平列表，manual order 需要"每一层级"各自的顺序，不能塞进同一个数组。

- 新 key：`workspace_tree_manual_order: Record<parentPath, string[]>`——每个父目录路径映射到其直接子项的名称顺序数组。只有排序策略为 `'manual'` 时才读取/写入这个 key，其余策略下它保持不用、不清空（切换回手动时顺序还在）。
- 拖拽结束后，前端计算新顺序数组，整体 PUT 到 `workspace_tree_manual_order[parentPath]`，走同一个通用 settings PUT，不新开路由。
- 拖拽把手：`TreeItem.tsx` 内 `strategy === 'manual'` 时渲染，用现成的 HTML5 draggable（`draggable` 属性 + `onDragStart/onDrop`），不引入新依赖（ponytail 铁律：已装依赖优先，此处连依赖都不需要）。
- 排序渲染顺序 = 若 `strategy === 'manual'` 且该父目录在 `workspace_tree_manual_order` 中有记录 → 按记录顺序，记录里没有的新增项追加到末尾；否则按 `sortEntries` 兜底（`name-asc`）。

## 3. 新建文件/文件夹、重命名（AC-8, AC-9）

**重命名**：daemon 端已完整存在（`FilesService.rename()`，`apps/daemon/src/files/service.ts:318-348`，路由 `POST /files/rename`），前端 `httpRuntimeClient.ts:567-585` 也已有 `workspace_rename_file` case。**这部分不用新写 daemon 代码**——只需在 `TreeContextMenu.tsx` 的 `items` 数组加一个"重命名"菜单项，触发 inline 编辑态（`TreeItem.tsx` 新增 `isEditing` 局部 state，展示 `<input>` 替代文字，Enter/blur 提交调用现有的 `onRename` 回调），仿现有 `handleArchive`/`onArchive?` 的可选 prop 模式。

**新建文件/文件夹**：daemon 端目前只有 `duplicate`/`importFile`/`importText` 会创建内容（`service.ts:292-316`），没有"创建空白文件"和"创建文件夹"。新增：
- `FilesService.createFile(dirPath, name, mode)`：仿 `duplicate()` 的模式，`assertWritableTarget` → `recordWritableChange(relPath, 'create', mode, '')`（空内容）→ 写入。
- `FilesService.createFolder(dirPath, name, mode)`：同样走 `assertWritableTarget` 校验后 `mkdirSync(dest, { recursive: false })`。

  **ChangeSet 记录方式（已核实）**：`ChangeSetOperation`（`packages/contracts/src/index.ts:111`）是 `'create' | 'edit' | 'move' | 'remove'`，`recordChangeSet` 的记录形状是路径 + 可选 `afterContent`（文件内容），没有 `isDirectory`/`kind` 字段。文件夹创建**用 `'create'` 操作、`afterContent` 留空**即可记录，机制上不需要新增枚举值。但要注意：现有的撤销/删除逻辑（`changeset/service.ts:191-198`，基于 `beforePath`/回收站做 revert）是按"单个文件"设计的，不递归处理目录树——所以 `createFolder` 记录 ChangeSet 时，**回滚（revert）只需删除这一个空目录本身**，不必实现"递归撤销目录内后续产生的文件"这类语义（本次故事里新建文件夹一开始必然是空的，不存在这个问题；如果未来支持"删除非空文件夹"才需要补递归 revert，那是另一个故事的范围）。
- 路由：`POST /files/create`（body 含 `kind: 'file' | 'folder'`），前端 `runtime_client` 新增 `workspace_create_file`/`workspace_create_folder` case，同构 `workspace_duplicate_file`。
- 命名冲突：直接复用 `rename()`/`move()` 已有的冲突处理——`apps/daemon/src/files/service.ts:335` 遇到 `existsSync(dest)` 时 `throw new WorkspaceFsError('target_exists', '<消息>', 409)`，`server.ts:661-667` 的 `handleFsError` 会自动转成 HTTP 409 + `{ error: { code: 'target_exists', message } }`。新建文件/文件夹时目标名已存在，直接复用同一个 `WorkspaceFsError('target_exists', ...)`（消息文案换成"同名文件/文件夹已存在"），不需要新错误码，前端 UI 捕获 409 + `target_exists` 提示用户改名即可。
- UI 流程：新建后新条目立即进入 inline 编辑态（与重命名共用同一套输入框组件），用户输入名称后确认才真正调用 daemon 创建（避免用户中途取消却已经产生一个"新建文件夹"占位文件）——即：先在前端展示一个临时占位输入行，确认后才发起 daemon 请求，取消则不发请求、不留痕迹。

## 4. 键盘导航（AC-10）

- Workspace 树的根容器（`TopicTree.tsx` 外层）加 `role="tree"` + `tabIndex={0}`，每行 `role="treeitem"`。
- 焦点行为一个客户端 state（`focusedPath: string | null`），不依赖 daemon。
- `onKeyDown`：↓/↑ 在当前可见（已展开范围内）的行之间移动 `focusedPath`；→ 展开当前文件夹（若已展开则移到第一个子项）；← 折叠当前文件夹（若已折叠则移到父级）；Enter 对文件夹＝展开/折叠，对文件＝打开（复用现有点击态的 `onSelect` 回调）。
- focus ring 视觉走已有 `--focus-ring` token（`docs/DESIGN.md` §5 结构化 token，禁止硬编码聚焦环样式）。

## 5. 图标：D 形状符号方案（AC-3, AC-4）

- `FileTypeIcon.tsx` 里现有的 `ICON_LABELS`/`ICON_PALETTES` 文字缩写渲染方式替换为内联 SVG 线性符号（16px、1.8 stroke-width），沿用已有的 `--file-*` 颜色 token 作为 `stroke` 色，不新增调色板。
- 新增类型覆盖：`fileKind.ts` 的 `fileKindFromName` 补 `json`/`yaml`/`yml`/`toml` → 归一为新 kind `config`（大括号符号）；已有的笼统 `code` kind 保留（ts/tsx/js/py 等都落这里，用尖括号符号），不做逐语言图标区分（YAGNI——用户没有提出要按语言区分，过度细分不产生辨识度收益）。
- `folder`/`folder-open` 两个 kind：`TreeItem.tsx:110` 的 `iconKind = topicEntry.is_dir ? 'folder' : ...` 改为 `topicEntry.is_dir ? (isExpanded ? 'folder-open' : 'folder') : ...`，`isExpanded` 是该组件已持有的展开态。

## 6. 子项计数、空文件夹提示（AC-5, AC-6）

- 计数：`TopicTree.tsx` 拿到某文件夹的 children 后，行尾渲染 `children.length`（仅直接子项，不递归），复用置顶区数字的现有样式类。
- 空文件夹：展开后 `children.length === 0` 时渲染一行灰色斜体文案"空文件夹"，复用现有列表行的间距/缩进规则，不新建组件。

## 受影响文件清单

| 文件 | 改动类型 |
|---|---|
| `apps/daemon/src/settings/service.ts` | 加 `workspace_tree_sort`/`workspace_tree_manual_order` 归一化 |
| `apps/daemon/src/files/service.ts` | 新增 `createFile`/`createFolder` |
| `apps/daemon/src/server.ts` | 新增 `POST /files/create` 路由 |
| `apps/web/src/lib/httpRuntimeClient.ts` | 新增 4 个 invoke case（sort get/set、create file/folder） |
| `apps/web/src/hooks/useTopics.ts` | 消费 `sortEntries` |
| `apps/web/src/lib/sortTopics.ts` | 新文件，纯排序函数 |
| `apps/web/src/lib/fileKind.ts` | 补 json/yaml/toml → `config` kind |
| `apps/web/src/components/FileTypeIcon.tsx` | 文字缩写 → SVG 线性符号，加 `folder-open` |
| `apps/web/src/components/TreeItem.tsx` | 展开态图标切换、拖拽把手、inline 编辑态、keydown |
| `apps/web/src/components/TopicTree.tsx` | 计数、空文件夹提示、tree/treeitem role |
| `apps/web/src/components/TreeContextMenu.tsx` | 新增"新建文件"/"新建文件夹"/"重命名"菜单项 |
| `docs/DESIGN.md` | 补充新增 `config` kind 的 token 说明（若引入新颜色变量） |

## 已核实、不再是待定项

- `ChangeSetService` 目录支持：用 `'create'` 操作 + 空 `afterContent` 即可记录文件夹创建，无需新增操作类型（细节见第 3 节）。
- 命名冲突错误：复用 `WorkspaceFsError('target_exists', ..., 409)`，`handleFsError` 已自动处理传播，无需新错误码。
