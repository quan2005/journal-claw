result: fail

# STORY-20260708-composer-multi-model R2 验收报告

验收基准：
- `stories/20260708-composer-multi-model/story.md` AC-1~AC-6 与三类 Won't。
- `stories/20260708-composer-multi-model/design.md` 顶部 R2 返工方案；下方 R1 “不需要 schema 改动”结论按契约视为已作废。

## AC-1 — 设置中配置多厂商多模型

结论：pass

证据：
- schema 已改为一份凭证下的 `models: string[]`：`apps/daemon/src/config/service.ts:6-13`。
- 旧 `model` 字段迁移为 `models: [model]`，已有配置不丢：`apps/daemon/src/config/service.ts:300-308`；测试 `apps/daemon/src/config/service.test.ts:95-119` 覆盖旧字段迁移，`apps/daemon/src/config/service.test.ts:121-151` 覆盖保留多模型数组。
- 设置页“追加模型”函数只改当前 provider 的 `models` 数组，不触碰 `api_key`：`apps/web/src/settings/components/SectionAiEngine.tsx:492-501`。API key 只由 `setProviderField('api_key', ...)` 更新：`apps/web/src/settings/components/SectionAiEngine.tsx:479-490`、`apps/web/src/settings/components/SectionAiEngine.tsx:852-861`。
- 同一凭证多模型共用 provider 注册与同一 api key 解析：`PiEngineService.buildModels()` 遍历 provider entry 注册 provider：`apps/daemon/src/engine/service.ts:128-141`；`resolveModelFor(providerId, modelId)` 校验 `modelId` 属于该 provider 的 `models`：`apps/daemon/src/engine/service.ts:108-120`；`getApiKey` 按 provider id 找同一条 `ProviderEntry` 并解析其 `api_key`：`apps/daemon/src/engine/service.ts:91-96`、`apps/daemon/src/engine/service.ts:209-212`。
- 最小单测已覆盖一份 DeepSeek 凭证下 `deepseek-chat` 与 `deepseek-reasoner` 两个模型：`apps/daemon/src/engine/service.test.ts:104-139`；同时覆盖任意 provider key 解析：`apps/daemon/src/engine/service.test.ts:141-170`。

## AC-2 — 输入框内切换模型

结论：pass

证据：
- ChatPanel 模型 pill 展示当前 provider label 与 model id：`apps/web/src/components/ChatPanel.tsx:996-1026`。
- 下拉菜单按 `provider.label` 分组：`apps/web/src/components/ChatPanel.tsx:62-71`、`apps/web/src/components/ChatPanel.tsx:1045-1063`。
- 组内将同一凭证的 `entry.models` 展开为多行 `(provider, modelId)`：`apps/web/src/components/ChatPanel.tsx:1045-1050`；点击行调用 `setSelection(entry.id, model)`：`apps/web/src/components/ChatPanel.tsx:1064-1077`。
- 测试以 `DeepSeek` 一条 provider、两个 models 验证菜单分组和模型项渲染：`apps/web/src/tests/ChatPanel.test.tsx:55-66`、`apps/web/src/tests/ChatPanel.test.tsx:71-87`。

## AC-3 — 切换后下一条消息立即生效

结论：pass

证据：
- `useComposerSelection.setSelection()` 将 provider/model 成对持久化：`apps/web/src/hooks/useComposerSelection.ts:52-63`。
- `useConversation.send()` 在发送前读取 `get_composer_selection` 并把 `providerId/modelId/thinkingLevel` 传入 `conversationSend`：`apps/web/src/hooks/useConversation.ts:978-994`。
- HTTP client 把三元组写入 `/conversation/send` body：`apps/web/src/lib/httpRuntimeClient.ts:674-686`；daemon route 解析三元组后传给 `ConversationService.send()`：`apps/daemon/src/server.ts:1447-1475`。
- `ConversationService.send()` 在 `runAgent` 前调用 `applyComposerSelection`：`apps/daemon/src/conversation/service.ts:254-256`；后者用 `(providerId, modelId)` 覆盖 `session.agent.state.model`，并写入 `thinkingLevel`：`apps/daemon/src/conversation/service.ts:269-287`。
- 单测覆盖 per-message model/thinking 覆盖：`apps/daemon/src/conversation/service.test.ts:300-352`；覆盖 providerId 有、modelId 省略时回退 `models[0]`：`apps/daemon/src/conversation/service.test.ts:359-395`。

## AC-4 — 默认模型 = 上次选择

结论：pass

证据：
- settings schema 新增 `composer_selected_provider_id`、`composer_selected_model_id`、`composer_thinking_level`：`apps/daemon/src/settings/service.ts:20-32`。
- HTTP client 的 `get_composer_selection` 返回 provider/model/thinking 三元组，`set_composer_selection` 一次性写入 provider/model/thinking：`apps/web/src/lib/httpRuntimeClient.ts:144-167`。
- `useComposerSelection()` mount 时读取持久化选择并更新本地状态：`apps/web/src/hooks/useComposerSelection.ts:28-50`。
- 测试覆盖读取上次 provider/model/thinking：`apps/web/src/tests/useComposerSelection.test.tsx:21-30`；覆盖 provider/model 成对持久化：`apps/web/src/tests/useComposerSelection.test.tsx:42-58`。

## AC-5 — 输入框整体重设计落地

结论：fail

通过部分：
- 输入框是单个 fused composer 容器：`apps/web/src/components/ChatPanel.tsx:771-790`。
- textarea 自身无边框，焦点/边框由外层容器承担：`apps/web/src/components/ChatPanel.tsx:906-933`。
- 底部工具条包含附件按钮、模型 pill、思考等级 pill、发送键，同在一行：`apps/web/src/components/ChatPanel.tsx:935-1253`。
- 单一信号橙主要通过 `var(--record-btn)` 出现在焦点边框、拖拽边框、模型圆点、选中勾、发送键：`apps/web/src/components/ChatPanel.tsx:777-785`、`apps/web/src/components/ChatPanel.tsx:996-1003`、`apps/web/src/components/ChatPanel.tsx:1094-1096`、`apps/web/src/components/ChatPanel.tsx:1222-1235`。

失败点：
- `docs/DESIGN.md` 明确要求结构化 token 强制消费，禁止组件硬编码圆角、边框、聚焦环数值：`docs/DESIGN.md:179-187`、`docs/DESIGN.md:248-264`。
- ChatPanel composer 仍硬编码圆角与聚焦环浓度：`borderRadius: 12`、`CHAT_PANEL_HIGHLIGHT_RING = color-mix(... 22% ...)`，见 `apps/web/src/components/ChatPanel.tsx:48-50`、`apps/web/src/components/ChatPanel.tsx:777-788`；pill/menu 也有 `borderRadius: 999`、`borderRadius: 8` 等硬编码：`apps/web/src/components/ChatPanel.tsx:986-989`、`apps/web/src/components/ChatPanel.tsx:1038-1041`、`apps/web/src/components/ChatPanel.tsx:1144-1147`、`apps/web/src/components/ChatPanel.tsx:1167-1170`。
- 因 AC-5 明确要求“遵循 docs/DESIGN.md 结构化 token”，上述偏差构成 AC-5 未完全通过。

## AC-6 — 思考等级切换

结论：pass

证据：
- ChatPanel 渲染思考等级 pill，显示低/中/高：`apps/web/src/components/ChatPanel.tsx:56-60`、`apps/web/src/components/ChatPanel.tsx:1133-1156`。
- 下拉菜单三档单选，点击调用 `setThinkingLevel(level)` 并关闭菜单：`apps/web/src/components/ChatPanel.tsx:1157-1201`。
- `useComposerSelection.setThinkingLevel()` 立即持久化当前 provider/model 与新 thinking：`apps/web/src/hooks/useComposerSelection.ts:65-68`。
- 发送链路把 thinkingLevel 传到 daemon，并在 `applyComposerSelection` 写入 `session.agent.state.thinkingLevel`：`apps/web/src/hooks/useConversation.ts:978-994`、`apps/daemon/src/server.ts:1455-1475`、`apps/daemon/src/conversation/service.ts:285-287`。
- 测试覆盖 thinking 读取与持久化：`apps/web/src/tests/useComposerSelection.test.tsx:61-80`；daemon conversation 测试覆盖发送前应用 `thinkingLevel: high`：`apps/daemon/src/conversation/service.test.ts:300-352`。

## 越界/偏差清单

- 偏差：AC-5 的结构化 token 要求未完全满足，存在硬编码圆角与聚焦环浓度；见 AC-5 失败点。
- 未发现新增语音输入功能；ChatPanel 工具条只有附件按钮、模型 pill、思考 pill、停止/发送按钮，未实现麦克风输入：`apps/web/src/components/ChatPanel.tsx:944-969`、`apps/web/src/components/ChatPanel.tsx:971-1253`。
- 未发现自动模型路由、计费统计、模型能力对比展示。
- 未发现发送中途换模型逻辑；流式过程中 `ConversationService.send()` 对已 streaming 会话走 follow-up 分支并直接 return，不应用新的 composer selection：`apps/daemon/src/conversation/service.ts:238-244`，符合“仅影响下一条消息/不做发送中途换模型”的边界。

## 运行验证

```text
cd apps/daemon && bunx vitest run src/config/service.test.ts src/engine/service.test.ts src/conversation/service.test.ts src/settings/service.test.ts src/server.test.ts src/ai_processor/service.test.ts
Test Files  6 passed (6)
Tests       55 passed (55)
Duration    829ms
```

```text
cd apps/daemon && bunx tsc --noEmit
exit code 0, no output
```

```text
cd apps/web && bunx vitest run
Test Files  55 passed (55)
Tests       394 passed (394)
Duration    18.87s
```

```text
cd apps/web && bunx tsc --noEmit
exit code 0, no output
```

## 待用户裁决项

- 无。AC-5 是契约内明确要求，不作为待裁决项放行。

SUMMARY: result=fail | fail=1 | pending=0
