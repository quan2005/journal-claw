# Daemon 侧报告：多模型 / 思考等级动态切换

Story: `STORY-20260708-composer-multi-model`（AC-1~AC-4、AC-6 daemon 部分）
执行范围：仅 `apps/daemon/*`，未触碰 `apps/web/*`（web 由并行任务处理）。

## 改动文件

| 文件 | 改动 |
| --- | --- |
| `apps/daemon/src/engine/service.ts` | 新增 `resolveModelFor(providerId)`；抽出 `buildModels()` 统一注册**全部**已配置 provider（内置 anthropic/openai + opts extras + 每条 entry 的 openai-compatible 变体）；`getApiKey` 回调通用化（查任意已配置 entry，不再只认 active） |
| `apps/daemon/src/conversation/service.ts` | `send()` 增加 `composerSelection` 第四参数；新增私有 `applyComposerSelection()`（在 `applyExpertMentions` 之后、`runAgent` 之前执行）；构造函数注入仅用于解析的 `piEngineService` 实例 |
| `apps/daemon/src/server.ts` | `POST /conversation/send` 解析并透传 `providerId` / `thinkingLevel`；新增 `VALID_THINKING_LEVELS` 校验常量 |
| `apps/daemon/src/settings/service.ts` | `WorkspaceSettings` 加 `composer_selected_provider_id?` / `composer_thinking_level`；`DEFAULT_SETTINGS` 默认 `'medium'`；`normalizeComposerThinkingLevel` 归一化（非法兜底 `'medium'`，空串 provider id 丢弃） |
| `apps/daemon/src/engine/service.test.ts` | 新增 2 个用例：`resolveModelFor` 解析任意 entry + 未知 id 返回 null；`getApiKey` 任意 entry 可取 key |
| `apps/daemon/src/conversation/service.test.ts` | 新增 2 个用例：per-message 模型/思考等级覆盖端到端生效；未知 provider 时保留当前模型不报错 |
| `apps/daemon/src/settings/service.test.ts` | 新增 2 个用例：默认 medium + 持久化；非法值归一化回 medium |

## 关键实现说明

### resolveModelFor 的注册范围（对 prompt 的一处合理偏离）

prompt 给出的 `resolveModelFor` 伪代码不注册 `this.opts.providers`（builtin extras）。实测发现：若不注册 extras，fauxProvider 背景下被切换到的 entry 会落到 `createOpenAICompatibleProvider` 的真实 HTTP 分支（`models.getModel` 找不到 faux provider → `shouldRegisterOpenAICompatibleProvider` 返回 true → 注册一个指向 `http://localhost:0` 的 openai-completions provider），运行时必然失败。

为让设计**真正正确**（切换到的模型在会话自身的 stream registry 里能找到对应 provider），把 `resolveEngine()` 与 `resolveModelFor()` 共享同一个 `buildModels()` 私有方法：注册 anthropic + openai + opts extras，再遍历 `config.providers` **全部** entry 按 `shouldRegisterOpenAICompatibleProvider` 注册 openai-compatible 变体。这样：

- 生产环境：会话创建时 `resolveEngine()` 已把所有已配置 provider 注册进 session 的 `MutableModels`；中途切到的任何 entry 的 provider 在该 registry 里都存在，`streamSimple` 能正确路由。
- 解析环境：`resolveModelFor()` 用同一份注册逻辑，返回的 `model.provider` 与会话 registry 一致。

`ConversationService` 的解析实例构造为 `new PiEngineService(this.configService, { providers: this.providers })`——显式带上 extras，使 fauxProvider 在测试里可被解析。

### 测试如何让模型切换端到端跑通

prompt 预见的 fauxProvider 路由难题确实存在（两条 `ProviderEntry` 若共用一个 faux provider id 会冲突；不同 id 又各自指向 openai-compatible）。解决方案：**两个独立的 fauxProvider**，各背一条 entry：

```ts
const fauxPrimary   = fauxProvider({ provider: 'faux',   models: [{ id: 'faux-model',   reasoning: false }], ... })
const fauxSecondary = fauxProvider({ provider: 'faux-2', models: [{ id: 'faux-model-2', reasoning: false }], ... })
```

`buildModels` 注册两者后，`shouldRegisterOpenAICompatibleProvider` 对每条 entry 都因 `models.getModel` 命中而返回 false → 两条 entry 各自走 faux provider，不触发真实 HTTP。切换 `providerId:'faux-2'` 后 `agent.state.model.id === 'faux-model-2'` 且实际由 fauxSecondary 产出回复，端到端可断言。无需简化断言范围。

### 未知 provider 静默跳过

`resolveModelFor` 找不到 entry 返回 `null`；`applyComposerSelection` 收到 `null` 时不改 `agent.state.model`，保留当前模型。额外加了一条测试覆盖该降级路径，确保发送流程不中断（符合铁律）。

## 验证命令与结果

### 定向测试（Step 6）

```bash
cd apps/daemon && bunx vitest run src/engine/service.test.ts src/conversation/service.test.ts src/settings/service.test.ts
```

```
 Test Files  3 passed (3)
      Tests  30 passed (30)
   Duration  ~0.8s
```

### 全量回归（Step 7）

```bash
cd apps/daemon && bunx vitest run
```

```
 Test Files  35 passed (35)
      Tests  217 passed (217)
   Duration  1.60s
```

```bash
cd apps/daemon && bunx tsc --noEmit
```

无输出（clean）。

### 格式

`bunx prettier --check` 对全部 7 个改动文件通过（其中 `settings/service.ts`、`conversation/service.test.ts` 初次有格式 warn，已 `prettier --write` 修正后复测全绿，语义无变化）。

## 遇到的问题

1. **fauxProvider 多 entry 路由**：见上方“测试如何让模型切换端到端跑通”——用两个独立 fauxProvider 解决，未改动实现逻辑。
2. **prettier 格式**：两文件初次未对齐项目 prettier 规则，已自动修正。
3. 无其他阻塞。`retry()` 按设计未改（沿用当前 `agent.state.model`/`thinkingLevel`，语义为“用当前状态重跑”）。

## 与 design.md 改动映射

- 改动 1（resolveEngine 注册全部 provider + resolveModelFor + getApiKey 通用化）：✅ 完成。
- 改动 2（ConversationService per-message 覆盖）：✅ 完成。
- 改动 3 daemon 部分（settings 持久化两个字段 + 归一化）：✅ 完成。settings 层复用通用 `GET/PUT /settings`，未新增路由（Step 5 无需改动）。

web 侧（改动 4/5 + `httpRuntimeClient` 的 `get/set_composer_selection`）不在本任务范围。

SUMMARY: result=pass | steps_done=7/7
