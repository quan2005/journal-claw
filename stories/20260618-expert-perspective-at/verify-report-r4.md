---
story: ./story.md
design: ./design.md
date: 2026-06-21
round: 4
result: fail
scope: "/tmp/expert-perspective-at-r4.diff；新增文件 src/tests/AtMentionMenu.test.tsx；复读 verify-report.md、verify-report-r2.md、verify-report-r3.md 并重点复核 r3 fail/待裁决项"
---

# 验收报告 - @ 专家视角对话机制

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 输入框 @ 专家名召唤专家视角 | ✅ pass | story 要求输入框 `@专家名` 选择并发送后进入专家视角，且不手写 prompt（`stories/20260618-expert-perspective-at/story.md:59`-`63`）。输入框检测 `@` 并记录 query（`src/components/ChatPanel.tsx:268`-`279`），选中菜单项后插入 `@{path}` / `@{insert_text}`（`src/components/ChatPanel.tsx:305`-`318`）；菜单从 `listAtMentionCandidates` 加载候选（`src/components/AtMentionMenu.tsx:127`-`146`）。发送前更新专家上下文并把专家上下文拼入 system prompt（`src-tauri/src/conversation.rs:1007`-`1037`）。 |
| AC-2 画像列表 @ 直接让专家视角进入当前对话 | ✅ pass | story 要求画像列表点击 `@` 后输入区出现可发送专家引用，发送后生效（`stories/20260618-expert-perspective-at/story.md:65`-`69`）。画像列表发出 `identities/{filename}`（`src/components/TreeSidebar.tsx:670`-`679`、`src/components/TreeSidebar.tsx:711`-`719`）；`App` 打开右侧面板并派发 `chat-append-text`（`src/App.tsx:1130`-`1132`）；`ChatPanel` 只追加到输入框并聚焦（`src/components/ChatPanel.tsx:146`-`164`）。测试覆盖追加后不自动发送、补问题后发送完整引用（`src/tests/ChatPanel.test.tsx:88`-`115`）。 |
| AC-3 专家作为单一分类可被查找 | ✅ pass | story 要求统一“专家”分类，不继续按产品/架构/商业等细分（`stories/20260618-expert-perspective-at/story.md:71`-`75`）。后端只定义一个 `__experts__` / `专家` 虚拟目录（`src-tauri/src/skills.rs:738`-`741`），根层级追加该目录，进入该目录返回专家候选（`src-tauri/src/skills.rs:911`-`945`）；前端把虚拟目录显示为“专家”并给专家候选显示单一“专家”标记（`src/components/AtMentionMenu.tsx:31`-`35`、`src/components/AtMentionMenu.tsx:347`-`357`）。 |
| AC-4 30 秒内找到并 @ 到专家 | ✅ pass | story 要求从对话或画像入口 30 秒内找到并 `@` 到合适专家（`stories/20260618-expert-perspective-at/story.md:77`-`80`）。根层级可直接进入“专家”并按 query 返回专家候选（`src-tauri/src/skills.rs:929`-`945`）；搜索覆盖 name、filename、summary、expert_skill、aliases、tags（`src-tauri/src/skills.rs:825`-`838`）；Rust 测试用 alias “教授”命中专家并返回 `identities/研究-犀利教授.md`（`src-tauri/src/skills.rs:671`-`692`）；画像列表入口测试可一键发出 identity ref（`src/tests/TreeSidebar.test.tsx:120`-`127`）。 |
| AC-5 专家回答提供视角差异和洞察 | ✅ pass | story 要求回答体现专家框架、关注点或追问方式，并至少提供盲点、反观点、挑战性追问或明确判断之一（`stories/20260618-expert-perspective-at/story.md:82`-`86`）。prompt 后缀要求使用专家思考框架，并给出判断、盲点提示、反观点或挑战性追问中的至少一种（`src-tauri/src/conversation.rs:578`-`610`）；有关联 skill 时提示调用 `load_skill`，失败时使用画像内容降级（`src-tauri/src/conversation.rs:597`-`605`）。测试断言最后一个专家为主视角并包含 skill name（`src-tauri/src/conversation.rs:2798`-`2823`）。 |
| AC-6 普通文件 @ 行为不被破坏 | ⚠️ 待裁决 | story 要求普通文件引用仍可用且不被误识别为专家（`stories/20260618-expert-perspective-at/story.md:88`-`92`）。普通候选仍由 `list_workspace_dir` 映射为 `file` / `directory`（`src-tauri/src/skills.rs:915`-`927`）；只有 `identities/` / `identity/` 且画像为专家时才生成专家上下文（`src-tauri/src/conversation.rs:504`-`557`），普通画像不生成专家上下文测试存在（`src-tauri/src/conversation.rs:2743`-`2760`）。但 r3 待裁决的普通文件 chip 打开方式变更仍在当前代码中：`ChatPanel` 用户消息里的普通文件 chip 点击派发 `dispatchJournalFileOpen(path)`（`src/components/ChatPanel.tsx:1224`-`1236`），该函数触发 `journal-file-open` 事件（`src/lib/fileNavigation.ts:22`-`27`），会进入 `App` 的 topic-file 选择路径（`src/App.tsx:420`-`435`）。这可解释为普通文件体验维护，也可视为超出 AC-6 的行为改动，需用户裁决。 |
| AC-7 可清除当前会话专家视角 | ✅ pass | story 要求通过 `@` 选择“清除专家视角”并发送后移除当前会话专家上下文（`stories/20260618-expert-perspective-at/story.md:94`-`98`）。专家目录提供“清除专家视角”，`path=__experts__/clear`、`insert_text=清除专家`（`src-tauri/src/skills.rs:859`-`882`）；菜单选中时使用 `insert_text`（`src/components/AtMentionMenu.tsx:193`-`200`、`src/components/AtMentionMenu.tsx:300`-`309`）；发送前识别 `@清除专家` / `@专家/清除` 并先清空上下文（`src-tauri/src/conversation.rs:511`-`575`）。测试覆盖 clear control 插入和清除后再应用新专家（`src/tests/AtMentionMenu.test.tsx:47`-`67`、`src-tauri/src/conversation.rs:2762`-`2796`）。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 对话输入框入口完整：story 覆盖输入框 `@专家名`（`stories/20260618-expert-perspective-at/story.md:30`、`stories/20260618-expert-perspective-at/story.md:59`-`63`）；代码有输入检测、菜单加载、选择插入、发送解析和 prompt 注入（`src/components/ChatPanel.tsx:268`-`318`、`src/components/AtMentionMenu.tsx:127`-`146`、`src-tauri/src/conversation.rs:1007`-`1037`）。
- ✅ 画像列表入口完整：story 覆盖画像列表 `@`（`stories/20260618-expert-perspective-at/story.md:30`、`stories/20260618-expert-perspective-at/story.md:65`-`69`）；代码从画像列表发出 `identities/{filename}` 并追加到输入框（`src/components/TreeSidebar.tsx:678`、`src/components/TreeSidebar.tsx:718`、`src/App.tsx:1130`-`1132`、`src/components/ChatPanel.tsx:146`-`164`）。
- ✅ 当前会话持续有效并可清除：story 已确认当前会话持续到切换/清除专家或新会话（`stories/20260618-expert-perspective-at/story.md:123`-`125`）；会话持久化 `expert_contexts`（`src-tauri/src/conversation.rs:76`、`src-tauri/src/conversation.rs:124`、`src-tauri/src/conversation.rs:1938`），send/continue 每轮拼接（`src-tauri/src/conversation.rs:1032`-`1037`、`src-tauri/src/conversation.rs:1644`-`1649`），清除消息会清空后再应用同条消息的新专家（`src-tauri/src/conversation.rs:566`-`575`）。
- ✅ 新会话为空：design 要求新建会话为空（`stories/20260618-expert-perspective-at/design.md:102`-`106`）；创建会话初始化 `expert_contexts: vec![]`（`src-tauri/src/conversation.rs:892`-`895`）。

## 方案落实（不偏，对照 design.md）

- ✅ 数据契约落实：design 要求画像 frontmatter 支持 `tags`、`expert_skill`、`aliases`，并由 `tags: ["专家"]` / `expert` 或 `expert_skill` 激活（`stories/20260618-expert-perspective-at/design.md:31`-`45`）。`IdentityEntry` 与 frontmatter 解析增加字段（`src-tauri/src/identity.rs:14`-`31`），激活规则为 tag/skill 二选一（`src-tauri/src/identity.rs:103`-`108`），列表输出字段（`src-tauri/src/identity.rs:220`-`230`），测试覆盖 tag/skill 与字段保留（`src-tauri/src/identity.rs:544`-`565`）。
- ✅ 新 IPC 与候选聚合落实：design 要求 `list_at_mention_candidates(relative_path, query)` 聚合工作区文件和专家（`stories/20260618-expert-perspective-at/design.md:49`-`75`）。命令清单、Tauri handler 和前端封装均存在（`src-tauri/src/commands/workspace.rs:18`、`src-tauri/src/main.rs:404`、`src/lib/tauri.ts:683`）；后端复用 `list_workspace_dir` 并追加专家目录、专家候选和清除控制（`src-tauri/src/skills.rs:900`-`948`）。
- ✅ 会话专家上下文落实：design 要求发送前解析专家引用、去重、清除、新建为空、持久化（`stories/20260618-expert-perspective-at/design.md:77`-`106`）。代码兼容 `identities/` 与 `identity/`（`src-tauri/src/conversation.rs:504`-`508`），只对专家画像生成上下文（`src-tauri/src/conversation.rs:519`-`557`），重复专家 retain 后 push（`src-tauri/src/conversation.rs:559`-`563`），清除后再合并新专家（`src-tauri/src/conversation.rs:566`-`575`）。
- ✅ system prompt 动态后缀落实：design 要求每次 LLM 调用前拼接专家上下文，不写死 base prompt（`stories/20260618-expert-perspective-at/design.md:108`-`133`、`stories/20260618-expert-perspective-at/design.md:206`-`208`）。代码用 `system_prompt_with_experts` 拼接 send/continue 本轮 prompt（`src-tauri/src/conversation.rs:613`-`615`、`src-tauri/src/conversation.rs:1032`-`1037`、`src-tauri/src/conversation.rs:1644`-`1649`）。
- ✅ 前端测试策略落实：design 要求 AtMentionMenu 专家候选、清除候选、画像列表追加输入框、不自动发送（`stories/20260618-expert-perspective-at/design.md:182`-`187`）。当前新增 `AtMentionMenu` 测试覆盖专家选择和清除 insert_text（`src/tests/AtMentionMenu.test.tsx:22`-`67`），`TreeSidebar` 覆盖画像列表 `@` 发出 identity ref（`src/tests/TreeSidebar.test.tsx:120`-`127`），`ChatPanel` 覆盖追加不自动发送并最终发送（`src/tests/ChatPanel.test.tsx:88`-`115`）。
- ✅ 验证命令落实：design 当前明列 `npm test -- src/tests/AtMentionMenu.test.tsx src/tests/ChatPanel.test.tsx src/tests/TreeSidebar.test.tsx`、`npm run build`、`cd src-tauri && cargo test expert`（`stories/20260618-expert-perspective-at/design.md:189`-`195`），并声明完整 `cargo test` 的 MDX 语料失败不作为本 story 放行条件（`stories/20260618-expert-perspective-at/design.md:197`-`200`）。本轮命令结果：`npm test -- src/tests/AtMentionMenu.test.tsx src/tests/ChatPanel.test.tsx src/tests/TreeSidebar.test.tsx` 通过 3 个文件 9 项；`npm run build` 通过；`cd src-tauri && cargo test expert` 通过 9 项。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ r4 diff 本身未见团队共享专家库、组织权限、多人协作分发实现；story 明确不做这些（`stories/20260618-expert-perspective-at/story.md:102`），r4 diff 文件范围集中在画像字段、候选聚合、对话上下文、AtMentionMenu、类型与测试（`/tmp/expert-perspective-at-r4.diff:1`、`/tmp/expert-perspective-at-r4.diff:13`、`/tmp/expert-perspective-at-r4.diff:387`、`/tmp/expert-perspective-at-r4.diff:559`、`/tmp/expert-perspective-at-r4.diff:891`、`/tmp/expert-perspective-at-r4.diff:1030`、`/tmp/expert-perspective-at-r4.diff:1060`、`/tmp/expert-perspective-at-r4.diff:1112`、`/tmp/expert-perspective-at-r4.diff:1142`、`/tmp/expert-perspective-at-r4.diff:1156`）。
- ✅ r4 diff 本身未见日志自动整理、会议转写、自动化任务、全局搜索、详情页阅读模式自动触发专家视角；story 明确不要求这些（`stories/20260618-expert-perspective-at/story.md:103`），专家上下文更新只发生在 `conversation_send` 用户消息路径（`src-tauri/src/conversation.rs:1007`-`1012`）。
- ✅ r4 diff 本身未见多专家辩论、专家市场/安装管理、Nuwa 自动蒸馏或从零生成专家 Skill；story/design 均列为非目标（`stories/20260618-expert-perspective-at/story.md:104`、`stories/20260618-expert-perspective-at/design.md:210`-`216`），实现只把最后一个专家作为主视角、其他专家辅助参考（`src-tauri/src/conversation.rs:583`-`589`）。
- ⚠️ 待用户裁决：r3 已记录 `ChatPanel` 普通文件 chip 从 `openFile(path)` 改为 `dispatchJournalFileOpen(path)` 的灰区（`stories/20260618-expert-perspective-at/verify-report-r3.md:45`、`stories/20260618-expert-perspective-at/verify-report-r3.md:63`）。当前代码仍存在该行为（`src/components/ChatPanel.tsx:1224`-`1236`、`src/lib/fileNavigation.ts:22`-`27`）。r4 diff 未显示移除该路径；可复现命令 `rg -n "src/components/ChatPanel.tsx|src/lib/fileNavigation.ts|dispatchJournalFileOpen" /tmp/expert-perspective-at-r4.diff` 无输出。接受代价：把普通文件 chip 应用内路由纳入 design；不接受代价：移出本 story 或恢复原行为。
- ⚠️ 待用户裁决：r2/r3 已记录 `journal-file-open` 强制切到 topics 并打开左侧栏无法归属本 story（`stories/20260618-expert-perspective-at/verify-report-r2.md:46`、`stories/20260618-expert-perspective-at/verify-report-r2.md:64`、`stories/20260618-expert-perspective-at/verify-report-r3.md:46`、`stories/20260618-expert-perspective-at/verify-report-r3.md:64`）。当前代码仍存在 `setActiveCategory('topics')` 与 `setLeftSidebarOpen(true)`（`src/App.tsx:420`-`435`）。r4 diff 未显示移除该路径；可复现命令 `rg -n "setActiveCategory|setLeftSidebarOpen" /tmp/expert-perspective-at-r4.diff` 无相关输出。接受代价：把该 in-app 路由/侧栏行为并入 story/design；不接受代价：移出或拆分到其他 story。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的两套并行实现。根层级专家直出与“专家”虚拟目录都复用 `expert_mention_candidates` / `expert_candidates`（`src-tauri/src/skills.rs:825`-`897`、`src-tauri/src/skills.rs:911`-`945`），不是两套独立逻辑。
- ✅ 清除专家视角没有额外 IPC / 状态机并行实现；同一路径由候选 `insert_text`、输入框插入和发送前解析闭合（`src-tauri/src/skills.rs:859`-`882`、`src/components/AtMentionMenu.tsx:300`-`309`、`src-tauri/src/conversation.rs:511`-`575`）。

## 结论

result: fail。

r3 中的 AC 主链路和验证命令问题在当前契约下仍为通过：清除专家视角链路、前端测试策略、三条 design 验证命令均有证据。r4 diff 本身未发现新的明确越界。

阻塞项来自 r3 遗留的 2 个待用户裁决，当前代码仍保留对应行为，且 r4 diff 未显示移出或契约回写。按六字标准，待裁决项按保守原则计 fail，因此本轮不应翻 `status: verified`。

明确 fail 项：0。待用户裁决项：2。

## 待用户裁决

1. `ChatPanel` 普通文件 chip 改为 `dispatchJournalFileOpen(path)` 是否属于本 story 的 AC-6 普通文件回归保护。接受则需把普通文件 chip 应用内路由写入 design；不接受则移出本 story 或恢复原行为。证据：`stories/20260618-expert-perspective-at/verify-report-r3.md:63`、`src/components/ChatPanel.tsx:1224`-`1236`、`src/lib/fileNavigation.ts:22`-`27`。
2. `journal-file-open` 强制切到 topics 并打开左侧栏是否纳入本 story。接受则需回写 story/design；不接受则移出或拆 story。证据：`stories/20260618-expert-perspective-at/verify-report-r2.md:64`、`stories/20260618-expert-perspective-at/verify-report-r3.md:64`、`src/App.tsx:420`-`435`。
