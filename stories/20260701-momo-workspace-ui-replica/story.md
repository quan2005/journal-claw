---
id: STORY-20260701-momo-workspace-ui-replica
title: 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图
status: verified
source: gate
level: L2
hypothesis_basis: intuition（视觉偏好驱动，将通过用户确认 + 原型走查验证）
design: ./design.md
created: 2026-07-01
related: []
---

# 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图

> 一句话概括：**为喜欢 Momo 工作空间气质的知识工作者，在 JournalClaw 内提供一个集中、平静、可立即行动的 Workspace 入口视图。**

## 用户故事（Connextra）

作为 **JournalClaw 桌面端知识工作者用户**，
当我 **切换到 Topics（专题）分类、想要快速找到最近文档或创建/导入新内容时**，
我希望 **看到 Momo 截图风格的三栏 Workspace 视图：左侧 Topics 文件树、中间 Quick Start 与 Recently Viewed、右侧常驻 AI Chat 面板**，
以便 **把专题空间当作我的工作台，一眼知道从哪继续，并能立即创建、导入或询问 AI。**

## 真实用户问题（背景）

当前 JournalClaw 的主界面以「分类列表 + 详情」为核心：左侧树形列表按月份/画像/专题组织，中间是单条内容详情，右侧聊天面板默认收起。这种结构擅长沉浸式阅读单篇内容，但作为**每天产生多条日志、需要频繁在会议/文档/AI 之间切换的知识工作者**，缺少一个像截图中那样“打开即看见全局、可立刻继续”的 workspace hub。

### 现状失败模式

- **入口分散**：新建/导入操作藏在不同分类或菜单里，无法像截图中的 Quick Start 一样一眼触达。
- **最近记录不可见**：用户最近查看或编辑的文件没有集中展示， reopen 成本高。
- **AI 聊天与文件浏览割裂**：右侧面板默认关闭，用户需要主动打开才能与 AI 交互，缺少截图中“AI 助手常驻在右侧、随时可问”的陪伴感。
- **视觉气质不一致**：用户明确表达了对该截图 UI 的喜爱，说明当前谨迹的某些视图在“平静、现代、agentic”的感受上还有差距。

**证据**：[证据] 用户提供的截图明确展示了 Momo Workspace 的目标视觉；[证据] 当前 `apps/web/src/App.tsx` 主视图以 `TreeSidebar` + `DetailView` 为主，无集中 home hub；[证据] `docs/DESIGN.md` 定义了谨迹的橙白设计系统，复刻应在此系统内消费 token。

## 成功标准（脊柱 Q4）

做完后，**JournalClaw 桌面端用户** 会：

- 用户切换到 Topics 分类后，在同一屏内看到文件树、Quick Start、Recently Viewed；右侧 Chat 面板默认收起，但可通过现有切换按钮一键展开。
- 新建/导入/打开最近文件的操作路径从原来的「切换分类 → 寻找入口」缩短为「Workspace 内直接点击」。
- 视觉上与提供的 Momo 截图在布局、字号、间距、圆角、图标气质上高度一致；浅色模式优先对齐截图，暗色模式使用谨迹暗色 token 保持同等可用性。
- 颜色严格遵循谨迹设计 token，浅色/暗色两套变量均不引入第二交互 accent 色。

⚠️ 假设依据：以上基于 **用户明确偏好（直觉）**，将通过 **原型截图对比 + 用户走查** 验证。

## 验收标准（Given-When-Then）

### AC-1 — Workspace 作为 Topics 分类的新视图

- **Given** 用户已打开 JournalClaw 桌面应用
- **When** 用户从导航栏切换到 **Topics（专题）** 分类
- **Then** 中间内容区渲染 Momo 风格 Workspace hub，而不是原有单文件详情视图
- **And** 左侧 Topics 文件树、中间 Quick Start + Recently Viewed 正常显示
- **And** 右侧 Chat 面板默认收起，但展开后比例与截图一致，无明显错位或闪烁

### AC-2 — 文件树与 Workspace 结构

- **Given** 用户处于 Workspace 视图
- **When** 页面加载完成
- **Then** 文件树面板沿用现有 Topics 树形结构，文件夹可展开/折叠，文件项显示对应文件类型图标
- **And** 顶部可显示「Workspace」标题与搜索/视图图标（如保留现有树则至少保持 Topics 导航可用）

### AC-3 — Quick Start 操作区

- **Given** 用户处于 Workspace 视图
- **When** 查看中间内容区顶部
- **Then** 显示「Quick Start」标题
- **And** 水平排列三个可操作卡片：New File、New Folder、Import，图标与文案与截图一致
- **And** 点击后触发对应本地状态反馈（如打开输入框/文件选择器占位），不调用真实后端

### AC-4 — Recently Viewed 列表

- **Given** 用户处于 Workspace 视图
- **When** 页面加载完成
- **Then** 显示「Recently Viewed」标题与表头 Name / Contributors / Viewed
- **And** 列表按截图展示若干文件行，每行包含文件图标、文件名、路径副标题、贡献者头像、相对时间
- **And** 列表底部显示「Show more」可展开更多 mock 行

### AC-5 — 右侧 AI Chat 面板（Momo 风格 + 真实能力）

- **Given** 用户处于 Workspace 视图且手动展开了右侧 Chat 面板
- **When** 面板打开
- **Then** 右侧面板渲染 Momo 风格的 `WorkspaceChatShell`，保留 agent 选择、历史会话选择、真实发送/取消/重试等核心能力
- **And** 顶部标题区为「New Chat」下拉框，左侧使用聊天图标，点击后展开历史会话列表并支持切换/删除会话，同时保留独立的「+」新建按钮
- **And** 输入框与引擎/模型选择器、权限选择器融为同一卡片，选择器位于输入框底部，与截图一致
- **And** 工具调用以单行胶囊展示（图标 + 工具名 + 描述），默认收起；有输出时可点击展开查看执行过程与结果
- **And** `WorkspaceChatShell` 在所有分类（含 Topics）下均可用，不因为进入 Workspace 视图而丢失原本 Chat 功能
- **And** 空状态显示纯文字问候「闫戍's momo」（无吉祥物），输入框、发送/取消按钮与截图视觉一致；不显示独立的 Continue 按钮

### AC-6 — 视觉还原度（浅色模式）

- **Given** 用户在桌面端（≥1280px 宽度）查看 Workspace 视图
- **When** 与 Momo 截图并排对比
- **Then** 颜色仅使用谨迹设计 token（白/暖白/墨文字/信号橙），无第二 accent 色
- **And** 圆角、阴影、菜单边框、聚焦环均消费 `--radius-*`、`--shadow-overlay`、`--border-menu`、`--focus-ring`
- **And** 标题字体使用 Playfair Display / Noto Serif SC，正文使用系统无衬线，代码使用 JetBrains Mono
- **And** 各区块间距落在 8pt 网格上，无卡片套卡片装饰阴影

### AC-7 — 暗色主题可用性

- **Given** 用户将谨迹切换到暗色主题
- **When** 再次打开 Workspace 视图
- **Then** 三栏布局、文件树、Quick Start、Recently Viewed、Chat 面板均使用暗色 token 正确渲染
- **And** 文字对比度满足 `--text` / `--text-secondary` / `--text-tertiary` 相对其表面背景的可读性下限
- **And** 选中态、悬停态、聚焦环仍使用信号橙暗色版 `#FF7A33`，不与截图浅色冲突

## 三类边界（脊柱 Q5 · Won't）

- **不为哪些用户做**：
  - 不为移动端/平板用户做：本次仅针对桌面端宽屏，响应式适配到最小 1280px 即可，不优化小屏触控体验。
  - 不为非中文/非英文用户新增翻译：复刻文案以截图中文/英文为准，暂不提供多语言字符串（沿用现有 i18n 框架但新增 key 为硬编码占位）。

- **不在哪些场景出现**：
  - Workspace 绑定 Topics 分类：点击 Topics 导航后默认显示 Workspace hub；日志/画像分类保持原有视图不变。
- 选中 Topics 文件后中间仍进入原有文件详情视图；Workspace hub 仅在未选中文件时作为默认态显示。
- 不实现面板拖拽/resize：三栏宽度使用固定或预设值，不做拖拽分隔条调整。

- **不解决哪些相关但不同的问题**：
  - 不接入真实文件系统：New File / New Folder / Import 仅作前端状态/占位反馈，不写磁盘、不调用 daemon 文件 API。
  - 不新增独立 AI 聊天实现：右侧面板复用现有 `useConversation` / `useAgentRun` 的真实聊天能力；不在 Workspace 内额外引入一个仅本地回显的占位 Chat。
  - 不实现多人协同/权限/贡献者真实数据：Contributors 头像使用 mock；Recently Viewed 优先使用真实 topic 文件，不足 5 条时补充 mock 数据（Topics 为空时亦展示 mock）。
  - 不实现搜索/排序/过滤：搜索图标可占位，但不实现真实全文搜索功能。
  - 不强制右侧面板全局默认收起：Workspace 入口场景（切换到 Topics 且未选中文件）下右侧面板会收起；全局 `rightPanelOpen` 初始值保持既有行为不变。
  - 不补齐原 Chat 面板的所有辅助能力：单条消息编辑、历史消息重发、pending 项单独移除、独立 Continue 按钮等未在 AC-5 明确要求的能力本次不迁移，保留核心发送/取消/重试。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] 当 `activeCategory === 'topics'` 且未选中具体文件时渲染 Workspace hub；选中文件后仍进入原有详情视图。需在 `App.tsx` 中明确该分支。
- [ ] 是否需要新增 `WorkspaceView` 组件？文件应放在 `apps/web/src/components/` 还是新增 `apps/web/src/views/`？
- [ ] Quick Start / Recently Viewed / Chat 占位组件中，哪些可以复用现有 `ChatPanel`、`TreeSidebar`、`RightPanel`、`NavRail`？哪些必须新建？
- [ ] 右侧 Chat 面板的空状态问候区无吉祥物，如何保持视觉平衡（纯文字 / 占位头像 / 其他图形）？
- [ ] mock 数据结构如何设计，才能既支撑截图中的文件树与列表，又便于后续替换为真实数据？
- [ ] 是否新增自动化测试（Vitest + React Testing Library）？视觉验收是否增加截图对比（Playwright）？
- [ ] 现有设计 token 是否已覆盖截图中的所有色值/字号/阴影？若存在缺口，是否扩展 token 还是局部硬编码？
- [ ] 暗色模式下各表面/文字/悬停态如何映射到谨迹暗色 token？
- [ ] 新组件如何处理 `prefers-reduced-motion` 与可访问性（焦点环、aria-label）？

## 待确认（意图层）

| #   | 问题                                                         | 当前默认值                                   | 状态   |
| --- | ------------------------------------------------------------ | -------------------------------------------- | ------ |
| Q1  | 入口位置：Workspace 是否绑定到现有 Topics 分类？             | 是；点击 Topics 导航后默认显示 Workspace hub | 已确认 |
| Q2  | 右侧 Chat 面板是否默认展开？                                 | 默认收起，与当前谨迹行为一致                 | 已确认 |
| Q3  | 右侧 Chat 空状态是否保留吉祥物？                             | 不需要吉祥物，使用纯文字问候                 | 已确认 |
| Q4  | 是否只需要单次视觉原型验证，还是期望合并到主分支并长期维护？ | 直接嵌入 apps/web 代码库交付                 | 已确认 |
| Q5  | 颜色方案：严格像素级复刻 Momo，还是结构复刻 + 谨迹 token？   | 结构复刻，颜色/交互态走谨迹 token            | 已确认 |
| Q6  | 选中 Topics 文件后中间显示什么？                             | 进入原有文件详情视图                         | 已确认 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：不依赖其他未实现故事，可基于现有谨迹前端独立开发。
- [x] **N** Negotiable：范围可通过边界裁剪（如去掉 Chat 交互、仅做静态还原）。
- [x] **V** Valuable：为用户提供更平静的入口体验，符合其明确偏好。
- [x] **E** Estimable：范围已限定为单视图 + mock 数据，可估工。
- [x] **S** Small：1-2 sprint 内可完成原型。
- [x] **T** Testable：每条 AC 均使用 GWT，可通过视觉对比 + 自动化测试断言。

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                                                                                                                                                       |
| ---- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 2026-07-01 | 可开发    | 意图层问题已全部确认，待用户最终 approved                                                                                                                                                      |
| 6    | 2026-07-01 | 可验收    | 用户要求将真实 Chat 能力（agent/历史/发送/取消/继续）融入 Momo 风格右侧面板；story 与 design 已同步更新，进入第 6 轮 verification-gate                                                         |
| 7    | 2026-07-01 | 可验收    | 用户截图反馈：历史会话应纳入顶部「New Chat」下拉框，引擎/模型/权限应放在输入框下方；已调整 UI 并同步契约，进入第 7 轮 verification-gate                                                        |
| 8    | 2026-07-01 | 可验收    | 第 7 轮反馈 `workspace.css` 中 6 处圆角未走 token；已替换为 `--radius-sm/md/pill`，进入第 8 轮 verification-gate                                                                               |
| 9    | 2026-07-01 | 可验收    | 用户截图反馈：顶部「New Chat」图标需更换、工具调用 UI 需优化、输入框与选择器需融合、Continue 按钮需删除；已调整 UI 并同步契约，进入第 9 轮 verification-gate                                   |
| 10   | 2026-07-01 | 可验收    | 第 9 轮反馈 Continue 按钮契约文本未同步、App.tsx 仍传 `onContinue`；已更新 story/design、移除 `WorkspaceChatShellProps` 中的 `onContinue`、清理 `App.tsx` 传参，进入第 10 轮 verification-gate |
| 11   | 2026-07-01 | 可验收    | 用户反馈：工具执行过程和结果需用单行胶囊包装、默认收起、点击展开；已实现 `ToolCapsule` 组件并同步契约，进入第 11 轮 verification-gate                                                          |
| 12   | 2026-07-01 | 可验收    | 第 11 轮反馈 `workspace.css` 中部分间距未落在 4px 细粒度网格、空状态问候语需明确；已统一间距为 4 的倍数并在契约中明确问候语为「闫戍's momo」，进入第 12 轮 verification-gate                   |
| 13   | 2026-07-01 | 可验收    | 第 12 轮反馈仍有 3 处间距/尺寸未落在 4px 网格（下拉偏移 6px、列表 padding 2px、TreeSidebar Workspace 头部 padding/按钮尺寸）；已修复，进入第 13 轮 verification-gate                           |
