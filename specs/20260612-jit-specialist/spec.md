---
id: jit-specialist
title: 主 Agent 自主外包与动态子 Agent (JIT Specialist) 协同机制
status: draft
level: L2
source: gate-L2
created: 2026-06-12
---

# 主 Agent 自主外包与动态子 Agent (JIT Specialist) 协同机制

## 1. 背景

当前谨迹的会话系统已有 `task` 工具实现子任务外包（`src-tauri/src/llm/task_tool.rs`）：

- 主 Agent 可并发派生多个子 Agent（`conversation.rs:2141-2247`）
- 子 Agent 拥有 bash、文件读写等工具，但不能再派生子任务（深度=1）
- 流式事件协议已存在（`subtask_start/delta/end`）
- 所有子 Agent 继承主 Agent 的同一引擎实例和模型

**问题**：当前 task tool 是"哑管道"——无法指定子 Agent 的专业人设、模型级别、步数上限，也无法对单个子 Agent 进行中止或干预。主 Agent 把它当普通工具用，而非作为"项目经理"角色有策略地外包。

## 2. 目标

将现有 `task` 工具升级为"JIT Specialist"机制：

1. 主 Agent 自主决定何时外包、用什么级别的专家
2. 每个子 Agent 有独立的名称、人设、模型级别、步数上限
3. 每个子 Agent 可被用户独立中止
4. 前端展示结构化的协同状态（保持克制·沉静基调）
5. 步数熔断防止失控

## 3. 非目标

- NG-01: 不实现子 Agent 之间的直接通讯（所有协调通过主 Agent）
- NG-02: 不实现"子 Agent 商店"或常驻 Specialist 管理后台
- NG-03: 不在本期定义 `intellect_level` 到具体模型的映射方案（待独立讨论后补充）
- NG-04: 不实现用户通过 mini 对话框干预子 Agent（二期考虑）
- NG-05: 不实现子 Agent 详情模态窗（二期考虑）

## 4. 设计

### 4.1 Task Tool 参数扩展

当前 input schema: `{ prompt: string }`

扩展为：

```json
{
  "prompt": "string (required) — 子任务的详细指令",
  "name": "string (optional) — 子 Agent 显示名，如 '检索专家-A'",
  "intellect_level": "string (optional) — 'junior' | 'senior' | 'expert'，默认 'senior'",
  "max_steps": "integer (optional) — 最大交互轮数，默认按级别：junior/senior=8, expert=15",
  "system_prompt": "string (optional) — 覆盖默认子 Agent 系统提示"
}
```

主 Agent 的 system prompt 中增加指引，教它在面对复杂/多源任务时主动拆解并使用这些参数。

### 4.2 模型映射（待确认）

`intellect_level` 字段先作为元数据透传并在 UI 展示，具体到引擎/模型的映射逻辑暂用 fallback：所有级别均使用当前会话的主引擎。待独立讨论确定映射策略后，在 `task_tool::execute()` 中按 level 选择不同的 `&dyn LlmEngine` 实例。

### 4.3 独立取消粒度

当前：子 Agent 使用 `cancel.child_token()`，但只有会话级取消入口。

改造：

- 为每个正在执行的 subtask 维护 `HashMap<tool_use_id, CancellationToken>`（在 `ConversationSession` 或独立的 `SubtaskRegistry` 中）
- 新增 Tauri command: `subtask_abort(session_id, tool_use_id)`
- 前端在协同卡片的每个子 Agent 行提供"中止"按钮

### 4.4 步数熔断

`tool_loop::run_agent()` 当前硬编码 `MAX_TURNS = 60`。

改造：增加 `max_turns` 参数（保持 60 为主 Agent 默认值），子 Agent 从 `TaskInput.max_steps` 读取，到达上限后返回已有成果（不 panic、不 error）。

### 4.5 前端协同卡片

保持"克制·沉静"基调：

- 不用色标/进度条/百分比
- 用极简的列表展示每个子 Agent：名称 + 状态文字 + 步数 + 中止按钮
- 状态用文字 badge：`执行中` / `已完成` / `已中止` / `失败`
- 子 Agent 的内部流式文本折叠显示（默认收起，点击展开）

扩展 `subtask_start` 事件 payload：

```json
{
  "tool_use_id": "id",
  "prompt": "...",
  "name": "检索专家-A",
  "intellect_level": "senior",
  "max_steps": 8
}
```

扩展 `subtask_delta` 事件 payload（新增 `current_step`）：

```json
{
  "tool_use_id": "id",
  "current_step": 3,
  "text": "..."
}
```

### 4.6 主 Agent System Prompt 增补

在 `src-tauri/src/llm/prompt.rs` 中增加关于 task 工具的使用指引：

- 何时应该外包（多源检索、独立代码修改、大量文件操作）
- 如何命名和设定人设
- 何时使用不同 intellect_level

## 5. 验收标准

- AC-01: 主 Agent 调用 task 工具时可传入 `name`、`intellect_level`、`max_steps`、`system_prompt` 参数，缺省时使用默认值（name=null, level=senior, max_steps=8, system_prompt=内置默认）
- AC-02: 子 Agent 的执行轮数不超过 `max_steps`；到达上限时将已有成果作为正常结果返回，`is_error = false`
- AC-03: 前端 `subtask_start` 事件携带 `name`、`intellect_level`、`max_steps` 字段，协同卡片据此渲染子 Agent 名称和状态
- AC-04: 用户可通过 UI 中止单个正在执行的子 Agent（调用 `subtask_abort` command），不影响同一会话中其他子 Agent 和主 Agent 的继续执行
- AC-05: 子 Agent 被中止后，主 Agent 收到的 tool result 包含已完成步骤的产物（非空），`is_error = true`，附带提示"已被用户中止"
- AC-06: `intellect_level` 字段在前端协同卡片中可见（文字标注），后端暂不做模型映射（统一使用当前引擎）

## 6. 待确认

- **[待确认-1] intellect_level 模型映射策略**：是在同一 vendor 内选型（如 Anthropic: Haiku→Sonnet→Opus），还是跨 vendor 选最优性价比？映射配置放在哪里（workspace_settings? 硬编码? 配置文件?）？——此项独立讨论后补入 spec 并可能新增 AC。
- **[待确认-2] max_steps 默认值**：当前设定 junior/senior=8, expert=15，是否合理？

## 7. 检索证据

| 文件                                      | 结论                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src-tauri/src/llm/task_tool.rs`          | [证据] 当前 task tool input 只有 `prompt` 一个字段；子 Agent 固定用 `SUBAGENT_SYSTEM` 提示词；引擎直接透传主 Agent 的 `engine` |
| `src-tauri/src/llm/tool_loop.rs:11`       | [证据] `MAX_TURNS = 60` 硬编码，无参数化入口                                                                                   |
| `src-tauri/src/conversation.rs:2141-2247` | [证据] task tool 已并发执行，使用 `cancel.child_token()` 但无独立取消入口                                                      |
| `src-tauri/src/llm/mod.rs:67-77`          | [证据] `create_engine_for_provider` 按 protocol 分发引擎，当前无"按级别选模型"逻辑                                             |
| `src/types.ts:181,223-225`                | [证据] 前端已有 subtask 类型和 subtask_start/delta/end 事件定义                                                                |

## 8. 依赖与影响

- **影响模块**：`task_tool.rs`、`tool_loop.rs`、`conversation.rs`、`prompt.rs`、`src/types.ts`、`ChatPanel.tsx`、`useConversation.ts`
- **无外部新依赖**：不引入新 crate 或 npm 包
- **向后兼容**：新增字段均为 optional，现有 task 调用（只传 prompt）继续正常工作

## 9. NFR 审查

| 维度       | 判定                                           |
| ---------- | ---------------------------------------------- |
| 性能       | N/A — 并发机制已存在，本次不增加额外开销       |
| 安全权限   | N/A — 子 Agent 权限与主 Agent 相同（已有设计） |
| 数据隐私   | N/A — 纯本地桌面应用                           |
| 可靠性降级 | 步数熔断 + 独立取消 = 降级机制已内建           |
| 可观测性   | 前端协同卡片即为可观测面板                     |
| 回滚       | N/A — 无持久化 schema 变更                     |
| 兼容性     | 新字段 optional，旧调用不受影响                |
| 成本       | [待确认-1] 模型映射确定后需评估                |
| 风控滥用   | 步数熔断 + 用户手动中止 = 双重保护             |
| 运营客服   | N/A — 桌面应用                                 |
| 多语言地区 | N/A                                            |
