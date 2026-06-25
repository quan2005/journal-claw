---
story: ./story.md
design: ./design.md
date: 2026-06-18
round: 1
result: fail
scope: "读取 /tmp/expert-perspective-at.diff，并核对涉及文件：src-tauri/src/commands/workspace.rs、src-tauri/src/conversation.rs、src-tauri/src/identity.rs、src-tauri/src/main.rs、src-tauri/src/skills.rs、src/App.tsx、src/components/AtMentionMenu.tsx、src/lib/tauri.ts、src/types.ts、src/tests/DetailView.test.tsx、src/tests/TreeSidebar.test.tsx"
---

# 验收报告 - @ 专家视角对话机制

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 输入框 @ 专家名召唤专家视角 | ✅ pass | `src/components/ChatPanel.tsx:268`-`279` 识别输入框 `@` 查询，`src/components/ChatPanel.tsx:711`-`715` 打开 `AtMentionMenu`，`src/components/AtMentionMenu.tsx:127`-`146` 用 query 调 `listAtMentionCandidates`，`src-tauri/src/skills.rs:803`-`817` 按 name/filename/summary/expert_skill/aliases/tags 匹配专家，`src/components/ChatPanel.tsx:305`-`318` 选中后插入 `@{path}`；发送后 `src-tauri/src/conversation.rs:987`-`988` 解析并合并专家上下文，`src-tauri/src/conversation.rs:1008`-`1013` 把专家上下文拼进本轮 system prompt。Rust 测试 `cd src-tauri && cargo test expert` 通过 6 项专家相关测试。 |
| AC-2 画像列表 @ 直接让专家视角进入当前对话 | ✅ pass | `src/components/TreeSidebar.tsx:678`、`src/components/TreeSidebar.tsx:718` 的画像 `@` 传入 `identities/{filename}`；`src/App.tsx:1130`-`1132` 打开右侧面板并派发 `chat-append-text`；`src/components/ChatPanel.tsx:146`-`154` 将该文本追加到输入区。发送后同 AC-1，由 `src-tauri/src/conversation.rs:504`-`545` 只把专家画像解析为 `ExpertContext`。 |
| AC-3 专家作为单一分类可被查找 | ✅ pass | `src-tauri/src/skills.rs:718`-`719` 定义单一虚拟目录 `__experts__` / `专家`；`src-tauri/src/skills.rs:864`-`875` 根层级追加该目录和专家候选；`src-tauri/src/skills.rs:847`-`849` 进入虚拟目录时返回专家候选；`src/components/AtMentionMenu.tsx:31`-`35` 将虚拟路径显示为“专家”；`src/components/AtMentionMenu.tsx:347`-`357` 对专家候选显示“专家”标记。 |
| AC-4 30 秒内找到并 @ 到专家 | ✅ pass | 代码提供可快速定位机制：根层级直接追加专家候选与“专家”目录（`src-tauri/src/skills.rs:864`-`875`），专家搜索覆盖别名、标签、摘要和 skill 名（`src-tauri/src/skills.rs:807`-`817`），选中即插入引用（`src/components/AtMentionMenu.tsx:301`-`309`）。相关 Rust 测试 `skills::tests::expert_candidates_include_expert_identity` 覆盖 alias “教授”命中专家并返回 `identities/研究-犀利教授.md`（`src-tauri/src/skills.rs:666`-`691`）；命令 `cd src-tauri && cargo test expert` 通过。 |
| AC-5 专家回答提供视角差异和洞察 | ✅ pass | `src-tauri/src/conversation.rs:558`-`590` 生成“当前专家视角”system prompt 后缀，要求使用专家思考框架，并给出“判断、盲点提示、反观点或挑战性追问中的至少一种”；`src-tauri/src/conversation.rs:577`-`581` 指示有关联 skill 时调用 `load_skill`，失败则用画像内容降级；`src-tauri/src/conversation.rs:2760`-`2762` 的测试断言 prompt 标记最后专家和 skill name。 |
| AC-6 普通文件 @ 行为不被破坏 | ✅ pass | 普通文件候选仍来自 `list_workspace_dir` 并映射为 `file` / `directory`（`src-tauri/src/skills.rs:851`-`861`）；只有 `identities/` 或 `identity/` 且画像为专家才生成专家上下文（`src-tauri/src/conversation.rs:504`-`545`）；普通身份引用不生成专家上下文的测试在 `src-tauri/src/conversation.rs:2719`-`2735`。命令 `npm test -- src/tests/ChatPanel.test.tsx` 通过 1 项；`npm test -- src/tests/TreeSidebar.test.tsx src/tests/DetailView.test.tsx` 通过 15 项。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 对话输入框 `@`：`ChatPanel` 打开 `AtMentionMenu` 并插入选择结果（`src/components/ChatPanel.tsx:268`-`318`）。
- ✅ 画像列表 `@`：画像项仍以 `identities/{filename}` 追加到当前输入区（`src/components/TreeSidebar.tsx:678`、`src/App.tsx:1130`-`1132`）。
- ✅ 当前会话持续有效：会话新增并持久化 `expert_contexts`（`src-tauri/src/conversation.rs:76`、`src-tauri/src/conversation.rs:123`-`124`、`src-tauri/src/conversation.rs:407`、`src-tauri/src/conversation.rs:1914`），后续 continue 仍拼接专家上下文（`src-tauri/src/conversation.rs:1620`-`1625`）。
- ❌ 清除专家视角缺口：story.md 的已确认 Q3 写明“当前会话持续有效，直到用户切换/清除专家或开启新会话”（`stories/20260618-expert-perspective-at/story.md:118`），design.md 目标同样写明“直到切换/清除或新建会话”（`stories/20260618-expert-perspective-at/design.md:16`）。代码搜索 `rg -n "expert_context|清除专家|clear.*expert|clear.*专家|ExpertContext|merge_expert|system_prompt_with_experts|resolve_expert" src-tauri/src src` 只找到新增、合并、持久化、拼接与新会话置空路径，未找到清除专家上下文的用户操作或命令；核心证据为 `src-tauri/src/conversation.rs:551`-`555` 只 retain 同专家后 push incoming，未提供清空 `expert_contexts` 的分支。
- ✅ 新建会话为空：`conversation_create` 初始化 `expert_contexts: vec![]`（`src-tauri/src/conversation.rs:875`）。

## 方案落实（不偏，对照 design.md）

- ✅ 复用画像 frontmatter：`IdentityEntry` 增加 `aliases`、`expert_skill`、`is_expert`（`src-tauri/src/identity.rs:6`-`20`），frontmatter 解析对应字段（`src-tauri/src/identity.rs:22`-`35`），`tags` 包含“专家”/`expert` 或 `expert_skill` 非空才算专家（`src-tauri/src/identity.rs:103`-`108`）。
- ✅ 新 IPC 已注册：`list_at_mention_candidates` 在命令清单和 Tauri handler 注册（`src-tauri/src/commands/workspace.rs:15`-`19`、`src-tauri/src/main.rs:403`-`404`），前端封装在 `src/lib/tauri.ts:666`-`682`。
- ✅ 候选合并“工作区文件 + 专家”：`list_at_mention_candidates` 复用 `list_workspace_dir` 并追加虚拟“专家”目录和专家候选（`src-tauri/src/skills.rs:851`-`875`）。
- ✅ 发送时解析专家引用并写入会话上下文：`extract_identity_mentions` 兼容 `identities/` 和 `identity/`（`src-tauri/src/conversation.rs:504`-`508`），`resolve_expert_contexts` 只对专家画像生成上下文（`src-tauri/src/conversation.rs:511`-`545`），发送前合并（`src-tauri/src/conversation.rs:987`-`988`）。
- ✅ system prompt 动态后缀：每次 send 和 continue 都调用 `system_prompt_with_experts`（`src-tauri/src/conversation.rs:1008`-`1013`、`src-tauri/src/conversation.rs:1620`-`1625`），没有把专家内容写死到 base prompt。
- ❌ 清除机制未落实：design.md 目标要求“直到切换/清除或新建会话”（`stories/20260618-expert-perspective-at/design.md:16`），但代码范围内无清除 `expert_contexts` 的 IPC、UI 操作或消息语义；同上方 `rg` 命令证据。
- ❌ 前端测试策略未完全落实：design.md 要求 `AtMentionMenu` 可展示专家候选并选中插入 `identities/{filename}`、画像列表点击 `@` 后仍追加输入框（`stories/20260618-expert-perspective-at/design.md:177`-`181`）。代码有实现证据，但 `rg -n "AtMentionMenu|listAtMentionCandidates|@identities|chat-append-text" src/tests` 未找到 `AtMentionMenu` 专项测试，也未找到画像列表 `@` 追加输入框的断言；现有改动仅给 `TreeSidebar.test.tsx` 和 `DetailView.test.tsx` 的 mock 数据补字段（`src/tests/TreeSidebar.test.tsx:33`-`45`、`src/tests/DetailView.test.tsx:362`-`371`）。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 未见团队共享专家库、组织权限、多人协作分发实现；diff 仅涉及画像、`@` 候选、会话 prompt 和测试类型补齐。
- ✅ 未见日志自动整理、会议转写、自动化任务、全局搜索、详情页阅读模式中的专家自动触发；专家解析只在 `conversation_send` 的用户消息路径（`src-tauri/src/conversation.rs:987`-`988`）。
- ✅ 未见多专家辩论编排；prompt 明确“本轮主视角；其他专家仅作为辅助参考”（`src-tauri/src/conversation.rs:567`-`569`），符合 design.md 非目标（`stories/20260618-expert-perspective-at/design.md:201`-`205`）。
- ✅ 未见专家市场/安装管理、Nuwa 自动蒸馏、从零生成专家 Skill；diff 中没有新增管理页面或安装流程。
- ✅ `src/App.tsx:431`-`436` 的 `journal-file-open` 同步打开 topics 侧栏属于可疑旁路改动，但不归属专家机制；该行为不是本 story 非目标命中项，风险较低，建议实现者确认是否为同一批变更的必要修复。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的两套并行实现。专家候选入口有“专家”虚拟目录和根层级专家直出（`src-tauri/src/skills.rs:864`-`875`），但二者复用同一个 `expert_candidates`（`src-tauri/src/skills.rs:803`-`833`），属于同一数据源的两种入口，不是独立重复逻辑。

## 结论

result: fail。

主体链路已经实现：专家画像识别、`@` 搜索/插入、画像列表追加、发送时解析、会话持久化、动态 prompt 后缀、普通文件回归均有代码证据和部分测试证据。

需修复项按风险排序：

1. 补齐“清除专家视角”的用户可操作路径或明确消息语义，并覆盖会话 `expert_contexts` 清空行为；否则当前实现不满足 story/design 中“直到切换/清除或新建会话”的完整条件。
2. 补齐设计测试策略中的前端用例：`AtMentionMenu` 展示专家候选并选中插入 `identities/{filename}`，画像列表点击 `@` 后追加到输入框且不自动发送。

## 待用户裁决

- `src/App.tsx:431`-`436` 的 `journal-file-open` 侧栏切换改动是否纳入本 story：接受的代价是 story/design 需记录该附带行为；不接受的代价是实现者需移出本次改动或说明其与专家 `@` 机制的必要关系。当前按低风险越界疑点记录，但不作为本轮主要 fail 项。
