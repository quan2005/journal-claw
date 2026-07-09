# 实现报告 · compact-folders（workspace tree 单链目录合并显示）

## 改动文件

| # | 文件 | 改动 |
| --- | --- | --- |
| 1 | `apps/daemon/src/files/service.ts` | `WorkspaceDirEntry` 加 `display_name?`；`listWorkspaceDir` 加 `opts:{compact?}`；新增私有 `compactChain()` 走单链合并（过滤隐藏文件、读错误即停、50 层防御上限） |
| 2 | `apps/daemon/src/server.ts` | `GET /files` 读 `?compact=true` 透传给 `listWorkspaceDir` |
| 3 | `apps/web/src/lib/apiTypes.ts` | `TopicEntry` 加 `display_name?` |
| 4 | `apps/web/src/hooks/useTopics.ts` | `list_workspace_dir` invoke 加 `compact: true`（硬编码，无开关） |
| 5 | `apps/web/src/lib/httpRuntimeClient.ts` | `list_workspace_dir` case 拼 `&compact=true` 透传 |
| 6 | `apps/web/src/lib/topicCuration.ts` | `displayTopicName` 优先返回 `display_name` |
| 7 | `apps/daemon/src/files/service.test.ts` | 新增 4 个用例（AC-1/2/3 + listAtMentionCandidates 不受影响） |

## 合并语义

对一个目录条目，自它向下只要「过滤隐藏文件后恰好只剩一个子目录」，就把子目录并入链，直到某层不满足（>1 项 / 唯一项是文件 / 读错误 / 50 层上限）。链长 ≥2 时：

- `display_name` = 链全程用 `/` 拼接（如 `a/b/c`）
- `name` = 链末端真实目录名（重命名输入框依赖真实名字）
- `path` = 末端目录的 workspace 相对路径

链长 =1 时三者保持原样，`display_name` 为 undefined。

## 关键约束遵守情况

- `listAtMentionCandidates` 内部调 `listWorkspaceDir(relativePath)` 不传 `compact`（默认 false），@ 提及不受影响——已加测试断言。
- 不加配置项：`compact:true` 硬编码在 `useTopics.ts`。
- 不改磁盘结构：纯展示层计算。
- 向后兼容：不传 `opts` 或 `compact:false` 行为零变化。
- 未引入新依赖。

## 测试命令完整输出

### `apps/daemon && bunx vitest run src/files/service.test.ts`
```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/daemon

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  08:47:31
   Duration  401ms (transform 121ms, setup 0ms, import 152ms, tests 63ms, environment 0ms)
```

### `apps/daemon && bunx vitest run`
```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/daemon

 Test Files  35 passed (35)
      Tests  224 passed (224)
   Start at  08:47:36
   Duration  5.10s (transform 3.69s, setup 0ms, import 16.59s, tests 3.25s, environment 17ms)
```

### `apps/daemon && bunx tsc --noEmit`
```
(no output — clean)
```

### `apps/web && bunx vitest run`
```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web

 Test Files  55 passed (55)
      Tests  392 passed (392)
   Start at  08:47:52
   Duration  39.10s (transform 3.02s, setup 7.73s, import 4.76s, tests 28.19s, environment 30.12s)
```

### `apps/web && bunx tsc --noEmit`
```
(no output — clean)
```

## 遇到的问题

无。前端不存在 `topicCuration.test.ts`，按任务说明未新建（前端逻辑简单，daemon 侧测试已覆盖核心行为）。

SUMMARY: result=pass | steps_done=8/8
