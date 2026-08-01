# 独立 mutation evidence

- 日期：2026-08-01（Asia/Hong_Kong）
- 验证者角色：独立验证子智能体；未参与本轮实现修改
- 真实工作树：`/Users/yanwu/Projects/github/journal_claw`
- 临时副本：由 `mktemp -d /tmp/journal-claw-tdd-evidence.XXXXXX` 创建，实际路径为 `/tmp/journal-claw-tdd-evidence.fWblQa`（Vitest 解析为等价的 `/private/tmp/journal-claw-tdd-evidence.fWblQa`）
- 证据性质：这是实现完成后的独立测试敏感性验证，不声称或补写原始开发阶段的红→绿时序。

## 隔离策略

在真实工作树根目录执行：

```bash
evidence_tmp=$(mktemp -d /tmp/journal-claw-tdd-evidence.XXXXXX)
mkdir -p "$evidence_tmp/apps/web"
rsync -a apps/web/ "$evidence_tmp/apps/web/" \
  --exclude node_modules --exclude dist --exclude build \
  --exclude test-results --exclude playwright-report --exclude .vite
ln -s /Users/yanwu/Projects/github/journal_claw/apps/web/node_modules \
  "$evidence_tmp/apps/web/node_modules"
cp package.json bun.lock "$evidence_tmp/"
```

复制范围只包含 Web 应用源码、测试与配置；排除了 `.git`（未复制仓库根目录）、`node_modules`、`output`（未复制仓库根目录）、`dist`、`build`、`test-results`、`playwright-report` 和 `.vite`。依赖目录只读复用真实工作树现有安装；所有变异均应用在 `/tmp/journal-claw-tdd-evidence.fWblQa/apps/web/src/` 下。

复制后、变异前，目标文件与真实工作树 SHA-256 完全相同：

```text
62187f704340fbfbddbd9aed32facfa078ccd0d97ab6c7f95e70662c391acdbb  apps/web/src/components/TreeContextMenu.tsx
e4ca886bc2a7ad6b4d0b02c015e52fb5ef41104a0db990a1714b31d1d8941144  apps/web/src/styles/workspace-tree.css
tree-context-copy-hash-match
css-copy-hash-match
```

## 变异 A：破坏 `topic-folder` 删除确认链路

仅在临时副本将：

```ts
itemType === 'topic-file' || itemType === 'topic-folder' ? hostConfirm : hostAsk
```

变异为：

```ts
itemType === 'topic-file' ? hostConfirm : hostAsk
```

这会让 `topic-folder` 错误地退回通用、Web 下默认拒绝的 `hostAsk`，而 `topic-file` 保持不变。

工作目录：`/tmp/journal-claw-tdd-evidence.fWblQa/apps/web`

精确测试命令：

```bash
./node_modules/.bin/vitest run src/tests/TreeContextMenu.test.tsx --reporter=verbose
```

变异结果：exit code `1`。

关键失败摘要：

```text
Test Files  1 failed (1)
Tests       2 failed | 5 passed (7)
uses explicit Web-capable confirmation before deleting 'topic-folder'
  expected onDelete to be called with ['topic-folder', 'System']; calls: 0
keeps 'topic-folder' when explicit Web-capable confirmation is cancelled
  expected mockHostConfirm to be called; calls: 0
```

`topic-file` 的确认与取消用例仍通过，因此失败精确落在被破坏的文件夹分支。

恢复上述临时变异后，以完全相同命令重跑：exit code `0`。

```text
Test Files  1 passed (1)
Tests       7 passed (7)
```

结论：参数化右键菜单测试能够捕获“文件可删、文件夹误走通用确认桥”的目标回归，并在恢复正确分支后转绿。

## 变异 B：破坏 34px 行节奏

仅在临时副本将：

```css
--workspace-tree-row-height: 34px;
```

变异为：

```css
--workspace-tree-row-height: 35px;
```

工作目录：`/tmp/journal-claw-tdd-evidence.fWblQa/apps/web`

精确测试命令：

```bash
./node_modules/.bin/vitest run src/tests/WorkspaceTreeRow.test.tsx --reporter=verbose
```

变异结果：exit code `1`。

关键失败摘要：

```text
Test Files  1 failed (1)
Tests       1 failed | 11 passed (12)
WorkspaceTreeRow > exposes its workspace geometry and selected state...
Expected: "34px"
Received: "35px"
src/tests/WorkspaceTreeRow.test.tsx:108
```

恢复上述临时变异后，以完全相同命令重跑：exit code `0`。

```text
Test Files  1 passed (1)
Tests       12 passed (12)
```

结论：组件测试读取真实注入的 `workspace-tree.css` 级联值，能够直接捕获 34px → 35px 的行节奏回归，并在恢复 34px 后转绿。

## 真实工作树未被变异修改

两个临时文件恢复后，其 SHA-256 再次与真实工作树一致；随后使用经过字面量前缀约束的精确路径清理临时目录：

```bash
find /tmp/journal-claw-tdd-evidence.fWblQa -depth -delete
test ! -e /tmp/journal-claw-tdd-evidence.fWblQa
```

清理结果：exit code `0`，`temp-absent`。

真实实现文件在验证前后的 SHA-256 均为：

```text
62187f704340fbfbddbd9aed32facfa078ccd0d97ab6c7f95e70662c391acdbb  apps/web/src/components/TreeContextMenu.tsx
e4ca886bc2a7ad6b4d0b02c015e52fb5ef41104a0db990a1714b31d1d8941144  apps/web/src/styles/workspace-tree.css
```

验证前后，真实工作树的目标范围 `git status --short` 均保持为：

```text
 M apps/web/src/components/TreeContextMenu.tsx
 M apps/web/src/tests/TreeContextMenu.test.tsx
?? apps/web/src/styles/workspace-tree.css
?? apps/web/src/tests/WorkspaceTreeRow.test.tsx
```

这些是进入独立验证前已经存在的 story 改动；本验证未改变其状态。`git diff --cached --name-only` 在目标范围为空，未暂存、未提交。
