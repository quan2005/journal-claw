---
story: ./story.md
design: ./design.md
date: 2026-06-21
round: 3
result: fail
scope: "/tmp/expert-perspective-at-r3.diff；新增文件 src/tests/AtMentionMenu.test.tsx；复读 verify-report.md 与 verify-report-r2.md"
---

# 验收报告 - @ 专家视角对话机制

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 输入框 @ 专家名召唤专家视角 | ✅ pass | story 要求输入框 `@专家名` 选择并发送后进入专家视角（`stories/20260618-expert-perspective-at/story.md:59`-`63`）。输入框检测 `@` 并打开菜单（`src/components/ChatPanel.tsx:268`-`279`、`src/components/ChatPanel.tsx:711`-`715`）；菜单调用 `listAtMentionCandidates` 并选中插入 `@{path}` / `@{insert_text}`（`src/components/AtMentionMenu.tsx:127`-`146`、`src/components/AtMentionMenu.tsx:193`-`200`、`src/components/ChatPanel.tsx:305`-`318`）；专家画像发送前写入会话并拼入 system prompt（`src-tauri/src/conversation.rs:1007`-`1037`）。 |
| AC-2 画像列表 @ 直接让专家视角进入当前对话 | ✅ pass | story 要求画像 `@` 后当前输入区出现可发送专家引用且发送后生效（`stories/20260618-expert-perspective-at/story.md:65`-`69`）。画像列表 `@` 传 `identities/{filename}`（`src/components/TreeSidebar.tsx:678`、`src/components/TreeSidebar.tsx:718`）；`App` 派发 `chat-append-text` 到聊天输入（`src/App.tsx:1130`-`1132`）；`ChatPanel` 仅追加文本并聚焦，不自动发送（`src/components/ChatPanel.tsx:146`-`164`）；测试覆盖追加后不自动发送、补问题后再发送（`src/tests/ChatPanel.test.tsx:88`-`115`）。 |
| AC-3 专家作为单一分类可被查找 | ✅ pass | story 要求统一“专家”分类，不继续细分（`stories/20260618-expert-perspective-at/story.md:71`-`75`）。后端只定义一个 `__experts__` / `专家` 虚拟目录（`src-tauri/src/skills.rs:738`-`741`）；根层级追加该目录，进入目录返回专家候选（`src-tauri/src/skills.rs:900`-`948`）；前端把虚拟路径显示为“专家”，专家候选只显示“专家”标记（`src/components/AtMentionMenu.tsx:31`-`35`、`src/components/AtMentionMenu.tsx:347`-`357`）。 |
| AC-4 30 秒内找到并 @ 到专家 | ✅ pass | story 要求从对话或画像入口 30 秒内找到并 `@` 到合适专家（`stories/20260618-expert-perspective-at/story.md:77`-`80`）。根层级可直接进入“专家”或按 query 返回专家候选（`src-tauri/src/skills.rs:929`-`945`）；搜索覆盖 name/filename/summary/skill/aliases/tags（`src-tauri/src/skills.rs:825`-`839`）；Rust 测试用 alias “教授”命中专家并返回 `identities/研究-犀利教授.md`（`src-tauri/src/skills.rs:670`-`692`）；画像列表入口测试可一键发出 identity ref（`src/tests/TreeSidebar.test.tsx:120`-`127`）。 |
| AC-5 专家回答提供视角差异和洞察 | ✅ pass | story 要求回答体现专家框架、关注点或追问方式，并至少有盲点/反观点/挑战追问/明确判断之一（`stories/20260618-expert-perspective-at/story.md:82`-`86`）。system prompt 后缀要求使用专家思考框架，并给出判断、盲点提示、反观点或挑战性追问中的至少一种（`src-tauri/src/conversation.rs:578`-`610`）；有关联 skill 时提示调用 `load_skill`，失败时用画像内容降级（`src-tauri/src/conversation.rs:597`-`605`）；测试断言最后专家为主视角且包含 skill name（`src-tauri/src/conversation.rs:2798`-`2823`）。 |
| AC-6 普通文件 @ 行为不被破坏 | ✅ pass | story 要求普通文件引用仍可用且不被误识别为专家（`stories/20260618-expert-perspective-at/story.md:88`-`92`）。普通工作区候选仍由 `list_workspace_dir` 映射为 `file` / `directory`（`src-tauri/src/skills.rs:915`-`927`）；只有 `identities/` / `identity/` 且画像 `is_expert` 的引用生成专家上下文（`src-tauri/src/conversation.rs:519`-`557`）；普通画像不生成专家上下文测试通过（`src-tauri/src/conversation.rs:2743`-`2760`）；现有普通文件发送测试仍断言 `@/workspace/...txt` 发送路径（`src/tests/ChatPanel.test.tsx:59`-`86`）。 |
| AC-7 可清除当前会话专家视角 | ✅ pass | story 要求通过 `@` 选择“清除专家视角”并发送后移除当前会话专家上下文（`stories/20260618-expert-perspective-at/story.md:94`-`98`）。专家目录提供“清除专家视角”，`path=__experts__/clear`、`insert_text=清除专家`（`src-tauri/src/skills.rs:859`-`882`）；菜单选中使用 `insert_text`（`src/components/AtMentionMenu.tsx:193`-`200`、`src/components/AtMentionMenu.tsx:304`-`309`）；发送前识别 `@清除专家` / `@专家/清除` 并先清空上下文（`src-tauri/src/conversation.rs:511`-`575`）；测试覆盖 clear control 插入与清除后再应用新专家（`src/tests/AtMentionMenu.test.tsx:47`-`67`、`src-tauri/src/conversation.rs:2762`-`2796`）。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 对话输入框入口完整：story 范围覆盖输入框 `@`（`stories/20260618-expert-perspective-at/story.md:30`、`stories/20260618-expert-perspective-at/story.md:59`-`63`）；代码有输入检测、菜单、选择插入、发送解析和 prompt 注入（`src/components/ChatPanel.tsx:268`-`318`、`src/components/AtMentionMenu.tsx:127`-`146`、`src-tauri/src/conversation.rs:1007`-`1037`）。
- ✅ 画像列表入口完整：story 范围覆盖画像列表 `@`（`stories/20260618-expert-perspective-at/story.md:30`、`stories/20260618-expert-perspective-at/story.md:65`-`69`）；代码从画像列表发出 `identities/{filename}` 并追加到输入框（`src/components/TreeSidebar.tsx:678`、`src/components/TreeSidebar.tsx:718`、`src/App.tsx:1130`-`1132`、`src/components/ChatPanel.tsx:146`-`164`）。
- ✅ 当前会话持续有效并可清除：已确认默认值要求“当前会话持续有效，直到用户切换/清除专家或开启新会话”（`stories/20260618-expert-perspective-at/story.md:123`-`125`）；会话持久化 `expert_contexts`（`src-tauri/src/conversation.rs:61`-`77`、`src-tauri/src/conversation.rs:111`-`124`、`src-tauri/src/conversation.rs:1926`-`1939`），send/continue 每轮拼接（`src-tauri/src/conversation.rs:1032`-`1037`、`src-tauri/src/conversation.rs:1644`-`1649`），清除消息会清空（`src-tauri/src/conversation.rs:566`-`575`）。
- ✅ 新会话为空：design 要求新建会话为空（`stories/20260618-expert-perspective-at/design.md:102`-`106`）；创建会话初始化 `expert_contexts: vec![]`（`src-tauri/src/conversation.rs:892`-`895`）。

## 方案落实（不偏，对照 design.md）

- ✅ 数据契约落实：design 要求画像 frontmatter 支持 `tags`、`expert_skill`、`aliases` 并由 `tags: ["专家"]` / `expert` 或 `expert_skill` 激活（`stories/20260618-expert-perspective-at/design.md:31`-`45`）。`IdentityEntry` 与 frontmatter 解析增加对应字段（`src-tauri/src/identity.rs:6`-`35`），`is_expert_identity` 实现激活规则（`src-tauri/src/identity.rs:103`-`108`），列表输出字段（`src-tauri/src/identity.rs:220`-`230`），测试覆盖 tag/skill 与字段保留（`src-tauri/src/identity.rs:542`-`565`）。
- ✅ 新 IPC 与候选聚合落实：design 要求 `list_at_mention_candidates(relative_path, query)` 聚合工作区文件和专家（`stories/20260618-expert-perspective-at/design.md:49`-`75`）。命令清单与 Tauri handler 注册（`src-tauri/src/commands/workspace.rs:15`-`19`、`src-tauri/src/main.rs:403`-`404`）；前端类型与封装同步（`src/lib/tauri.ts:666`-`683`）；后端复用 `list_workspace_dir` 并追加专家目录、专家候选和清除控制（`src-tauri/src/skills.rs:900`-`948`）。
- ✅ 会话专家上下文落实：design 要求发送前解析专家引用、去重、清除、新建为空、持久化（`stories/20260618-expert-perspective-at/design.md:77`-`106`）。代码兼容 `identities/` 与 `identity/`（`src-tauri/src/conversation.rs:504`-`508`），只对专家画像生成上下文（`src-tauri/src/conversation.rs:519`-`557`），重复专家 retain 后 push（`src-tauri/src/conversation.rs:559`-`563`），清除后再合并新专家（`src-tauri/src/conversation.rs:566`-`575`）。
- ✅ system prompt 动态后缀落实：design 要求每次 LLM 调用前拼接专家上下文，不写死 base prompt（`stories/20260618-expert-perspective-at/design.md:108`-`133`、`stories/20260618-expert-perspective-at/design.md:206`-`208`）。代码用 `system_prompt_with_experts` 拼接 send/continue 本轮 prompt（`src-tauri/src/conversation.rs:613`-`615`、`src-tauri/src/conversation.rs:1032`-`1037`、`src-tauri/src/conversation.rs:1644`-`1649`）。
- ✅ 前端测试策略落实 r1 fail：r1 明确缺 AtMentionMenu 专项测试与画像列表追加输入框断言（`stories/20260618-expert-perspective-at/verify-report.md:38`-`39`、`stories/20260618-expert-perspective-at/verify-report.md:59`-`62`）；当前新增测试覆盖专家候选、清除候选、画像列表 `@` 与 ChatPanel 追加不自动发送（`src/tests/AtMentionMenu.test.tsx:22`-`67`、`src/tests/TreeSidebar.test.tsx:120`-`127`、`src/tests/ChatPanel.test.tsx:88`-`115`）。
- ✅ 验证命令落实：design 当前明列 `npm test -- src/tests/AtMentionMenu.test.tsx src/tests/ChatPanel.test.tsx src/tests/TreeSidebar.test.tsx`、`npm run build`、`cd src-tauri && cargo test expert`（`stories/20260618-expert-perspective-at/design.md:189`-`195`），并声明完整 `cargo test` 的 MDX 语料失败不作为本 story 放行条件（`stories/20260618-expert-perspective-at/design.md:197`-`200`）。本轮命令结果：`npm test -- src/tests/AtMentionMenu.test.tsx src/tests/ChatPanel.test.tsx src/tests/TreeSidebar.test.tsx` 通过 3 个文件 9 项；`npm run build` 通过；`cd src-tauri && cargo test expert` 通过 9 项。额外取证：完整 `cd src-tauri && cargo test` 仍失败于 `mdx::tests::compiles_repository_mdx_examples`，输出 `repository MDX corpus count drifted`、`left: 3`、`right: 113`，与 design 排除项一致。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 未见团队共享专家库、组织权限、多人协作分发实现；story 明确不做这些（`stories/20260618-expert-perspective-at/story.md:102`），r3 diff 归属画像字段、`@` 候选、会话 prompt、前端插入与测试（`/tmp/expert-perspective-at-r3.diff:9`、`/tmp/expert-perspective-at-r3.diff:29`-`47`、`/tmp/expert-perspective-at-r3.diff:740`-`838`、`/tmp/expert-perspective-at-r3.diff:1038`-`1182`）。
- ✅ 未见日志自动整理、会议转写、自动化任务、全局搜索、详情页阅读模式自动触发专家视角；story 明确不要求这些（`stories/20260618-expert-perspective-at/story.md:103`），专家上下文更新只发生在 conversation send 用户消息路径（`src-tauri/src/conversation.rs:1007`-`1012`）。
- ✅ 未见多专家辩论、专家市场/安装管理、Nuwa 自动蒸馏或从零生成专家 Skill；story/design 均列为非目标（`stories/20260618-expert-perspective-at/story.md:104`、`stories/20260618-expert-perspective-at/design.md:210`-`216`），实现只把最后一个专家作为主视角、其他专家辅助参考（`src-tauri/src/conversation.rs:583`-`589`）。
- ⚠️ 待用户裁决：r3 diff 将 ChatPanel 用户消息里的普通文件 chip 点击从 `openFile(path)` 改为 `dispatchJournalFileOpen(path)`（`/tmp/expert-perspective-at-r3.diff:1038`、`/tmp/expert-perspective-at-r3.diff:1055`-`1056`；当前代码 `src/components/ChatPanel.tsx:1224`-`1236`）。这会从直接调用 Tauri 打开文件变为派发 `journal-file-open` 事件（`src/lib/fileNavigation.ts:22`-`27`），再由 App 进入 topic-file 选择流程（`src/App.tsx:420`-`435`）。它可被解释为 AC-6 “普通文件 @ 行为不被破坏”的普通文件体验维护（`stories/20260618-expert-perspective-at/story.md:88`-`92`，design 测试策略 `stories/20260618-expert-perspective-at/design.md:187`），但 design 影响面没有列 `src/lib/fileNavigation.ts`，也未要求改变普通文件 chip 的打开方式（`stories/20260618-expert-perspective-at/design.md:144`-`161`）。接受代价：将普通文件 chip 改为应用内路由纳入 design；不接受代价：移出本 story 或另开 story。
- ⚠️ 待用户裁决：r2 已记录 `journal-file-open` 强制 `setActiveCategory('topics')` 与 `setLeftSidebarOpen(true)` 无法归属本 story（`stories/20260618-expert-perspective-at/verify-report-r2.md:46`、`stories/20260618-expert-perspective-at/verify-report-r2.md:64`）；当前代码仍存在该行为（`src/App.tsx:433`-`435`）。r3 diff 本身未显示这几行新增（`rg -n "setActiveCategory\\('topics'\\)|setLeftSidebarOpen\\(true\\)" /tmp/expert-perspective-at-r3.diff` 无输出），但 r3 新增的 ChatPanel `dispatchJournalFileOpen` 会复用该路径（`/tmp/expert-perspective-at-r3.diff:1055`-`1056`）。接受代价：把该 in-app 路由行为并入本 story/design；不接受代价：恢复普通文件 chip 原打开方式，或把侧栏切换行为拆出。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的两套并行实现。专家候选的根层级直出与“专家”虚拟目录都复用 `expert_mention_candidates` / `expert_candidates`（`src-tauri/src/skills.rs:825`-`897`、`src-tauri/src/skills.rs:911`-`945`），不是两套独立逻辑。
- ✅ 清除专家视角没有额外 IPC / 状态机并行实现；同一路径由候选 `insert_text`、输入框插入和发送前解析闭合（`src-tauri/src/skills.rs:859`-`882`、`src/components/AtMentionMenu.tsx:304`-`309`、`src-tauri/src/conversation.rs:511`-`575`）。

## 结论

result: fail。

r2 的明确 fail 项已按当前契约完成复查：清除专家视角链路已补齐，前端测试策略已补齐，当前 design 明列的三条验证命令均通过。完整 `cargo test` 仍有 MDX 基线失败，但 current design 明确排除为本 story 之外。

本轮没有发现 AC 主链路缺实现或测试命令失败；阻塞来自“待用户裁决”项。按六字标准，待裁决项按保守原则计 fail，因此本轮不应翻 `status: verified`。

## 待用户裁决

1. r3 diff 中 `ChatPanel` 普通文件 chip 从 `openFile(path)` 改为 `dispatchJournalFileOpen(path)` 是否属于本 story 的 AC-6 普通文件回归保护。接受则需把普通文件 chip 应用内路由写入 design；不接受则移出本 story或恢复原行为。证据：`/tmp/expert-perspective-at-r3.diff:1055`-`1056`、`src/components/ChatPanel.tsx:1233`-`1236`、`src/lib/fileNavigation.ts:22`-`27`。
2. r2 遗留的 `journal-file-open` 强制切到 topics 并打开左侧栏是否纳入本 story。接受则需回写 story/design；不接受则移出或拆 story。证据：`stories/20260618-expert-perspective-at/verify-report-r2.md:46`、`src/App.tsx:433`-`435`。
