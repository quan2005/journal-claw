---
story: ./story.md
status: approved
created: 2026-07-09
---

# Design: Workspace tree 单链目录合并显示

## 核心决策：合并计算放在 daemon，前端零结构性改动

`listWorkspaceDir` 已经是 workspace tree 唯一的数据源（`apps/daemon/src/files/service.ts:168`，经 `GET /files` 暴露，`apps/web/src/hooks/useTopics.ts` 的 `listDir` 消费）。合并逻辑在 daemon 侧算好、直接把"压缩后的虚拟条目"返回给前端，前端渲染代码（`TopicTree.tsx`）**不需要理解"链"这个概念**——它拿到的仍是一个普通 `TopicEntry`，只是 `name`/`path` 已经指向链的末端。这样排序（`sortEntries`）、右键菜单、拖拽、键盘导航（均已在 `workspace-tree-enhancements` 故事里实现）全部免费兼容，不用逐个适配。

## 改动 1（daemon）：`FilesService.listWorkspaceDir` 加 `compact` 选项

```ts
listWorkspaceDir(relativePath = '', opts: { compact?: boolean } = {}): WorkspaceDirEntry[]
```

不改变默认行为（`compact` 默认 `false`，`listAtMentionCandidates` 等其他调用方不受影响，只有 workspace tree 传 `compact: true`）。

`compact: true` 时，对每个目录条目递归判断是否可合并：

```ts
function collapseChain(dir: string, name: string): { chainPath: string; chainName: string; terminal: string } {
  let currentDir = dir
  let currentName = name
  const segments = [name]
  for (;;) {
    const childPath = join(currentDir, currentName)
    let entries: Dirent[]
    try {
      entries = readdirSync(childPath, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'))
    } catch {
      break
    }
    if (entries.length !== 1 || !entries[0].isDirectory()) break
    currentDir = childPath
    currentName = entries[0].name
    segments.push(currentName)
  }
  return {
    chainPath: relativeFromRoot(join(currentDir, currentName)) /* wrong when loop never advances, see below */,
    chainName: segments.join('/'),
    terminal: currentName,
  }
}
```

（上面是示意，实现时用现有的 `resolveExistingDir`/`relativeFromRoot` 之类的私有辅助拼真实路径，不要重新发明路径拼接逻辑；关键收敛条件是 AC-2：`entries.length !== 1 || !entries[0].isDirectory()` 就停止合并——目录下除了这一个子目录还有别的文件/目录，链就断在这里。）

返回的 `WorkspaceDirEntry` 在合并发生时：
- `name`：终端目录的**真实名字**（不变，保证重命名输入框、右键菜单展示的是真实名字，不是拼接串）
- `path`：终端目录的真实 workspace-relative 路径（AC-4：右键操作默认作用于终端目录，因为 `path` 已经指向它，不用额外处理）
- 新增可选字段 `display_name?: string`：合并链的完整展示标签（如 `"a/b/c"`），只有真正发生了合并（链长度 ≥ 2）才设置；未合并的目录/所有文件条目不带这个字段。

`WorkspaceDirEntry` 接口（`apps/daemon/src/files/service.ts:21`）加：
```ts
export interface WorkspaceDirEntry {
  name: string
  is_dir: boolean
  path: string
  mtime_secs: number
  display_name?: string
}
```

`apps/web/src/lib/apiTypes.ts` 的 `TopicEntry` 同步加 `display_name?: string`。

## 改动 2（daemon）：路由透传 `compact` 参数

`GET /files`（`apps/daemon/src/server.ts:1077`）加 `compact` query 支持：

```ts
const compact = req.query.compact === 'true'
res.json(filesService().listWorkspaceDir(relativePath, { compact }))
```

## 改动 3（web）：`useTopics.ts` 请求时带 `compact=true`

`apps/web/src/hooks/useTopics.ts` 的 `listWorkspaceDir` 调用（`invoke('list_workspace_dir', { relativePath })`）加 `compact: true` 参数；`httpRuntimeClient.ts` 的 `case 'list_workspace_dir'` 透传到 `GET /files?relativePath=...&compact=true`。

**只有 workspace tree 走 compact**——`apps/daemon/src/files/service.ts` 里 `listAtMentionCandidates` 内部调用 `listWorkspaceDir` 时不传 `compact`（保持展开态，@ 提及候选列表不该把链合并，用户输入 `@a` 时应该还能匹配到中间层 `a`）。

## 改动 4（web）：展示名优先取 `display_name`

`apps/web/src/lib/topicCuration.ts` 的 `displayTopicName(entry)`（AC-2 现有函数：优先 frontmatter title，否则 humanize 文件名）在最前面插一条优先级最高的分支：

```ts
export function displayTopicName(entry: TopicEntry): string {
  if (entry.display_name) return entry.display_name
  const title = typeof entry.title === 'string' ? entry.title.trim() : ''
  return title || humanizeEntryName(entry.name)
}
```

`entry.name` 保持真实终端目录名不变，`TopicTree.tsx` 里 inline 重命名输入框已经用 `entry.name` 作 `defaultValue`（`workspace-tree-enhancements` 故事里实现的），**自动**只重命名终端目录，不需要额外改动——这正是 AC-4 要求的"重命名指定层级、以用户可理解方式明确作用对象"最省事的落地方式（真实名字摆在输入框里，用户看到的就是要改的那一层）。

## AC-3（结构变化自动重算）— 不需要额外代码

合并结果每次 `listWorkspaceDir(relativePath, { compact: true })` 调用都是现算现返回，不缓存。`useTopics.ts` 已有的 `topics-updated` 事件 + 防抖刷新（`TOPICS_REFRESH_DEBOUNCE_MS`）机制会在文件系统变化后重新拉取，天然拿到重新计算过的合并结果。**这条 AC 靠现有刷新机制自动满足，不用专门写代码**，实现时只需要在测试里验证一下（新增文件后再拉一次列表，断言链拆开）。

## AC-4 补充：合并节点的展开行为

链合并节点本身在树里只占一行，`path` 指向终端目录——用户点击展开这一行时，`onToggleDir(entry.path)` 直接请求终端目录的子内容（`listWorkspaceDir(terminalPath)`，非 compact，因为这是"展开一个目录看它内部"，内部子项该按各自情况继续 compact——递归展开时子请求同样应传 `compact: true`，保持链合并语义在任意深度都生效，不只是第一层）。这个行为已经是 `useTopics.toggleDir` 的既有逻辑（照常调 `listDir`），只要 Step 3 把 `compact: true` 固化进 `listDir` 内部，展开子目录时自动继承。

## 验收标准回归自查

- AC-1：`collapseChain` 递归收敛链，`display_name` 承载 `"a/b/c"` 展示，一次展开（`path` 指终端）直达内容。✓
- AC-2：`entries.length !== 1 || !isDirectory` 即停止合并，断链目录独立显示（`display_name` 不设置，走真实 `name`）。✓
- AC-3：无缓存 + 既有刷新机制，天然重算。✓
- AC-4：`path`/`name` 始终对应真实终端目录，右键菜单/重命名操作不用改代码就能自动作用于正确层级。✓

## 边界重申（继承 story.md Won't）

不加开关（默认对所有 workspace tree 用户生效，`compact: true` 硬编码在 `useTopics.ts` 里，不做可配置项）；不做分段点击跳转到链中间层（`display_name` 是纯文本 label，不拆成可点击的分段）；不改磁盘真实结构（纯展示层计算，`path`/`name` 全部指向真实文件系统实体）。

## 验证命令

```bash
cd apps/daemon && bunx vitest run src/files/service.test.ts src/server.test.ts
cd apps/daemon && bunx tsc --noEmit
cd apps/web && bunx vitest run
cd apps/web && bunx tsc --noEmit
npm run build
```
