---
story: ./story.md
design: N/A
date: 2026-07-08
round: 1
result: pass
scope: 'git -C /Users/yanwu/Projects/github/journal_claw diff HEAD -- apps/web/（6 文件，+38/−23）'
---

# 验收报告 — 文件树选中：内容不加载 + 选中反馈延迟

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据 |
| ---- | ------- | ---- |
| AC-1 | ✅ pass | `apps/web/src/components/DetailView.tsx:73-79`：`topicFileAbsolutePath` 改为 `${workspacePath}/${path}`，删除 `topicWorkspaceRelativePath` 的 `topics/` 强制前缀。红→绿测试 `apps/web/src/tests/DetailView.test.tsx:74-93`（`tmp_roundtable/notes.md` → 断言请求 `/Users/yanwu/Documents/journal/tmp_roundtable/notes.md`）。`topics/` 内不回退：树条目路径由 daemon `list_workspace_dir` 返回 workspace 相对路径（`apps/web/src/hooks/useTopics.ts:6-7`），topics 内文件路径本身携带 `topics/` 段，拼接结果不变。全量测试 401/401 通过（`cd apps/web && bun run test`）。 |
| AC-2 | ✅ pass | `apps/web/src/components/TopicTree.tsx`（原 :70）与 `apps/web/src/components/TreeItem.tsx`（原 :249）各删除一行 `transition: 'background-color 0.15s var(--ease-out)'`，选中底色改为瞬时切换。测试 `apps/web/src/tests/TopicTree.test.tsx:92-97` 断言 row transition 不含 background。日记列表行同为 `TreeItem` 渲染，一并覆盖（`grep transition src/components/TreeItem.tsx` 剩余仅 :272 选中竖条 transform、:391 hover 操作按钮——后者属边界排除项）。 |

### topic-file 路径生产者一致性核查（AC-1 全链路）

| 生产者 | 证据 | 结论 |
| ------ | ---- | ---- |
| 文件树 / 置顶 | `TreeSidebar.tsx:932/967/1023` 直接用 `entry.path`（daemon workspace 相对路径）；置顶匹配同源 `dirState.entries`（`TreeSidebar.tsx:516`） | ✅ 一致 |
| 面包屑导航 | `DetailView.tsx:333` segments 来自 `topicFileDisplayPath`（现 = workspace 相对路径，`DetailView.tsx:82-88`）→ `App.tsx:846-855` 原样入 selection | ✅ 一致 |
| journal-file-open 事件 | 发射方 `FileAttachments.tsx:42`（absPath 绝对路径）、`MarkdownRenderer.tsx:367-368`（`resolveWorkspaceFilePath` 解析为绝对路径）、`ChatPanel.tsx:1247`（`@/...` 绝对路径）；绝对路径由 `DetailView.tsx:75` `isAbsoluteFilePath` 分支直通 | ✅ 一致 |
| 最近浏览 | `App.tsx:654-670` `handleOpenRecent` 原样透传 path，无前缀加工 | ✅ 一致 |

## 范围完整性（不少，对照 story.md 范围）

story 范围即 AC-1/AC-2，均已覆盖（见上表）。无 AC 之外的范围条目。

## 方案落实（不偏，对照 design.md）

N/A（L1，无 design.md）。

## 越界检查（不多，对照 story 非目标）

- ✅ `topicFileDisplayPath` / `topicFileCopyPath` 简化（`DetailView.tsx:82-90`）：删除 `topics/` 剥离/补齐逻辑是 AC-1 路径契约变更的必然连带（否则非 topics 文件的展示/复制路径仍错），归属 AC-1；copyPath 收敛为 displayPath 属等价合并。测试同步更新（`DetailView.test.tsx:276-288`）。
- ✅ `App.test.tsx:785` 单行测试数据随新契约更新，归属 AC-1。
- ✅ 边界遵守：内容加载协议、预览渲染未动；chevron/hover 操作按钮动效保留（`TopicTree.tsx:95/136`、`TreeItem.tsx:391`、`TreeSidebar.tsx:220-232`）。

## 冗余（不重，对照 story.md）

无。路径拼接单点收敛在 `topicFileAbsolutePath`，无并行实现。备注：`JournalItem.tsx:52` 仍有 180ms background 过渡，但该组件已无任何消费者（`grep '<JournalItem' src` 零命中，死代码），不构成 AC-2 用户可观察偏差，不计冗余。

## 结论

六项全部通过，result: pass。测试证据：`cd apps/web && bun run test` → 54 files / 401 tests 全绿（含两条新增 story 标注测试）。

## 待用户裁决

无。
