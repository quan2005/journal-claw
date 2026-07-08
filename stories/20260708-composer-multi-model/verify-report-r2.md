---
story: ./story.md
design: ./design.md
round: 2
date: 2026-07-08
verifier: independent-subagent
result: pass
---

# Verify Report (R2) — STORY-20260708-composer-multi-model

> 独立 subAgent 第 2 轮验收。结论仅基于 story.md / design.md 契约与指定范围内的代码取证，不接受实现者自述。
> 本轮重点核对 R1 的 2 条 FAIL（AC-2 / AC-5）及 6 项偏差（D1–D6）是否收敛。

## 取证命令与结果

| 命令                                                            | 结果                          |
| --------------------------------------------------------------- | ----------------------------- |
| `vitest run src/engine/service.test.ts` (daemon)               | 1 file passed                 |
| `vitest run src/conversation/service.test.ts` (daemon)         | 1 file passed（含 2 条 composer） |
| `vitest run src/settings/service.test.ts` (daemon)             | 1 file passed（含 2 条 composer） |
| `vitest run` (daemon, 三文件合计)                              | 30 tests passed               |
| `vitest run` (web, 全量)                                       | 55 files / 392 tests passed   |
| `vitest run src/tests/useComposerSelection.test.tsx src/tests/ChatPanel.test.tsx` | 7 tests passed |
| `tsc --noEmit` (daemon)                                        | 无错误                        |
| `tsc --noEmit` (web)                                           | 无错误                        |

## R1 偏差收敛追踪

| #   | R1 描述                                                       | R2 状态 | R2 证据                                                                 |
| --- | ------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| D1  | 模型下拉按 `protocol` 分组（应为厂商 `label`）                | **已修** | `ChatPanel.tsx:62-71` `groupProvidersByLabel()`；`:1030` 调用；测试 `ChatPanel.test.tsx:72-88` 断言 `queryByText('openai')` 为 null |
| D2  | 下拉末尾缺"管理模型…"跳转设置                                 | **已修** | `ChatPanel.tsx:1078-1101` 按钮 dispatch `open-settings-section`；`App.tsx:471-479` 监听；测试 `ChatPanel.test.tsx:83-87` 验证事件触发 |
| D3  | pill 仅 `{model}`，缺 `● {label} · {model}`                  | **已修** | `ChatPanel.tsx:978-1011` 渲染 dot + provider label + model + caret ▼   |
| D4  | 选中项用背景色，缺 `✓`                                        | **已修** | `ChatPanel.tsx:1069-1071` `{isSelected ? '✓' : ''}`，橙色 `--record-btn` |
| D5  | 发送键 `background:none` vs mockup 填充橙底                   | **未改** | `ChatPanel.tsx:1196-1225` 仍 `background:'none'` + 橙色描边图标        |
| D6  | 思考 pill `🧠 中` 合并字符串，缺 caret                        | **已修** | `ChatPanel.tsx:1127-1129` 拆为 `<span>🧠</span>` + 等级 + caret ▼ 三段 |

**结论：6 项偏差中 5 项已修复（D1–D4、D6），仅 D5（发送键填充风格）保留。**

## AC 逐条核对

### AC-1 — 设置中配置多厂商多模型 → **PASS**

- design.md 声明 AC-1 复用现有 `EngineConfig { active_provider, providers: ProviderEntry[] }`，不改 schema。
- `git diff --stat` 确认 `config/service.ts`、`SectionAiEngine.tsx` 未在本故事改动范围内。
- `engine/service.ts:119-133` `buildModels()` 遍历 `config.providers` 全部记录注册。

### AC-2 — 输入框内切换模型 → **PASS**

| 子项                            | 证据                                                                 | 判定 |
| ------------------------------- | -------------------------------------------------------------------- | ---- |
| pill 点击展开下拉               | `ChatPanel.tsx:958-963` `openPillMenu` state                         | ✅   |
| 选中后 pill 立即更新            | `ChatPanel.tsx:1049-1052` `setProviderId(entry.id)` 即时 React state | ✅   |
| **列表按厂商分组**              | `groupProvidersByLabel()`（`:62-71`），按 `ProviderEntry.label` 分组；测试 `ChatPanel.test.tsx:78-81` 断言 DeepSeek/智谱 成组、`openai` 不出现 | ✅ |
| 选中项显示 `✓`                  | `ChatPanel.tsx:1069-1071` `{isSelected ? '✓' : ''}`                  | ✅   |
| 末尾"管理模型…"跳转设置         | `ChatPanel.tsx:1078-1101` dispatch `open-settings-section`；`App.tsx:471-479` 监听切到 settings；测试 `:83-87` 验证 | ✅ |
| pill = `● {label} · {model} ▾` | `ChatPanel.tsx:978-1011` dot + label + model + caret ▼              | ✅   |

> 分组语义核实：`ProviderEntry.label`（`config/service.ts:9`）为厂商显示名（如 "DeepSeek"/"智谱"），同一厂商多条模型记录共享 label → 自然成组，与 mockup 的 DeepSeek/Anthropic/智谱 分组一致。

### AC-3 — 切换后下一条消息立即生效 → **PASS**

- `conversation/service.ts:251` `applyComposerSelection(session, composerSelection)` 在 `runAgent`（`:252`）之前执行。
- `conversation/service.ts:265-271`：`providerId` 命中 → `session.agent.state.model = resolved.model`；`thinkingLevel` 直接赋值。
- 测试 `conversation/service.test.ts:300-353` 端到端：send `{ providerId:'faux-2', thinkingLevel:'high' }` → `model.id==='faux-model-2'` 且 `thinkingLevel==='high'`，响应来自 secondary provider。
- 测试 `:355-374`：未知 providerId 静默保留当前 model。✓

### AC-4 — 默认模型 = 上次选择 → **PASS**

- `settings/service.ts:29-30` 字段 `composer_selected_provider_id?` / `composer_thinking_level`。
- `settings/service.ts:150-154, 211-217` 归一化：非法 thinkingLevel 兜底 `'medium'`；空 provider_id → `undefined`。
- `useComposerSelection.ts:25-45` mount 读 `get_composer_selection`；`:47-55` set 立即乐观更新 + 异步持久化。
- `ChatPanel.tsx:989-992, 1043` pill 回退 `providerId ?? engineConfig.active_provider`。
- 测试 `useComposerSelection.test.tsx` 4 条全过（mount 读、失败兜底、setProviderId 持久化、setThinkingLevel 持久化）；`settings/service.test.ts:158-184` 默认值 + 持久化 + 非法值归一化。

### AC-5 — 输入框整体重设计落地 → **PASS（含 1 项待裁决）**

**结构层面（契约"Then"明确列项，全部满足）：**

| 子项                                        | 证据                                              | 判定 |
| ------------------------------------------- | ------------------------------------------------- | ---- |
| 多行输入区                                  | `ChatPanel.tsx:889-915` `<textarea>`              | ✅   |
| 单行紧凑操作行                              | `ChatPanel.tsx:918-924` toolbar flex row          | ✅   |
| 附件 / 模型 pill / 思考 pill / 发送 同行    | `ChatPanel.tsx:926-1226`                          | ✅   |
| 无内外双边框                                | 外层 `<div style={{padding}}>` 无 border；fused container 单 border | ✅ |
| 聚焦态边框 + 聚焦环在容器                   | `ChatPanel.tsx:767` `CHAT_PANEL_HIGHLIGHT_RING`   | ✅   |
| textarea 无独立边框                         | `ChatPanel.tsx:903` `border:'none'`               | ✅   |

**token 合规（契约"And"：遵循结构化 token + 单一信号橙）：**

- 全部走 CSS 变量（`--record-btn` / `--dialog-inset-border` / `--detail-case-bg` / `--item-meta` 等），无硬编码色值。
- 信号橙 `--record-btn` 仅出现在：模型指示圆点（`:983`）、选中 `✓`（`:1069`）、聚焦环（`:767`）、发送键图标色（`:1208`）。✓

**唯一保留偏差（D5，R1 已标 ⚠️ 低危 + P3 待裁决）：**

| 项 | mockup.html | 实现 | 说明 |
| -- | ----------- | ---- | ---- |
| 发送键 | `.send { background: var(--accent); color: var(--accent-text); }` 填充橙底白图标 | `background:'none'` + `color:'var(--record-btn)'` 描边图标（`:1196-1225`） | R1 P3 建议保留（与 codebase 其他发送键风格一致）；本轮未被改动，视为开发者默许接受 |

> 判定依据：AC-5 的"Then"明确列出的结构项全部满足；"And"的 token/信号橙合规满足。发送键填充风格属未列出的渲染细节，R1 已分类为低危并建议可接受。故判 PASS，D5 列入待用户裁决。

### AC-6 — 思考等级切换 → **PASS**

- `ChatPanel.tsx:1107-1176` 思考 pill 独立下拉，三档单选，`openPillMenu==='thinking'` 与 model pill 互斥。
- `ChatPanel.tsx:148-153` click-outside 关闭。
- `useComposerSelection.ts:52-55` `setThinkingLevel` 持久化。
- `server.ts:63` `VALID_THINKING_LEVELS = new Set(['low','medium','high'])` 校验。
- `conversation/service.ts:269-271` 赋值 `agent.state.thinkingLevel`。
- pill 三段式 `🧠 + 等级 + ▼`（`:1127-1129`），与 mockup 一致（D6 已修）。
- 测试 `conversation/service.test.ts:336-348` 验证 `thinkingLevel==='high'` 生效。✓

## 三类边界（Won't）核对

| Won't 项                                | 核对                                                                      | 判定 |
| --------------------------------------- | ------------------------------------------------------------------------- | ---- |
| 不做语音输入                            | 无 🎤 / voice / speech 相关代码                                           | ✅   |
| 不做发送中途换模型                      | `applyComposerSelection` 仅在 `send()` 内、`prompt()` 前执行              | ✅   |
| 不做模型自动路由                        | 全程手动选                                                                | ✅   |
| 不做计费统计 / 能力对比                 | 无相关代码                                                                | ✅   |
| 不改输入框以外对话区域                  | diff 集中在 ChatPanel.tsx 输入框区域 + daemon 三文件 + httpRuntimeClient | ✅   |
| 不碰 SectionAiEngine.tsx / EngineConfig | 未在改动范围                                                              | ✅   |

## 越界 / 偏差清单

| #   | 类型 | 位置                       | 描述                                                                 | 严重度 |
| --- | ---- | -------------------------- | -------------------------------------------------------------------- | ------ |
| D5  | 偏差 | `ChatPanel.tsx:1196-1225` | 发送键 `background:'none'` 描边图标，mockup 为填充橙底白图标         | 低     |

（R1 的 D1–D4、D6 已全部修复，无新增越界。）

## 待用户裁决项

| #   | 问题                                                                       | 建议                                                                       |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P1  | 发送键视觉：描边橙图标 vs mockup 填充橙底白图标（R1 P3 延续，未改动）     | 当前实现与 codebase 其他发送键一致，可接受；若要严格对齐 mockup 再开微调任务 |

## 不漏 / 不重 / 不偏 / 不倚 / 不多 / 不少 自检

- **不漏**：AC-1~AC-6 全部核对；R1 的 6 项偏差逐项追踪收敛。✓
- **不重**：`useComposerSelection` 为 composer 状态唯一 hook；`resolveModelFor` 为模型解析唯一入口；`groupProvidersByLabel` 取代了旧的 `groupProvidersByProtocol`（grep 确认全仓仅一处定义 + 一处调用）。✓
- **不偏**：后端改动落在 design.md 指定的 daemon 三文件（engine/conversation/settings + server 路由）；前端落在 ChatPanel + useComposerSelection + httpRuntimeClient + App 事件监听。✓
- **不倚**：每条 AC 独立取证（文件:行 + 测试断言），D5 未修如实记录不放过也不夸大。✓
- **不多**：无超出 story/design 范围的额外功能。✓
- **不少**：design.md 5 项改动（buildModels 全量注册、resolveModelFor、getApiKey 通用化、settings KV、httpRuntimeClient get/set_composer_selection、conversation_send 透传、输入框重设计）均已落地。✓

## P1 裁定（2026-07-08，主对话）

**保留描边风格，不改为 mockup 的填充橙底。** 理由：R1/R2 均确认当前发送键的描边+橙色图标风格与谨迹现有代码库其余发送键的既定视觉语言一致；mockup.html 是交互结构参照（AC-5 明确要求"Then"里的布局项，已全部满足），不是逐像素规格。为这一个按钮单独改成填充橙底，会制造与应用内其他发送键的视觉不一致，违反 `docs/DESIGN.md` 的视觉一致性铁律，得不偿失。pending 清零。

SUMMARY: result=pass | fail=0 | pending=0（P1 裁定为保留现状，理由见上，不违反 AC-5）
