# 工作区界面精简设计

**Story:** `stories/20260730-ui-surface-cleanup/story.md`

## 目标

从主工作区真实 DOM 中移除左右面板分隔线上的折叠/展开按钮，以及日志未选中态中的“粘贴 / 拖文件”卡片；把空会话文案改为“您的谨迹”。保持三栏结构、分隔线宽度拖拽、面板状态与替代唤起路径、全窗口文件拖放及空工作区示例入口不变。

## 现状证据

- `apps/web/src/App.tsx` 的左右 divider 各渲染一个按钮，点击直接切换面板开关状态。
- `apps/web/src/components/DetailView.tsx` 在日志未选中态渲染引导标题、粘贴卡片，并在空工作区额外渲染示例卡片。
- “粘贴 / 拖文件”卡片自身没有剪贴板或拖放处理，只会打开右侧面板；真实文件拖放由 `App` 的 host file-drop 订阅与 Electron preload 提供。
- `apps/web/src/components/WorkspaceView.tsx` 在空会话中硬编码“闫戍's momo”。
- `apps/web/src/tests/App.test.tsx` 当前断言左右 divider 按钮存在，与本次目标相反；`apps/web/src/tests/WorkspaceView.test.tsx` 当前断言旧问候语。

## 方案比较

### A. 删除可见节点，保留底层状态与替代交互（采用）

直接停止渲染三个目标按钮/卡片，仅清理因卡片删除而失去意义的容器与孤立标题。面板状态、快捷键、响应式规则、业务唤起、divider 拖拽和 host file-drop 链路保持不变。

优点：用户要求与 DOM、辅助技术树一致；改动小；不会留下可聚焦的隐藏控件。代价：折叠面板不再依赖 divider 上的鼠标按钮，需要沿用现有快捷键或业务入口。

### B. 仅用 CSS 隐藏

视觉上消失，但节点、事件与无障碍语义仍可能存在，且容易在样式回归后重新出现。不采用。

### C. 同时删除折叠状态和文件导入能力

能进一步简化状态，但会改变响应式、快捷键、业务唤起和本地文件工作流，明显超出用户圈定范围。不采用。

## 组件设计

### App 面板 shell

- 左右 divider 保留，继续承担 resize hit target。
- 删除 divider 内的两个切换按钮及不再使用的 chevron 图标引用。
- 不修改 `leftSidebarOpen`、`rightPanelOpen`、`set*Open`、窗口断点、自动收起、固定状态、快捷键和业务唤起逻辑。
- 不修改左右面板宽度、持久化键或拖拽范围。

### DetailView 日志未选中态

- 删除“粘贴 / 拖文件”按钮。
- 工作区非空时，中央未选中态只保留现有水印，不渲染孤立的“通过以下方式开始记录”标题。
- 工作区为空且存在示例回调时，继续显示“通过以下方式开始记录”和“创建示例条目”按钮。
- `onOpenDock` 仅被该卡片消费，因此从 `DetailView` 接口和 `App` 调用处一并移除；只包装该 prop 的 `handleOpenChat` 同步删除。真正承载会话打开行为的 `openChatPanel`、快捷键和其他业务唤起路径保留。

### WorkspaceChatShell 空会话

- 将空会话 greeting 的唯一可见文本从“闫戍's momo”替换为“您的谨迹”。
- 不修改消息、队列、streaming、输入框或会话切换逻辑。

## 数据流与异常处理

本改动不新增数据流、网络请求、持久化或异常分支。文件拖放仍沿用：

`Electron preload → hostBridge.onFileDrop → App handleDropFiles → runtimeClient import_file / enqueue_work`

删除中央卡片不得修改这条链路。面板开关仍由现有 UI context 和 App 内状态管理；在窄窗口自动收起后，仍可通过现有导航/快捷键/业务动作重新打开。

## 测试设计

遵循先红后绿：

1. 修改 `apps/web/src/tests/App.test.tsx`，把“按钮存在并可点击”的断言改为“左右 divider 存在，但两个折叠/展开按钮均不存在”；保留或补充 divider 与面板结构断言。
2. 在 `apps/web/src/tests/DetailView.test.tsx` 增加两类未选中态测试：
   - 非空工作区不出现“粘贴 / 拖文件”和孤立标题；
   - 空工作区仍出现“创建示例条目”，且不出现粘贴卡片。
3. 修改 `apps/web/src/tests/WorkspaceView.test.tsx`，先期待“您的谨迹”并排除旧文案。
4. 运行上述测试确认在实现前按预期失败，再做最小实现并复跑。
5. 运行 web workspace 全量测试、lint、format check 和 build。
6. 用真实渲染 smoke 核对四个可见结果，并验证文件拖入覆盖层/导入路径未回归。

## 影响面与风险

- **架构**：无分层、依赖方向或数据契约变化。
- **设计**：用户可见控件减少，符合 `docs/DESIGN.md` 的扁平与克制原则；需要在验收后同步当前设计说明中与面板按钮相冲突的既有描述。
- **兼容性**：依赖 divider 按钮的鼠标路径被移除，这是用户明确批准的行为变化；替代入口必须保留。
- **回滚**：纯前端渲染变更，无数据迁移；可通过恢复对应 JSX 与测试回滚。
- **依赖与供应链**：不新增依赖。

## 非目标

不重构 App 或 DetailView；不调整三栏宽度、颜色、token、动画、响应式断点；不删除其他按钮；不改变 daemon、Electron preload、hostBridge、文件导入或对话协议。
