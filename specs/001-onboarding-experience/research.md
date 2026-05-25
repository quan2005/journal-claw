# Research: 首次启动引导体验

**Created**: 2026-05-25

## Decision 1: 引导视图架构

**Decision**: 引导作为 App 内的覆盖层组件（`OnboardingView`），在 `App.tsx` 中条件渲染。使用 `useOnboarding` hook 管理状态。

**Rationale**:
- 所有现有基础设施（主题 `useTheme`、i18n `useTranslation`、IPC `tauri.ts`）均可用
- 从引导到主界面的过渡平滑自然（仅移除覆盖层，不涉及路由跳转）
- 无需创建新的 Tauri webview 窗口或修改 `tauri.conf.json`
- 参考 open-design 的做法：`EntryShell.tsx` 中条件渲染 `<OnboardingView>`

**Alternatives considered**:
- 独立 webview 窗口：增加复杂性，主题和 i18n 需重新初始化，过渡不流畅
- 独立路由页面：项目中无前端路由库，引入路由为单一功能过度设计
- Pre-App 阻塞式（main.tsx 中）：阻止 React 挂载，无法使用 hooks 和主题系统

## Decision 2: 引导状态持久化

**Decision**: 在 `Config` 结构体中添加 `onboarding_completed: bool` 字段（默认 `false`），通过 `get_onboarding_status` 和 `complete_onboarding` Tauri 命令读写。

**Rationale**:
- 复用现有 `config.json` 持久化机制（`config.rs` 已有 `load_config()` / `save_config()`）
- 与现有 `sample_entry_created` 模式一致
- Rust 侧实现最简：新增 2 个 Tauri command，在 `invoke_handler![]` 中注册
- `bool` 语义明确：`false` = 需要引导，`true` = 已完成

**Alternatives considered**:
- `localStorage`：不持久（清除浏览器数据会丢失），且绕过 Rust 边界
- `workspace/.setting.json`：语义不符（该文件属于 workspace 级设置，而引导是 app 级状态，即使用户切换 workspace 也不应重现）
- 独立的 `onboarding.json`：过度设计，`bool` 字段不值得独立文件

## Decision 3: 组件结构（三步引导）

**Decision**: 采用 `OnboardingView` 主组件 + 内部步骤子组件的扁平结构，不引入路由。

```
OnboardingView (主容器)
├── StepIndicator (步骤指示器：圆点 + 标签)
├── Step0Welcome (工作区路径确认)
├── Step1AiEngine (AI 引擎 API Key 配置)
└── Step2Capabilities (可选能力展示)
```

步骤状态通过 `useState<0 | 1 | 2>` 管理，切换动画通过 CSS transition。

**Rationale**:
- 步骤数量固定（3 步），不需要通用步骤引擎
- 扁平结构易于理解和维护
- 每个步骤自包含，可独立测试
- Step 1（AI 引擎配置）是用户明确要求的核心步骤，与 Step 0 并列 P1 优先级

## Decision 4: 工作区路径选择

**Decision**: 复用现有 `SectionGeneral.tsx` 中的 `pickFolder()` + `setWorkspacePath()` IPC 调用。

**Rationale**:
- `pickFolder()` 已封装 macOS 原生文件夹选择器
- `setWorkspacePath()` 已处理目录创建和 `.claude/` 初始化
- 无需新增 Rust 命令

**注意**: 引导中的路径选择 UI 应比设置面板更简洁——展示默认路径 + "自定义路径" 入口，而非设置面板的完整表单。

## Decision 5: AI 引擎配置（关键步骤）

**Decision**: 步骤 1 展示 AI 引擎配置，复用现有的提供商选择、API Key 输入、连接测试逻辑。通过现有的 `get_engine_config` / `set_engine_config` / `test_connection` IPC 命令实现。

**Rationale**:
- 用户明确指出 AI Key 配置是引导中最重要的一环
- 现有 `SectionAiEngine` 组件（设置面板中）已实现提供商选择、API Key 输入、连接测试等完整逻辑
- 引导场景直接复用这些 IPC 命令，但在 UI 上做减法：更简洁的布局，聚焦于"选择提供商 → 填入 Key → 测试 → 继续"
- 参考 open-design 的 Runtime 选择步骤：提供商选择卡 + API Key 输入 + 内嵌连接测试按钮 + 测试结果分级展示
- 连接测试给用户即时的正向反馈（"配置成功！延迟 120ms"），显著降低放弃率

**复用现有命令**:
- `get_engine_config()` → 读取当前配置（判断是否已配置）
- `set_engine_config(cfg)` → 写入引擎配置
- 连接测试调用 AI 引擎的轻量 API 请求（由 Rust 后端处理）

**错误状态**（参考 open-design 的分级反馈）:
- `success`: "连接成功 · 延迟 120ms"（绿色成功态）
- `error_auth`: "API Key 无效，请检查后重试"（红色错误态）
- `error_network`: "无法连接，请检查网络或代理设置"（黄色警告态）
- `error_quota`: "账户余额不足"（红色错误态）

**Alternatives considered**:
- 跳过 AI 配置，在主界面设置中配置：用户反馈这不够——AI 是核心能力，没有 Key 应用等于不可用。不前置会导致用户进入主界面后面临"什么也做不了"的尴尬
- 在步骤 0 合并工作区和 AI 配置：信息密度过高，两步分离更聚焦

## Decision 5.1: 产品定位 — 纯粹笔记软件

**Decision**: 引导流程不展示录音/语音转写相关功能。JournalClaw 定位为纯粹笔记软件，核心输入方式为拖入文件和粘贴文本两种。

**Rationale**:
- 用户明确要求：语音转写能力不纳入核心功能，录音功能弱化
- 引导步骤 2（能力展示）仅展示两种输入方式：拖入文件、粘贴文本
- 空状态引导语更新为"拖入一个文件或粘贴一段文字开始"
- 简化产品定位，降低用户认知负担

## Decision 6: 空状态处理

**Decision**: 移除 `JournalList` 中可能的 "暂无日志" 空状态提示。改为在详情面板展示一句温和引导语（"从一次录音开始"），产生产生第一条日志后自动消失。

**Rationale**:
- 当前代码中需确认 `JournalList` 是否已有空状态渲染
- 引导语使用详情面板现有布局空间，不额外占位
- 有日志后自动消失 = 零维护成本

## Decision 7: 动画策略

**Decision**: 步骤切换使用 `opacity + transform: translateX` 过渡，时长 250ms，缓动 `cubic-bezier(0.16, 1, 0.3, 1)`（ease-out expo）。检测 `prefers-reduced-motion` 时降级为即时切换。

**Rationale**:
- 遵循项目设计规范：仅动 transform + opacity，≤300ms
- 类 Apple 平台的 ease-out expo 缓动舒适自然
- 参考 open-design 的 160ms `cubic-bezier(0.23, 1, 0.32, 1)` 按钮过渡，步骤级过渡稍长以区分层级

## Decision 8: 颜色系统集成

**Decision**: 引导界面使用项目现有 CSS 变量和 `.impeccable.md` 中定义的 amber accent `#B8782A` (light) / `#C8933B` (dark)。步骤指示器使用 `color-mix()` 混合 accent（参考 open-design 的做法）。

**Rationale**:
- 引导不是独立产品，应无缝融入主应用
- 使用现有 CSS 变量确保主题切换正确
- `color-mix()` 提供灵活的 accent 混合而无需硬编码颜色

## Decision 9: i18n 策略

**Decision**: 引导相关字符串添加到 `src/locales/zh.ts` 和 `src/locales/en.ts` 中，通过 `useTranslation()` 获取。

**Rationale**:
- 遵循项目现有 i18n 模式
- 系统语言检测已在 `I18nContext` 中实现
- 中英文用户均需覆盖
