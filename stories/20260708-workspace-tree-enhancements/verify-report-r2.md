# Verify Report (R2) — STORY-20260708-workspace-tree-enhancements

**轮次**: 1 (R2)  
**日期**: 2026-07-08  
**核对范围**: 21 个指定文件（daemon 5 + web 16）  
**结论**: **PASS**

---

## 测试与类型检查总览

| 包                | 命令                                  | 结果          |
| ----------------- | ------------------------------------- | ------------- |
| apps/daemon       | `vitest run src/files/service.test.ts src/settings/service.test.ts` | 22 passed (22) |
| apps/web          | `vitest run src/lib/fileKind.test.ts src/lib/sortTopics.test.ts src/tests/TopicTree.test.tsx src/tests/TreeSidebar.test.tsx src/tests/TreeContextMenu.test.tsx src/tests/useTreeSort.test.tsx` | 34 passed (34) |
| apps/web          | `vitest run src/tests/App.test.tsx`   | 19 passed (19) |
| apps/web          | `tsc --noEmit`                        | 0 errors      |
| apps/daemon       | `tsc --noEmit`                        | 0 errors      |

**合计 75 tests passed, 0 failures, 0 type errors。**

---

## 逐条 AC 核对

### AC-1 — 切换排序策略 ✅ PASS

**Given** 在专题树中  
**When** 点击排序入口选择"名称 A-Z"/"名称 Z-A"/"最近修改"/"类型优先"  
**Then** 所有层级子项立即按所选策略重排  
**And** 置顶区域顺序不受影响

**证据**:
- 排序菜单 4 策略 + 手动排序：`TreeSidebar.tsx:802-849`（渲染 SORT_LABELS 全部 5 key，手动项单独分区）
- 排序执行：`TopicTree.tsx:62` → `sortEntries(filterCuration(entries), sortStrategy, manualOrder?.[parentPath])`，递归传参 `TopicTree.tsx:318` 保证所有层级生效
- 排序逻辑：`sortTopics.ts:9-37` 纯函数，case 分支覆盖 name-asc / name-desc / mtime-desc / type-first / manual
- 置顶区域不受影响：`TreeSidebar.tsx:1121-1127` pinned items 按自身数组顺序 map，不经过 sortEntries
- 测试：`TreeSidebar.test.tsx:231-247` 验证菜单打开 + 切换后 data-active-sort 更新；`sortTopics.test.ts:12-26` 验证 4 种策略排序结果

---

### AC-2 — 排序策略持久化 ✅ PASS

**Given** 上次选了非默认策略  
**When** 关闭重开应用  
**Then** 树仍按上次策略显示

**证据**:
- daemon 存储：`settings/service.ts:25` `workspace_tree_sort: WorkspaceTreeSort`，默认 `'name-asc'`（line 51）
- 归一化兜底：`settings/service.ts:195-199` `normalizeTreeSort` → 非法值落 `'name-asc'`
- 前端加载：`useTreeSort.ts:24-39` mount 时 `get_workspace_tree_sort` → setStrategyState
- 前端写入：`useTreeSort.ts:47-50` setStrategy 立即 `set_workspace_tree_sort`
- HTTP 桥接：`httpRuntimeClient.ts:140-147` get/set_workspace_tree_sort → GET/PUT /settings
- 测试：`settings/service.test.ts:153-162` 验证默认值 + 持久化 + 垃圾值兜底；`useTreeSort.test.tsx:19-25` 验证 mount 加载

---

### AC-3 — 按类型识别文件图标 ✅ PASS

**Given** 多种类型文件  
**When** 查看文件树  
**Then** 每种类型显示不同 SVG 符号图标  
**And** json/yaml/toml 有专属图标（非通用兜底）

**证据**:
- 类型分类：`fileKind.ts:68-72` json/yaml/yml/toml → `'config'`；md/mdx/markdown/pdf/docx/spreadsheet/presentation/image/html/csv/code/archive 全覆盖
- icon kind 映射：`fileTypeIconKind.ts:5-8` mdx 单独 kind，其余透传 fileKind
- SVG 线性符号：`FileTypeIcon.tsx:136-253` VectorGlyph 为每种 kind 渲染不同内联 SVG（folder / folder-open / image / audio / video / markdown+mdx+text / code / config / html / pdf+docx / spreadsheet+csv / presentation / archive / other）
- config 独有 SVG（大括号形状）：`FileTypeIcon.tsx:200-206`
- 覆盖类型 ≥ 12：实际 18 种 kind（含 folder/folder-open），远超目标
- 测试：`fileKind.test.ts:5-10` 验证 json/yaml/yml/toml → config；`TopicTree.test.tsx:39-75` 验证 16 种 label 全部渲染

---

### AC-4 — 文件夹展开态图标反馈 ✅ PASS

**Given** 折叠态文件夹显示"关闭"图标  
**When** 展开后  
**Then** 切换为"打开"图标，折叠后恢复

**证据**:
- 动态切换：`TopicTree.tsx:71-75` `iconKind = isDir ? (isExpanded ? 'folder-open' : 'folder') : fileTypeIconKindFromName(entry.name)`
- 两种 SVG：`FileTypeIcon.tsx:137-153` folder（关闭态路径）vs folder-open（展开态路径）
- 测试：`TopicTree.test.tsx:169-173` 验证展开文件夹显示"已展开的文件夹" label

---

### AC-5 — 文件夹子项计数 ✅ PASS

**Given** 包含直接子项的文件夹  
**When** 查看行  
**Then** 行尾显示直接子项数量

**证据**:
- 计数渲染：`TopicTree.tsx:223-234` `childState.entries.length > 0` 时渲染数字 badge
- 仅直接子项：`childState.entries` 来自 `dirs.get(entry.path).entries`（非递归）
- 测试：`TopicTree.test.tsx:232-245` 验证 3 子项文件夹显示 "3"

---

### AC-6 — 空文件夹提示 ✅ PASS

**Given** 无子项的文件夹  
**When** 展开后  
**Then** 显示明确的"空文件夹"提示（非空白）

**证据**:
- 空态渲染：`TopicTree.tsx:298-310` `childState.entries.length === 0` 时渲染灰色斜体文案"空文件夹"
- 加载态与空态分离：`TopicTree.tsx:286-310` isLoading → "加载中…"，空 → "空文件夹"，有子项 → 递归
- 测试：`TopicTree.test.tsx:247-251` 验证空文件夹显示"空文件夹"

---

### AC-7 — 手动拖拽排序 ✅ PASS

**Given** 排序策略切换为"手动"  
**When** 拖拽到新位置  
**Then** 项移动且持久化  
**And** 非手动策略下拖拽把手不出现

**证据**:
- 拖拽把手条件渲染：`TopicTree.tsx:118` `sortStrategy === 'manual' &&` 才渲染 draggable span
- HTML5 拖拽实现：`TopicTree.tsx:121-139` draggable + onDragStart(setData) + onDrop(getData → reorder → onReorder)
- 排序消费 manualOrder：`sortTopics.ts:27-36` manual case 按 rank 排序，未记录项追加末尾
- 持久化路径：`TreeSidebar.tsx:1168` `onReorder={setManualOrderFor}` → `useTreeSort.ts:52-56` setManualOrderFor → `set_workspace_tree_manual_order` → PUT /settings
- daemon 存储：`settings/service.ts:26` `workspace_tree_manual_order?: Record<string, string[]>`；`settings/service.ts:142-144` isRecord 校验
- 测试：`TopicTree.test.tsx:200-230` 验证 name-asc 时无把手、manual 时有 2 个把手；`sortTopics.test.ts:28-35` 验证 manualOrder + 未知项追加；`settings/service.test.ts:164-173` 验证 manual_order 持久化为 opaque map

---

### AC-8 — 右键新建文件/文件夹 ✅ PASS

**Given** 在文件夹上右键  
**When** 选择"新建文件"/"新建文件夹"  
**Then** 出现待命名新项，输入名称后创建成功

**证据**:
- 菜单项（仅 topic-folder）：`TreeContextMenu.tsx:148-160` 条件渲染"新建文件"/"新建文件夹"+ divider
- 菜单回调：`TreeContextMenu.tsx:122-129` handleCreateFile/handleCreateFolder → onCreateFile/onCreateFolder
- 占位输入流：`TreeSidebar.tsx:610-617` setPendingNew + setEditingPath；`TreeSidebar.tsx:596-608` withPendingEntry 注入占位条目
- 确认后创建：`TreeSidebar.tsx:618-648` handleCommitEdit → pendingNew 时调 `workspace_create_file`/`workspace_create_folder`，空名则取消不请求
- HTTP 桥接：`httpRuntimeClient.ts:590-603` → POST /files/create { dirPath, name, kind }
- daemon 路由：`server.ts:1147-1171` POST /files/create 校验 body → createFile/createFolder
- daemon 实现：`files/service.ts:318-358` createFile（writeFileSync 空）/ createFolder（mkdirSync），均走 assertWritableTarget + ChangeSet record + target_exists 409
- 测试：`TreeContextMenu.test.tsx:7-33` 验证菜单触发回调；`files/service.test.ts:149-167` 验证创建成功 + 冲突拒绝

---

### AC-9 — 右键重命名 ✅ PASS

**Given** 在文件/文件夹上右键  
**When** 选择"重命名"并输入新名称  
**Then** 树内和文件系统中名称同步更新

**证据**:
- 菜单项（topic-file + topic-folder）：`TreeContextMenu.tsx:172-174` 条件渲染"重命名"
- 菜单回调：`TreeContextMenu.tsx:130-133` handleRename → onRename
- inline 编辑态：`TreeSidebar.tsx:653-655` handleRename setEditingPath；`TopicTree.tsx:196-216` 渲染 input，Enter/blur 提交
- 确认后重命名：`TreeSidebar.tsx:618-648` handleCommitEdit → 非 pendingNew 时调 `workspace_rename_file`
- HTTP 桥接：`httpRuntimeClient.ts:604-610` → POST /files/rename { relativePath, newName }
- daemon 路由：`server.ts:1173-1189` POST /files/rename 校验 body → FilesService.rename
- daemon 实现：`files/service.ts:360-390` rename（assertWritableTarget + ChangeSet + renameSync + target_exists 409）
- 测试：`TreeContextMenu.test.tsx:35-56` 验证重命名回调；`files/service.test.ts:89-103` 验证 rename 成功；`TopicTree.test.tsx:176-197` 验证 inline input Enter 提交

---

### AC-10 — 键盘导航 ✅ PASS

**Given** 树容器获得焦点  
**When** 按 ↓/↑、→/←、Enter  
**Then** 焦点在同级/跨层级移动、展开/折叠、打开/选中

**证据**:
- 树容器：`TreeSidebar.tsx:1251-1256` `role="tree"` + `tabIndex={0}` + `onKeyDown={handleTreeKeyDown}`
- treeitem：`TopicTree.tsx:82-88` `role="treeitem"` + `data-path` + `tabIndex={-1}` + ref focus when `entry.path === focusedPath`
- 焦点管理：`TreeSidebar.tsx:382` `focusedPath` state；`TopicTree.tsx:86-88` ref 回调 focus 对应 DOM
- flattenVisible（可见行扁平化）：`TreeSidebar.tsx:657-668` 递归收集展开范围内的行
- 键盘逻辑：`TreeSidebar.tsx:670-719`
  - ArrowDown/Up：`visible[Math.min/max(idx±1)]` 移动焦点（preventDefault）
  - ArrowRight：文件夹未展开 → toggleDir；已展开 → 移到第一个子项
  - ArrowLeft：文件夹已展开 → toggleDir；已折叠 → 移到父级
  - Enter：文件夹 → toggleDir；文件 → handleSelect
- focus ring 用 token：`TopicTree.tsx:101` `outline: 'var(--focus-ring)'`（非硬编码）
- 测试：`TreeSidebar.test.tsx:217-229` 验证 ArrowDown 后 `document.activeElement` 有 data-path

---

## 三类边界（Won't）核对

| Won't 项                                            | 实现状态   | 证据                                                                    |
| --------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| 不做每文件夹独立排序策略（全局单一）                | ✅ 未违反 | 全局 `workspace_tree_sort` 单 key（`settings/service.ts:25`），无 per-path 分叉 |
| 不做树内搜索自动展开+高亮                           | ✅ 未违反 | 搜索按钮存在但无逻辑绑定（`TreeSidebar.tsx:748-764` 仅渲染 `<Search>` 图标，无 handler） |
| 不做文件夹自定义图标/颜色                           | ✅ 未违反 | 图标仅按 is_dir + isExpanded + 扩展名分类，无 per-folder 个性化         |
| 不做多选/批量/剪切粘贴/撤销历史                     | ✅ 未违反 | 右键菜单无多选/批量项；TreeContextMenu 仅 pin/copy/create/rename/delete 单项操作 |

---

## 越界 / 偏差清单

| # | 类型         | 描述                                                                                                                              | 影响 | 建议         |
| - | ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------ |
| 1 | 实现位置偏差 | design.md 建议 `useTopics.ts` 消费 sortEntries，实际排序在 `TopicTree.tsx:62` + `TreeSidebar.tsx:658` 消费。`useTopics.ts` 不在核对范围内。 | 无功能影响，排序结果一致 | 可接受，归档记录 |
| 2 | 实现位置偏差 | design.md 建议 `TreeItem.tsx` 承载 expand 图标/拖拽/inline edit/keydown，实际这些特性在 `TopicTree.tsx` 内直接渲染行。`TreeItem.tsx` 不在核对范围内，仍用于 journal/identity/pinned 行。 | 无功能影响，TopicTree 自包含递归 | 可接受，归档记录 |

无功能性越界（无超出 story Won't 范围的额外能力），无遗漏的 AC。

---

## 待用户裁决项

| # | 项                                                                                              | 背景                                                                                                                                                                                              | 建议                                   |
| - | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1 | 新建/重命名时 409 冲突（target_exists）的前端用户提示                                           | daemon 正确返回 409（`files/service.ts:329,350,377`），httpRuntimeClient 正确传播错误，但 `TreeSidebar.tsx:618-648` handleCommitEdit 仅 `console.error`，无用户可见提示。AC-8/AC-9 未明确要求冲突 UI；design.md 第 3 节提到"前端 UI 捕获 409...提示用户改名"。 | 如需友好 UX 可补 toast/alert；当前不阻塞 AC 通过 |

**用户裁决（2026-07-08）：现在补上。** 已在 `handleCommitEdit` 的 catch 分支加 `hostAsk(message, { title: '操作失败', kind: 'error' })`，`target_exists` 错误显示"「name」已存在，请换一个名称"，其余错误显示通用失败提示。复用既有 `hostBridge.hostAsk`，未新增 UI 组件/依赖。全量回归 425/425 通过，lint/tsc 均 0 错误。此项已闭环，非遗留。

---

## NFR / 依赖落实

| design 要求                                | 落实状态   | 证据                                                                    |
| ------------------------------------------ | ---------- | ----------------------------------------------------------------------- |
| 复用 WorkspaceSettings 通用 KV，不新增接口 | ✅         | workspace_tree_sort / workspace_tree_manual_order 走现有 PUT /settings  |
| 复用 ChangeSet 写入模式                    | ✅         | createFile/createFolder/rename 均走 recordWritableChange               |
| 复用 WorkspaceFsError('target_exists', 409) | ✅        | `files/service.ts:329,350,377`                                          |
| ChangeSet 用 'create' + 空 afterContent 记录文件夹 | ✅  | `files/service.ts:351-352` createFolder recordWritableChange(relPath,'create',mode,'') |
| focus ring 用 --focus-ring token           | ✅         | `TopicTree.tsx:101`                                                     |
| 不引入新依赖（HTML5 draggable）            | ✅         | `TopicTree.tsx:121-139` 原生 draggable                                  |
| sortEntries 为纯函数无副作用               | ✅         | `sortTopics.ts:14` `[...entries]` copy 后 sort                          |

---

SUMMARY: result=pass | fail=0 | pending=0 (409 冲突提示已在验收后补齐并复核)
