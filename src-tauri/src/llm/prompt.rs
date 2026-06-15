use std::path::PathBuf;
/// Build the full system prompt for the built-in AI engine.
///
/// Concatenates:
/// 0. Environment context
/// 1. Journal document format contract
/// 2. Embedded CLAUDE.md (platform contract from workspace template)
/// 3. User's workspace/CLAUDE.md (personal secretary instructions)
/// 4. Runtime memory (recent summaries + identity/README.md)
/// 5. Available skills hint
pub async fn build_system_prompt(
    workspace_path: &str,
    workspace_claude_md: &str,
    global_skills_enabled: bool,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    // 0. Environment context
    let now = chrono::Local::now();
    let env_info = format!(
        "## 环境信息\n\n- 工作目录: {}\n- 操作系统: {}\n- 当前时间: {}",
        workspace_path,
        crate::platform::os_display_name(),
        now.format("%Y-%m-%d %H:%M (%A)"),
    );
    parts.push(env_info);

    // 1. App-wide document rendering preference
    parts.push(journal_document_format_contract());

    // 2. Agent instructions (embedded at compile time in ai_processor.rs, passed in here)
    parts.push(workspace_claude_md.to_string());

    // 3. User's workspace/CLAUDE.md
    let user_md = PathBuf::from(workspace_path).join("CLAUDE.md");
    if let Ok(content) = tokio::fs::read_to_string(&user_md).await {
        if !content.trim().is_empty() {
            parts.push(format!("\n## 用户指令\n\n{}", content));
        }
    }

    // 4. Runtime memory
    let recent_summaries =
        run_workspace_script(workspace_path, "recent-summaries", &["-n", "15"]).await;
    let identity_readme = PathBuf::from(workspace_path)
        .join("identity")
        .join("README.md");
    let identity_profile = tokio::fs::read_to_string(&identity_readme).await.ok();
    if let Some(memory) = format_runtime_memory(recent_summaries, identity_profile) {
        parts.push(memory);
    }

    // 5. Available skills — details are in the load_skill tool definition
    let disabled = crate::workspace_settings::get_disabled_skills_for_workspace(workspace_path);
    let skills = scan_skills(workspace_path, global_skills_enabled, &disabled).await;
    if !skills.is_empty() {
        parts.push(available_skills_hint());
    }

    parts.join("\n\n")
}

fn journal_document_format_contract() -> String {
    r#"## 文档输出格式优先级

当任务是整理日志、会议纪要、研究材料、技术记录、手册、专题页或其他可沉淀文档时，优先输出 JournalClaw 可渲染的 `.mdx` 文档，而不是只输出普通说明文字。

结构选择顺序：

1. Markdown first: 普通段落、标题、列表、表格、代码块先用标准 Markdown，保持可读、可回溯。
2. MDX JSX second: 需要稳定视觉层级、对比、时间线、步骤、判断、引用、资源列表、结尾总结或更强语义对象时，使用 typed MDX JSX components。

写日志或整理素材前应加载 `/journal`。需要组件时读取 `references/component-catalog.md` 和 `references/component-recipes.md`。普通条目通常使用 0-5 个承载信息的 JSX components；不要为了装饰使用组件。"#
        .to_string()
}

fn non_empty_trimmed(content: Option<String>) -> Option<String> {
    content
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn format_runtime_memory(
    recent_summaries: Option<String>,
    identity_profile: Option<String>,
) -> Option<String> {
    let mut memory_parts = Vec::new();

    if let Some(content) = non_empty_trimmed(recent_summaries) {
        memory_parts.push(format!("### 近期条目摘要\n\n{}", content));
    }
    if let Some(content) = non_empty_trimmed(identity_profile) {
        memory_parts.push(format!("### 用户档案\n\n{}", content));
    }

    if memory_parts.is_empty() {
        None
    } else {
        Some(format!("## 运行时记忆\n\n{}", memory_parts.join("\n\n")))
    }
}

fn available_skills_hint() -> String {
    "## 可用 Skills\n\n当用户提到 /skill-name 或你判断需要某个 skill 时，调用 load_skill 工具加载其规则。"
        .to_string()
}

/// Run a script from workspace/.claude/scripts/ and return stdout.
async fn run_workspace_script(workspace_path: &str, script: &str, args: &[&str]) -> Option<String> {
    let script_path = PathBuf::from(workspace_path)
        .join(".claude")
        .join("scripts")
        .join(script);

    if !script_path.exists() {
        return None;
    }

    let output = tokio::process::Command::new("bash")
        .arg(script_path.to_string_lossy().as_ref())
        .args(args)
        .current_dir(workspace_path)
        .env("PATH", crate::config::augmented_path())
        .output()
        .await
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        eprintln!(
            "[llm::prompt] script {} failed: {}",
            script,
            String::from_utf8_lossy(&output.stderr)
        );
        None
    }
}

/// Scan skills from all layers, return (dir_name, description) pairs.
/// Project and enabled global skills are included. Disabled ones are excluded.
pub async fn scan_skills(
    workspace_path: &str,
    _global_skills_enabled: bool,  // kept for API compat, now always scans global
    disabled_ids: &[String],
) -> Vec<(String, String)> {
    let mut skills: Vec<(String, String)> = Vec::new();

    // L2: Project skills (from .agents/skills/ — these include builtin-mirrored skills)
    let project_skills_dir = PathBuf::from(workspace_path).join(".agents").join("skills");
    if let Ok(mut entries) = tokio::fs::read_dir(&project_skills_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            let content = match tokio::fs::read_to_string(&skill_md).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            let dir_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if dir_name.is_empty() {
                continue;
            }
            let skill_id = format!("project:{}", dir_name);
            if disabled_ids.contains(&skill_id) {
                continue;
            }
            let description = parse_skill_description(&content).unwrap_or_default();
            skills.push((dir_name, description));
        }
    }

    // Also scan .claude/skills/ for backward compatibility
    let claude_skills_dir = PathBuf::from(workspace_path).join(".claude").join("skills");
    if let Ok(mut entries) = tokio::fs::read_dir(&claude_skills_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            let content = match tokio::fs::read_to_string(&skill_md).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            let dir_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if dir_name.is_empty() {
                continue;
            }
            let skill_id = format!("project:{}", dir_name);
            if disabled_ids.contains(&skill_id) {
                continue;
            }
            // Skip if already found in .agents/skills/
            if skills.iter().any(|(n, _)| n == &dir_name) {
                continue;
            }
            let description = parse_skill_description(&content).unwrap_or_default();
            skills.push((dir_name, description));
        }
    }

    // L3: Global skills (only enabled ones from whitelist)
    let enabled_globals =
        crate::workspace_settings::get_enabled_global_skills_for_workspace(workspace_path);
    if let Some(home) = dirs::home_dir() {
        // ~/.claude/skills/
        let global_dir = home.join(".claude").join("skills");
        if let Ok(mut entries) = tokio::fs::read_dir(&global_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let skill_md = path.join("SKILL.md");
                let content = match tokio::fs::read_to_string(&skill_md).await {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let dir_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                if dir_name.is_empty() {
                    continue;
                }
                let skill_id = format!("global:{}", dir_name);
                if !enabled_globals.contains(&skill_id) {
                    continue;
                }
                let description = parse_skill_description(&content).unwrap_or_default();
                if !skills.iter().any(|(n, _)| n == &dir_name) {
                    skills.push((dir_name, description));
                }
            }
        }

        // ~/.claude/plugins/cache/<publisher>/<plugin>/<version>/skills/
        let plugins_cache = home.join(".claude").join("plugins").join("cache");
        if let Ok(mut publishers) = tokio::fs::read_dir(&plugins_cache).await {
            while let Ok(Some(publisher)) = publishers.next_entry().await {
                if !publisher.path().is_dir() {
                    continue;
                }
                let publisher_name = publisher.file_name().to_string_lossy().to_string();
                if let Ok(mut plugins) = tokio::fs::read_dir(publisher.path()).await {
                    while let Ok(Some(plugin)) = plugins.next_entry().await {
                        if !plugin.path().is_dir() {
                            continue;
                        }
                        let plugin_name = plugin.file_name().to_string_lossy().to_string();
                        // Find latest version (sort desc, take first)
                        let mut versions: Vec<_> = Vec::new();
                        if let Ok(mut ver_entries) = tokio::fs::read_dir(plugin.path()).await {
                            while let Ok(Some(v)) = ver_entries.next_entry().await {
                                if v.path().is_dir() {
                                    versions.push(v);
                                }
                            }
                        }
                        versions.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
                        if let Some(version_entry) = versions.first() {
                            let skills_dir = version_entry.path().join("skills");
                            if !skills_dir.is_dir() {
                                continue;
                            }
                            if let Ok(mut entries) = tokio::fs::read_dir(&skills_dir).await {
                                while let Ok(Some(entry)) = entries.next_entry().await {
                                    let path = entry.path();
                                    if !path.is_dir() {
                                        continue;
                                    }
                                    let skill_md = path.join("SKILL.md");
                                    let content = match tokio::fs::read_to_string(&skill_md).await {
                                        Ok(c) => c,
                                        Err(_) => continue,
                                    };
                                    let raw_dir = path
                                        .file_name()
                                        .and_then(|n| n.to_str())
                                        .unwrap_or("")
                                        .to_string();
                                    if raw_dir.is_empty() {
                                        continue;
                                    }
                                    let dir_name = format!("{}/{}/{}", publisher_name, plugin_name, raw_dir);
                                    let skill_id = format!("global:{}", dir_name);
                                    if !enabled_globals.contains(&skill_id) {
                                        continue;
                                    }
                                    let description = parse_skill_description(&content).unwrap_or_default();
                                    if !skills.iter().any(|(n, _)| n == &dir_name) {
                                        skills.push((dir_name, description));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    skills.sort_by(|a, b| a.0.cmp(&b.0));
    skills
}

pub fn parse_skill_description(content: &str) -> Option<String> {
    crate::frontmatter::parse_frontmatter_field(content, "description")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_skill_description_basic() {
        let content = "---\nname: test\ndescription: \"A test skill\"\n---\n\nContent";
        assert_eq!(
            parse_skill_description(content),
            Some("A test skill".to_string())
        );
    }

    #[test]
    fn parse_skill_description_no_frontmatter() {
        assert_eq!(parse_skill_description("# Just a heading"), None);
    }

    #[test]
    fn runtime_memory_groups_recent_summaries_and_profile() {
        let memory = format_runtime_memory(
            Some("最近创建了 MDX 支持手册。".to_string()),
            Some("用户关注知识库长期维护。".to_string()),
        )
        .expect("memory should be present");

        assert!(memory.starts_with("## 运行时记忆"));
        assert!(memory.contains("### 近期条目摘要\n\n最近创建了 MDX 支持手册。"));
        assert!(memory.contains("### 用户档案\n\n用户关注知识库长期维护。"));
        assert!(memory.find("### 近期条目摘要").unwrap() < memory.find("### 用户档案").unwrap());
    }

    #[test]
    fn runtime_memory_omits_empty_parts() {
        let memory = format_runtime_memory(Some("  ".to_string()), Some("用户档案".to_string()))
            .expect("profile should keep memory present");

        assert!(!memory.contains("近期条目摘要"));
        assert!(memory.contains("### 用户档案\n\n用户档案"));
    }

    #[test]
    fn runtime_memory_omits_empty_section() {
        assert!(format_runtime_memory(Some("  ".to_string()), None).is_none());
        assert!(format_runtime_memory(None, Some("\n".to_string())).is_none());
    }

    #[tokio::test]
    async fn build_system_prompt_uses_jsx_as_the_only_component_syntax() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let workspace = tmp.path();

        let prompt = build_system_prompt(
            workspace.to_str().expect("workspace path"),
            "## 平台契约",
            false,
        )
        .await;

        let contract_idx = prompt
            .find("## 文档输出格式优先级")
            .expect("format contract");
        let platform_idx = prompt.find("## 平台契约").expect("platform contract");
        assert!(contract_idx < platform_idx);
        assert!(prompt.contains("优先输出 JournalClaw 可渲染的 `.mdx` 文档"));
        assert!(prompt.contains("Markdown first"));
        assert!(prompt.contains("MDX JSX second"));
        assert!(prompt.contains("references/component-recipes.md"));
        assert!(!prompt.contains("references/layout-directives.md"));
        assert!(!prompt.contains("Layout directives"));
    }

    #[tokio::test]
    async fn build_system_prompt_groups_runtime_memory_before_skills() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let workspace = tmp.path();
        let dot_claude = workspace.join(".claude");
        let scripts = dot_claude.join("scripts");
        let skill_dir = dot_claude.join("skills").join("journal");
        let identity_dir = workspace.join("identity");

        std::fs::create_dir_all(&scripts).expect("scripts");
        std::fs::create_dir_all(&skill_dir).expect("skill dir");
        std::fs::create_dir_all(&identity_dir).expect("identity dir");
        std::fs::write(workspace.join("CLAUDE.md"), "用户默认指令").expect("user claude");
        std::fs::write(
            scripts.join("recent-summaries"),
            "#!/usr/bin/env bash\nprintf '最近摘要'",
        )
        .expect("recent script");
        std::fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: journal\ndescription: 统一笔记整理 skill\n---\n\n# Journal",
        )
        .expect("skill");
        std::fs::write(identity_dir.join("README.md"), "用户档案内容").expect("identity");

        let prompt = build_system_prompt(
            workspace.to_str().expect("workspace path"),
            "## 平台契约",
            false,
        )
        .await;

        let platform_idx = prompt.find("## 平台契约").expect("platform");
        let user_idx = prompt.find("## 用户指令\n\n用户默认指令").expect("user");
        let memory_idx = prompt.find("## 运行时记忆").expect("memory");
        let recent_idx = prompt.find("### 近期条目摘要\n\n最近摘要").expect("recent");
        let profile_idx = prompt
            .find("### 用户档案\n\n用户档案内容")
            .expect("profile");
        let skills_idx = prompt.find("## 可用 Skills").expect("skills");

        assert!(platform_idx < user_idx);
        assert!(user_idx < memory_idx);
        assert!(memory_idx < recent_idx);
        assert!(recent_idx < profile_idx);
        assert!(profile_idx < skills_idx);
    }
}
