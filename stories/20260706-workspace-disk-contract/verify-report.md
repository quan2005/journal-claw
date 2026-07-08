---
story: ./story.md
design: ./design.md
date: 2026-07-06
round: 1
result: fail
scope: 'git diff -- apps packages（26 个修改文件 + 新增 apps/daemon/src/workspace/{paths,migration,migration.test}.ts）'
---

# 验收报告 — Workspace 磁盘契约：根目录归用户，.journal/ 归系统

测试证据：daemon `bunx vitest run` 45 files / 285 tests 全绿；web `bunx vitest run` 54 files / 398 tests 全绿（2026-07-06 本机复跑）。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据 |
| ---- | ------- | ---- |
| AC-1 | ✅ pass | `apps/daemon/src/workspace/migration.ts:40-52` 按序搬 YYMM→`.journal/memory/`、todos、identity、`.journal-trash`→`.journal/trash`；测试 `migration.test.ts:25-66`（旧结构全量搬迁 + 用户文件 topics/README 原地不动）、`:156-169`（非 YYMM 用户目录不误搬）通过 |
| AC-2 | ✅ pass | 各 service 改经 `workspace/paths.ts` 消费新路径：journal `journal/service.ts:63-76`、todos `todos/service.ts:148-154`、identity `identity/service.ts:172-174`；ChangeSet 快照收窄排除规则使 `.journal/` 下 todos/memory/identity 仍被追踪（`changeset/service.ts:56-80`）；相应既有测试改路径后全绿（`todos/service.test.ts`、`journal/service.test.ts`、`identity/service.test.ts`、`changeset/service.test.ts`） |
| AC-3 | ❌ fail | dot 过滤本身已实现（daemon `files/service.ts:178`，web 兜底 `useTopics.ts:10-15`，测试 `useTopics.test.tsx:250-292`、`TreeSidebar.test.tsx:198-211`），**但文件树数据源换到的 `/files` 路由绑定的是 daemon 进程 cwd 而非配置的 workspace 根**——见下方「结论」第 1 条。生产链路上文件树会列出错误目录 |
| AC-4 | ✅ pass | `migration.ts:41,51`（空 workspace 仅建 `.journal/` + 写 marker，不造幽灵目录）；测试 `migration.test.ts:68-76` 通过 |
| AC-5 | ✅ pass | `migration.ts:43` layoutVersion>=2 短路；`server.ts:249-268` 每 root 进程内只跑一次；测试 `migration.test.ts:78-90`（幂等）、`:92-113`（崩溃续搬）通过 |

## 范围完整性（不少，对照 story.md 范围）

- 根目录系统文件归零：migration 覆盖 story 列举的全部五类（YYMM/todos.md/todos.done.md/identity/.journal-trash），`migration.ts:45-49`。✅
- 自动静默搬迁、无手动操作：`server.ts:255-263` 在 `workspaceRoot()` 首次取用时触发，无 UI。✅
- 交棒清单四项均落实：原子性/续搬（`migration.ts:103-117` rename + 无 marker 续搬）、完成标记（`layoutVersion: 2`，`migration.ts:29,51`）、路径集中化（`workspace/paths.ts` 被 journal/todos/identity/changeset/files/materials/local/ai_processor/auto_lint 消费）、trash 兼容（`changeset/service.ts:188-206` 新路径缺失时回退 `.journal-trash/<id>`，方向与 design §3 一致）。✅
- 新素材落盘路径同步迁移：`materials/service.ts:34,50-52`、`local/service.ts:83`、`files/service.ts:234-259` 均写 `.journal/memory/<ym>/raw/`，AI 处理 prompt 与 digest 查找同步（`ai_processor/service.ts:248,298,385,411`）。✅

## 方案落实（不偏，对照 design.md）

- §1 路径集中化：`workspace/paths.ts` 提供设计要求的全部函数并多出 legacy trash 两个兼容 helper（服务于 §3）。✅
- §2 迁移：触发点（`server.ts:262-267` workspace 取用处，覆盖启动与切换）、幂等（layoutVersion）、rename 原子 + marker 最后写 + 冲突跳过警告，与 design 逐条一致。✅
- §3 ChangeSet：排除规则收窄为 `.journal/{runs,trash,index}/` + `workspace.json`（`changeset/service.ts:66-80`），revert 旧记录回退查 `.journal-trash/<id>`（`service.ts:191-199`）。✅
- §4 文件树全展示：daemon dot 过滤 ✅；web 根遍历改 `list_workspace_dir` ✅（`useTopics.ts:6-15`、`TreeSidebar.tsx:24-28`）；懒加载沿用现有按目录展开 ✅。**但 design 指定复用的 FilesService 在 server 侧以 `process.cwd()` 为根（见结论第 1 条），设计未察觉此绑定问题 → 落地后 AC-3 生产行为不成立**。❌
- §5 明确不做：未发现反向迁移 / 迁移 UI / topics 语义变更 / memory 压缩。✅

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ `automation/runner.ts:189-213`（isJournalEntryPath/isTodosPath 识别新旧两套路径）：路径迁移的必要跟随改动，归属 AC-2。其中 `.journal/done.md` 一条为多余分支（该文件从不存在于该路径），无害。
- ✅ `engine/tools/fs.ts:172,185`：仅描述文案随 trash 路径更新。
- ✅ `changeset/service.ts:231-243` rel 路径 posix 归一化：快照 key 一致性的必要基础设施。
- 未发现命中 story 非目标的改动。

## 冗余（不重，对照 story.md）

- web 侧 dot 过滤（`useTopics.ts:10-12`、`TreeSidebar.tsx:27-28`）与 daemon 过滤（`files/service.ts:178`）重复，但代码注释声明为防御性兜底（AC-3），有声明原因，不计 fail。

## 结论

**fail（1 项）**，按风险排序：

1. **AC-3 生产链路根目录错误（高风险）**：文件树数据源从 `list_topics_dir` → `/topics`（per-request `new TopicsService(workspaceRoot(), ...)`，`server.ts:278-279`，跟随配置的 workspace 并触发迁移）切换为 `list_workspace_dir` → `/files`（`server.ts:1081`），而 `/files` 使用启动时构造的 `new FilesService(process.cwd(), ...)`（`server.ts:245`）。desktop 以无 `cwd` 选项 spawn daemon（`apps/desktop/src/daemon.ts:76-87`），workspace 路径却来自 config（`apps/daemon/src/config/service.ts:116-129`）——两者在生产/开发环境均不相等。后果：文件树列出的是 daemon 进程 cwd（打包 app 通常是 `/` 或 repo 根），不是用户 workspace；且该路由不经 `workspaceRoot()`、不触发迁移；树上下文菜单的 rename/move/delete（`server.ts:1140-1212`，同一个 cwd 绑定的 filesService）会作用于错误目录。单测全绿是因为测试直接用临时目录构造 FilesService，未覆盖 server 装配层。
   **修复建议**：仿照 `topicsService()` 把 `/files` 系列路由改为 per-request `new FilesService(workspaceRoot(), workspaceChangeSets())`（一处装配改动即可），并补一条 server 层测试断言 `/files` 列出的是 config workspace 而非 cwd。

## 待用户裁决

- 无。（`server.ts:239-245` 的 changeSet/sediment/workspace service 同样绑定 `process.cwd()`，属迁移前既有装配问题，不在本 story diff 内，未计 fail；修复第 1 条时可顺带评估。）
