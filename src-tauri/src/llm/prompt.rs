use std::path::PathBuf;

fn get_macos_version() -> String {
    std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|v| v.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Build the full system prompt for the built-in AI engine.
///
/// Concatenates:
/// 1. Embedded CLAUDE.md (agent instructions from workspace template)
/// 2. User's workspace/CLAUDE.md (personal secretary instructions)
/// 3. Recent entry summaries (via recent-summaries script)
/// 4. Available skills list
/// 5. identity/README.md (user's own profile)
pub async fn build_system_prompt(
    workspace_path: &str,
    workspace_claude_md: &str,
    global_skills_enabled: bool,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    // 0. Environment context
    let now = chrono::Local::now();
    let env_info = format!(
        "## 环境信息\n\n- 工作目录: {}\n- 操作系统: macOS {}\n- 当前时间: {}",
        workspace_path,
        get_macos_version(),
        now.format("%Y-%m-%d %H:%M (%A)"),
    );
    parts.push(env_info);

    // 1. Agent instructions (embedded at compile time in ai_processor.rs, passed in here)
    parts.push(workspace_claude_md.to_string());

    // 2. User's workspace/CLAUDE.md
    let user_md = PathBuf::from(workspace_path).join("CLAUDE.md");
    if let Ok(content) = tokio::fs::read_to_string(&user_md).await {
        if !content.trim().is_empty() {
            parts.push(format!("\n## 用户指令\n\n{}", content));
        }
    }

    // 3. Recent summaries (run the script)
    if let Some(output) =
        run_workspace_script(workspace_path, "recent-summaries", &["-n", "15"]).await
    {
        if !output.trim().is_empty() {
            parts.push(format!("\n## 近期条目摘要\n\n{}", output));
        }
    }

    // 4. Available skills — details are in the load_skill tool definition
    let skills = scan_skills(workspace_path, global_skills_enabled).await;
    if !skills.is_empty() {
        parts.push("\n## 可用 Skills\n\n当用户提到 /skill-name 或你判断需要某个 skill 时，调用 load_skill 工具加载其规则。".to_string());
    }

    // 5. identity/README.md
    let identity_readme = PathBuf::from(workspace_path)
        .join("identity")
        .join("README.md");
    if let Ok(content) = tokio::fs::read_to_string(&identity_readme).await {
        if !content.trim().is_empty() {
            parts.push(format!("\n## 用户档案\n\n{}", content));
        }
    }

    parts.join("\n\n")
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

/// Scan workspace and global skill directories, return (dir_name, description) pairs.
pub async fn scan_skills(
    workspace_path: &str,
    global_skills_enabled: bool,
) -> Vec<(String, String)> {
    let mut skills = Vec::new();

    let mut dirs = vec![PathBuf::from(workspace_path).join(".claude").join("skills")];
    if global_skills_enabled {
        dirs.push(
            dirs::home_dir()
                .unwrap_or_default()
                .join(".claude")
                .join("skills"),
        );
    }

    for dir in dirs {
        let mut entries = match tokio::fs::read_dir(&dir).await {
            Ok(e) => e,
            Err(_) => continue,
        };

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

            // Parse frontmatter for description
            let description = parse_skill_description(&content).unwrap_or_default();
            skills.push((dir_name, description));
        }
    }

    skills.sort_by(|a, b| a.0.cmp(&b.0));
    skills.dedup_by(|a, b| a.0 == b.0); // project skills take precedence
    skills
}

pub fn parse_skill_description(content: &str) -> Option<String> {
    let trimmed = content.trim();
    if !trimmed.starts_with("---") {
        return None;
    }
    let rest = &trimmed[3..];
    let end = rest.find("---")?;
    let yaml_block = &rest[..end];

    for line in yaml_block.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("description:") {
            return Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
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
}
