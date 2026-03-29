# 调通 Claude CLI AI 执行引擎 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Claude CLI AI 引擎端到端跑通：用户拖入素材 → AI 自动生成/更新日志条目 → 前端刷新显示。

**Architecture:** 在 workspace 根目录放置 CLAUDE.md 定义日志格式规范，Rust 端调用 Claude CLI 时 `current_dir` 设为 **workspace 根目录**（而非 yyMM/ 子目录），传入正确的 flags（`--tools "Read,Write,Glob"`、`--permission-mode bypassPermissions`、`--output-format json`、`--no-session-persistence`），解析 JSON 输出判断成功/失败。`@` 文件引用使用相对路径 `yyMM/raw/filename`（相对于 workspace 根目录）。首次启动时自动生成 CLAUDE.md。

**Tech Stack:** Rust (tokio process, serde_json), Claude CLI v2.x

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src-tauri/src/ai_processor.rs` | 修改：CLI args 构建、JSON 输出解析、系统提示词文件管理 |
| `src-tauri/src/ai_processor/prompt.rs` | **不创建** — 提示词内容写在 CLAUDE.md 里，不在 Rust 里 |

---

### Task 1: 在 workspace 自动生成 CLAUDE.md

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: 写测试 — ensure_workspace_prompt 生成 CLAUDE.md**

在 `ai_processor.rs` 的 `#[cfg(test)] mod tests` 中添加：

```rust
    #[test]
    fn ensure_workspace_prompt_creates_file() {
        let tmp = std::env::temp_dir().join("journal_prompt_test");
        std::fs::create_dir_all(&tmp).unwrap();
        let prompt_path = tmp.join("CLAUDE.md");
        // 确保文件不存在
        let _ = std::fs::remove_file(&prompt_path);

        ensure_workspace_prompt(tmp.to_str().unwrap());
        assert!(prompt_path.exists());

        let content = std::fs::read_to_string(&prompt_path).unwrap();
        assert!(content.contains("tags"));
        assert!(content.contains("summary"));
        assert!(content.contains("DD-标题.md"));

        // 第二次调用不应覆盖
        std::fs::write(&prompt_path, "用户自定义内容").unwrap();
        ensure_workspace_prompt(tmp.to_str().unwrap());
        let content2 = std::fs::read_to_string(&prompt_path).unwrap();
        assert_eq!(content2, "用户自定义内容");

        std::fs::remove_dir_all(&tmp).ok();
    }
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test ensure_workspace_prompt -- --nocapture`
Expected: FAIL — `ensure_workspace_prompt` 函数不存在。

- [ ] **Step 3: 实现 ensure_workspace_prompt**

在 `ai_processor.rs` 的 `// ── Helpers` 区域添加：

```rust
const WORKSPACE_PROMPT: &str = r#"# Journal 秘书稿规范

你是一个日志整理助手。用户会给你原始素材（录音转写、PDF、文档等），你需要整理成结构化的日志条目。

## 输出格式

每个日志条目是一个 Markdown 文件，格式：

```markdown
---
tags: [标签1, 标签2]
summary: "一句话摘要：先结论后背景"
---

# 标题

## 背景
## 关键讨论 / 核心内容
## 结论
## 行动项
```

## 规则

1. 文件名格式：`DD-标题.md`（DD 是日期数字，如 `28-AI平台产品会议纪要.md`）
2. frontmatter 只保留 `tags` 和 `summary` 两个字段
3. `summary` 写 1-3 句，先结论后背景
4. `tags` 使用小写中文或英文，常用标签：journal, meeting, reading, research, plan, design, guide
5. 正文结构根据内容类型选用：会议用「关键讨论 + 结论 + 行动项」，阅读用「核心观点 + 启发」，日常用「记录 + 感想」
6. 新素材可以创建新条目，也可以追加到当天已有条目（如同一天的多段录音合并为一篇会议纪要）
7. 如果已有同主题条目，更新而不是新建，保留用户手动修改的部分
8. 日志条目文件写在素材对应的 `yyMM/` 目录下（与 raw/ 同级，不要写到 raw/ 子目录里）
9. 不要输出任何解释性文字，只创建/更新文件即可
"#;

/// 确保 workspace 根目录有 CLAUDE.md。仅在文件不存在时创建，不覆盖用户修改。
fn ensure_workspace_prompt(workspace_path: &str) {
    let path = std::path::PathBuf::from(workspace_path).join("CLAUDE.md");
    if !path.exists() {
        let _ = std::fs::write(&path, WORKSPACE_PROMPT);
    }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd src-tauri && cargo test ensure_workspace_prompt -- --nocapture`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat(rust): 添加 workspace CLAUDE.md 自动生成"
```

---

### Task 2: 修正 Claude CLI 调用参数

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: 写测试 — build_args 包含正确的 flags**

在 `#[cfg(test)] mod tests` 中添加：

```rust
    #[test]
    fn build_args_has_required_flags() {
        let args = build_args("/nb/2603/raw/note.txt", "2603");
        // 必须包含 -p
        assert!(args.contains(&"-p".to_string()));
        // @ 引用使用 yyMM/raw/filename 相对路径
        assert!(args[1].starts_with("@2603/raw/note.txt"));
        // 必须包含 --tools
        assert!(args.contains(&"--tools".to_string()));
        assert!(args.contains(&"Read,Write,Glob".to_string()));
        // 必须包含 --permission-mode
        assert!(args.contains(&"--permission-mode".to_string()));
        assert!(args.contains(&"bypassPermissions".to_string()));
        // 必须包含 --output-format json
        assert!(args.contains(&"--output-format".to_string()));
        assert!(args.contains(&"json".to_string()));
        // 必须包含 --no-session-persistence
        assert!(args.contains(&"--no-session-persistence".to_string()));
        // 不能包含 --cwd
        assert!(!args.iter().any(|a| a == "--cwd"));
    }
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test build_args_has_required_flags -- --nocapture`
Expected: FAIL — 当前 `build_args` 没有这些 flags。

- [ ] **Step 3: 更新 build_args 和 build_prompt**

替换 `build_prompt` 和 `build_args`：

```rust
fn build_prompt(material_path: &str) -> String {
    let filename = std::path::PathBuf::from(material_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    format!(
        "新增素材 @{}，请阅读内容并整理为日志条目。按 CLAUDE.md 中的规范输出，直接创建或更新 .md 文件。",
        filename
    )
}

/// Build CLI args. current_dir 是 workspace 根目录，@ 引用用 yyMM/raw/filename 相对路径。
fn build_args(material_path: &str, year_month: &str) -> Vec<String> {
    let filename = std::path::PathBuf::from(material_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let relative_ref = format!("{}/raw/{}", year_month, filename);
    vec![
        "-p".to_string(),
        format!("@{} {}", relative_ref, build_prompt(material_path)),
        "--tools".to_string(),
        "Read,Write,Glob".to_string(),
        "--permission-mode".to_string(),
        "bypassPermissions".to_string(),
        "--output-format".to_string(),
        "json".to_string(),
        "--no-session-persistence".to_string(),
    ]
}
```

- [ ] **Step 4: 更新 build_args_no_cwd 测试以匹配新签名**

替换 `build_args_no_cwd` 测试：

```rust
    #[test]
    fn build_args_no_cwd() {
        let args = build_args("/nb/2603/raw/note.txt", "2603");
        assert!(args[0] == "-p");
        // 使用相对路径 yyMM/raw/filename
        assert!(args[1].starts_with("@2603/raw/note.txt"));
        assert!(args[1].contains("新增素材"));
        assert!(!args.iter().any(|a| a == "--cwd"));
    }
```

- [ ] **Step 5: 运行全部测试**

Run: `cd src-tauri && cargo test build_args -- --nocapture`
Expected: 所有 build_args 相关测试 PASS

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat(rust): 完善 Claude CLI 调用参数 — tools, permissions, json output"
```

---

### Task 3: 解析 JSON 输出 + 调用 ensure_workspace_prompt

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: 写测试 — parse_cli_output 正确解析 JSON**

```rust
    #[test]
    fn parse_cli_output_success() {
        let json = r#"{"type":"result","subtype":"success","is_error":false,"result":"已创建 28-会议纪要.md","total_cost_usd":0.05}"#;
        let result = parse_cli_output(json);
        assert!(result.is_ok());
    }

    #[test]
    fn parse_cli_output_error() {
        let json = r#"{"type":"result","subtype":"error","is_error":true,"result":"无法读取文件"}"#;
        let result = parse_cli_output(json);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("无法读取文件"));
    }

    #[test]
    fn parse_cli_output_non_json() {
        let text = "some plain text error";
        let result = parse_cli_output(text);
        // 非 JSON 视为成功（旧版 CLI 兼容）
        assert!(result.is_ok());
    }
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test parse_cli_output -- --nocapture`
Expected: FAIL — `parse_cli_output` 不存在。

- [ ] **Step 3: 实现 parse_cli_output**

```rust
/// 解析 Claude CLI 的 JSON 输出，判断成功/失败。
fn parse_cli_output(stdout: &str) -> Result<(), String> {
    // 尝试解析为 JSON
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(stdout.trim());
    match parsed {
        Ok(val) => {
            let is_error = val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
            if is_error {
                let msg = val.get("result")
                    .and_then(|v| v.as_str())
                    .unwrap_or("AI 处理失败");
                Err(msg.to_string())
            } else {
                Ok(())
            }
        }
        Err(_) => {
            // 非 JSON 输出（兼容旧版或纯文本模式），视为成功
            Ok(())
        }
    }
}
```

- [ ] **Step 4: 更新 process_material 使用 JSON 解析 + ensure_workspace_prompt**

替换 `process_material` 函数：

```rust
pub async fn process_material(
    app: &AppHandle,
    material_path: &str,
    year_month: &str,
) -> Result<(), String> {
    let cfg = config::load_config(app)?;
    let cli = if cfg.claude_cli_path.is_empty() {
        "claude".to_string()
    } else {
        cfg.claude_cli_path.clone()
    };

    // 确保 workspace 有 CLAUDE.md
    ensure_workspace_prompt(&cfg.workspace_path);

    // Emit "processing"
    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.to_string(),
        status: "processing".to_string(),
        error: None,
    });

    let args = build_args(material_path, year_month);
    let output = tokio::process::Command::new(&cli)
        .args(&args)
        .current_dir(&cfg.workspace_path)  // workspace 根目录，不是 yyMM/
        .env("PATH", augmented_path())
        .output()
        .await
        .map_err(|e| format!("启动 Claude CLI 失败 ({}): {}", &cli, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // 优先检查进程退出码，再解析 JSON
    if !output.status.success() {
        let err = if stderr.is_empty() { stdout.clone() } else { stderr };
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "failed".to_string(),
            error: Some(err.clone()),
        });
        return Err(err);
    }

    // 解析 JSON 输出
    match parse_cli_output(&stdout) {
        Ok(()) => {
            let _ = app.emit("ai-processing", ProcessingUpdate {
                material_path: material_path.to_string(),
                status: "completed".to_string(),
                error: None,
            });
            let _ = app.emit("journal-updated", year_month);
            Ok(())
        }
        Err(err) => {
            let _ = app.emit("ai-processing", ProcessingUpdate {
                material_path: material_path.to_string(),
                status: "failed".to_string(),
                error: Some(err.clone()),
            });
            Err(err)
        }
    }
}
```

- [ ] **Step 5: 运行全部测试**

Run: `cd src-tauri && cargo test -- --nocapture`
Expected: 所有测试 PASS（config_defaults 已知失败除外）

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat(rust): 解析 CLI JSON 输出、调用 ensure_workspace_prompt"
```

---

### Task 4: 集成验证

- [ ] **Step 1: 编译检查**

Run: `cd src-tauri && cargo check`
Expected: 无错误。

- [ ] **Step 2: 运行所有 Rust 测试**

Run: `cd src-tauri && cargo test -- --nocapture 2>&1 | grep -E "^test |^running|result:"`
Expected: ai_processor 的所有新测试 PASS。

- [ ] **Step 3: 运行前端构建**

Run: `npm run build`
Expected: 无错误。

- [ ] **Step 4: 手动冒烟测试**

Run: `npm run tauri dev`

验证流程：
1. 检查 `~/Documents/journal/CLAUDE.md` 是否自动生成（首次运行后）
2. 拖入一个 PDF 文件 → 提交 Agent 整理
3. 队列面板显示 "排队中" → "处理中"
4. TitleBar 显示 "xxx.pdf · 整理中"
5. Claude CLI 处理完成后，队列显示 "完成" 并淡出
6. 左侧日志列表自动刷新，新的日志条目出现
7. 点击日志条目，右侧面板显示 markdown 内容，格式符合规范（有 frontmatter tags/summary）
