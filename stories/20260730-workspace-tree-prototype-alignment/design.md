# 工作空间文件树原型对齐设计

关联需求：[story.md](./story.md)

## 1. 设计目标

在不改变 workspace 数据、daemon 协议和既有文件操作语义的前提下，将工作空间文件树的真实渲染结果对齐用户提供的原型：

- 顶部只保留“个人空间”和常显排序按钮；
- 删除未实现的搜索入口和重复的“工作空间”分组标题；
- 统一目录与文件的名称列、10 px 层级缩进、34 px 行节奏和竖向引导线；
- 移除目录名后的子项统计数字；
- 将 workspace 文件图标升级为用户选定的 B · Glyph Tile 主题；
- 选中态继续使用唯一信号橙 `#FF5701`，采用完整圆润胶囊，不使用左侧选中条；
- 保留排序、展开/折叠、选择、`@`、更多菜单、右键菜单、拖拽排序和键盘导航。
- 修复纯 Web 和 Electron 中 workspace 文件/目录的右键删除，继续使用现有 ChangeSet 可恢复删除语义。

本设计的视觉改动只作用于 workspace 文件树。删除修复仅重用现有 `workspace_delete_file` 和 ChangeSet，不改 daemon、文件系统、权限或持久化语义。Journal、Identity 与详情面板视觉不受影响。

## 2. 证据与基准

参考 PNG 的实际尺寸为 596×1100 px。根据字号、图标和行间距推定其展示比例约为 DPR 2，视觉验收统一归一化为 298×550 CSS px。DPR 只用于复现截图尺寸，不进入业务逻辑。

归一化后的关键锚点：

| 锚点                 | 目标值                                         |
| -------------------- | ---------------------------------------------- |
| 侧栏宽度             | 298 CSS px                                     |
| 标题左边缘           | 约 16 CSS px                                   |
| 文件树首行顶部       | 约 30 CSS px                                   |
| 相邻行中心距离       | 34 CSS px                                      |
| 相邻层级名称列增量   | 10 CSS px                                      |
| 根级引导线横坐标     | 约 19 CSS px                                   |
| 文件类型图标可见尺寸 | Glyph 约 11–12 CSS px，tile 与占位为 16 CSS px |
| 选中胶囊横向范围     | 约 x=7 至 x=291 CSS px                         |
| 选中胶囊高度与圆角   | 34 CSS px 高，17 CSS px 半径的完整胶囊         |
| 尾部操作顺序         | `…`，然后 `@`                                  |

关键几何允许误差为 ±2 CSS px。信号橙选中态、常显排序按钮和 B · Glyph Tile 是用户确认的产品差异，不要求与参考图的灰色选中态、无排序按钮和纸张轮廓完全重合。Glyph Tile 仍必须保持名称列和与原型一致的行几何。

### 2.1 删除失效根因

只读调试确认删除链存在两个独立断点：

1. `TreeContextMenu` 通过 `hostAsk` 请求确认，而 plain web 在没有 `window.electronAPI` 时固定得到 `false`，因此删除回调永远不会执行。HTML Standard 已定义 `window.confirm(message)` 的布尔确认语义，可作为 workspace 删除显式选择的最小标准 fallback；generic `hostAsk` 保持原有无宿主 `false`，避免改变详情页等范围外调用。
2. workspace 树已从旧 `topics/` 白名单迁移到 workspace 根目录，但 `TreeSidebar` 删除仍调用 `delete_topic`。正确的现有路径是 `workspace_delete_file` → `DELETE /files` → `FilesService.delete`，该路径已经记录可恢复的 remove ChangeSet。

本轮不在 daemon 新增接口，也不复制删除逻辑。

权威来源：[WHATWG HTML `confirm()`](https://html.spec.whatwg.org/multipage/timers.html#dom-confirm-dev)；[Electron `dialog`](https://www.electronjs.org/docs/latest/api/dialog)。

## 3. 已选视觉方案

HTML mockup 比较了三个标题行方案：

- A：排序按钮仅在悬浮或聚焦时出现；
- B：排序按钮在“个人空间”标题行始终可见；
- C：移除标题行按钮，仅从右键菜单进入排序。

用户选择方案 B。排序能力可发现，标题区域仍保持单层结构。标题行高度为 30 px；排序按钮使用 28 px 圆形点击区并消费结构化圆角、边框、悬浮和聚焦 token。

第二次可视化比较了三套 workspace 文件 icon 主题：

- A · Paperline：无折角圆角文档壳，原型保真最高；
- B · Glyph Tile：柔和圆角色块承载简洁 glyph，扫读识别最快；
- C · Filemark：标准折角文件轮廓，系统图标库感最强。

用户选择 B · Glyph Tile。这一选择取代了原设计中“workspace 专用纸张轮廓”的视觉假设，但不改变名称列、层级缩进、行高和选中胶囊的几何契约。

## 4. 组件边界

### 4.1 `TreeSidebar`

`TreeSidebar` 负责：

- 渲染单一标题行：“个人空间” + 常显排序按钮；
- 继续持有现有排序菜单开关和 `useTreeSort` 行为；
- 渲染 workspace tree 根容器；
- 保留现有空状态、加载状态和上下文菜单入口。

它不再渲染 `Workspace`、搜索按钮、布局按钮或额外“工作空间”标题。删除这些入口时同步删除对应的无效 import、无用状态和不可达事件处理器。

### 4.2 `WorkspaceTreeRow`

新增 workspace 专用的共享行原语 `WorkspaceTreeRow`，集中表达：

- 34 px 行高和完整胶囊；
- 层级缩进、固定 marker 槽、同级名称列；
- 目录箭头或文件类型图标；
- 名称、省略、重命名输入框和尾部区域；
- 默认、悬浮、选中、拖拽、上下文菜单和键盘聚焦状态；
- 尾部操作的出现规则及 `…` → `@` 顺序。

`TopicTree` 的递归目录/文件行直接使用该原语。现有 `TreeItem` 在 `topic-file` 分支委托给相同原语，以覆盖 pinned workspace 文件；Journal 与 Identity 分支继续使用原实现，避免把 workspace 的 10 px 缩进和胶囊规则扩散到其他列表。

### 4.3 `TopicTree`

`TopicTree` 继续负责树数据、展开状态、选择、重命名、拖拽和上下文菜单。它只把显示状态与回调传给 `WorkspaceTreeRow`，并用 scoped children wrapper 表达递归层级。

每层 children wrapper 使用伪元素绘制竖向引导线。引导线长度随展开子项的真实高度自然变化；折叠时 children wrapper 不渲染，因此不会遗留短线或改变后续同级名称列。

### 4.4 `FileTypeIcon`

继续复用仓库现有 `FileTypeIcon`、`VectorGlyph`、文件类型分类和 palette，不引入新图标依赖。`FileTypeIcon` 增加可选 `variant="glyph-tile"`：

- 默认 variant 保持 `WorkspaceView` 和 `FileChip` 现有外观；
- workspace 树传入 `glyph-tile`，使用 16×16 px 圆角色块和约 11–12 px 内部 glyph；
- 根元素暴露 `data-file-kind` 和 `data-file-icon-variant`，样式不再依赖中文 `aria-label`；
- Markdown、HTML、PDF、图片、表格、音视频和其他类型继续消费现有文件语义色 token；
- 选中行上 glyph 与 tile 转为选中前景的可读变体，不与 `#FF5701` 背景竞争。

行尾操作复用项目已有 `lucide-react` 中的 `Ellipsis` 和 `AtSign`，目录箭头可同步复用 `ChevronRight`。项目已直接依赖 Lucide，因此没有新增依赖或 lockfile 变更。

## 5. 几何与样式契约

样式放入 workspace scoped 样式文件，并从树入口导入。所有视觉状态消费 `docs/DESIGN.md` 定义的结构化 token；下面的尺寸属于该组件的布局契约，集中定义在根容器自定义属性中，不散落到递归节点：

```css
.workspace-tree {
  --workspace-tree-row-height: 34px;
  --workspace-tree-indent: 10px;
  --workspace-tree-inline: 7px;
  --workspace-tree-marker: 16px;
  --workspace-tree-marker-gap: 5px;
  --workspace-tree-guide-offset: 4px;
}
```

`TreeSidebar` 的滚动容器已有 8 px 外层 gutter，因此根级引导线的最终侧栏坐标为
`8 + 7 + 4 = 19 px`；下一层再叠加 10 px，得到 29 px。这里的 offset 是树容器内部值，
不是相对整个侧栏的绝对坐标。

每行接收整数 `depth`，仅用于设置 `--workspace-tree-depth`。名称列由“根级起点 + depth × 10 px”计算。目录箭头和 Glyph Tile 进入同一个 16 px marker 槽。marker 从 14 px 增加到 16 px 时，gap 从 7 px 减为 5 px，两者总和仍为 21 px，因此同级名称列和原型几何不变。

实现使用 CSS grid 的固定 marker 列、弹性名称列和 trailing actions 列：

1. 层级偏移；
2. 16 px marker；
3. 5 px 间距；
4. `minmax(0, 1fr)` 名称；
5. trailing metadata/actions。

拖拽把手放在 trailing 区，不占用名称列前方空间。目录子项计数从 DOM、props 和样式契约中完整移除。名称过长时单行省略。进入重命名时输入框占用名称列，不改变 marker 与 trailing 列。

选中行：

- 背景和前景使用现有 `--item-selected-bg`、`--item-selected-text`，其唯一 accent 来源仍为 `--signal-orange`；
- 使用 `--radius-pill`，不新增硬编码圆角；
- 背景覆盖容器可用宽度，左右各约 7 px；
- 移除 `topic-file` 旧的左侧橙色选中条；
- 默认不额外位移文字、图标和操作区。

悬浮和聚焦不改变行高或名称列。聚焦使用结构化 focus-ring token，只有键盘 `:focus-visible` 时显示。动效使用现有 duration/easing token，并尊重 `prefers-reduced-motion`。

## 6. 交互与数据流

本次不新增数据源或 daemon 能力。浏览、选择与展开流保持不变；删除流只校正到现有 workspace 运行时能力：

```text
useTopics / useTreeSort / usePinned
              │
              ▼
         TreeSidebar
              │
              ▼
     TopicTree / pinned TreeItem
              │
              ▼
       WorkspaceTreeRow
```

```text
TreeContextMenu
      │
      ├─ Electron: electronAPI.ask
      └─ Web: window.confirm
      │
      ▼
TreeSidebar → runtimeClient.workspace_delete_file → FilesService / ChangeSet
```

- 排序按钮调用现有排序菜单，排序选择与 manual sort 行为不变；
- 目录箭头继续调用现有 expand/collapse 回调；
- 单击文件、双击或 Enter、方向键导航继续走现有选择/打开路径；
- 右键菜单、`@` 和更多菜单继续调用现有回调；
- 选中或悬浮时显示尾部操作，视觉顺序固定为 `…` 后 `@`；
- 未悬浮、未选中时隐藏操作；目录不再显示子项计数；
- 搜索入口直接删除，不创建空壳状态或替代 API。

### 6.1 删除确认与运行时路由

- generic `hostAsk` 优先调用 `window.electronAPI.ask`，保留 Electron 原生 dialog 及现有 IPC 白名单；没有 Electron host 时继续返回 `false`；
- workspace `topic-file`/`topic-folder` 删除显式调用 `hostConfirm`：Electron 仍走同一原生 `ask`，plain Web 回退到 `window.confirm(message)`，SSR/无 `window` 返回 `false`；
- 日志、身份、详情页和错误提示不调用 `hostConfirm`，因此不会获得本 story 范围外的 plain-Web 行为变化；
- 用户取消时，`TreeContextMenu` 不调用删除回调；
- 用户确认时，workspace `topic-file` 与 `topic-folder` 都调用 `workspace_delete_file({ relativePath: path })`；
- 只在运行时删除成功后执行 deselect、pinned refresh 和 workspace tree reload；失败继续保留现有错误记录。

删除路径继续遵守 `runtimeClient` 唯一入口和 ChangeSet 写入规则，组件不直连 daemon URL。

排序按钮具有可访问名称，菜单继续具备正确的 menu 语义。行级按钮必须阻止事件冒泡，避免点击操作时同时选择或展开行。

## 7. 边界与异常状态

- **加载与空状态**：标题行和排序按钮稳定显示；树区域沿用既有 loading/empty 内容，不伪造目录。
- **空目录**：无子项目录仍保留 marker 槽和名称列；是否显示展开箭头遵循现有业务判定。
- **紧凑目录**：继续使用现有 compact path 数据，不通过 CSS 重新拼接路径；末级 marker 和名称列遵循真实 depth。
- **窄侧栏与长名称**：名称列先收缩并省略，尾部按钮保持 28 px 圆形点击区且不可被文字覆盖。
- **manual sort 与拖拽**：拖拽把手只在现有条件出现；拖拽中的 opacity/背景状态不改变固定行几何。
- **pinned 文件**：通过 `TreeItem` 的 `topic-file` 分支复用 workspace 行，避免主树与 pinned 文件视觉分叉。
- **暗色主题**：不写固定浅色背景或文字色；由现有 semantic token 映射。信号橙仍是唯一 accent。
- **减少动态效果**：遵循全局 reduced-motion 规则。

## 8. 测试策略

实现遵循 TDD：先把当前行为写成失败测试，再写最小实现使其通过。至少覆盖以下独立状态：

1. 标题只显示“个人空间”和常显排序按钮，`Workspace`、搜索及额外“工作空间”标题不存在；
2. 根级目录和文件共用名称列；
3. 根、一级、二级的 depth 与 10 px 缩进、竖向引导线正确；
4. Markdown、HTML 和其他支持类型使用正确图标并保持固定占位；
5. 选中项为信号橙完整胶囊、无左侧选中条；
6. 悬浮/选中操作按 `…` → `@` 排列，默认状态隐藏；
7. 展开和折叠同步更新子项及引导线，不改变同级名称列；
8. 排序菜单、右键、`@`、更多菜单与键盘导航回归；
9. `:focus-visible` 和暗色主题使用结构化 token，不产生几何漂移。
10. 目录在任何状态下都不渲染子项计数。
11. Plain Web 确认/取消与 Electron 确认分支，以及 workspace 文件/目录删除精确调用 `workspace_delete_file`；generic `hostAsk` 的无宿主行为保持不变。

组件测试优先断言可访问语义、DOM 层级、事件和显式的 `data-depth`/状态属性；不把易碎的整段 class 字符串当行为契约。

### 8.1 真实渲染视觉验收

视觉验证必须经过生产使用的 `.md-content`/全局主题/组件样式级联，不用脱离应用 CSS 的静态复制品代替：

1. 用 Playwright 启动真实 web app；
2. 拦截 daemon HTTP/SSE 请求，提供固定的三层 workspace fixture；
3. 将侧栏宽度设为 298 CSS px，viewport DPR 设为 2，截取 596×1100 px 基准图；
4. 通过 DOM bounding box 校验标题、行中心、三层名称列、引导线、图标和选中胶囊，误差不超过 ±2 CSS px；
5. 将实际截图与用户原型按相同尺寸生成透明叠加对比；
6. 对信号橙选中颜色、常显排序按钮和 B · Glyph Tile 这三项已批准差异做显式注记；
7. 浅色、暗色、悬浮、选中和键盘聚焦状态分别留证；
8. 由用户对最终真实渲染截图进行视觉确认。

不新增只在生产包中可访问的调试路由。确定性数据通过测试层网络拦截注入，页面仍走真实组件与 CSS。

### 8.2 工程门禁

完成实现后执行：

```bash
bun run --filter @journal/web test
bun run --filter @journal/web build
bun run --filter @journal/web lint
```

随后执行仓库 `verification-gate`，产出 verify report；在用户视觉确认和验收门禁通过前不提交。

## 9. 预期文件范围

预计新增或修改：

- `apps/web/src/components/WorkspaceTreeRow.tsx`
- `apps/web/src/components/TreeSidebar.tsx`
- `apps/web/src/components/TopicTree.tsx`
- `apps/web/src/components/TreeItem.tsx`
- `apps/web/src/components/FileTypeIcon.tsx`
- `apps/web/src/lib/hostBridge.ts`
- workspace scoped CSS
- 对应的 `WorkspaceTreeRow`、`TreeSidebar`、`TopicTree`、`TreeItem`、`TreeContextMenu`、`hostBridge` 测试
- workspace tree 真实渲染视觉测试及截图证据
- 验收通过后按 docs-maintenance 结果更新 `docs/DESIGN.md` 或相关文档

## 10. 风险与回滚

| 风险                                       | 控制措施                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| 共享 `TreeItem` 导致 Journal/Identity 漂移 | 只在 `topic-file` 分支委托 workspace 行；为其他类型保留回归测试                |
| 固定 trailing 按钮挤压名称                 | grid 使用 `minmax(0, 1fr)`；窄宽度下先省略名称                                 |
| 拖拽、重命名与新 grid 冲突                 | 分别测试 manual sort、拖拽态和 inline rename                                   |
| 参考图比例推断有偏差                       | 以 34 px 行节奏和 DOM 锚点为主，最终由等比例截图叠加与用户确认校准             |
| 暗色主题出现硬编码浅色                     | 仅使用 semantic/structured token，并做真实暗色截图                             |
| Glyph Tile 色块在选中胶囊上对比不足        | 选中时切换为 selected foreground 变体，真实明暗主题测量对比                    |
| 删除路由再次退回旧 `topics/` API           | 组件测试锁定 `workspace_delete_file` 的 operation 名与 workspace-relative path |
| Web 确认 fallback 意外跳过取消语义         | `hostBridge` 分别覆盖 confirm=true/false，E2E 覆盖取消不发请                   |

回滚以组件边界为单位：恢复 `TreeSidebar` 原标题区、让 `TopicTree`/`topic-file` 停止使用 `WorkspaceTreeRow`、删除 scoped 样式即可；不涉及数据迁移、持久化或 daemon 回滚。

## 11. 非目标

- 不实现搜索；
- 除恢复 workspace 右键删除的现有语义外，不改变排序算法、文件类型识别、置顶、其他 CRUD、拖拽或权限；
- 不重设计 Journal、Identity、详情面板或移动端；
- 不引入新图标库、CSS 框架或运行时依赖；
- 不以参考原型的中性灰替换 JournalClaw 的信号橙；
- 不修改版本号或 release 流程。
