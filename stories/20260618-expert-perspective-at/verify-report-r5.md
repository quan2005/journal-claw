---
story: ./story.md
design: ./design.md
date: 2026-07-08
round: 5
result: pass
scope: 'TS daemon 迁移后重新核对。范围：apps/daemon/src/conversation/service.ts、apps/daemon/src/conversation/service.test.ts、apps/daemon/src/server.ts、apps/daemon/src/identity/service.ts、apps/daemon/src/files/service.ts、apps/web/src/components/AtMentionMenu.tsx、apps/web/src/components/ChatPanel.tsx、apps/web/src/components/TreeSidebar.tsx、apps/web/src/tests/AtMentionMenu.test.tsx；桥接证据采自 apps/web/src/App.tsx 与 apps/web/src/types.ts（范围外，仅作链路佐证）'
---

# 验收报告 r5 - @ 专家视角对话机制

> 本轮在 Rust/Tauri → TS daemon 迁移（M 系列，已 verified）后，对照当前 `apps/web + apps/daemon` 实现重新核对。story.md 已声明 r1-r4 引用的 `src-tauri/` 路径已删除，其 2 个 pending 项是"pre-existing app-wide file-open routing unrelated to this round's diff"——即不在本轮核对范围内。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
| --- | --- | --- |
| AC-1 输入框 @ 专家名召唤专家视角 | ✅ pass | story 要求输入框 `@专家名` 选择并发送后进入专家视角，且不手写 prompt（`stories/20260618-expert-perspective-at/story.md:66`-`71`）。输入框检测 `@` 并记录 query（`apps/web/src/components/ChatPanel.tsx:288`-`303`）；选中菜单项插入 `@{insert_text ?? path}`（`apps/web/src/components/ChatPanel.tsx:325`-`346`）；菜单从 `list_at_mention_candidates` 加载（`apps/web/src/components/AtMentionMenu.tsx:5`-`9`、`134`-`149`）。daemon 侧 `send` 调用 `applyExpertMentions` 更新 `session.expertContexts` 并重算 `agent.state.systemPrompt`（`apps/daemon/src/conversation/service.ts:243`-`244`、`254`-`279`）；`expertSystemPromptSuffix` 把画像正文拼为后缀（`apps/daemon/src/conversation/service.ts:284`-`303`）。测试断言发送后 system prompt 含专家正文与"主视角"标记（`apps/daemon/src/conversation/service.test.ts:242`-`273`），本轮运行通过。 |
| AC-2 画像列表 @ 直接让专家视角进入当前对话 | ✅ pass | story 要求画像列表点击 `@` 后输入区出现可发送专家引用，不自动发送，发送后生效（`stories/20260618-expert-perspective-at/story.md:73`-`78`）。画像列表三类分组均发出 `identities/{filename}`（`apps/web/src/components/TreeSidebar.tsx:981`、`1030`、`1079`）；`App` 桥接打开右面板并派发 `chat-append-text` 携带 `@{path}`（`apps/web/src/App.tsx:1134`-`1137`）；`ChatPanel` 仅追加到 `inputValue` 并聚焦，**不调用 onSend**（`apps/web/src/components/ChatPanel.tsx:167`-`185`）。发送路径与 AC-1 同一条 `applyExpertMentions`。`TreeSidebar.test.tsx:146`-`151` 覆盖画像 `@` 发出 identity ref。 |
| AC-3 专家作为单一分类可被查找 | ✅ pass | story 要求统一"专家"分类，不继续细分（`stories/20260618-expert-perspective-at/story.md:82`-`85`）。daemon 只定义一个 `__experts__` / `专家` 虚拟目录（`apps/daemon/src/files/service.ts:59`-`62`）；根层级追加该虚拟目录（`apps/daemon/src/files/service.ts:208`-`218`）；进入该目录返回专家候选（`apps/daemon/src/files/service.ts:195`-`198`）。前端面包屑把 `__experts__` 显示为"专家"（`apps/web/src/components/AtMentionMenu.tsx:38`-`42`），专家候选显示单一"专家"标记（`apps/web/src/components/AtMentionMenu.tsx:354`-`365`）。无产品/架构/商业等子分类。 |
| AC-4 30 秒内找到并 @ 到专家 | ✅ pass | story 要求从对话或画像入口 30 秒内 `@` 到合适专家（`stories/20260618-expert-perspective-at/story.md:87`-`91`）。结构性证据：根层级直接出"专家"目录并按 query 返回专家候选（`apps/daemon/src/files/service.ts:208`-`219`）；搜索覆盖 name、filename、summary、expert_skill、aliases、tags（`apps/daemon/src/files/service.ts:469`-`476`）；query 非空时根层级直出匹配专家（`apps/daemon/src/files/service.ts:219`）；专家 icon/标记一眼可辨（`apps/web/src/components/AtMentionMenu.tsx:111`-`116`、`354`-`365`）。注：30 秒为 UX 时效目标，非可在单测中断言；结构支撑充分，判 pass。 |
| AC-5 专家回答提供视角差异和洞察 | ✅ pass | story 要求回答体现专家思考框架、关注点或追问方式，并至少给出盲点/反观点/挑战性追问/明确判断之一（`stories/20260618-expert-perspective-at/story.md:93`-`98`）。prompt 后缀指令"以其思考框架、关注点和追问方式回应，不要只是泛泛赞同"（`apps/daemon/src/conversation/service.ts:302`），并把画像正文注入上下文（`apps/daemon/src/conversation/service.ts:296`-`298`）；最后一个 `@` 的专家标为"主视角"，其余为"参考视角"（`apps/daemon/src/conversation/service.ts:297`）。注：实际回答质量依赖 LLM，单测无法断言；指令覆盖 AC-5 意图。偏差见下文"方案落实"。 |
| AC-6 普通文件 @ 行为不被破坏 | ✅ pass | story 要求普通文件引用仍可用且不被误识别为专家（`stories/20260618-expert-perspective-at/story.md:100`-`105`）。普通候选仍由 `listWorkspaceDir` 映射为 `file`/`directory`（`apps/daemon/src/files/service.ts:200`-`206`）；只有 `identities/{filename}` 且画像 `is_expert` 才进入专家上下文（`apps/daemon/src/conversation/service.ts:31`、`261`-`275`）；专家判定需 `tags` 含"专家"/"expert" 或 `expert_skill` 非空（`apps/daemon/src/identity/service.ts:228`-`233`）。其他 `@path` 原样留在用户消息中（`apps/daemon/src/conversation/service.ts:244` 直接 `prompt(message, ...)`）。pre-existing 的 chip 路由（`dispatchJournalFileOpen`）与 `journal-file-open` 强制切 topics 行为，story.md 已显式声明不属于本轮 diff，不计入 AC-6。 |
| AC-7 可清除当前会话专家视角 | ✅ pass | story 要求通过 `@` 选择"清除专家视角"并发送后移除当前会话专家上下文，后续不沿用（`stories/20260618-expert-perspective-at/story.md:107`-`112`）。daemon 提供 `清除专家` 控制候选，`path=__experts__/clear`、`insert_text=清除专家`（`apps/daemon/src/files/service.ts:61`-`62`、`443`-`453`）；菜单选中使用 `insert_text`（`apps/web/src/components/AtMentionMenu.tsx:206`、`315`）；发送前 `CLEAR_EXPERT_RE = /@清除专家(?=\s\|@\|$)/` 先清空再合并同条消息新专家（`apps/daemon/src/conversation/service.ts:34`、`257`-`259`）。测试覆盖：选中清除控制插入"清除专家"（`apps/web/src/tests/AtMentionMenu.test.tsx:55`-`80`），`@清除专家 好的` 后 prompt 不再含专家正文（`apps/daemon/src/conversation/service.test.ts:269`-`273`），本轮运行通过。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 对话输入框入口完整：story 覆盖输入框 `@专家名`（`stories/20260618-expert-perspective-at/story.md:36`、`59`-`63`）；代码覆盖输入检测 → 菜单加载 → 选择插入 → 发送解析 → prompt 注入（`apps/web/src/components/ChatPanel.tsx:288`-`346`、`apps/web/src/components/AtMentionMenu.tsx:134`-`149`、`apps/daemon/src/conversation/service.ts:243`-`279`）。
- ✅ 画像列表入口完整：story 覆盖画像列表 `@`（`stories/20260618-expert-perspective-at/story.md:36`、`65`-`69`）；TreeSidebar → App → ChatPanel 桥接闭合（`apps/web/src/components/TreeSidebar.tsx:981`、`apps/web/src/App.tsx:1134`-`1137`、`apps/web/src/components/ChatPanel.tsx:167`-`185`），不自动发送。
- ✅ 当前会话持续有效并可清除：story 已确认当前会话持续到切换/清除/新会话（`stories/20260618-expert-perspective-at/story.md:122`-`125`、Q3）；会话持久化 `expert_contexts`（`apps/daemon/src/conversation/service.ts:105`、`117`、`430`-`432`、`643`、`668`），每轮 send 重算 suffix（`apps/daemon/src/conversation/service.ts:278`），`load` 重建会话时回挂 suffix（`apps/daemon/src/conversation/service.ts:430`-`434`、`530`-`532`）。
- ✅ 新会话为空：design 要求新建会话专家上下文为空（`stories/20260618-expert-perspective-at/design.md:106`）；`create` 初始化 `expertContexts: []`（`apps/daemon/src/conversation/service.ts:220`）。

## 方案落实（不偏，对照 design.md）

- ✅ 数据契约落实：design 要求 frontmatter 支持 `tags`/`expert_skill`/`aliases`，并由 `tags:["专家"]`/`expert` 或 `expert_skill` 激活（`stories/20260618-expert-perspective-at/design.md:31`-`45`）。`IdentityEntry` 含 `aliases`、`expert_skill`、`is_expert`（`apps/daemon/src/identity/service.ts:20`-`33`），激活规则 tag/skill 二选一（`apps/daemon/src/identity/service.ts:228`-`233`），列表输出字段齐全（`apps/daemon/src/identity/service.ts:140`-`160`）；前端 `types.ts` 同步（`apps/web/src/types.ts:66`-`68`）。
- ✅ 候选聚合 IPC 落实：design 要求 `list_at_mention_candidates(relative_path, query)` 聚合工作区文件与专家（`stories/20260618-expert-perspective-at/design.md:49`-`75`）。daemon 路由 `GET /files/at-mention-candidates`（`apps/daemon/src/server.ts:1090`-`1099`）；`FilesService.listAtMentionCandidates` 复用 `listWorkspaceDir` 并追加专家虚拟目录与专家候选（`apps/daemon/src/files/service.ts:195`-`223`）；前端封装走 `runtimeClient`（`apps/web/src/components/AtMentionMenu.tsx:5`-`9`）。
- ✅ 会话专家上下文解析落实：design 要求发送前解析、去重、清除、新建为空、持久化（`stories/20260618-expert-perspective-at/design.md:77`-`106`）。`applyExpertMentions` 先判清除再 collect mention（`apps/daemon/src/conversation/service.ts:257`-`276`），重复专家 filter 后 push 实现 retain+append 去重（`apps/daemon/src/conversation/service.ts:273`-`274`）。
- ✅ system prompt 动态后缀落实：design 要求每轮 LLM 调用前动态拼接，不写死 base prompt（`stories/20260618-expert-perspective-at/design.md:108`-`134`、`206`-`208`）。`expertSystemPromptSuffix` 每次 send 重算并赋给 `agent.state.systemPrompt = session.systemPrompt + suffix`（`apps/daemon/src/conversation/service.ts:278`），base `session.systemPrompt` 不被污染。
- ✅ 前端测试策略落实：design 要求 AtMentionMenu 专家候选、清除候选、画像列表追加输入框、不自动发送（`stories/20260618-expert-perspective-at/design.md:183`-`188`）。`AtMentionMenu.test.tsx` 覆盖专家选择与清除 `insert_text`（`apps/web/src/tests/AtMentionMenu.test.tsx:42`-`80`，本轮 2/2 通过）；`service.test.ts` 覆盖 @mention 注入 prompt 与清除（`apps/daemon/src/conversation/service.test.ts:242`-`273`，本轮 6/6 通过）。
- ⚠️ 偏差（记入待裁决）：design 决策 4 模板中"如果关联 skill 为 `{skill_name}`，你应调用 load_skill 加载该 skill；如无法加载，使用下方画像内容作为降级"未落实。当前 `expertSystemPromptSuffix` 只注入画像正文（`apps/daemon/src/conversation/service.ts:290`-`298`），从未读取 `entry.expert_skill`，也未在 prompt 中提示 `load_skill`。`expert_skill` 字段被解析并参与 `is_expert` 判定，但在 prompt 注入路径上未被消费（`apps/daemon/src/conversation` 目录无 `expert_skill`/`load_skill`/`skill_name` 引用，已 grep 确认）。实际影响：纯正文注入对"画像正文丰富的专家"足够生效（AC-1/AC-5 仍 pass），但对"正文为空、仅靠 expert_skill 指向 skill 目录"的专家无法触发 skill 加载路径。
- ℹ️ 次要偏差（信息项）：design 决策 3 提到 `@清除专家` / `@专家/清除` 两种写法（`stories/20260618-expert-perspective-at/design.md:103`），当前 `CLEAR_EXPERT_RE` 只匹配前者（`apps/daemon/src/conversation/service.ts:34`）；`@专家/清除` 不被识别。但 UI 控制候选 `insert_text=清除专家`，用户实际只产生 `@清除专家`，无功能缺口。同理 design 决策 5 提到兼容 `identity/{filename}` 单数（`design.md:140`），当前 `EXPERT_MENTION_RE` 只匹配 `identities/` 复数（`service.ts:31`）；但 TreeSidebar/files 均产出复数，无功能缺口。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 当前实现未见团队共享专家库、组织权限、多人协作分发（story 非目标 `stories/20260618-expert-perspective-at/story.md:116`）。
- ✅ 当前实现未见日志自动整理、会议转写、自动化任务、全局搜索、详情页阅读模式自动触发专家视角；专家上下文更新只发生在 `send` 用户消息路径（`apps/daemon/src/conversation/service.ts:243`）。story 非目标 `stories/20260618-expert-perspective-at/story.md:117`。
- ✅ 当前实现未见多专家辩论编排、专家市场、Nuwa 自动蒸馏（story/design 非目标 `stories/20260618-expert-perspective-at/story.md:118`、`design.md:210`-`216`）；多专家只做"最后为主视角、其余参考"（`apps/daemon/src/conversation/service.ts:297`）。
- ✅ r1-r4 遗留的 2 个待裁决项（`dispatchJournalFileOpen` chip 路由、`journal-file-open` 强制切 topics）属 pre-existing app-wide file-open routing，story.md 已显式声明"unrelated to this round's diff"，本轮不纳入核对、不阻塞。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的两套并行实现。根层级专家直出与"专家"虚拟目录都复用 `listExpertIdentities`（`apps/daemon/src/files/service.ts:208`-`219`、`458`-`489`）。
- ✅ 清除专家视角无并行 IPC/状态机；同一路径由候选 `insert_text`、输入框插入、发送前 regex 闭合（`apps/daemon/src/files/service.ts:443`-`453`、`apps/web/src/components/AtMentionMenu.tsx:315`、`apps/daemon/src/conversation/service.ts:257`-`259`）。
- ✅ 专家判定逻辑在 `identity/service.ts` 与 `files/service.ts` 各有一份（`isExpertIdentity` vs `isExpert`），逻辑等价（tag/skill 二选一），是分属不同模块的合理重复，非冗余实现。

## 验证命令（本轮实跑）

```bash
# daemon 专家注入与清除单测
cd apps/daemon && bun run test -- src/conversation/service.test.ts
# → Test Files 1 passed (1) / Tests 6 passed (6) / Duration 859ms   ✅

# web AtMentionMenu 专家候选与清除控制单测
cd apps/web && bun run test -- src/tests/AtMentionMenu.test.tsx
# → Test Files 1 passed (1) / Tests 2 passed (2) / Duration 705ms   ✅
```

## 结论

result: pass。

所有 7 条 AC 在当前 TS daemon + web 实现下均有文件:行级证据与运行通过的测试支撑：
- AC-1/AC-7 由 daemon 单测实证（`service.test.ts` 6/6）；
- AC-2 桥接链路完整且 `TreeSidebar.test.tsx` 覆盖画像 `@` 发出 identity ref；
- AC-3/AC-4 结构性证据充分；
- AC-5 prompt 指令覆盖意图（质量依赖 LLM，非单测可断）；
- AC-6 普通文件不被误识别，pre-existing 路由按 story.md 声明不计入。

r1-r4 的 2 个待裁决项经 story.md 显式声明为 out-of-scope，不再阻塞。

明确 fail 项：0。待用户裁决项：1（expert_skill → load_skill prompt 通路未落实）。

## 待用户裁决

1. **expert_skill 通路简化是否可接受**：design 决策 4 指定 prompt 中应提示"关联 skill 为 `{skill_name}` 时调用 load_skill 加载，失败则用画像正文降级"。当前 TS 实现只注入画像正文，从未读取 `expert_skill`，也未在 prompt 中提示 `load_skill`（`apps/daemon/src/conversation/service.ts:284`-`303`，`apps/daemon/src/conversation` 目录 grep `expert_skill|load_skill|skill_name` 无匹配）。对"正文丰富的专家"无影响（AC-1/AC-5 仍成立），但对"正文为空、仅靠 expert_skill 指向 skill 目录"的专家无法触发 skill 加载。接受则保持现状；不接受则需在 `expertSystemPromptSuffix` 中读取 `entry.expert_skill` 并补 load_skill 提示。证据：`stories/20260618-expert-perspective-at/design.md:122`、`apps/daemon/src/conversation/service.ts:290`-`298`、`apps/daemon/src/identity/service.ts:154`。

**裁定（2026-07-08，主对话）：不接受简化，已补齐。** `expertSystemPromptSuffix` 现在读取 `entry.expert_skill`，非空时在该专家的 prompt 块里加一句"如果关联 skill 为 `{skill_name}`，应先调用 load_skill 加载该 skill 获取完整视角；若无法加载，使用下方画像内容作为降级"，与 design 决策 4 一致。新增测试 `hints load_skill for experts backed by an external skill`（`apps/daemon/src/conversation/service.test.ts`），daemon 全量 293/293 通过。pending 清零。

SUMMARY: result=pass | fail=0 | pending=0（expert_skill → load_skill 提示已补齐并测试覆盖）
