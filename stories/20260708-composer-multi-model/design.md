---
story: ./story.md
status: approved
created: 2026-07-08
---

# Design: Agent 输入框重设计 + 多厂商多模型按需切换

## R2 返工（2026-07-09）：AC-1 判定被推翻，补充一对多 schema 改动

轮次 2 的 codex 独立验收判定 AC-1 未达成：R1 版本本节曾主张"`ProviderEntry` 已支持多模型，加多条记录即可"，但这在真实配置下等价于"一个厂商条目=一个模型"——配 `deepseek-chat` + `deepseek-reasoner` 两个模型，需要整份复制厂商记录（重复 `protocol`/`api_key`/`base_url`，只有 `id`/`model`/`label` 不同），UI 也要求重填一遍 API key。这不是"一份凭证下管理模型列表"，是"伪装成模型列表的凭证复制"。以下是修正后的正确方案，**取代**本文件下方"已确认可复用的现状"小节的结论——该小节的"不需要 schema 改动"判断作废。

### 新 schema：凭证（credential）与模型（model）一对多

`apps/daemon/src/config/service.ts`：

```ts
export interface ProviderEntry {
  protocol: string
  id: string        // 凭证 id，全局唯一
  label: string      // 凭证显示名，如 "DeepSeek"
  api_key: string
  base_url: string
  models: string[]   // 该凭证下的模型 id 列表，如 ["deepseek-chat", "deepseek-reasoner"]
}
```

`model: string` 字段整体替换为 `models: string[]`（破坏性 schema 变更，本项目未发布 GA、无需兼容旧配置的"软迁移"，但仍要写一次性迁移：`normalizeProvider` 读到旧字段 `model`（非空字符串）而无 `models` 时，转成 `models: [oldModel]`，保证已有用户的 `config.json` 升级后不丢配置）。

`resolveModelFor` 签名扩展为按 `(providerId, modelId)` 二元定位：

```ts
resolveModelFor(providerId: string, modelId: string): { model: Model<Api>; provider: ProviderEntry } | null
```

内部：`config.providers.find(p => p.id === providerId)` 找到后，校验 `modelId` 在 `provider.models` 内，再 `models.getModel(provider.id, modelId)`（`MutableModels` 的注册键仍是 `(providerId, modelId)` 二元组，`buildModels()` 需要按 `provider.models` 逐个注册而非单个 `provider.model`）。

`resolveEngine()` 的默认模型（会话创建时用）取 `provider.models[0]`（`active_provider` 对应记录的第一个模型），找不到则沿用现有的 `PiEngineConfigError`。

`ConversationService.applyComposerSelection` 的覆盖参数从 `{ providerId }` 扩展为 `{ providerId, modelId }`（两者都要传，只传 `providerId` 时用该 provider 的第一个模型作为回退，不静默跳过——否则 UI 选中某个模型后仍可能命中另一个模型，构成新的"选了但没生效"bug）。

### `SectionAiEngine.tsx` UI 改动（本次必须动）

现有"添加供应商"表单（`AddProviderMenu`/`addProvider`）改为两级操作：

1. **添加凭证**：填 `protocol`/`label`/`api_key`/`base_url` 一次，创建时 `models: []`（或从 `listModels()` 探测结果里预选一个）。
2. **凭证下管理模型列表**：每条凭证展开后有一个模型子列表（chips 或行），"+ 添加模型"从 `listModels(engine, apiKey, baseUrl, protocol)` 返回的候选里多选/输入自定义 id 追加进 `models` 数组，每个模型旁一个删除按钮（删到 0 个模型时凭证仍保留，只是暂不可用于对话，不强制级联删除凭证）。
3. 删除凭证＝删除整条 `ProviderEntry`（级联删除其下全部模型），沿用现状。

不引入新的顶层设置项/路由，改动限于这一个文件内的表单结构与 `EngineConfig` 读写逻辑。

### Pill 菜单分组改动

`ChatPanel.tsx` 模型 pill 下拉：按 `provider.label` 分组（不变），组内列出 `provider.models` 每一项（新增的一层循环，之前是"组内只有一条，等于组=模型"）。选中态存储从 `providerId` 扩展为 `{ providerId, modelId }`，pill 文案 `● {label} · {modelId}`。

### `composer_selected_provider_id` 持久化字段改名/扩展

`apps/daemon/src/settings/service.ts`：新增 `composer_selected_model_id?: string` 字段（与 `composer_selected_provider_id` 成对持久化，二者必须同时写入/同时读出，不允许出现"provider 已换、model 还是旧的"这种半更新态）。`httpRuntimeClient.ts` 的 `get/set_composer_selection` 返回/接收 `{ providerId, modelId, thinkingLevel }` 三元组。

### 迁移与向后兼容验证要点（codex 复验时须覆盖）

- 一个已有 `model: "gpt-4o"` 字段、无 `models` 字段的旧 `config.json`，启动后自动迁移为 `models: ["gpt-4o"]`，原有对话不受影响。
- 真实场景回归：配置一个 DeepSeek 凭证，添加 `deepseek-chat`、`deepseek-reasoner` 两个模型，**不重新输入 API key**，pill 菜单里两个模型分别可选、发消息后 `applyComposerSelection` 命中对应 `modelId`。这是本轮返工要堵的洞，必须用真实配置走一遍，不能只看代码里有没有 UI 组件。

---

## 已确认可复用的现状（R1，结论已被上方 R2 推翻，仅保留存档）

`apps/daemon/src/config/service.ts` 的 `EngineConfig { active_provider: string; providers: ProviderEntry[] }` **已经**支持多厂商多模型：`ProviderEntry { protocol, id, label, api_key, base_url, model }` 每条记录一个厂商的一个模型，`id` 全局唯一。想配同一厂商的多个模型，就加多条 `protocol` 相同但 `id`/`model` 不同的记录。`apps/web/src/settings/components/SectionAiEngine.tsx`（960 行）已经有完整的"添加供应商/模型"UI（`addProvider`/`AddProviderMenu`/删除/编辑），重启应用后配置仍在（持久化在 `config.json`）。

**（作废）结论：AC-1 已实现，本次不用碰 `SectionAiEngine.tsx` 或 `EngineConfig` schema。** 本故事真正要做的是 AC-2～AC-6：输入框上的"选择哪条已配置记录用于下一条消息"+ 视觉重设计 + 思考等级。

## 核心机制：per-turn 动态切换模型/思考等级（框架原生支持，已核实）

`@earendil-works/pi-agent-core` 的 `AgentState` 接口明确标注：

```ts
model: Model<any>          // "Active model used for future turns."
thinkingLevel: ThinkingLevel // "Requested reasoning level for future turns."
```

这两个字段就是为"运行时切换、下一轮生效"设计的可写字段。本故事复用这个机制，和 story `20260618-expert-perspective-at` 里对 `agent.state.systemPrompt` 做动态后缀拼接是同一模式：**在 `send()` 里、调用 `agent.prompt()` 之前，读取本次请求携带的 `providerId`/`thinkingLevel` 覆盖值，解析出真实 `Model` 对象后赋给 `session.agent.state.model`（`thinkingLevel` 直接赋值），不需要重建 Agent/Engine。**

`ThinkingLevel` 联合类型是 `"off" | "minimal" | "low" | "medium" | "high" | "xhigh"`，UI 三档「低/中/高」映射到 `'low' | 'medium' | 'high'`。

## 改动 1（daemon）：`PiEngineService` 注册全部 provider，不再只注册 active 一个

**现状**：`resolveEngine()`（`apps/daemon/src/engine/service.ts:73-101`）只解析 `config.active_provider` 对应的一条 `ProviderEntry`，`shouldRegisterOpenAICompatibleProvider` 只对这一条注册。想切到另一条记录时，那条记录的 provider 可能还没注册进 `MutableModels`，`models.getModel(otherId, otherModel)` 会返回 `undefined`。

**改动**：`resolveEngine()` 改成遍历 `config.providers`**全部**记录，对每一条都跑一遍 `shouldRegisterOpenAICompatibleProvider` + 按需注册（`anthropicProvider()`/`openaiProvider()` 内置的两家不用重复注册，只需按需注册 openai-compatible 变体）。返回值除了现有的 `{ model, models, provider, getApiKey }`（`model`/`provider`/`getApiKey` 仍按 `active_provider` 解析，作为会话创建时的默认值，向后兼容），新增：

```ts
resolveModelFor(providerId: string): { model: Model<Api>; provider: ProviderEntry } | null
```

内部逻辑：`config.providers.find(p => p.id === providerId)` 找不到返回 `null`；找到则确保其 provider 已注册（同 `resolveEngine` 里的注册逻辑，可以抽成私有辅助函数 `ensureProviderRegistered(models, provider)` 给两处复用），再 `models.getModel(provider.id, provider.model)`。

`getApiKey` 回调（`AgentOptions['getApiKey']`）目前只认 `provider.id === 唯一激活的那个`（`apps/daemon/src/engine/service.ts:96-99`：`if (providerId !== provider.id) return undefined`）。改成**通用化**：`getApiKey: async (providerId) => { const entry = config.providers.find(p => p.id === providerId); if (!entry) return undefined; return this.resolveApiKey(entry) }`——不再局限于当前 active provider，任何已配置记录切换过去都能拿到 key。

`createAgent()` 里把 `engine.models`（`MutableModels`）也暴露给调用方（`ConversationService`），因为动态切换要用同一个 `models` 实例去 `getModel`。可以在 `PiEngineService` 上加一个 `getModels(): MutableModels`（懒加载/缓存 `resolveEngine()` 的 `models`，避免每次切换都重新扫描注册一遍——**注意**：当前 `resolveEngine()` 是无状态纯函数式调用，`createAgent()` 每次都新建一个 `models`。为了让"运行期切换"和"会话创建时"用的是同一份已注册好的 `MutableModels`，`PiEngineService` 需要把 `resolveEngine()` 的结果缓存在实例上（`private cachedEngine?: ResolvedPiEngine`），`resolveModelFor` 复用这份缓存而不是重新 `resolveEngine()`。

## 改动 2（daemon）：`ConversationService` 接收 per-message 的模型/思考等级覆盖

`send(sessionId, message, images?)` 签名扩展为 `send(sessionId, message, images?, options?: { providerId?: string; thinkingLevel?: 'low'|'medium'|'high' })`。在 `applyExpertMentions(session, message)` 调用的同一位置（`send()` 方法体内，`runAgent` 之前）新增：

```ts
private applyComposerSelection(
  session: ConversationSession,
  options?: { providerId?: string; thinkingLevel?: 'low' | 'medium' | 'high' },
): void {
  if (options?.providerId) {
    const resolved = this.piEngineService?.resolveModelFor(options.providerId)
    if (resolved) session.agent.state.model = resolved.model
  }
  if (options?.thinkingLevel) {
    session.agent.state.thinkingLevel = options.thinkingLevel
  }
}
```

`ConversationService` 目前不持有一个跨会话共享的 `PiEngineService`（每次 `createAgent()` 内部 `new PiEngineService(...)` 都是新实例，绑死一个 `runId`）。需要新增一个不绑定 runId、只用于"查表/解析模型"的辅助实例（或者让 `resolveModelFor` 成为一个不依赖 runId 的独立函数/类方法，直接接收 `ConfigService` 现查）。**建议**：把 `resolveModelFor` 相关逻辑做成 `apps/daemon/src/engine/service.ts` 里的一个独立导出函数 `resolveModelForProvider(configService, providerId, cachedModels?)`，而不是挂在某个绑定了 runId 的 `PiEngineService` 实例上——这样 `ConversationService` 不需要额外持有一个引擎实例，直接调用这个函数即可。`MutableModels` 的缓存复用可以退化为"每次都重新注册"（provider 数量通常个位数，注册开销可忽略，不必强求跨调用缓存——这是可以接受的简化，避免引入额外的实例生命周期管理复杂度）。

## 改动 3（daemon）：settings 持久化"上次选择"

复用通用 settings KV（同 `workspace_tree_sort` 的模式），新增两个 key：

```ts
composer_selected_provider_id?: string   // 上次选中的 ProviderEntry.id；未设置时用 config.active_provider
composer_thinking_level: 'low' | 'medium' | 'high'  // 默认 'medium'
```

daemon 侧：`apps/daemon/src/settings/service.ts` 的 `WorkspaceSettings` 加这两个字段 + `normalizeComposerThinkingLevel` 归一化（非法值兜底 `'medium'`）。`httpRuntimeClient.ts` 加 `get/set_composer_selection`（一次性返回/写入 `{ providerId, thinkingLevel }` 这一对，没必要拆成两个 invoke，逻辑上是一体的用户偏好）。

前端 `useComposerSelection()` hook（仿 `useTreeSort.ts` 的 mount-load + 立即持久化模式），返回 `{ providerId, thinkingLevel, setProviderId, setThinkingLevel, loading }`。

## 改动 4（web）：输入框重设计（对照 `mockup.html`，已用户确认）

现有 Agent 栏输入框在 `apps/web/src/components/UnifiedChatShell.tsx`/`ChatPanel.tsx`（具体渲染输入区的组件，本轮 web 侧删除外部引擎后 `UnifiedChatShell` 已经简化为纯 chat passthrough，实现者需要先读现状确认输入框实际渲染点，可能已经内聚到 `ChatPanel.tsx` 一处）。

按 mockup 布局：
- 外层容器只保留输入框自身一层边框（`.composer`），去掉 `UnifiedChatShell`/父容器可能存在的第二层边框。
- `<textarea>` 无独立边框，聚焦态边框+聚焦环加在 `.composer` 容器上（`:focus-within`），不加在 textarea 自身。
- 底部单行工具条：📎（若现有附件能力存在则保留原有 handler，只做位置迁移；若不存在则不做，story Won't 已声明不新增语音）→ 模型 pill → 思考等级 pill → spacer → 发送键。
- 模型 pill：`● {provider.label} · {model}`，点击展开下拉菜单，按 provider 分组（`<div class="group">{label}</div>` + 该 provider 下的 `ProviderEntry` 列表项），选中项显示 `✓`，末尾一条"管理模型…"跳转到设置的 AI 引擎面板。
- 思考等级 pill：`🧠 {低|中|高}`，独立下拉，三档单选。
- 两个 pill 都是"点击展开覆盖层菜单"交互，同一时间只开一个（点开一个自动关另一个），点击页面其他地方关闭——直接照抄 mockup.html 里的 JS 逻辑改写成 React state（`openMenu: 'model' | 'effort' | null`）。
- 颜色：只在发送键、模型指示圆点、选中 ✓、聚焦环上出现橙色（`--record-btn`），其余走中性色 token，不新增调色板。

## 改动 5（web）：发送时携带覆盖参数

`ChatPanel`（或输入框所在组件）的发送逻辑，调 `selectRuntimeClient().invoke('conversation_send', { sessionId, message, providerId, thinkingLevel })`（新增 `providerId`/`thinkingLevel` 两个可选参数，透传到 `httpRuntimeClient.ts` 对应 case，再透传到 daemon `POST /conversations/:id/messages`（或现有等价路由）body，最终到 `ConversationService.send(...)`）。

## 验收标准回归自查

- AC-1：已有，不做改动。
- AC-2：模型 pill 点击展开分组下拉，选中后 pill 立即更新——纯前端 state，展示层面。
- AC-3：`applyComposerSelection` 在 `send()` 里于 `runAgent` 之前执行，保证"当前这条"就用新模型，不需要新建会话。
- AC-4：`useComposerSelection` mount 时读 daemon settings，默认值 = 上次持久化值；`setProviderId`/`setThinkingLevel` 立即写回 daemon（乐观更新 + 异步持久化，同 `useTreeSort` 模式）。
- AC-5：对照 mockup.html 逐项还原（见改动 4）。
- AC-6：思考等级 pill，独立于模型 pill 的下拉，同样"下一条消息生效 + 记住上次选择"路径。

## 交棒清单收敛（对照 story.md）

- settings schema 升级：不需要（AC-1 复用现有 `EngineConfig`，"上次选择"走新增的通用 KV 两个字段，非 schema 破坏性变更）。
- API key 存储/脱敏：不变（`SectionAiEngine.tsx` 现有逻辑已处理，本故事不碰）。
- "上次选择"持久化位置：daemon settings（`composer_selected_provider_id`/`composer_thinking_level`），不用 localStorage，符合铁律 4。
- 会话中途切模型的上下文传递：`agent.state.model` 切换不影响 `agent.state.messages`（对话历史），框架层面模型切换只影响后续请求用哪个 API，历史消息原样继续送给新模型——这是 pi-agent-core 的既定行为，不需要额外处理。
- 模型不可用时的错误反馈：`resolveModelForProvider` 找不到对应 provider/model 时返回 `null`，`applyComposerSelection` 静默跳过覆盖（保留当前 `agent.state.model` 不变），前端如果 pill 选中的 provider 被用户在设置里删除，下拉菜单本身依据当前 `EngineConfig` 渲染，不会显示已删除的项，不会出现"选中了不存在的模型"的用户可见错误态——这是自然规避，不需要专门的错误 UI。
- 思考等级到各厂商参数映射：`ThinkingLevel` 是 pi-agent-core/pi-ai 框架统一抽象，各 provider 的 reasoning 参数映射已经在框架内部处理（不在本次改动范围内验证每家具体行为，只要传值正确即可，属于框架职责）；不支持思考的模型如何呈现——不做特殊处理，思考等级 pill 始终显示，框架层面会忽略不支持该参数的模型请求中的 thinkingLevel（若某模型报错则是既有框架行为，不在本故事范围内修）。

## 验证命令

```bash
cd apps/daemon && bunx vitest run src/engine/service.test.ts src/conversation/service.test.ts
cd apps/daemon && bunx tsc --noEmit
cd apps/web && bunx vitest run
cd apps/web && bunx tsc --noEmit
npm run build
```

## 边界重申（继承 story.md Won's，不重复展开）

不做未配置模型时的额外引导教育；不做语音输入；不做发送中途换模型（只影响下一条）；不做模型自动路由/计费统计/能力对比展示；不改输入框以外的对话区域设计。
