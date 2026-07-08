---
story: ./story.md
design: ./design.md
date: 2026-07-08
round: 1
result: pass
scope: 'git -C /Users/yanwu/Projects/github/journal_claw diff HEAD -- apps/web/（4 文件：DetailView.tsx、locales/en.ts、locales/zh.ts、tests/DetailView.test.tsx）'
---

# 验收报告 — 无法识别类型的文件：提示用户选择纯文本渲染

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据 |
| ---- | ------- | ---- |
| AC-1 | ✅ pass | 提示面板：`DetailView.tsx:1836-1841` 仅 `fileKind === 'other' && !plainTextPaths.has(file.path)` 时进入提示分支；`:1865-1867` 显示 `unknownFileTypeHint` 提示文案，`:1869-1880` 两个按钮（viewAsPlainText / openExternal）。不自动加载：加载条件 `DetailView.tsx:1163-1170` 中 `other` 仅在 `plainTextPaths.has(topicFilePath)` 时触发 `getJournalEntryContent`。测试 `tests/DetailView.test.tsx:106-115` 断言两按钮存在且 `get_journal_entry_content` 未被调用，通过（54 files / 405 tests 全绿） |
| AC-2 | ✅ pass | 点击后 `setPlainTextPaths(add file.path)`（`DetailView.tsx:1871-1873`）→ 加载 effect 触发（依赖含 `plainTextPaths`，`:1204`）→ 渲染走与 `.txt` 完全同一分支 `(fileKind === 'text' \|\| fileKind === 'other') && content !== null`（`:1890`），同一 `<pre>` 样式与 SourceView/查找链路。测试 `tests/DetailView.test.tsx:118-131` 通过 |
| AC-3 | ✅ pass | 会话内记忆为组件 `useState<ReadonlySet<string>>`，key = 文件相对路径（`DetailView.tsx:1112-1113`）；切走切回时集合仍含该 path，直接进入 text 分支不再提示。测试 `tests/DetailView.test.tsx:134-158`：切到 `other.bin`（重新出现提示）再切回 `run.log`（直接显示内容、无提示按钮），通过 |
| AC-4 | ✅ pass | 提示按钮包在 `fileKind === 'other'` 条件内（`DetailView.tsx:1866,1868`）；md/html/image/pdf 等分支（`:1736-1832`）零改动（diff 未触及）。测试 `tests/DetailView.test.tsx:161-171`（md 文件无提示按钮）通过 |

## 范围完整性（不少，对照 story.md 范围）

- 两个操作入口、选择后 App 内纯文本渲染、会话内记忆——均已落地（见 AC 表）。
- 交棒项"超大文件截断"：design §5 明确不在本 story 做，与 .txt 同水位——代码确无截断（`getJournalEntryContent` 直取全文，`DetailView.tsx:1172`），符合 design 决定。

## 方案落实（不偏，对照 design.md）

- ✅ 全部改动收在 DetailView.tsx + 文案 + 测试，无新组件/依赖（`git diff --stat`：4 文件）。
- ✅ 记忆用组件内 `useState<Set>`，key 为相对路径（design §1 ↔ `DetailView.tsx:1113`）。
- ✅ 加载条件按 design §2 扩展（`:1169`）。
- ✅ 提示面板仅 other 分支加按钮，audio/docx 分支共用 UI 但按钮/提示均以 `fileKind === 'other'` 守卫（design §3 ↔ `:1865-1878`）。
- ✅ text 渲染分支按 design §4 扩展（`:1890`）。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ audio/docx/archive/pdf/video 等已识别类型无纯文本入口：archive/video/spreadsheet/presentation 不匹配任何新条件（`fileKind.ts:1-15` 枚举，非 `other`），行为与改动前一致。
- ✅ 无持久化：diff 中无 localStorage/daemon 写入，仅内存 state。
- ✅ 未扩充 fileKind 白名单：`lib/fileKind.ts` 零改动。
- ✅ 无编码/二进制嗅探代码。
- 按钮样式抽成 `actionButtonStyle` 常量（`DetailView.tsx:1841-1850`）：等价重构（原内联样式原样复用于两个按钮），归必要基础设施。

## 冗余（不重，对照 story.md）

- ✅ 单一实现路径：一个 state、一处加载条件、一处渲染分支复用，无并行实现。

## 结论

六项全部通过，`result: pass`。测试证据：`cd apps/web && bun run test` → 54 files / 405 tests 全通过（含本 story 4 条 AC 测试）。

## 待用户裁决

（无阻塞项）备注一处纯 cosmetic 差异：加载中 spinner 的 preview/source 顶栏开关判断 `hasPreviewSourceToggle`（`DetailView.tsx:1717-1718`）未含 `other`，选择纯文本后的短暂加载期顶栏无切换按钮、加载完出现。不影响任何 AC，可忽略或顺手补。
