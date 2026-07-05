# 技能三层加载机制设计

## 概述

为谨迹内置 LLM 引擎引入三层技能加载架构，区分内置技能、用户项目安装技能、全局发现技能，提供差异化的加载策略和统一的临时调用能力。

## 三层架构

| 层级        | 来源                         | 存储位置                              | 默认状态       | 可否关闭  |
| ----------- | ---------------------------- | ------------------------------------- | -------------- | --------- |
| L1 内置     | 打包进应用二进制             | `src-tauri/resources/builtin-skills/` | 强制加载       | ❌        |
| L2 项目安装 | 用户主动安装到项目           | `<workspace>/.agents/skills/`         | 可选（默认开） | ✅ toggle |
| L3 全局发现 | 扫描 `~/.claude/` 下已知路径 | 原地引用，不复制                      | 默认不加载     | ✅ toggle |

## 冲突解决

严格层级覆盖：L1 > L2 > L3。

以 `name` 字段匹配同名技能。高层屏蔽低层，被屏蔽的技能在 UI 中标注"已被内置/项目技能覆盖"，不可启用。

## 加载语义

- **"加载"** = 技能的 SKILL.md + references/ 内容拼接进 LLM system prompt，每轮对话都带。
- Toggle 实时生效——切换后下一轮 LLM 调用立刻反映变化。
- 内置技能始终注入，无 toggle。

## 临时调用

所有技能（无论是否启用）均支持"使用一次"（`/`）的临时调用。两个等价入口：

1. **斜杠命令** — 输入框输入 `/` 时弹出候选列表，包含全部三层可用技能，选中后该技能内容仅附加到本次消息的 system prompt。
2. **Workbench `/` 按钮** — 每个技能卡片上的 `/` 图标按钮，点击后将技能内容推送到当前对话的下一轮。

临时调用不改变持久 toggle 状态。对已启用（已在 prompt 中）的技能点击 `/`，视为 no-op，UI 提示"该技能已在当前对话中生效"。

## SkillsWorkbench UI 分区

```
┌─────────────────────────────────┐
│ 🔒 内置技能 (System)            │  ← 独立分区，无 toggle
│   • docs-maintenance        [/] │
│   • requirements-gate       [/] │
│   • ...                         │
├─────────────────────────────────┤
│ 📦 项目技能 (Installed)         │  ← 带 toggle，默认开
│   • custom-lint       [✅] [/]  │
│   • my-workflow       [✅] [/]  │
├─────────────────────────────────┤
│ 🌐 全局技能 (Discovered)        │  ← 带 toggle，默认关
│   • superpowers:brainstorming [⬜] [/] │
│   • superpowers:debugging     [⬜] [/] │
└─────────────────────────────────┘
```

三个分区清晰划分层级语义。所有技能统一拥有 `/` 按钮。

## 全局技能扫描路径

自动扫描 `~/.claude/` 下已知技能目录：

- `~/.claude/skills/`
- `~/.claude/plugins/cache/*/skills/` （superpowers 等插件缓存）

发现依据：目录中包含 `SKILL.md` 文件。复用现有 `parse_skill_frontmatter()` 解析元数据。

## 状态持久化

在现有 `<workspace>/.setting.json` 中扩展：

```jsonc
{
  // 既有：L2 项目技能的禁用列表（默认开，记录关了哪些）
  "disabled_skills": ["project:some-skill"],

  // 新增：L3 全局技能的白名单（默认关，记录开了哪些）
  "enabled_global_skills": ["global:superpowers:brainstorming"],
}
```

## Rust 后端变更

### skills.rs 扩展

- 新增 `SkillScope` 枚举：`Builtin | Project | Global`
- `scan_skills_dir()` 拆分为三个扫描函数：
  - `scan_builtin_skills()` — 扫描 bundle 内 `resources/builtin-skills/`
  - `scan_project_skills()` — 扫描 `<workspace>/.agents/skills/`（现有逻辑）
  - `scan_global_skills()` — 扫描 `~/.claude/skills/` + `~/.claude/plugins/cache/*/skills/`
- `list_skills()` 合并三层结果，执行同名覆盖去重
- 新增 `get_loaded_skill_contents(workspace)` — 返回当前应加载的所有技能 SKILL.md 内容（供 LLM prompt 拼接）

### 新增 Tauri 命令

- `invoke_skill_once(skill_id)` — 临时调用，返回技能内容供前端推送到对话

### workspace_settings.rs 扩展

- 新增 `enabled_global_skills: Vec<String>` 字段
- 新增 `set_global_skill_enabled(skill_id, enabled)` 命令

## 前端变更

### SkillsWorkbench.tsx

- 渲染三分区布局
- L1 区域：只展示，无 toggle，有 `/` 按钮
- L2 区域：toggle + `/` 按钮
- L3 区域：toggle（默认关）+ `/` 按钮
- 被覆盖的技能灰显 + 标注原因

### 对话输入框

- `/` 触发时，候选列表从 `list_skills()` 获取全部技能
- 选中后调用 `invoke_skill_once(skill_id)` 获取内容
- 内容附加到本次消息上下文

### tauri.ts IPC 层

- 扩展 `SkillInfo` 类型：增加 `scope: 'builtin' | 'project' | 'global'`、`shadowed_by?: string`
- 新增 `invokeSkillOnce(skillId: string)` 函数
- 新增 `setGlobalSkillEnabled(skillId: string, enabled: boolean)` 函数

## LLM 集成

在 `tool_loop.rs`（或 prompt 构建层）中：

1. 调用 `get_loaded_skill_contents(workspace)` 获取全部应加载技能内容
2. 拼接到 system prompt 末尾
3. 如有临时调用的技能，额外附加其内容到本轮 prompt

## 边界条件

- **扫描性能**：全局扫描在 workspace 打开时执行一次并缓存，Workbench 打开时可手动刷新
- **大量技能的 context 压力**：启用过多技能会占用 LLM context window。UI 可显示当前已加载技能的 token 估算，提醒用户
- **SKILL.md 格式兼容**：第三层来源的 SKILL.md 可能格式不完全符合本应用规范，解析时容错处理，缺失字段用默认值填充
