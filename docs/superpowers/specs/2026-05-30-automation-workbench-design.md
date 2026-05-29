# Automation Workbench Design

## Context

JournalClaw 当前只有单一的自动日志整理能力：设置页里的 auto-lint。新的自动化模块要扩展成通用工作台，让用户设置多种定时任务，包括每日总结、周报总结、月度回顾、项目观察、人物动态追踪、日志整理、待办提取和自定义 Agent 自动化。

设计参考 Open Design 的自动化模块，但只复刻架构骨架：模板降低创建门槛，Routine 承载统一执行内核，run history 保留可追溯性。JournalClaw 不复刻 Open Design 的 artifact/design-system/connector 领域对象。

Mockup:

- `docs/superpowers/mockups/2026-05-29-automation-workbench.html`
- `docs/superpowers/mockups/2026-05-29-automation-workbench-full.png`

## Confirmed Decisions

1. 自动化采用混合型：默认展示高质量模板，每个模板可以展开成可编辑 Routine。
2. 第一版只支持定时触发，不做条件触发和事件触发。
3. 自动化产物仍然作为日志系统的一部分存在；自动生成日志条目使用 frontmatter 标记来源。
4. 每个模板提供默认输入范围，但用户可以修改。
5. 允许空白创建自定义自动化，但入口弱化，不与高质量模板平级。
6. 运行记录默认只展示简短状态，底层保留完整会话，可从会话详情展开查看。
7. 第一版模板覆盖总结类、维护类和自定义 Agent 类。
8. 所有自动化拥有完整 Agent 权限。
9. 产物由 Agent 根据实际任务自主决策，系统不要求用户配置 output policy。
10. 产品入口采用混合入口：主界面提供自动化工作台，设置页保留全局自动化设置。

## Goals

- 把自动化从“日志整理设置项”升级为核心工作台。
- 让用户通过具体任务模板开始，而不是先理解 Agent automation 平台。
- 保持内部模型统一：所有自动化最终都是 Routine。
- 复用现有 Agent、conversation、workspace、skills、todos、identity、lint 能力。
- 每次自动运行都可追溯：简短状态、完整会话、运行 manifest、文件改动清单。

## Non-Goals

- 第一版不做事件触发，例如“录音完成后自动运行”。
- 第一版不做条件触发，例如“新增 10 条日志后运行”。
- 第一版不做 proposal 审批流。用户选择完整信任 Agent，自动化直接执行。
- 第一版不新增独立 CLI。所有能力先通过 Tauri IPC 和 UI 暴露。
- 不引入新的 Agent 引擎；必须复用现有 conversation / LLM tool loop。

## Product Model

### Two-Layer Model

表层是模板入口。用户看到的是具体任务：

- 每日总结
- 周报总结
- 月度回顾
- 项目观察
- 人物动态追踪
- 主题研究
- 日志库整理
- 待办提取
- 身份画像更新
- 自定义 Agent

内核是 Routine。所有模板展开后都是同一种底层对象：

```ts
type Routine = {
  id: string
  title: string
  templateId?: string
  prompt: string
  schedule: AutomationSchedule
  scope: AutomationScope
  enabled: boolean
  fullAgentAccess: true
  createdAt: string
  updatedAt: string
  lastRun?: AutomationRunSummary
}
```

模板只提供默认值：标题、prompt、schedule、scope、说明文案和上下文引用。用户保存后，系统持久化的是 Routine。

### Schedule

第一版支持定时触发：

```ts
type AutomationSchedule =
  | { kind: 'daily'; time: string; timezone: string }
  | { kind: 'weekdays'; time: string; timezone: string }
  | { kind: 'weekly'; weekday: number; time: string; timezone: string }
  | { kind: 'monthly'; day: number; time: string; timezone: string }
```

调度器必须处理：

- app 启动后恢复 timers
- 错过运行时间后的补偿检查
- 同一 Routine 防重入
- 手动 run now 走同一执行链路
- 更新 schedule 后重排 timer

### Scope

每个模板提供默认 scope，用户可以修改：

```ts
type AutomationScope =
  | { kind: 'relative'; range: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' }
  | { kind: 'recent_days'; days: number }
  | { kind: 'month'; yearMonth: string }
  | { kind: 'tags'; tags: string[]; range?: AutomationScope }
  | { kind: 'identities'; identityIds: string[]; range?: AutomationScope }
  | { kind: 'keyword'; query: string; range?: AutomationScope }
  | { kind: 'workspace' }
```

Scope 用于生成 Agent 上下文，不是硬权限边界。因为自动化拥有完整 Agent 权限，Agent 可以根据任务需要读取更多文件，但 manifest 必须记录实际读取与修改。

## Execution Model

每次运行都是一条无人值守完整 Agent 会话：

```text
Schedule 到点或手动运行
  -> 创建 AutomationRun
  -> 创建 Conversation Session
  -> 注入 unattended system prompt
  -> 注入 Routine prompt + scope + template context
  -> Agent 自主读取、判断、创建或修改文件
  -> 保存 run manifest
  -> 更新 Routine lastRun
```

自动化运行时不能向用户反问。信息不足时，Agent 必须记录不确定性，继续完成任务。

### AutomationRun

```ts
type AutomationRun = {
  id: string
  routineId: string
  trigger: 'scheduled' | 'manual'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
  startedAt: string
  completedAt?: string
  error?: string
  conversationId?: string
  manifest?: RunManifest
}
```

### RunManifest

系统不预设 output policy，但必须记录结果：

```ts
type RunManifest = {
  summary: string
  filesRead: string[]
  filesChanged: string[]
  entriesCreated: string[]
  todosChanged: string[]
  identitiesChanged: string[]
  warnings: string[]
  conversationId: string
}
```

Manifest 是自动化信任模型的核心。用户允许 Agent 直接执行，但任何自动化改动都必须能回看。

## Built-In Templates

### Summary Templates

`daily-summary`

- 默认 schedule：每天 08:00
- 默认 scope：昨天
- 目标：生成一篇克制、准确的每日总结日志
- 允许 Agent 自主补充待办或关联记录，但必须写入 manifest

`weekly-summary`

- 默认 schedule：每周五 17:30
- 默认 scope：本周
- 目标：聚合项目进展、会议脉络、待办状态和关键风险

`monthly-review`

- 默认 schedule：每月 1 日 09:00
- 默认 scope：上月
- 目标：生成月度回顾，突出主题演进、重要人物、项目变化

### Maintenance Templates

`journal-lint`

- 默认 schedule：每周日 03:00
- 默认 scope：workspace
- 目标：复用现有 `/lint` 规则，整理关联记录、身份画像矛盾、交叉引用和元数据

`todo-digest`

- 默认 schedule：每天 21:30
- 默认 scope：最近 24 小时
- 目标：从日志提取行动项，更新 `todos.md` / `done.md`

`identity-maintenance`

- 默认 schedule：每周一 09:00
- 默认 scope：最近 7 天 + identities
- 目标：补充人物、项目、概念画像

### Agent Templates

`project-watch`

- 默认 schedule：每天 22:00
- 默认 scope：关键词或标签
- 目标：追踪项目状态、风险和待推进事项

`person-watch`

- 默认 schedule：每周一 10:00
- 默认 scope：指定身份画像 + 近期日志
- 目标：总结人物相关动态和协作线索

`topic-research`

- 默认 schedule：每周
- 默认 scope：指定关键词或标签
- 目标：持续整理某个主题的观察和材料

`custom-agent`

- 弱入口
- 无默认业务 prompt
- 默认要求用户填写任务目标、scope 和 schedule

## User Experience

### Main Workbench

主界面新增自动化工作台入口。它和日志、画像并列，但不抢占阅读体验。

工作台区域：

- 左侧：Routine 列表，按总结 / 观察 / 维护分组
- 主区域顶部：启用中、今天将运行、最近创建、失败数
- 模板入口：高质量模板卡片
- Routine 列表：状态、schedule、scope、上次运行结果
- 右侧详情：所选 Routine 的 prompt、scope、上次 manifest、操作按钮

操作：

- 新建自动化
- 从模板创建
- 编辑 Routine
- 手动运行
- 暂停 / 启用
- 删除
- 打开完整会话详情

### New / Edit Modal

新建弹窗分两栏：

- 左侧：模板列表，自定义 Agent 放在底部，弱化入口
- 右侧：Routine 编辑表单

字段：

- 名称
- 频率
- 输入范围
- Agent 权限说明
- Prompt
- 上下文 chips

保存后创建 Routine。模板不再保留特殊执行路径。

### Settings

设置页的自动化区只保留全局设置：

- 允许后台自动化运行
- 默认 Agent 权限说明
- 失败通知
- 最大并发策略说明

现有 auto-lint 设置卡不再作为主界面。迁移后，它表现为一个内置 Routine。

## Backend Architecture

新增模块：

- `automation.rs`：调度、状态、防重入、run lifecycle
- `automation_store.rs`：Routine / Run / Manifest 持久化
- `automation_templates.rs`：内置模板注册
- `automation_runner.rs`：把 Routine 转成无人值守 Agent 会话
- `automation_commands.rs`：Tauri IPC 命令

现有 `auto_lint.rs` 不再继续扩展为更多任务。保留 `/lint` 执行逻辑，迁移成 `journal-lint` 模板 runner。

### Storage

自动化状态跟随 workspace。建议文件结构：

```text
workspace/
  .Codex/
    automations/
      routines.json
      runs.json
      manifests/
        <run-id>.json
```

`routines.json` 保存用户定义；内置模板不写入用户文件，除非用户从模板创建 Routine。

### IPC

新增 IPC wrapper 仍然集中在 `src/lib/tauri.ts`：

- `listAutomationTemplates()`
- `listRoutines()`
- `createRoutine(request)`
- `updateRoutine(id, patch)`
- `deleteRoutine(id)`
- `runRoutineNow(id)`
- `pauseRoutine(id)`
- `resumeRoutine(id)`
- `listRoutineRuns(id)`
- `getAutomationRun(runId)`

组件不直接调用 `invoke()`。

## Error Handling

- 同一 Routine 已在运行时，下一次 scheduled run 标记为 `skipped`，原因写入 run。
- Agent 运行失败时，保存 partial manifest、错误消息和 conversationId。
- App 启动时如果发现上次运行停在 `running`，标记为 `failed`，原因是 app closed during run。
- 后台自动化总开关关闭时，不触发 scheduled run；手动运行仍可执行。
- 删除 Routine 不删除历史 run，run history 作为审计记录保留。

## Migration

当前 auto-lint 配置迁移为一个内置 Routine：

- enabled -> Routine enabled
- frequency/time -> schedule
- min_entries -> prompt/context 中的运行条件说明，第一版不做条件触发
- last_run -> 迁移为一条 legacy run summary

旧 IPC 可以短期保留，用于设置页兼容；新 UI 使用 automation IPC。

## Testing

后端：

- schedule next run 计算
- routine create/update/delete 持久化
- app restart 后恢复 timers
- 防重入 skipped run
- manual run 与 scheduled run 共用执行链路
- failed run 保存 error 和 conversationId
- auto-lint 迁移为 `journal-lint`

前端：

- 模板列表渲染
- 从模板创建 Routine
- 自定义 Agent 入口弱化但可用
- Routine 列表状态展示
- run manifest 展示
- 设置页全局开关

集成：

- 每日总结创建自动化日志条目，并带 automation frontmatter
- 周报读取本周日志并生成日志条目
- journal-lint 复用现有 `/lint`
- 运行失败可从 run detail 打开完整会话

## Frontmatter for Generated Entries

Agent 创建自动化日志时应写入：

```yaml
generated_by: automation
automation_id: <routine-id>
automation_run_id: <run-id>
automation_template_id: <template-id>
source_scope: <human-readable scope>
created_at: <iso timestamp>
```

这不是 output policy，只是自动化产物的来源标记，便于列表过滤、折叠和追溯。

## Design Notes

- 视觉遵循 JournalClaw 的克制、沉静、专业基调。
- 不使用营销式 hero、渐变、玻璃态、卡片套卡片。
- 自动化工作台信息密度高于详情阅读区，但保持边框、间距和琥珀 accent 一致。
- 自定义 Agent 必须可用，但不应该成为第一视觉入口。
