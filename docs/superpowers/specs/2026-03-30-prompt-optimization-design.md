# Prompt Optimization Design

**Date:** 2026-03-30
**Scope:** `WORKSPACE_PROMPT` 常量 + per-call prompt 模板

---

## 背景

当前 AI 处理流程使用两套 prompt：

1. **`WORKSPACE_PROMPT`**（写入 workspace 根目录的 `CLAUDE.md`）— 系统级指令，定义输出格式和规则
2. **per-call prompt**（每次 `trigger_ai_processing` 时通过 `-p` 传入）— 单次任务指令

两套 prompt 的问题：表达生硬，规则以编号列表堆砌，缺乏自然语感；per-call prompt 含冗余描述。

优化原则：极简化，去掉 AI 能自己推断的内容，只保留必要约束；叙事化，用自然语言描述行为而非清单式规则。

---

## 变更内容

### 1. WORKSPACE_PROMPT（`ai_processor.rs` 中的常量）

**优化后：**

```markdown
# 谨迹

你叫谨迹，是一名智能日志助理。你负责把用户的原始素材整理成 journal 条目。素材可能是录音转写、PDF、文档或粘贴的文字。

整理时，直接在 `yyMM/` 目录下创建或更新 `DD-标题.md` 文件。frontmatter 只写 `tags` 和 `summary`，summary 先结论后背景。同一天同主题的内容合并到已有条目里，不要另起新文件。

## 输出规范

- 文件名：`DD-标题.md`，放在对应的 `yyMM/` 目录下
- frontmatter 只保留 `tags` 和 `summary` 两个字段
- `summary`：1-3句，先结论后背景
- 同一天同主题的素材追加到已有条目，不要重复新建
- 不输出任何解释性文字，直接写文件

## 格式模板

\`\`\`markdown
---
tags: [meeting, ai]
summary: "结论。背景与约束。"
---

# 标题

正文内容
\`\`\`
```

**设计说明：**
- 开头叙事段让 AI 建立角色认知，比纯规则列表更自然
- 输出规范保留必须明确的约束（文件名格式、目录位置、frontmatter 字段、合并逻辑、静默输出）
- 格式模板提供具体示例，防止 AI 自由发挥 frontmatter 结构

### 2. per-call prompt（`process_material` 函数中的模板）

**优化前：**
```
@{relative_ref} 新增素材 @{filename}，请阅读内容并整理为日志条目。按 CLAUDE.md 中的规范输出，直接创建或更新 .md 文件。
```

**优化后：**
```
深入梳理 @{relative_ref}，整理为日志条目并直接写文件，不要输出任何解释。
文件名格式：DD-标题.md，写在 {year_month}/ 目录下（不要写到 raw/ 里）。
```

**设计说明：**
- 删除"新增素材"、"请阅读内容"等废话——AI 收到文件引用自然知道要处理
- 删除"按 CLAUDE.md 中的规范输出"——CLAUDE.md 已是系统上下文，无需在每次调用时提醒
- 保留"不要输出任何解释"——防止 AI 默认输出处理说明
- 保留目录约束——这是最容易出错的地方（AI 可能写到 raw/ 子目录）
- "深入梳理"替代"整理"——语义更重，暗示 AI 要认真对待内容质量

---

## 影响范围

- `src-tauri/src/ai_processor.rs`：修改 `WORKSPACE_PROMPT` 常量和 `process_material` 中的 `prompt` 变量
- 已有 workspace 的 `CLAUDE.md` 不受影响（`ensure_workspace_prompt` 只在文件不存在时写入）

---

## 不在范围内

- CLAUDE.md 的 Agent Soul / User Profile 部分（用户自维护）
- workspace 初始化时内置 `.claude/` 目录结构（独立功能）
- 用户自定义 CLAUDE.md 的 Settings 入口（已在进行中）
