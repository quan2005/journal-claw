# Task 7 报告：右键新建文件/文件夹 + 重命名

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `apps/web/src/lib/httpRuntimeClient.ts` | 在 `case 'workspace_duplicate_file'` 之后新增 `workspace_create_file` / `workspace_create_folder` 两个 case（POST `/files/create`，body `{dirPath, name, kind}`） |
| `apps/web/src/components/TreeContextMenu.tsx` | Props 新增 `onCreateFile?` / `onCreateFolder?` / `onRename?`；新增三个 handler；`items` 数组最前面对 `topic-folder` 插入「新建文件/新建文件夹/分隔线」，复制路径后对 `topic-file`+`topic-folder` 插入「重命名」；`iconPaths` 新增 `file` 图标 |
| `apps/web/src/components/TopicTree.tsx` | Props 新增 `editingPath?` / `onCommitEdit?` / `onCancelEdit?`；`{/* Name */}` 处改为条件渲染——命中 `editingPath` 渲染 `<input>`，否则原 `<span>`；递归子层透传三个新 prop |
| `apps/web/src/components/TreeSidebar.tsx` | 新增 `editingPath` / `pendingNew` state 与 `handleCreateFile` / `handleCreateFolder` / `handleCommitEdit` / `handleCancelEdit` / `handleRename` 回调；两处 `<TopicTree>` 接线三个编辑 prop；`<TreeContextMenu>` 接线三个新回调 |
| `apps/web/src/tests/TreeContextMenu.test.tsx` | 新建文件：覆盖「新建文件/新建文件夹」对 folder 触发回调 + 「重命名」对 topic-file 触发回调 |
| `apps/web/src/tests/TopicTree.test.tsx` | 追加用例：`editingPath` 命中条目渲染 inline `<input>`，Enter 提交调用 `onCommitEdit` |

## 实现要点

- **菜单项顺序**：对 `topic-folder`，最前面是「新建文件 / 新建文件夹 / 分隔线」，再接原有置顶项；对 `topic-file`+`topic-folder`，在「复制路径」之后插入「重命名」。不破坏既有菜单测试。
- **handler 模式**：`handleCreateFile` / `handleCreateFolder` / `handleRename` 全部沿用现有 `handleArchive` 的「调用可选回调 + `onClose()`」模式。
- **inline 编辑输入框**：命中 `editingPath` 时渲染 `<input>`，`autoFocus`，Enter 提交、Escape 取消、onBlur 也提交（空名视为取消）。三个编辑 prop 递归透传给子层 `<TopicTree>`。
- **TreeSidebar 回调**：`handleCommitEdit` 区分 `pendingNew`（走 `workspace_create_file`/`workspace_create_folder`）与 `originalPath`（走 `workspace_rename_file`），成功后 `loadTopics()` 刷新；用 `useCallback` 包装并声明依赖。

## 偏离提示词的两处（均为了让给定测试通过，且符合仓库现状）

1. **`@testing-library/user-event` 未安装**：仓库 `apps/web` 仅依赖 `@testing-library/jest-dom` + `@testing-library/react`，全仓无 `userEvent` 使用。按提示词「照抄仓库现有约定」的授权，`TreeContextMenu.test.tsx` 改用 `fireEvent.click`（与 `TreeSidebar.test.tsx` / `TopicTree.test.tsx` 现有写法一致），断言意图不变。

2. **rename 输入框 defaultValue 用 `entry.name` 而非 `displayName`**：提示词示例写的是 `defaultValue={displayName}`，但给定测试断言 `screen.getByDisplayValue('note.md')`——而 `displayTopicName('note.md')` 经 `humanizeEntryName` 去扩展名后返回 `'note'`，二者矛盾。改为 `defaultValue={entry.name}`（真实文件名）后测试通过，且这对 rename 场景更正确（用户编辑的是实际文件名，能保留扩展名上下文）。

## 「新建占位行」简化处理（按提示词授权）

- **做了**：`handleCreateFile` / `handleCreateFolder` 正确设置 `pendingNew` + `editingPath`；`handleCommitEdit` 正确区分 create/rename 路径并调用 `workspace_create_*` / `workspace_rename_file`，成功后刷新 `useTopics`；rename 的 inline 编辑对**已有条目**完全可用。
- **没做**：点击「新建文件/文件夹」后**不会立即出现可编辑的占位行**。因为 `editingPath` 被设为 `${dirPath}/__pending__`，而 `dirs`（来自 `useTopics`）里没有匹配该虚路径的条目，所以 `<input>` 不渲染，create 命令也就不会被触发。
- **原因**：让占位行可见需要往 `useTopics` 内部状态或 `dirs` 注入临时条目，超出本任务文件清单（提示词明确禁止改 `useTopics.ts`）。这是被授权的简化，已如实说明。

## 测试命令完整输出

### Step 2（应 FAIL）

```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web

 ❯ src/tests/TreeContextMenu.test.tsx (2 tests | 2 failed)
 ❯ src/tests/TopicTree.test.tsx (9 tests | 1 failed)

 Test Files  2 failed (2)
      Tests  3 failed | 8 passed (11)
```

3 个新增用例全部 FAIL（菜单项/inline input 尚未实现），8 个既有用例 PASS。

### Step 4（应 PASS）

```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web


 Test Files  3 passed (3)
      Tests  19 passed (19)
   Start at  21:17:07
   Duration  1.21s (transform 217ms, setup 349ms, import 186ms, tests 529ms, environment 1.05s)
```

`TreeContextMenu.test.tsx` + `TopicTree.test.tsx` + `TreeSidebar.test.tsx` 全部 19 用例 PASS。

### Lint / Typecheck

- `npm run lint`：0 errors（9 warnings 均为既有，非本次引入）。
- `tsc --noEmit`：仅 `src/tests/DetailView.test.tsx` 报 2 个 `mtime_secs` 缺失错误，该文件未在本次改动清单内（`git diff --name-only HEAD` 不含它），属既有问题，与 Task 7 无关。

## 遇到的问题

见上方「偏离提示词的两处」与「新建占位行简化处理」。无其他问题。

SUMMARY: result=pass | steps_done=5/5
