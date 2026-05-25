# Data Model: 首次启动引导体验

**Created**: 2026-05-25

## Entity: Config (扩展)

在现有 `Config` 结构体（`src-tauri/src/config.rs`）中新增字段：

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `onboarding_completed` | `bool` | `false` | 引导是否已完成。一旦设为 `true`，永不复位 |

**验证规则**:
- 只能从 `false` → `true`（单向）
- 持久化到 `config.json`，与其他 Config 字段一起读写
- 设置为 `true` 后，App 启动时不再渲染 `<OnboardingView>`

**与其他实体的关系**:
- 独立于 `sample_entry_created`：引导完成后，示例条目创建逻辑仍会触发（首次运行仍需示例引导）
- 独立于 `workspace_path`：引导中设置的工作区路径通过现有的 `set_workspace_path` 命令持久化
- 独立于 `workspace_settings`（主题等）：引导期间主题切换正常生效
- 独立于 `providers` / `active_provider`：AI 引擎配置通过现有的 `Config.providers` 字段持久化，引导仅提供便捷的前置配置入口

## Entity: OnboardingState (前端 transient)

纯前端状态，不持久化。

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `currentStep` | `0 \| 1 \| 2` | `0` | 当前引导步骤。0 = 工作区路径，1 = AI 引擎配置，2 = 能力展示 |
| `workspacePath` | `string` | 从 Rust 获取的默认路径 | 用户在步骤 0 选择/确认的工作区路径 |
| `aiProviderId` | `string \| null` | `null` | 用户在步骤 1 选择的提供商 ID |
| `aiConfigStatus` | `'idle' \| 'testing' \| 'success' \| 'error'` | `'idle'` | 步骤 1 连接测试状态 |
| `aiConfigError` | `string \| null` | `null` | 步骤 1 连接测试错误详情 |
| `isTransitioning` | `boolean` | `false` | 是否正在步骤间切换动画中 |
| `isDismissing` | `boolean` | `false` | 是否正在退出引导（fade-out 动画） |

**状态转换**:

```
引导启动 → Step 0
Step 0 → Step 1 (确认路径后)
Step 0 → Dismiss (跳过)
Step 1 → Step 2 (配置完成或跳过 AI)
Step 1 → Dismiss (跳过)
Step 2 → Dismiss (跳过 / 触发操作后)
Dismiss → 移除覆盖层，显示主界面
```

**状态持久化**:
- `onboardingCompleted` (Rust Config) 在 Dismiss 时写入 `true`
- 引导中途关闭窗口 → 下次启动时恢复到最后一次未完成的步骤。通过 Rust 持久化 `onboarding_last_step: Option<u8>` 字段

## Entity: AIEngineConfig (复用现有)

引导步骤 1 不创建新的数据实体，直接复用现有的 AI 引擎配置：

| 现有字段 | 描述 |
|---|---|
| `Config.active_provider` | 当前激活的提供商 ID |
| `Config.providers[].id` | 提供商标识（anthropic, deepseek, zhipu, dashscope, volcengine, ollama 等） |
| `Config.providers[].api_key` | API Key（加密存储） |
| `Config.providers[].base_url` | 自定义 API 端点 |
| `Config.providers[].model` | 默认模型 |

引导步骤 1 通过 `get_engine_config()` 读取现有配置，通过 `set_engine_config()` 写入。

## Entity: WorkspacePath (复用现有)

复用现有 `Config.workspace_path`，不新增字段。引导步骤 0 调用现有 `set_workspace_path` 命令。
