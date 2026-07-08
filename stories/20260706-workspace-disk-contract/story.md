---
status: verified
date: 2026-07-06
slug: workspace-disk-contract
level: L2
---

# Workspace 磁盘契约：根目录归用户，.journal/ 归系统

## 用户故事

作为 JournalClaw 用户（知识工作者），当我在 App 文件树或 Finder 中查看我的 workspace 时，我希望看到的就是"我自己的文件"——根目录下全部非隐藏内容可见、可自由组织；系统生成/管理的数据（日期记忆、待办、画像、回收站、运行记录）统一收进隐藏的 `.journal/` 目录，不污染我的资产区。

## 背景与失败模式

[证据] 当前 daemon 落盘现状（`apps/daemon/src/*/service.ts`）：

- 日期记忆目录 `YYMM/`、`todos.md`/`todos.done.md`、`identity/`（画像）、`.journal-trash/` 全部散在 workspace 根目录，与用户自己的文件混居。
- App 文件树 UI 只展示 `topics/` 一个白名单容器，用户放在 workspace 其他位置的文件在 App 里不可见。
- `.journal/` 已有雏形（`workspace.json`、`runs/`），但未收编上述内容。

失败模式：

1. 用户在 Finder 打开 workspace，看到一堆系统文件混在自己的资料里，分不清哪些能动、哪些不能动（动错会破坏 App 数据）。
2. 用户在 App 里只能看到 `topics/`，自己的其余文件"消失"了，与"文件是长期资产、高效浏览"的产品北极星直接冲突。

现状规避方式：用户只能记住"哪些文件是系统的别碰"、把资料强行塞进 `topics/`——即"放弃组织自由"。

## 目标状态（可观察行为）

- App 文件树根 = workspace 根，展示全部非 `.` 开头的文件/目录（此前只有 `topics/` 可见 → 现在 100% 非隐藏内容可见）。
- workspace 根目录下不再出现任何系统文件：`YYMM/`、`todos.md`、`todos.done.md`、`identity/`、`.journal-trash/` 归零。
- 旧 workspace 首次用新版本打开后自动完成搬迁，用户既有数据（日期记忆、待办、画像、回收站内容）在 App 内全部照常可见可用，无需任何手动操作。

## 决策记录（用户 2026-07-06 拍板，见 docs/final-state.md §0.2）

1. `topics/` 保留为普通用户文件夹，不迁移、不再有特殊语义。
2. `YYMM/` 日期目录是 memory 数据，迁入 `.journal/memory/YYMM/`。
3. `todos.md`/`todos.done.md` 迁入 `.journal/`，接受"不能在 Finder/外部编辑器直接编辑待办"的副作用。

## 验收标准

- **AC-1** Given 一个旧结构 workspace（根目录含 `YYMM/`、`todos.md`、`todos.done.md`、`identity/`、`.journal-trash/` 及若干用户文件），When 用新版本 App 打开该 workspace，Then 上述系统内容分别位于 `.journal/memory/YYMM/`、`.journal/todos.md`、`.journal/todos.done.md`、`.journal/identity/`、`.journal/trash/`，且根目录不再存在旧路径；用户文件（含 `topics/`）位置与内容不变。
- **AC-2** Given 搬迁完成的 workspace，When 用户在 App 中查看时间线/待办/画像，Then 迁移前的全部条目照常显示，新增/勾选/编辑操作正常生效。
- **AC-3** Given workspace 根目录下存在任意用户文件与目录（含 `topics/` 之外的），When 用户打开 App 文件树，Then 根下所有非 `.` 开头的文件/目录全部可见，`.` 开头的（含 `.journal/`）不出现在文件树中。
- **AC-4** Given 一个全新（空）workspace，When App 初始化它，Then 所有系统文件直接创建于 `.journal/` 下，根目录保持为空的用户区。
- **AC-5** Given 已完成搬迁的 workspace，When 再次重启 App 打开它，Then 不重复执行搬迁、无重复/丢失数据。

## 边界（Won't）

- **不为谁**：不考虑多人共享同一 workspace 的并发场景；不考虑网盘同步冲突处理。
- **不做的场景**：不提供 UI 内的迁移向导/进度界面（静默自动搬迁）；不提供"迁回旧结构"的反向操作；不改变 topics、日期记忆、待办、画像的任何功能语义——本 story 只动位置与展示范围。
- **不解决的相关问题**：`.journal/memory/` 的沉淀压缩/保留周期（既有产品债）；Artifacts 独立浏览器；workspace meta 编辑 UI；`todos.md` 外部编辑能力的替代方案。

## 交棒清单（转 design.md）

- 搬迁的原子性与失败恢复：搬迁中途崩溃/磁盘满如何保证不丢数据（建议 design 阶段定：先复制后删除 or 事务标记文件）。
- 搬迁完成标记的实现方式（如 `workspace.json` 里的 schemaVersion），及 AC-5 幂等的判定依据。
- 各 service（journal/todos/identity/changeset/files）路径常量的集中化，避免路径再度散落。
- 文件树 UI 从 topics 白名单改为 workspace 根遍历后的性能考虑（大目录、忽略规则）。
- `.journal-trash` → `.journal/trash` 对 ChangeSet revert 既有记录的兼容。
