# 分离 workspace CLAUDE.md：内置 vs 用户可编辑

> Date: 2026-04-04
> Status: Approved

## Problem

当前 `workspace/.claude/CLAUDE.md` 同时承载两个矛盾的角色：

1. **系统指令** — 每次 `ensure_workspace_dot_claude()` 调用时强制覆盖为内嵌模板
2. **用户可编辑内容** — SoulView 编辑器通过 `set_workspace_prompt()` 写入用户自定义

由于 `ensure_workspace_dot_claude()` 在每次 AI 处理前都会调用，用户的编辑会被覆盖。

## Design

### 双文件模型

| 文件 | 性质 | 来源 | 用户可见 | 启动时行为 |
|---|---|---|---|---|
| `.claude/CLAUDE.md` | 内置系统指令 | `include_str!("...workspace-template/.claude/CLAUDE.md")` | 不可见 | 每次强制覆盖 |
| `CLAUDE.md` (workspace 根) | 用户可编辑 | `include_str!("...workspace-template/CLAUDE.md")` | 可见，SoulView 编辑 | 仅在不存在时创建 |

Claude CLI 自动读取两个文件（项目根 `CLAUDE.md` + `.claude/CLAUDE.md`），天然叠加，无需运行时拼接。

### 模板内容拆分

从现有 `.claude/CLAUDE.md`（136行）中抽出个性化部分到 `workspace/CLAUDE.md`：

**留在 `.claude/CLAUDE.md` 的系统指令：**
- `## 你所在的系统` — 目录结构、调用方式
- `## 身份系统` — speaker_id 关联、脚本调用规则
- `## 核心行为` — 文件操作工作流
- `## 输出规范` → Frontmatter 格式、文件命名规则
- `## 读取素材` — PDF/DOCX 工具
- `## 待办事项提取` — todos.md 格式

**抽到 `workspace/CLAUDE.md` 的个性化内容：**
- 角色定义段（"你是用户的私人秘书"）
- `## 行为准则` — 写作风格偏好
- `## 输出规范` → 正文结构（结论先行、标题分层等）

### Rust 变更（`ai_processor.rs`）

1. **新增常量**：
   ```rust
   const WORKSPACE_USER_CLAUDE_MD: &str = include_str!("../resources/workspace-template/CLAUDE.md");
   ```

2. **修改 `ensure_workspace_dot_claude()`**：在现有 `.claude/` 初始化后新增：
   ```rust
   let user_claude_md = std::path::PathBuf::from(workspace_path).join("CLAUDE.md");
   if !user_claude_md.exists() {
       let _ = std::fs::write(&user_claude_md, WORKSPACE_USER_CLAUDE_MD);
   }
   ```

3. **修改 `get_workspace_prompt()`**：路径从 `.claude/CLAUDE.md` 改为 `workspace/CLAUDE.md`，fallback 改为 `WORKSPACE_USER_CLAUDE_MD`。

4. **修改 `set_workspace_prompt()`**：写入路径从 `.claude/CLAUDE.md` 改为 `workspace/CLAUDE.md`。

5. **修改 `reset_workspace_prompt()`**：恢复内容从 `WORKSPACE_CLAUDE_MD`（系统模板）改为 `WORKSPACE_USER_CLAUDE_MD`（用户默认模板）。

### 前端变更

**无。** SoulView 和 IdentityDetail 通过 Tauri 命令操作，路径切换对前端透明。

### 重置行为

用户点击重置时，`workspace/CLAUDE.md` 恢复为默认用户模板（抽出的个性化内容）。

## Files Changed

| File | Action |
|---|---|
| `src-tauri/resources/workspace-template/CLAUDE.md` | **New** — 从现有模板抽出个性化内容 |
| `src-tauri/resources/workspace-template/.claude/CLAUDE.md` | **Edit** — 移除个性化部分，只保留系统指令 |
| `src-tauri/src/ai_processor.rs` | **Edit** — 修改 5 个函数的路径/内容 |

## Risks

- **升级兼容**：已有 workspace 中 `.claude/CLAUDE.md` 的用户编辑会在首次启动后被覆盖（这是预期行为，与当前行为一致）。新的 `CLAUDE.md` 会在不存在时自动创建。
- **Claude CLI 读取顺序**：Claude CLI 先读 `.claude/CLAUDE.md` 再读根目录 `CLAUDE.md`，用户自定义内容后加载，可以覆盖系统指令中的行为。
