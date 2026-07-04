---
id: DESIGN-20260618-expert-perspective-at
story: ./story.md
created: 2026-06-18
status: accepted
---

# @ 专家视角对话机制设计

## 目标

让用户通过现有 `@` 操作召唤“专家视角”，不新增一套独立专家系统：

1. 对话输入框可搜索并插入专家引用。
2. 画像列表点击 `@` 继续走现有“追加到输入框”路径，不自动发送。
3. 发送后，LLM 在当前会话中获得该专家视角；后续轮次持续有效，直到切换/清除或新建会话。
4. 普通 `@文件`、`/skill` 和现有画像浏览不被破坏。

## 现状事实

- 画像数据在 `identity/`，前端树中使用 `identities/{filename}` 作为历史虚拟引用路径。
- `TreeSidebar` 的画像 `@` 已调用 `onAtRef("identities/{filename}")`，`App` 通过 `chat-append-text` 把 `@...` 追加到输入框。
- `AtMentionMenu` 当前只浏览工作区可见文件，隐藏 `.agents/skills`。
- LLM 已有 `load_skill` 工具和 `SkillInfo.triggers`，但 `@` 不会自动触发 Skill。
- 会话 `system_prompt` 在首轮发送时懒构建；构建后存入 `ConversationSession` 并随会话持久化。

## 核心决策

### 决策 1：专家是画像的一个能力，不是新顶级导航

首版只引入一个统一“专家”分类。数据契约复用画像 frontmatter：

```yaml
---
summary: '...'
tags: ['专家']
expert_skill: 'technical-architect-perspective'
aliases: ['架构师', '技术架构师']
---
```

- `tags` 包含 `专家` 或 `expert` 时，该画像进入专家候选。
- `expert_skill` 可选。存在时优先加载对应 Skill。
- `aliases` 可选，用于 `@` 搜索匹配。
- 没有 `expert_skill` 时，使用画像正文生成临时专家上下文。

理由：复用现有画像列表、画像文件和 Skill 目录，避免新增数据库、专家管理页或复杂分类模型。

### 决策 2：`@` 候选合并“工作区文件 + 专家”

新增一个轻量 IPC：`list_at_mention_candidates(relative_path, query)`，由后端聚合：

1. 现有 `list_workspace_dir(relative_path)` 的文件/目录候选。
2. 根层级额外追加一个虚拟目录 `专家`。
3. 进入 `专家` 虚拟目录时，返回专家画像候选。

候选类型：

```ts
type AtMentionKind = 'file' | 'directory' | 'expert'

interface AtMentionCandidate {
  name: string
  path: string
  is_dir: boolean
  kind: AtMentionKind
  insert_text?: string
  summary?: string
  tags?: string[]
}
```

专家候选插入文本仍是 `@identities/{filename}`，保证画像列表 `@` 和输入框 `@` 得到同一种引用形式。

“专家”虚拟目录中额外提供一个控制候选“清除专家视角”。它不对应真实文件，`path` 为 `__experts__/clear`，`insert_text` 为 `清除专家`；用户选中后输入区出现 `@清除专家`，发送后清空当前会话的专家上下文。

### 决策 3：发送时解析专家引用，写入会话专家上下文

在 `conversation_send` 进入 LLM 前解析用户消息中的 `@...`：

- 匹配行内或独立行里的 `@identities/{filename}`。
- 解析到的画像如果是专家画像，则生成 `ExpertContext`：

```rust
struct ExpertContext {
    identity_ref: String,
    display_name: String,
    summary: String,
    skill_name: Option<String>,
    profile_content: String,
}
```

会话新增字段：

```rust
expert_contexts: Vec<ExpertContext>
```

规则：

- 每轮发送前根据消息里的专家引用更新会话专家上下文。
- 消息包含 `@清除专家` / `@专家/清除` 时，先清空当前会话专家上下文，再处理同条消息里的新专家引用。
- 同一专家重复引用去重。
- 引用新的专家时追加；首版不做多专家辩论，只把多个专家作为可用视角列表，模型应优先使用用户本轮明确提到的最后一个专家。
- 新建会话为空；持久化会话保存该字段。

### 决策 4：专家上下文注入 system prompt，不强迫模型先调用工具

每次 LLM 调用前，把当前会话 `expert_contexts` 拼接为 system prompt 后缀：

```markdown
## 当前专家视角

用户已通过 @ 召唤以下专家视角。回答时优先使用本轮最后一次 @ 的专家。

### {display_name}

来源：@identities/{filename}
摘要：...

如果关联 skill 为 `{skill_name}`，你应调用 load_skill 加载该 skill；如无法加载，使用下方画像内容作为降级上下文。

画像内容：
...

回答要求：

- 给出该专家的判断、盲点提示、反观点或挑战性追问。
- 不要只模仿口吻；要使用该专家的思考框架。
- 信息不足时说明边界，不编造此人没说过的话。
```

理由：现有 `load_skill` 是模型可调用工具，强制后端预执行会改变工具链和日志语义；system prompt 后缀能让“本轮立即生效”，同时保留 Skill 内容按需加载。

### 决策 5：普通文件引用保持原语义

只有满足以下条件的引用才被视为专家：

- 路径形如 `identities/{filename}` 或兼容 `identity/{filename}`。
- 对应画像 frontmatter 的 `tags` 包含 `专家` / `expert`，或存在 `expert_skill`。

其他 `@` 继续按普通文件/材料引用处理。

## 影响面

- `src-tauri/src/identity.rs`
  - 扩展 frontmatter 解析：`aliases`、`expert_skill`。
  - `IdentityEntry` 增加 `aliases`、`expert_skill`、`is_expert`。
- `src/types.ts`
  - 同步 `IdentityEntry` 字段。
- `src-tauri/src/skills.rs`
  - 新增 `AtMentionCandidate` 与 `list_at_mention_candidates`，复用 `list_workspace_dir` 和 `list_identity_entries`。
- `src/lib/tauri.ts`
  - 新增 IPC 类型与函数。
- `src/components/AtMentionMenu.tsx`
  - 从 `listWorkspaceDir` 切到 `listAtMentionCandidates`。
  - 对 `expert` 候选显示专家标记，仍保持现有菜单布局。
- `src-tauri/src/conversation.rs`
  - 增加 `ExpertContext`、解析 `@identities/...`、会话持久化与 prompt 后缀。
- `src/components/TreeSidebar.tsx`
  - 保持画像 `@` 现有交互；必要时只调整路径兼容和测试。

## 测试策略

### Rust

- `identity.rs`
  - 解析 `tags: ["专家"]` 得到 `is_expert=true`。
  - 解析 `expert_skill` 和 `aliases`。
  - 普通画像不进入专家。
- `skills.rs`
  - 根层级候选包含虚拟 `专家` 目录。
  - `专家` 目录返回专家画像候选。
  - 普通文件候选不受影响。
- `conversation.rs`
  - `@identities/某专家.md` 生成专家上下文。
  - `@2606/xx.md` 不生成专家上下文。
  - 重复专家引用去重。
  - `@清除专家` 清空当前会话专家上下文。
  - system prompt 后缀包含专家要求和 skill name。

### 前端

- `AtMentionMenu` 可展示专家候选并选中插入 `identities/{filename}`。
- `AtMentionMenu` 可展示“清除专家视角”并选中插入 `清除专家`。
- 画像列表点击 `@` 后仍追加到输入框，不自动发送。
- `ChatPanel` 普通文件 chip 行为不回归。

### 验证命令

```bash
npm test -- src/tests/AtMentionMenu.test.tsx src/tests/ChatPanel.test.tsx src/tests/TreeSidebar.test.tsx
npm run build
cd src-tauri && cargo test expert
```

补充说明：当前仓库完整 `cargo test` 在本 story 之外存在既有失败
`mdx::tests::compiles_repository_mdx_examples`，原因是测试硬编码期待 `.agents/skills/journal`
示例语料存在，而当前仓库基线未包含该目录。该失败不作为本 story 的放行条件；如需修复，应另开
MDX 测试语料/基线维护任务。

## 风险与处理

- 风险：把所有画像都误当专家。处理：必须有 `tags: ["专家"]` / `expert` 或 `expert_skill` 才激活专家语义。
- 风险：`identities/` 与真实 `identity/` 路径不一致。处理：保留 `identities/` 为虚拟引用，后端解析时兼容到 `identity/`。
- 风险：专家 Skill 名称与目录名冲突或不存在。处理：prompt 明确要求无法加载时使用画像内容降级；后续可加 UI 校验。
- 风险：会话 system prompt 已懒构建且持久化。处理：专家上下文不直接写死到 base system prompt，而是在每轮 LLM 调用前动态拼接。
- 风险：多个专家同时出现导致角色混乱。处理：首版不做辩论；默认本轮最后一个 `@专家` 为主视角，其他专家作为辅助上下文。

## 非目标

- 不新增专家管理页面。
- 不做专家细分类。
- 不做多专家辩论编排。
- 不做 Nuwa 自动蒸馏流程。
- 不迁移 `identities/` 虚拟路径命名。
