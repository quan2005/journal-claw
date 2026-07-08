---
story: ./story.md
design: ./design.md
round: 1
date: 2026-07-08
verifier: independent-subagent
result: fail
---

# Verify Report — STORY-20260708-composer-multi-model

> 独立 subAgent 第 1 轮验收。结论仅基于 story.md / design.md 契约与指定范围内的代码取证，不接受实现者自述。

## 取证命令与结果

| 命令                                                | 结果                                          |
| --------------------------------------------------- | --------------------------------------------- |
| `vitest run src/engine/service.test.ts` (daemon)   | 1 file, tests passed                          |
| `vitest run src/conversation/service.test.ts`      | 1 file, tests passed (含 2 条 composer 新测)  |
| `vitest run src/settings/service.test.ts`          | 1 file, tests passed (含 2 条 composer 新测)  |
| `vitest run` (web, 全量)                           | 55 files / 391 tests passed                   |
| `tsc --noEmit` (daemon)                            | 无错误                                        |
| `tsc --noEmit` (web)                               | 无错误                                        |

## AC 逐条核对

### AC-1 — 设置中配置多厂商多模型 → **PASS**

- design.md 明确声明 AC-1 "已实现，不需要 schema 改动"，核对 `EngineConfig { active_provider, providers: ProviderEntry[] }` 确实原生支持多厂商多模型。
- `git diff --stat` 确认 `config/service.ts`、`SectionAiEngine.tsx` **均未改动** → 无越界、无 schema 破坏。
- 证据：`apps/daemon/src/engine/service.ts:119-133` `buildModels()` 遍历 `config.providers` 全部记录注册。

### AC-2 — 输入框内切换模型 → **FAIL（偏差）**

| 子项                       | 契约要求                                         | 实现                                                     | 判定 |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------------- | ---- |
| pill 点击展开下拉          | 是                                               | `ChatPanel.tsx:958-963` `openPillMenu` state             | ✅   |
| 选中后 pill 立即更新       | 是                                               | `setProviderId(entry.id)` 立即更新 React state            | ✅   |
| **列表按厂商分组**         | mockup 按**厂商 label**分组（DeepSeek/Anthropic/智谱 各成组） | `groupProvidersByProtocol()` 按 **`protocol`** 分组（`ChatPanel.tsx:62-71, 1021`） | ❌   |
| 选中项显示 `✓`             | design.md: "选中项显示 `✓`"                      | 用 `background: var(--item-selected-bg)` 高亮，无 `✓`     | ❌   |
| 末尾"管理模型…"跳转设置    | design.md: "末尾一条'管理模型…'跳转设置"          | **缺失**，dropdown 内无此菜单项                          | ❌   |
| pill 显示 `● {label} · {model}` | design.md + mockup 明确三段式               | `ChatPanel.tsx:996-1002` 只显示 `{model}`，**缺 provider label** | ❌   |
| pill caret `▾`             | mockup 有 `<span class="caret">▼</span>`         | **缺失**，pill 无 caret                                   | ❌   |

**关键偏差**：按 `protocol` 分组会导致 DeepSeek 与 智谱（均 protocol=openai）合并在 "openai" 组下，违反 story.md AC-2 "按厂商分组" 与 mockup 的视觉契约。

### AC-3 — 切换后下一条消息立即生效 → **PASS**

- `conversation/service.ts:251` `applyComposerSelection(session, composerSelection)` 在 `runAgent` 之前执行。
- `conversation/service.ts:265-271`：`providerId` 命中时 `session.agent.state.model = resolved.model`；`thinkingLevel` 直接赋值。
- 测试 `conversation/service.test.ts:300-353` 端到端验证：send 携带 `{ providerId: 'faux-2', thinkingLevel: 'high' }` → `session.agent.state.model.id === 'faux-model-2'` 且 `thinkingLevel === 'high'`，响应来自 secondary provider。
- 测试 `:355-374`：未知 providerId 时静默保留当前 model。✓

### AC-4 — 默认模型 = 上次选择 → **PASS**

- `settings/service.ts:29-30` 新增 `composer_selected_provider_id?` / `composer_thinking_level` 字段。
- `settings/service.ts:150-154, 211-217` `normalizeComposerThinkingLevel` 非法值兜底 `'medium'`；空字符串 provider_id 归一化为 `undefined`。
- `useComposerSelection.ts:25-45` mount 时 `get_composer_selection` 读取持久化值。
- `useComposerSelection.ts:47-55` `setProviderId`/`setThinkingLevel` 立即乐观更新 + 异步持久化（同 `useTreeSort` 模式）。
- `ChatPanel.tsx:997-1001` pill 回退逻辑 `providerId ?? engineConfig.active_provider` → null 时显示 active_provider。✓
- 测试 `useComposerSelection.test.tsx` 4 条全过；`settings/service.test.ts:158-184` 覆盖默认值 + 持久化 + 非法值归一化。

### AC-5 — 输入框整体重设计落地 → **FAIL（与 mockup 不一致）**

**结构层面（PASS）**：

| 子项                       | 证据                                              | 判定 |
| -------------------------- | ------------------------------------------------- | ---- |
| 多行输入区                 | `ChatPanel.tsx:889-915` `<textarea>`              | ✅   |
| 单行紧凑操作行             | `ChatPanel.tsx:918-924` toolbar flex row          | ✅   |
| 附件 / 模型 pill / 思考 pill / 发送 同行 | `ChatPanel.tsx:926-1186`                | ✅   |
| 无内外双边框               | 外层 `<div style={{padding}}>` 无 border，内层 fused container 单 border | ✅   |
| 聚焦态边框+聚焦环在容器    | `ChatPanel.tsx:767` `CHAT_PANEL_HIGHLIGHT_RING` on `:focused` | ✅   |
| textarea 无独立边框        | `ChatPanel.tsx:903` `border: 'none'`              | ✅   |

**视觉细节层面（FAIL — 与 mockup.html 已确认版不一致）**：

| #   | mockup.html 要求                                  | 实现                                                | 偏差 |
| --- | ------------------------------------------------- | --------------------------------------------------- | ---- |
| 1   | pill = `dot + provider_label + model + caret ▼`  | `dot + model` 仅（`ChatPanel.tsx:978-1002`）        | ❌ 缺 label + caret |
| 2   | 分组 header = 厂商名（DeepSeek/Anthropic/智谱）   | 分组 header = `protocol`（openai/anthropic）        | ❌ 语义错位 |
| 3   | 选中项 `✓` checkmark                              | 用背景色高亮，无 `✓`                                | ❌ |
| 4   | 末尾"⚙︎ 管理模型…"跳转设置                        | **完全缺失**                                        | ❌ 功能缺失 |
| 5   | 发送键 `background: var(--accent)` 填充橙底白图标 | `background: 'none'` + 橙色描边图标（`:1156-1170`） | ⚠️ 风格差异 |
| 6   | 思考 pill = `🧠 + 等级文字 + caret`               | `🧠 中` 合并为单字符串（`:56-60`）                   | ⚠️ 轻微 |

AC-5 契约原文："布局与 mockup.html（已确认版）一致" + "遵循结构化 token 与单一信号橙规范"。token 合规性 PASS（全部使用 CSS 变量），但"一致"未达成（4 处 ❌ + 2 处 ⚠️）。

### AC-6 — 思考等级切换 → **PASS**

- `ChatPanel.tsx:1069-1136` 思考 pill 独立下拉，三档单选，`openPillMenu === 'thinking'` 与 model pill 互斥。
- `ChatPanel.tsx:148-153` click-outside 关闭。
- `useComposerSelection.ts:52-55` `setThinkingLevel` 持久化。
- daemon `server.ts:63` `VALID_THINKING_LEVELS = new Set(['low', 'medium', 'high'])` 校验。
- `conversation/service.ts:269-271` 赋值 `agent.state.thinkingLevel`，下一条消息生效。
- 测试 `conversation/service.test.ts:336-348` 验证 `thinkingLevel === 'high'` 生效。✓

## 三类边界（Won't）核对

| Won't 项                                   | 核对                                                                           | 判定 |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ---- |
| 不做语音输入                               | 无 🎤 / voice / speech 相关代码                                                 | ✅   |
| 不做发送中途换模型                         | `applyComposerSelection` 仅在 `send()` 内、`prompt()` 前执行                    | ✅   |
| 不做模型自动路由                           | 全程手动选                                                                     | ✅   |
| 不做计费统计 / 能力对比                    | 无相关代码                                                                     | ✅   |
| 不改输入框以外对话区域                     | git diff 仅 ChatPanel.tsx（输入框所在组件），无 DetailPanel/JournalList 改动    | ✅   |
| 不碰 SectionAiEngine.tsx / EngineConfig    | git diff 未含此二文件                                                           | ✅   |

## 越界 / 偏差清单

| #   | 类型     | 位置                          | 描述                                                                                     | 严重度 |
| --- | -------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| D1  | 偏差     | `ChatPanel.tsx:62-71`         | 模型下拉按 `protocol` 分组，应为厂商 `label` 分组（违反 AC-2 + mockup）                  | 高     |
| D2  | 功能缺失 | `ChatPanel.tsx:1004-1065`     | 模型下拉菜单末尾缺"管理模型…"跳转设置项（design.md 明确要求）                            | 中     |
| D3  | 偏差     | `ChatPanel.tsx:996-1002`      | 模型 pill 仅显示 `{model}`，缺 `● {label} · {model}` 结构（mockup + design 明确三段式）  | 中     |
| D4  | 偏差     | `ChatPanel.tsx:1051-1057`     | 选中项用背景色高亮，缺 `✓` checkmark（design.md 明确要求）                               | 低     |
| D5  | 偏差     | `ChatPanel.tsx:1156-1170`     | 发送键透明底+橙色图标，mockup 为填充橙底白图标                                            | 低     |
| D6  | 偏差     | `ChatPanel.tsx:56-60, 1089`   | 思考 pill `🧠 中` 合并为单字符串，mockup 为 `🧠` + 等级 + caret 三段                      | 低     |

## 不漏 / 不重 / 不偏 / 不倚 / 不多 / 不少 自检

- **不漏**：AC-1~AC-6 全部核对；design.md 5 项改动逐项核实。✓
- **不重**：`useComposerSelection` 为 composer 状态唯一 hook；`resolveModelFor` 为模型解析唯一入口。✓
- **不偏**：后端改动严格落在 design.md 指定的 3 个 daemon 文件内；前端改动落在 design.md 指定的 4 个 web 文件内。✓
- **不倚**：6 条 AC 各自独立取证，不因功能通过而放过视觉偏差。✓
- **不多**：无超出 story/design 范围的额外功能（如自动路由、计费等 Won't 项确认未实现）。✓
- **不少**：design.md 要求的 `getApiKey` 通用化（`engine/service.ts:90-95`）、`buildModels` 全量注册（`:119-133`）、`resolveModelFor`（`:104-112`）、settings KV（`settings/service.ts:29-30`）、httpRuntimeClient `get/set_composer_selection`（`:144-160`）、`conversation_send` 透传 providerId/thinkingLevel（`:666-679`）均已落地。✓

## 待用户裁决项

| #   | 问题                                                                                               | 建议                                                                 |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P1  | AC-5 "布局与 mockup.html 一致" 的严格度：当前有 4 处 ❌ + 2 处 ⚠️ 视觉偏差，是否判为 blocker？      | D1（分组语义）和 D2（管理模型缺失）建议必改；D3-D6 可由用户拍板      |
| P2  | AC-3 "会话中可观察到模型标识变化"：当前仅 pill 反映当前选择，单条 assistant 消息不携带 model 标签   | design.md 未要求 per-message 标签；若需可在后续 story 补             |
| P3  | 发送键视觉风格：mockup 为填充橙底，实现为透明底描边。是否需要严格对齐 mockup？                     | 当前实现与 codebase 其他发送键风格一致，可视为合理设计决策           |

SUMMARY: result=fail | fail=2 | pending=3
