# R2 返工报告：composer-multi-model 厂商/模型一对多

执行日期：2026-07-09。本报告由实现者（被指派的执行器）自测产出，**不构成正式验收**——正式验收由 codex 独立执行。

## 逐 Step 改动文件清单

### Step 1 — daemon schema + 迁移
- `apps/daemon/src/config/service.ts`：`ProviderEntry.model: string` → `models: string[]`；`normalizeProvider()` 新增一次性迁移（读到旧字段 `model` 而无 `models` 时转成 `models: [model]`）；`emptyProvider()` 改为 `models: []`。
- `apps/daemon/src/config/service.test.ts`：现有 fixture `model:` → `models:`；新增迁移测试三条（旧 `model`→`models:[model]`、新 `models` 原样保留、两者都没有→`models:[]`）。

### Step 2 — daemon engine
- `apps/daemon/src/engine/service.ts`：`resolveEngine()` 默认模型取 `provider.models[0]`；`resolveModelFor(providerId, modelId?)` 新增 `modelId`，校验 `provider.models.includes(modelId)`，不在列表内返回 `null`，`modelId` 缺省时回退 `models[0]`；`resolveActiveProvider()` 校验改为 `models.length === 0`；`buildModels()`/`createOpenAICompatibleProvider()`/`createOpenAICompatibleModel()` 改为遍历 `provider.models` 注册多个模型；`shouldRegisterOpenAICompatibleProvider()` 改为检测任一 model 已注册。
- `apps/daemon/src/engine/service.test.ts`：`engineConfig` helper 与内联 fixture `model:` → `models:`；`resolveModelFor` 调用补 `modelId`；新增"一凭证两模型分别解析 + 回退 models[0] + 非法 modelId 返回 null"测试。

### Step 3 — daemon conversation
- `apps/daemon/src/conversation/service.ts`：`send()` 与 `applyComposerSelection()` 的覆盖参数扩展为 `{ providerId?, modelId?, thinkingLevel? }`；`applyComposerSelection` 把 `modelId` 透传给 `resolveModelFor`（缺省回退 `models[0]`，绝不静默跳过整条覆盖）。
- `apps/daemon/src/conversation/service.test.ts`：fixture 与 composer-override 用例更新；新增"只传 providerId 不传 modelId → 命中 models[0]"用例。

### Step 4 — daemon settings + server
- `apps/daemon/src/settings/service.ts`：`WorkspaceSettings` 新增 `composer_selected_model_id?: string`，与 `composer_selected_provider_id` 同样的非空字符串归一化。
- `apps/daemon/src/server.ts`：`POST /conversation/send` 解析 `body.modelId` 并透传给 `ConversationService.send`。
- `apps/daemon/src/settings/service.test.ts`：composer 持久化用例覆盖 `composer_selected_model_id`；新增空字符串归一化用例。
- 附带：`apps/daemon/src/ai_processor/service.ts` `resolveModelForDigest` 由 `provider.model` 改为 `provider.models[0]`；`ai_processor/service.test.ts`、`automation/service.test.ts`、`engine/run.test.ts` 的 `engineConfig` helper `model:` → `models:`。

### Step 5 — web api/types/client/hook
- `apps/web/src/lib/apiTypes.ts`：`ProviderEntry.model` → `models: string[]`。
- `apps/web/src/lib/httpRuntimeClient.ts`：`get/set_composer_selection` 与 `conversation_send` 透传新增的 `modelId`；`set_composer_selection` 将 provider_id/model_id/thinking_level 三字段同一次 `updateSettings` 写入（原子写，杜绝半更新态）。
- `apps/web/src/hooks/useComposerSelection.ts`：state 扩展为 `{ providerId, modelId, thinkingLevel }`；`setProviderId` 替换为 `setSelection(provider, model)`（provider+model 一起写）；`setThinkingLevel` 一并带上当前 modelId。
- `apps/web/src/hooks/useConversation.ts`：`conversationSend` 签名与两处 `get_composer_selection` 读取点扩展 `modelId`。
- `apps/web/src/tests/useComposerSelection.test.tsx`：适配新 API（`setSelection`、`modelId` 断言）。

### Step 6 — web SectionAiEngine.tsx
- `apps/web/src/settings/components/SectionAiEngine.tsx`：删除单模型 `ModelSelect`，新增 `ModelListManager`（凭证下以 chips 列出 `models` 数组，每条带删除按钮；"+ 添加模型"从 `listModels` 探测候选里选或手输自定义 id 追加）；`addProvider` 创建 `models`（preset 有默认模型则 `[defaultModel]`，否则 `[]`）；`addProviderModel`/`removeProviderModel` 只改 `models` 不碰 `api_key`；`isEngineConfigEqual` 比较 `models` 数组；凭证列表 chip 与详情面板 chip 改为渲染 `models`。
- `apps/web/src/tests/SectionAiEngine.test.tsx`：fixture `model:''` → `models:[]`。
- 附带：`apps/web/src/components/OnboardingView.tsx` 由 `active.model` / `existing.model = model` 改为 `models[0]` / `models = [model]`。

### Step 7 — web ChatPanel.tsx
- `apps/web/src/components/ChatPanel.tsx`：模型 pill 下拉组内改为遍历 `provider.models`，每个 `(provider, modelId)` 一行可选；选中态由 `providerId` 扩展为 `(providerId, modelId)`；pill 文案 `● {label} · {modelId}`；选中写入走 `setSelection(provider, model)`；新增 `activePillModelId` helper 解析展示用 modelId（持久化值不在列表时回退 `models[0]`）。
- `apps/web/src/tests/ChatPanel.test.tsx`：engine_config mock 改为单 DeepSeek 凭证配两模型（正是本次返工要验证的形态）+ zhipu；composer mock 补 `modelId`。

## Step 8 验证命令真实输出

```
$ cd apps/daemon && bunx vitest run src/config/service.test.ts src/engine/service.test.ts src/conversation/service.test.ts src/settings/service.test.ts src/server.test.ts
 Test Files  5 passed (5)
      Tests  50 passed (50)

$ cd apps/daemon && bunx tsc --noEmit          ; echo EXIT=$?
DAEMON_TSC_EXIT=0   (无输出)

$ cd apps/web && bunx vitest run
 Test Files  55 passed (55)
      Tests  394 passed (394)

$ cd apps/web && bunx tsc --noEmit             ; echo EXIT=$?
WEB_TSC_EXIT=0      (无输出)

$ npm run build                                ; echo EXIT=$?
... @journal/web built in 2.24s
... @journal/desktop packaging done in 19.66s
... @journal/daemon built in 4.75s
BUILD_EXIT=0
```

附加（非 Step 8 强制，确认未破坏门禁）：`npm run lint` → `0 errors, 9 warnings`（9 条 warning 全部位于本次未改动的 `useAgentRun.ts`/`TodoSidebar.tsx` 等历史文件）。全 daemon 套件（含 ai_processor/automation/engine.run）也额外跑过：8 文件 / 68 测试全绿。

## 手动核实的真实场景：一凭证两模型、不重填 key

> 验收要求：配置一个凭证、加两个模型、不重新填 key、pill 菜单能分别选中两个模型。以下按代码路径推导（标注具体行），不是"应该可以"。

**为什么不重填 key 成立——关键代码路径：**

1. 凭证创建时 key 与 models 是同一 `ProviderEntry` 上互不干涉的两个字段。`SectionAiEngine.tsx` 的 `addProvider(presetId)` 构建 entry 时同时写入 `api_key: ''`（待填）与 `models: [...]`；用户填一次 key 后，`api_key` 存于凭证。
2. **追加模型只改 `models`，不碰 `api_key`**：`addProviderModel(model)`（SectionAiEngine.tsx）实现为 `providers.map(p => p.id === active ? { ...p, models: [...p.models, model] } : p)`——展开时 `api_key` 原样保留，仅 `models` 数组追加。`ModelListManager` 的添加入口（候选点击 / 自定义回车 / "+ xxx" 自定义项）全部只回调 `onAdd` → `addProviderModel`，没有任何写 `api_key` 的路径。
3. **daemon 侧一个凭证 = 一个 Provider，所有模型共用同一 key**：`createOpenAICompatibleProvider(provider)`（engine/service.ts）创建一个 `Provider`，其 `auth.apiKey.resolve` 从 `credential.key`（即凭证的 `api_key`）解析，`models: [...]` 是该 Provider 下挂的全部模型。`buildModels()` 对每个 credential 只 `setProvider` 一次（`shouldRegisterOpenAICompatibleProvider` 检测到任一 model 已注册即跳过），所以同一凭证加 N 个模型不会重复注册、不会要求 N 份 key。
4. **发送时取 key 也按凭证**：`resolveEngine()` 的 `getApiKey: async (providerId) => entry = providers.find(id===providerId); return resolveApiKey(entry)`——按凭证 id 查 key，与该凭证下选哪个 modelId 无关。

**pill 分别选中两个模型的路径：** `ChatPanel.tsx` 下拉 `group.entries.flatMap(entry => entry.models.map(model => ({entry, model})))`——对单凭证的两模型生成两行 `{entry, model}`；点击 `setSelection(entry.id, model)` 把 `(providerId, modelId)` 原子写入 composer selection。发送时 `useConversation.send` 读 `get_composer_selection`（现含 `modelId`）→ `conversationSend(..., {providerId, modelId, thinkingLevel})` → daemon `POST /conversation/send` 解析 `modelId` → `ConversationService.applyComposerSelection` → `resolveModelFor(providerId, modelId)` 校验 `provider.models.includes(modelId)` 后命中对应 `Model` 对象赋给 `session.agent.state.model`。两模型解析为不同 `Model` 对象已由 engine/service.test.ts 的 "resolveModelFor resolves both models under one credential" 测试实证（断言 `chat.model not.toBe reasoner.model`）。

## 自行决定的实现细节（供验收核对）

1. **`resolveModelFor(providerId, modelId?)` 的 `modelId` 设为可选**：design.md 与任务 Step 2 写的是 `(providerId, modelId)` 两个必填 string。我把它做成 `modelId?: string`，语义为"传了就严格校验是否在 `provider.models` 内（不在返回 null）；不传/空字符串则回退 `provider.models[0]`"。这样 Step 3"只传 providerId 不传 modelId 时回退 models[0]、不静默跳过"的需求可以在 `applyComposerSelection` 里一行 `resolveModelFor(providerId, selection.modelId)` 自然实现，不需要 ConversationService 自己再去查 provider 列表算 models[0]。当 `modelId` 显式传入且非法时行为与任务一致（返回 null）。
2. **`addProvider` 的 preset 预填**：design.md 说创建凭证时 `models: []`（或从 listModels 探测预选一个）。我选择：当 preset 有 `defaultModel`（如 DeepSeek 的 `deepseek-chat`）时预填 `models: [defaultModel]`，否则 `[]`。理由是保留原有"添加 DeepSeek 即开即用"的体验；用户随后可在同一凭证下追加 `deepseek-reasoner` 而无需重填 key。如验收希望严格 `[]` 起步可一行改掉。
3. **`composer_selected_model_id` 的"原子写"落在 web client**：任务 Step 4 要求"两字段必须同一次调用一起设置"。daemon 的 settings `update()` 是通用 KV 合并，不便为 composer 两个 key 加硬约束，因此原子性由 `httpRuntimeClient.set_composer_selection` 保证（一次 `updateSettings` 同时写 provider_id + model_id + thinking_level）。daemon 侧只做单字段非空归一化。
4. **`SectionAiEngine.tsx` 的 `setProviderField` 类型收紧**：由 `field: keyof ProviderEntry` 收紧为 `'protocol'|'id'|'label'|'api_key'|'base_url'`（排除 `models`），因为 `models` 是 `string[]`，旧的泛型签名会在计算属性赋值时触发 TS 报错；`models` 的增删走专用的 `addProviderModel`/`removeProviderModel`。
5. **ChatPanel pill 的 `activePillModelId` 回退**：持久化的 `modelId` 若被用户在设置里删掉，pill 展示用 modelId 回退到当前凭证 `models[0]`，避免显示一个已不存在的模型 id（与 daemon `resolveModelFor` 的回退语义一致）。
