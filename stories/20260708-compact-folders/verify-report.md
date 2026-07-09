---
story: ./story.md
design: ./design.md
round: 1
verifier: independent-subagent
date: 2026-07-09
result: pass
---

# Verify Report — STORY-20260708-compact-folders

独立 subAgent 核对，结论仅基于 story.md / design.md 契约与指定核对范围文件的真实内容。

## 范围内文件

| 文件 | 状态 |
| --- | --- |
| apps/daemon/src/files/service.ts | 已读 |
| apps/daemon/src/server.ts | 已读 |
| apps/web/src/lib/apiTypes.ts | 已读 |
| apps/web/src/hooks/useTopics.ts | 已读 |
| apps/web/src/lib/httpRuntimeClient.ts | 已读 |
| apps/web/src/lib/topicCuration.ts | 已读 |
| apps/daemon/src/files/service.test.ts | 已读 |

## 执行的验证命令（真实输出）

| 命令 | 结果 |
| --- | --- |
| `apps/daemon && bunx vitest run src/files/service.test.ts` | **18 passed (18)**, 190ms |
| `apps/daemon && bunx tsc --noEmit` | 通过（无输出） |
| `apps/web && bunx tsc --noEmit` | 通过（无输出） |

## AC 逐条核对

### AC-1 — 单链目录合并显示 → **PASS**

- 契约要求：`a/b/c`（每层只含一个子目录）显示为一个节点，标签 `a/b/c`，一次展开直达 `c` 内文件。
- 证据：
  - `service.ts:232-252` `compactChain` 递归下钻：`children.length !== 1` 或唯一子项非目录即停，收集链上所有目录名。
  - `service.ts:205-214` `compact` 分支：`chain.length >= 2` 时 `display_name = chain.join('/')`（即 `"a/b/c"`）、`name = chain[chain.length-1]`（终端真实名 `c`）、`path = terminalRel`（终端真实路径 `a/b/c`）。
  - `topicCuration.ts:46` `displayTopicName` 最高优先级返回 `entry.display_name` → 标签为 `a/b/c`。
  - `useTopics.ts:8-9` `listWorkspaceDir` 固定传 `compact: true`；`toggleDir(path)` 中 `path` 已是终端 `a/b/c`，点击即拉取 `c` 的子内容 → 一次展开直达。
  - 测试 `service.test.ts:193-205`「compacts a single-child directory chain into one entry (AC-1)」：断言 `name==='c'`、`display_name==='a/b/c'`、`path==='a/b/c'`，并通过。

### AC-2 — 链条断开条件 → **PASS**

- 契约要求：`a` 下除 `b` 外还有文件/另一子目录时，`a` 独立显示、不合并。
- 证据：
  - `service.ts:245` `if (children.length !== 1) break` —— `a` 有多个条目时链立即在 `a` 处停止，`chain=['a']`、`length=1 < 2`，不进入合并分支，`display_name` 不设置。
  - `service.ts:247` `if (!only.isDirectory()) break` —— 唯一子项是文件也断链。
  - `service.ts:205` `if (opts.compact && isDir)` —— 文件条目永不合并（定义使然）。
  - 测试 `service.test.ts:207-217`「breaks the chain when a directory has more than one entry (AC-2)」：`a/sibling.md` 存在时断言 `a.display_name===undefined`、`a.path==='a'`，并通过。

### AC-3 — 结构变化后自动重算 → **PASS**

- 契约要求：`a/b/c` 已合并，`a` 下新增文件后，树更新、`a` 拆出独立显示。
- 证据：
  - `service.ts:181-223` `listWorkspaceDir` 无任何缓存，每次现算。
  - `useTopics.ts:149-170` 订阅 `topics-updated` → `TOPICS_REFRESH_DEBOUNCE_MS=250ms` 防抖 → `refreshLoadedDirs` 重拉所有已加载目录，天然拿到重算结果。
  - `useTopics.ts:54-67` `topicEntriesEqual` 比较 `name`+`path`：合并↔拆分时终端名与路径必然变化（`c`↔`a`、`a/b/c`↔`a`），相等检查能探测到差异并触发 `setDirs`。
  - 测试 `service.test.ts:219-232`「recomputes the chain after a new sibling appears (AC-3)」：新增 `a/another.md` 后断言 `a.display_name===undefined`、`a.path==='a'`，并通过。

### AC-4 — 合并节点操作对齐 IDEA 惯例 → **PASS（daemon 层）/ UI 层依赖范围外文件**

- 契约要求：右键操作作用于链最深层目录（`c`），重命名/删除等以用户可理解方式明确作用对象。
- 证据：
  - `service.ts:211-212` 合并节点的 `name`/`path` 始终指向真实终端目录（`name='c'`、`path='a/b/c'`）。任何以 `entry.path` 为参的 daemon 写操作（`rename`/`delete`/`move`，`service.ts:419/475/451`）因此自动作用于 `c`，无需额外分支。
  - `display_name` 为纯文本 label（`topicCuration.ts:46`），不拆分为可点击分段 → 与 Won't「不做分段点击」一致。
  - UI 侧右键菜单与 inline 重命名输入框在 `TopicTree.tsx`（**不在本轮核对范围**），但 `displayTopicName` 已在 `TopicTree.tsx:76` 消费（rg 取证），daemon 侧前置条件（path/name=终端）已验证成立。
- 结论：daemon 层语义完全满足 AC-4；UI 行为正确性依赖范围外的 `TopicTree.tsx`，本轮不对其下结论，但不构成 daemon 侧 fail。

## Won't 边界核对

| Won't 项 | 证据 | 结论 |
| --- | --- | --- |
| 默认对所有 workspace tree 用户生效、无开关 | `useTopics.ts:9` `compact: true` 硬编码；无 settings 字段 | 遵守 |
| 不影响 topic/journal 等非 workspace 树 | topics 走 `list_topics_dir`→`/topics`→`topicsService`（`httpRuntimeClient.ts:494-500`、`server.ts:880-890`），与 `/files` 独立；journal 走 `/journal/*` | 遵守 |
| @ 提及候选不合并 | `service.ts:259` `listAtMentionCandidates` 内部 `this.listWorkspaceDir(relativePath)` 不传 `compact`；测试 `service.test.ts:234-243` 断言 `display_name===undefined` | 遵守 |
| 不合并含文件/多子目录的目录 | `compactChain` 收敛条件（见 AC-2） | 遵守 |
| 不做分段点击 | `display_name` 纯文本 | 遵守 |
| 不改磁盘真实结构 | 合并仅改返回值的 `name`/`path`/`display_name`，无任何 fs 写 | 遵守 |

## design.md 改动落实核对

| 设计改动 | 落实位置 | 结论 |
| --- | --- | --- |
| 改动1：`listWorkspaceDir` 加 `compact` 选项 + `WorkspaceDirEntry.display_name?` | `service.ts:181-223`、`service.ts:21-29` | 落实 |
| 改动1：`TopicEntry.display_name?` 同步 | `apiTypes.ts:14-24` | 落实 |
| 改动2：`GET /files` 透传 `compact` | `server.ts:1077-1086`（`const compact = req.query.compact === 'true'`） | 落实 |
| 改动3：`useTopics` 传 `compact:true` | `useTopics.ts:8-9` | 落实 |
| 改动3：`httpRuntimeClient` 透传 compact | `httpRuntimeClient.ts:277-284`（`compactParam = args?.compact === true ? '&compact=true' : ''`） | 落实 |
| 改动3：`listAtMentionCandidates` 不传 compact | `service.ts:259` | 落实 |
| 改动4：`displayTopicName` 优先 `display_name` | `topicCuration.ts:45-49` | 落实 |
| AC-3 不需额外代码（靠现有刷新） | `useTopics.ts:149-170` | 落实 |

## 越界 / 偏差清单

无阻塞性越界或偏差。所有改动严格落在 design.md 描述的 4 处改动 + 接口字段扩展范围内，未触及范围外逻辑。

## 观察（非 fail，供参考）

1. **无 HTTP 路由级 compact 测试**：`server.test.ts` 不含 `compact` 用例。`/files` 路由对 compact 是纯透传（`server.ts:1081-1082`），service 层已覆盖，风险低。
2. **无 web 侧 `displayTopicName` 的 `display_name` 分支单测**：`topicCuration.ts:46` 为一行 guard，逻辑简单，且 `TopicTree.tsx:76` 已消费；风险低。
3. **合并节点 `mtime_secs` 取起始目录 mtime**（`service.ts:203` 用 `entryPath`=起始目录），design 未指定取终端还是起始；不影响 AC，属实现细节。
4. **`apiTypes.ts` 的 `WorkspaceDirEntry`（行 171-177）未加 `display_name`**，而 daemon 侧 `WorkspaceDirEntry` 与 web 侧 `TopicEntry` 都有。该类型在本流程未被使用（`useTopics` 全程用 `TopicEntry`），功能无影响，仅类型层面不一致。
5. **排序按终端名**（合并节点 `name='c'`，排在以 `c` 为序的位置）：design 明确接受此行为，非偏差。

## 待用户裁决项

无。所有 AC 与 Won't 均有确凿证据，无拿不准项。

SUMMARY: result=pass | fail=0 | pending=0
