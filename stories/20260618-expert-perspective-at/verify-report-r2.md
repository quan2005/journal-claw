---
story: ./story.md
design: ./design.md
date: 2026-06-18
round: 2
result: fail
scope: "git diff -- story.md design.md src-tauri/src/commands/workspace.rs src-tauri/src/conversation.rs src-tauri/src/identity.rs src-tauri/src/main.rs src-tauri/src/skills.rs src/App.tsx src/components/AtMentionMenu.tsx src/components/ChatPanel.tsx src/lib/tauri.ts src/types.ts src/tests/AtMentionMenu.test.tsx src/tests/ChatPanel.test.tsx src/tests/DetailView.test.tsx src/tests/TreeSidebar.test.tsx；另核对未跟踪的 src/tests/AtMentionMenu.test.tsx"
---

# 验收报告 - @ 专家视角对话机制

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 输入框 @ 专家名召唤专家视角 | ✅ pass | 输入框识别 `@` 查询并打开菜单（`src/components/ChatPanel.tsx:268`-`279`、`src/components/ChatPanel.tsx:711`-`715`）；菜单调用 `listAtMentionCandidates` 并选中后插入 `@{path}`（`src/components/AtMentionMenu.tsx:127`-`146`、`src/components/ChatPanel.tsx:305`-`318`）；专家候选按名称、文件名、摘要、skill、aliases、tags 匹配（`src-tauri/src/skills.rs:825`-`839`）；发送前更新专家上下文并拼入本轮 system prompt（`src-tauri/src/conversation.rs:1007`-`1037`）。 |
| AC-2 画像列表 @ 直接让专家视角进入当前对话 | ✅ pass | 画像列表 `@` 传入 `identities/{filename}`（`src/components/TreeSidebar.tsx:678`、`src/components/TreeSidebar.tsx:718`）；`App` 打开右侧面板并派发 `chat-append-text`（`src/App.tsx:1130`-`1132`）；`ChatPanel` 只追加到输入区并聚焦（`src/components/ChatPanel.tsx:146`-`164`）；测试覆盖追加后不自动发送、用户补问题后发送完整引用（`src/tests/ChatPanel.test.tsx:88`-`115`）。 |
| AC-3 专家作为单一分类可被查找 | ✅ pass | 后端只定义一个虚拟专家目录 `__experts__` / `专家`（`src-tauri/src/skills.rs:738`-`741`）；根层级追加该目录，进入该目录返回专家候选（`src-tauri/src/skills.rs:911`-`945`）；前端面包屑把虚拟目录显示为“专家”（`src/components/AtMentionMenu.tsx:31`-`35`），专家候选显示单一“专家”标记（`src/components/AtMentionMenu.tsx:347`-`357`）。 |
| AC-4 30 秒内找到并 @ 到专家 | ✅ pass | 根层级直接补充专家目录和按 query 过滤的专家候选（`src-tauri/src/skills.rs:929`-`945`）；搜索覆盖 alias/tag/summary/skill/name/filename（`src-tauri/src/skills.rs:825`-`839`）；选中候选直接插入引用或 insert_text（`src/components/AtMentionMenu.tsx:301`-`309`）。Rust 测试用 alias “教授”命中专家并返回 `identities/研究-犀利教授.md`（`src-tauri/src/skills.rs:670`-`692`）。 |
| AC-5 专家回答提供视角差异和洞察 | ✅ pass | system prompt 后缀声明本轮主视角，要求使用思考框架，并给出判断、盲点、反观点或挑战性追问之一（`src-tauri/src/conversation.rs:578`-`610`）；有关联 skill 时要求调用 `load_skill`，失败则用画像内容降级（`src-tauri/src/conversation.rs:597`-`605`）；测试断言最后专家为主视角且包含 skill name（`src-tauri/src/conversation.rs:2798`-`2823`）。 |
| AC-6 普通文件 @ 行为不被破坏 | ✅ pass | 普通工作区候选仍由 `list_workspace_dir` 映射为 `file` / `directory`（`src-tauri/src/skills.rs:915`-`927`）；只有 `identities/` / `identity/` 且 `entry.is_expert` 的画像生成专家上下文（`src-tauri/src/conversation.rs:504`-`545`）；普通画像不生成专家上下文的测试通过（`src-tauri/src/conversation.rs:2743`-`2760`）；原文件发送测试仍断言普通 `@/workspace/...txt` 发送路径（`src/tests/ChatPanel.test.tsx:80`-`85`）。 |
| AC-7 可清除当前会话专家视角 | ✅ pass | “专家”候选中提供“清除专家视角”，`path=__experts__/clear`、`insert_text=清除专家`（`src-tauri/src/skills.rs:859`-`882`）；菜单选中时使用 `insert_text`（`src/components/AtMentionMenu.tsx:304`-`309`），测试断言 `onSelect('清除专家')`（`src/tests/AtMentionMenu.test.tsx:47`-`67`）；发送前识别 `@清除专家` / `@专家/清除` 并先清空上下文，再合并同条消息里的新专家（`src-tauri/src/conversation.rs:511`-`575`）；Rust 测试覆盖检测清除与清除后重新应用新专家（`src-tauri/src/conversation.rs:2762`-`2796`）。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 对话输入框入口完整：`ChatPanel` 负责检测 `@`、打开 `AtMentionMenu`、插入选择结果（`src/components/ChatPanel.tsx:268`-`318`）。
- ✅ 画像列表入口完整：画像列表传 `identities/{filename}`，`App` 追加到当前输入区且不自动发送（`src/components/TreeSidebar.tsx:678`、`src/App.tsx:1130`-`1132`、`src/tests/ChatPanel.test.tsx:88`-`115`）。
- ✅ 当前会话持续有效并可清除：会话新增并持久化 `expert_contexts`（`src-tauri/src/conversation.rs:158`-`165`、`src-tauri/src/conversation.rs:404`-`408`、`src-tauri/src/conversation.rs:1935`-`1939`），send/continue 每轮动态拼接（`src-tauri/src/conversation.rs:1032`-`1037`、`src-tauri/src/conversation.rs:1644`-`1649`），清除消息会清空（`src-tauri/src/conversation.rs:566`-`575`）。
- ✅ 新会话为空：创建会话初始化 `expert_contexts: vec![]`（`src-tauri/src/conversation.rs:892`-`895`）。

## 方案落实（不偏，对照 design.md）

- ✅ 画像 frontmatter 数据契约落实：`IdentityEntry` 增加 `aliases`、`expert_skill`、`is_expert`（`src-tauri/src/identity.rs:6`-`16`），frontmatter 解析对应字段（`src-tauri/src/identity.rs:22`-`35`），`tags: ["专家"]` / `expert` 或 `expert_skill` 激活专家语义（`src-tauri/src/identity.rs:103`-`108`），测试覆盖字段保留（`src-tauri/src/identity.rs:542`-`565`）。
- ✅ 新 IPC 落实：命令清单与 Tauri handler 注册 `list_at_mention_candidates`（`src-tauri/src/commands/workspace.rs:15`-`19`、`src-tauri/src/main.rs:403`-`404`），前端封装类型与调用（`src/lib/tauri.ts:666`-`683`）。
- ✅ 候选合并“工作区文件 + 专家”：`list_at_mention_candidates` 复用 `list_workspace_dir`，根层级追加专家目录和专家候选，进入 `__experts__` 返回专家候选与控制项（`src-tauri/src/skills.rs:900`-`948`）。
- ✅ 清除机制落实上一轮 fail：design 要求清除候选与 `@清除专家` 清空会话专家上下文（`stories/20260618-expert-perspective-at/design.md:75`、`stories/20260618-expert-perspective-at/design.md:102`-`106`）；当前代码提供 UI 候选、插入文本、发送前清空与测试（`src-tauri/src/skills.rs:859`-`882`、`src/components/AtMentionMenu.tsx:304`-`309`、`src-tauri/src/conversation.rs:511`-`575`、`src-tauri/src/conversation.rs:2762`-`2796`）。
- ✅ 前端测试策略落实上一轮 fail：design 要求 AtMentionMenu 专家候选、清除候选、画像列表追加输入框、不自动发送（`stories/20260618-expert-perspective-at/design.md:182`-`187`）；当前测试覆盖专家选择、清除 insert_text、sidebar 追加不自动发送（`src/tests/AtMentionMenu.test.tsx:22`-`67`、`src/tests/ChatPanel.test.tsx:88`-`115`）。`git status --short -- src/tests/AtMentionMenu.test.tsx` 输出 `?? src/tests/AtMentionMenu.test.tsx`，说明该测试文件当前存在但尚未纳入 git 跟踪。
- ❌ 验证命令未全部通过：design 明列 `cd src-tauri && cargo test`（`stories/20260618-expert-perspective-at/design.md:189`-`195`）；本轮执行 `cargo test` 失败，输出 `mdx::tests::compiles_repository_mdx_examples ... FAILED`，失败断言为 `repository MDX corpus count drifted`，`left: 3`、`right: 113`，对应断言在 `src-tauri/src/mdx.rs:742`-`766`。聚焦命令 `cargo test expert` 通过 9 项，`npm test -- src/tests/AtMentionMenu.test.tsx src/tests/ChatPanel.test.tsx src/tests/TreeSidebar.test.tsx src/tests/DetailView.test.tsx` 通过 4 个文件 20 项，`npm run build` 通过。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 未见团队共享专家库、组织权限、多人协作分发；核对范围 diff 只涉及画像字段、`@` 候选、会话 prompt、前端插入与测试，符合 story 非目标（`stories/20260618-expert-perspective-at/story.md:102`）。
- ✅ 未见日志自动整理、会议转写、自动化任务、全局搜索、详情页阅读模式自动触发专家视角；专家解析只发生在 `conversation_send` 用户消息路径（`src-tauri/src/conversation.rs:1007`-`1012`），符合 story 边界（`stories/20260618-expert-perspective-at/story.md:103`）。
- ✅ 未见专家市场/安装管理、Nuwa 自动蒸馏或从零生成专家 Skill；实现复用画像和 skill 名称字段，符合 story 非目标（`stories/20260618-expert-perspective-at/story.md:104`）与 design 非目标（`stories/20260618-expert-perspective-at/design.md:205`-`210`）。
- ✅ 未见多专家辩论编排；prompt 明确最后一个专家为主视角、其他专家仅辅助参考（`src-tauri/src/conversation.rs:583`-`589`），符合 design 风险处理（`stories/20260618-expert-perspective-at/design.md:203`）。
- ⚠️ 待裁决：`src/App.tsx` 中 `journal-file-open` 事件新增 `setActiveCategory('topics')` 与 `setLeftSidebarOpen(true)`（`src/App.tsx:433`-`435`；`git diff -- src/App.tsx` 显示该行为为本次新增）。该行为无法直接归属到 story 的对话 `@` / 画像列表 `@` 范围，也不在 design 影响面（`stories/20260618-expert-perspective-at/design.md:144`-`161`）。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的两套并行实现。根层级专家直出与“专家”虚拟目录都复用 `expert_mention_candidates` / `expert_candidates`（`src-tauri/src/skills.rs:885`-`897`、`src-tauri/src/skills.rs:911`-`945`），不是两套独立逻辑。

## 结论

result: fail。

上一轮两个明确 fail 已修复：清除专家视角现在有候选、插入、发送前清空与测试；前端测试策略已补 `AtMentionMenu` 与 `ChatPanel` 覆盖。

仍需处理的 fail 项：

1. `cd src-tauri && cargo test` 未通过。虽然失败点在 MDX 语料计数测试、不是本 story 直接改动文件，但它是 design.md 明列验证命令；在该命令修复、隔离或由用户明确豁免前，本轮按 fail 计。

## 待用户裁决

- `src/App.tsx:433`-`435` 的 `journal-file-open` 强制切到 topics 并打开左侧栏是否纳入本 story：接受的代价是 story/design 需记录该附带行为；不接受的代价是实现者移出本次改动或拆到其他 story。当前按保守原则计为待裁决，因此 result 不能为 pass。
