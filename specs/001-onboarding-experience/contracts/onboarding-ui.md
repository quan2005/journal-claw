# UI Contract: OnboardingView

**Feature**: 首次启动引导体验

**Type**: React 组件接口

## Component Interface

```typescript
interface OnboardingViewProps {
  onComplete: () => void;
}
```

- `onComplete`: 引导完成后的回调。调用方（App.tsx）负责卸载 OnboardingView 并恢复正常 UI。

## Internal State Machine

```
                     ┌──────────────────────┐
                     │   Step 0: Welcome     │
                     │   (工作区路径确认)      │
                     └──────┬───────┬───────┘
                            │       │
                确认路径     │       │ Skip
                            ▼       │
                     ┌──────────┐   │
                     │  Step 1   │   │
                     │ (AI 引擎) │   │
                     └──┬───┬───┘   │
                        │   │       │
             配置完成/跳过│   │       │
                        ▼   │       │
                     ┌──────────┐   │
                     │  Step 2   │   │
                     │ (能力展示) │   │
                     └──┬───┬───┘   │
                        │   │       │
             触发操作/跳过│   │       │
                        ▼   ▼       ▼
                     ┌──────────────────────┐
                     │      Dismiss         │
                     │ (fade-out → complete) │
                     └──────────────────────┘
```

## Step 0: Welcome & Workspace

### Layout
```
┌──────────────────────────────────────────────┐
│                                              │
│              [App Icon / Logo]               │
│                                              │
│              欢迎使用 JournalClaw              │  ← 56px, weight 700
│        你的会议、文档、灵光一现，化为日志。      │  ← 15px, text-muted
│                                              │
│    ┌──────────────────────────────────┐      │
│    │  工作区路径                       │      │
│    │  ~/Documents/journal/            │      │  ← 默认路径，可编辑
│    │  [确认并继续]  [自定义路径...]     │      │
│    └──────────────────────────────────┘      │
│                                              │
│              跳过 · 直接进入                  │  ← 底部小字链接
│                                              │
└──────────────────────────────────────────────┘
```

### States
- **Default**: 展示默认路径，按钮可用
- **Validating**: 点击"确认并继续"后，路径校验中，按钮 loading
- **Error**: 路径不可写或无权限，展示错误提示，按钮恢复
- **Customizing**: 点击"自定义路径"，调用 `pickFolder()`，更新路径显示

### Behavior
- 点击"确认并继续" → 调用 `setWorkspacePath(path)` → 过渡到 Step 1
- 点击"自定义路径" → 调用 `pickFolder()` → 更新路径显示
- 点击"跳过" → Dismiss
- 路径校验失败 → 显示具体错误信息，不阻塞

## Step 1: AI Engine Configuration

### Layout
```
┌──────────────────────────────────────────────┐
│  ● 工作区  ──  ○ AI 引擎  ──  ○ 开始使用     │  ← 步骤指示器
│                                              │
│            配置 AI 引擎                       │  ← 25px heading
│       选择模型提供商并填入 API Key             │  ← 15px, text-muted
│                                              │
│  ┌──────────────┐ ┌──────────────┐          │
│  │ ○ Anthropic  │ │ ○ DeepSeek   │          │  ← 提供商选择卡
│  │ Claude Opus  │ │ DeepSeek-V3  │          │     2 列网格
│  └──────────────┘ └──────────────┘          │
│  ┌──────────────┐ ┌──────────────┐          │
│  │ ○ Ollama     │ │ ○ 自定义...  │          │
│  │ 本地部署      │ │ 其他提供商    │          │
│  └──────────────┘ └──────────────┘          │
│                                              │
│    API Key  ┌────────────────────────┐       │
│             │ sk-ant-api03-xxxxx...  │ [👁]  │  ← 密码输入 + 显示/隐藏
│             └────────────────────────┘       │
│                                              │
│    ┌──────────────────────────────────┐      │
│    │  ✓ 连接成功 · 延迟 120ms         │      │  ← 测试结果（成功态）
│    └──────────────────────────────────┘      │
│                                              │
│  [测试连接]    [确认并继续]    [跳过]          │  ← 操作区
│                                              │
└──────────────────────────────────────────────┘
```

### Provider Selection Cards
- 两列网格（`grid-template-columns: repeat(2, minmax(0, 1fr))`），与 open-design 选卡模式一致
- 每张卡：单选框圆点 + 提供商名称 + 一行描述（模型名）
- 选中态：accent 边框 + accent 填充圆点 + 浅 accent 背景（`color-mix(in srgb, var(--amber) 6%, transparent)`）
- 至少展示 4 个提供商：Anthropic、DeepSeek、Volcengine（豆包）、Ollama（本地）
- "自定义"选项允许用户手动输入 base URL 和模型名

### API Key Input
- 密码类型输入框（`type="password"`），带显示/隐藏切换按钮（眼睛图标）
- 粘贴后自动去首尾空白
- 聚焦时边框 accent 色
- placeholder: "sk-ant-api03-..."（暗示格式）

### Connection Test
- "测试连接"按钮：发送轻量 API 请求验证凭据
- 测试中：按钮 loading（spinner + "测试中..."）
- 结果分级展示（参考 open-design 的分级反馈）：

| 状态 | 样式 | 消息示例 |
|------|------|---------|
| `success` | 绿色图标 + 绿色文字 | "连接成功 · 延迟 120ms" |
| `error_auth` | 红色图标 + 红色文字 | "API Key 无效，请检查后重试" |
| `error_network` | 黄色图标 + 黄色文字 | "无法连接，请检查网络或代理设置" |
| `error_quota` | 红色图标 + 红色文字 | "账户余额不足，请充值后重试" |
| `error_not_found` | 红色图标 + 红色文字 | "模型不可用，请检查模型名称" |

- 测试成功后，"确认并继续"按钮变为 accent 实心（视觉暗示已就绪）
- 测试成功后，下次再进入此步骤时显示上次测试结果摘

### Behavior
- 点击"确认并继续" → 保存 AI 引擎配置 → 过渡到 Step 2
- 若未测试但填入 Key → 仍可"确认并继续"（key 保存，信任用户）
- 点击"跳过" → 过渡到 Step 2（或直接 Dismiss 如果连 Step 2 也跳过）
- 提供商切换时清空连接测试结果（重新验证）

### Empty / Pre-configured States
- 若用户已有 AI 配置（如从旧版升级）：预填现有配置，连接测试结果显示上次测试结果（若可用）
- Key 输入为空时，"确认并继续"仍可用（不强制测试，但鼓励）

## Step 2: Capabilities

### Layout
```
┌──────────────────────────────────────────────┐
│  ● 工作区  ──  ● AI 引擎  ──  ○ 开始使用     │  ← 步骤指示器
│                                              │
│            开始使用 JournalClaw               │
│                                              │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │  📎 拖入文件     │  │  📝 粘贴文本     │   │  ← 两列选择卡
│  │  导入文件自动分析 │  │  快速记录整理    │   │
│  │  [拖入文件区域]   │  │  [点击粘贴文本]  │   │
│  └─────────────────┘  └─────────────────┘   │
│                                              │
│            [跳过 · 进入应用]                   │
│                                              │
└──────────────────────────────────────────────┘
```

### States
- **Default**: 两列选择卡均展示，可交互
- **Action Triggered**: 某个操作被触发后，整个界面 fade-out → Dismiss，操作在后台继续

### Behavior
- 拖入文件 → 调用 `importFile()` → Dismiss 进入主界面（AI 处理中状态）
- 在粘贴区域粘贴文本 → 调用 `importText()` → Dismiss 进入主界面
- 点击"跳过" → Dismiss 进入主界面

## Step Indicator

```
  ● 工作区  ────  ○ AI 引擎  ────  ○ 开始使用
  (done)          (active)          (inactive)
```

- 已完成的步骤：accent 填充圆 + text-strong 标签
- 当前步骤：accent 边框圆 + text-strong 标签
- 未激活步骤：text-muted 圆 + text-muted 标签
- 点击已完成步骤的标签：回退到该步骤（不丢失输入状态）
- 点击未激活步骤的标签：无反应（不可前跳）

## Dismiss Animation

1. `OnboardingView` 整体 opacity → 0（250ms ease-out）
2. 动画结束后调用 `onComplete()`
3. `App.tsx` 接收回调，设置 `showOnboarding = false`，渲染主界面
4. 主界面以 opacity 0→1 淡入（250ms ease-out，与 dismiss 连续）

## Accessibility

- 所有可交互元素在 `Tab` 键序中
- 步骤指示器中的已访问/当前步骤使用 `aria-current="step"`
- `prefers-reduced-motion` 时跳过所有过渡动画（即时切换）
- 品牌文字使用语义化 heading 层级（h1 → h2）
- 颜色对比度满足 WCAG AA（深色/浅色模式均测试）
- API Key 输入框标注 `aria-label`，显示/隐藏按钮有明确的 `aria-label`

## Theme Integration

- 所有颜色使用项目 CSS 变量（`var(--bg)`、`var(--text-strong)`、`var(--text-muted)` 等）
- Accent 色使用 amber `#B8782A` (light) / `#C8933B` (dark)
- 步骤卡选中态使用 `color-mix()` 混合 accent（如 `background: color-mix(in srgb, var(--amber) 6%, transparent)`）
- 连接测试状态色：success 绿色（系统绿）、error 红色（`#ff3b30`）、warning 黄色（amber）
- 深色/浅色切换按钮在引导右上角保持可见

## i18n Keys

所有文本通过 `t('onboarding.*')` 获取：

| Key | 中文 | English |
|-----|------|---------|
| `onboarding.welcome.title` | 欢迎使用 JournalClaw | Welcome to JournalClaw |
| `onboarding.welcome.subtitle` | 你的会议、文档、灵光一现，化为日志。 | Your meetings, documents, and ideas, distilled into journals. |
| `onboarding.welcome.workspaceLabel` | 工作区路径 | Workspace Path |
| `onboarding.welcome.confirm` | 确认并继续 | Confirm & Continue |
| `onboarding.welcome.customPath` | 自定义路径... | Custom Path... |
| `onboarding.welcome.skip` | 跳过 · 直接进入 | Skip · Enter directly |
| `onboarding.welcome.errorPermission` | 无法写入所选路径，请选择其他目录 | Cannot write to selected path |
| `onboarding.ai.title` | 配置 AI 引擎 | Configure AI Engine |
| `onboarding.ai.subtitle` | 选择模型提供商并填入 API Key | Choose a model provider and enter your API key |
| `onboarding.ai.providerLabel` | 选择提供商 | Choose Provider |
| `onboarding.ai.apiKeyLabel` | API Key | API Key |
| `onboarding.ai.testConnection` | 测试连接 | Test Connection |
| `onboarding.ai.testing` | 测试中... | Testing... |
| `onboarding.ai.testSuccess` | 连接成功 · 延迟 {latency}ms | Connected · {latency}ms latency |
| `onboarding.ai.testAuthFailed` | API Key 无效，请检查后重试 | Invalid API key, please check and retry |
| `onboarding.ai.testNetworkError` | 无法连接，请检查网络或代理设置 | Cannot connect, check network or proxy settings |
| `onboarding.ai.testQuotaExceeded` | 账户余额不足，请充值后重试 | Insufficient balance, please top up and retry |
| `onboarding.ai.testModelNotFound` | 模型不可用，请检查模型名称 | Model not available, check model name |
| `onboarding.ai.confirm` | 确认并继续 | Confirm & Continue |
| `onboarding.ai.skip` | 跳过 · 稍后配置 | Skip · Configure later |
| `onboarding.capabilities.title` | 开始使用 JournalClaw | Start with JournalClaw |
| `onboarding.capabilities.drop.title` | 拖入文件 | Drop Files |
| `onboarding.capabilities.drop.desc` | 导入文件自动分析 | Import files for AI analysis |
| `onboarding.capabilities.drop.action` | 拖入文件 | Drop files |
| `onboarding.capabilities.paste.title` | 粘贴文本 | Paste Text |
| `onboarding.capabilities.paste.desc` | 快速记录整理 | Quick capture & organize |
| `onboarding.capabilities.paste.action` | 粘贴文本 | Paste text |
| `onboarding.capabilities.skip` | 跳过 · 进入应用 | Skip · Enter app |
| `onboarding.stepIndicator.workspace` | 工作区 | Workspace |
| `onboarding.stepIndicator.ai` | AI 引擎 | AI Engine |
| `onboarding.stepIndicator.start` | 开始使用 | Start |
| `onboarding.emptyState.hint` | 拖入一个文件或粘贴一段文字开始 | Drop a file or paste some text to start |
| `onboarding.provider.anthropic` | Anthropic | Anthropic |
| `onboarding.provider.deepseek` | DeepSeek | DeepSeek |
| `onboarding.provider.ollama` | Ollama（本地） | Ollama (Local) |
| `onboarding.provider.custom` | 自定义... | Custom... |
