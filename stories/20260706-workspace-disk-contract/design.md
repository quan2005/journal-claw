# Design — Workspace 磁盘契约迁移

Story: `stories/20260706-workspace-disk-contract/story.md`（approved）
契约权威: `docs/final-state.md` §0.2

## 目标布局

```
<workspace>/
  （用户区：全部非 dot 内容，UI 全展示；topics/ 为普通文件夹）
  .journal/
    workspace.json        （已有；新增 layoutVersion: 2 作迁移完成标记）
    runs/                 （已有）
    memory/YYMM/          ← 原根目录 YYMM/（/^\d{4}$/ 目录）
    todos.md + todos.done.md
    identity/
    trash/                ← 原 .journal-trash/
```

## 方案

### 1. 路径集中化（新增 `apps/daemon/src/workspace/paths.ts`）

导出唯一路径函数集：`journalDir(root)`、`memoryDir(root)`、`todosPath(root)`、`todosDonePath(root)`、`identityDir(root)`、`trashDir(root)`。JournalService / TodosService / IdentityService / ChangeSetService / FilesService / MaterialsService（raw 目录随 YYMM 一起走）改为消费该模块，禁止再各自 `join(workspaceRoot, ...)` 硬编码系统路径。

### 2. 迁移（新增 `apps/daemon/src/workspace/migration.ts`）

- **触发点**：server 启动与 workspace 切换时（`configService.getWorkspacePath()` 生效处），任何 service 使用前先跑 `migrateWorkspaceLayout(root)`。
- **幂等判定**：读 `.journal/workspace.json` 的 `layoutVersion`；`>= 2` 直接返回（AC-5）。
- **原子性策略**：同卷 `renameSync` 逐项搬移（rename 本身原子）；顺序：memory YYMM → todos → identity → trash；**全部成功后**才写 `layoutVersion: 2`。中途崩溃 = 部分已 rename + 无标记 → 下次启动继续搬（每项搬移前判 source 存在、target 不存在；target 已存在且 source 也存在视为冲突，该项跳过并记 warning，不覆盖用户数据）。
- 空 workspace：直接建 `.journal/` 并写 `layoutVersion: 2`（AC-4）。

### 3. ChangeSet 兼容

- trash 新路径 `.journal/trash/`；revert 旧记录时若 `.journal/trash/<id>` 不存在则回退查 `.journal-trash/<id>`。
- **注意**：ChangeSet 快照目前排除 `.journal/` 前缀（见 `changeset/service.test.ts:162`）。todos/journal 迁入后，`writeTracked` 的系统写入需继续可追踪——将排除规则从"`.journal/` 全排除"收窄为"排除 `.journal/{runs,trash,index}/` 与 `workspace.json`"，或为系统白名单路径放行。以现有测试语义为准做最小调整，保证 todos 勾选、日记写入的 ChangeSet 行为与迁移前一致（AC-2）。

### 4. 文件树全展示（daemon FilesService + web TreeSidebar）

- FilesService 目录列举：根列举时过滤 `.` 开头条目。
- web 侧文件树根从 `topics/` 白名单改为 workspace 根遍历；`topics/` 不再特殊处理（TopicsService API 保持不变，UI 中它只是普通目录）。涉及 `TreeSidebar.tsx` 与相关 hooks/tests。
- 性能：沿用现有懒加载/按目录展开模式即可，不引入新机制；若现有实现是一次性全量，保持按需 readdir 每层。

### 5. 明确不做

反向迁移、迁移 UI、topics 语义变更、memory 压缩策略（story Won't）。

## 验收映射

AC-1/AC-4/AC-5 → migration 单测（旧结构临时目录 / 空目录 / 二次打开）+ 崩溃续搬测试（模拟部分完成状态）。
AC-2 → journal/todos/identity service 既有测试改路径后全绿 + ChangeSet 追踪行为不变。
AC-3 → FilesService 列举测试（dot 过滤）+ TreeSidebar 测试（根展示非 topics 内容）。
