use crate::automation_types::{AutomationRoutine, AutomationRun, RunManifest};
use crate::conversation::{run_unattended_agent_session, UnattendedAgentRequest};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileStamp {
    mtime_secs: u64,
    len: u64,
}

#[allow(dead_code)]
pub async fn run_routine_agent(
    app: AppHandle,
    workspace: &str,
    routine: &AutomationRoutine,
    run: &AutomationRun,
) -> Result<(String, RunManifest), String> {
    let before = snapshot_workspace(workspace);
    let prompt = build_unattended_prompt(routine, run);
    let result = run_unattended_agent_session(
        app,
        UnattendedAgentRequest {
            title: format!("自动化：{}", routine.title),
            user_message: prompt,
            context_files: Vec::new(),
        },
    )
    .await?;
    let after = snapshot_workspace(workspace);
    let changed = diff_snapshots(&before, &after);
    let manifest = build_manifest(
        workspace,
        &result.session_id,
        &routine.title,
        &result.assistant_text,
        changed,
    );
    Ok((result.session_id, manifest))
}

pub fn build_unattended_prompt(routine: &AutomationRoutine, run: &AutomationRun) -> String {
    format!(
        r#"你正在执行一个无人值守的 JournalClaw 自动化任务。

规则：
- 你拥有完整 Agent 权限，可以根据任务目标自主读取、创建、修改 workspace 文件。
- 不要向用户反问。信息不足时，记录不确定性并继续完成任务。
- 必须遵守 workspace AGENTS.md 和相关 skill 规则。
- 结束前用简短自然语言说明你做了什么。

Routine:
- id: {routine_id}
- title: {title}
- run_id: {run_id}
- schedule_trigger: {trigger:?}
- scope: {scope}

任务 Prompt:
{prompt}

结束前请尽量列出你读取和修改的文件。系统会自动生成 run manifest。"#,
        routine_id = routine.id,
        title = routine.title,
        run_id = run.id,
        trigger = run.trigger,
        scope = serde_json::to_string(&routine.scope).unwrap_or_else(|_| "{}".to_string()),
        prompt = routine.prompt
    )
}

fn build_manifest(
    _workspace: &str,
    conversation_id: &str,
    title: &str,
    assistant_text: &str,
    files_changed: Vec<String>,
) -> RunManifest {
    let entries_created = files_changed
        .iter()
        .filter(|p| is_journal_entry_path(p))
        .cloned()
        .collect();
    let todos_changed = files_changed
        .iter()
        .filter(|p| *p == "todos.md" || *p == "done.md")
        .cloned()
        .collect();
    let identities_changed = files_changed
        .iter()
        .filter(|p| p.starts_with("identities/"))
        .cloned()
        .collect();

    RunManifest {
        summary: summarize_text(title, assistant_text),
        files_read: Vec::new(),
        files_changed,
        entries_created,
        todos_changed,
        identities_changed,
        warnings: Vec::new(),
        conversation_id: conversation_id.to_string(),
    }
}

fn summarize_text(title: &str, assistant_text: &str) -> String {
    let first_line = assistant_text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("运行完成");
    let clipped: String = first_line.chars().take(120).collect();
    format!("{}：{}", title, clipped)
}

fn is_journal_entry_path(path: &str) -> bool {
    let mut parts = path.split('/');
    let Some(month) = parts.next() else {
        return false;
    };
    let Some(file) = parts.next() else {
        return false;
    };
    parts.next().is_none()
        && month.len() == 4
        && month.chars().all(|c| c.is_ascii_digit())
        && file.ends_with(".md")
}

fn snapshot_workspace(workspace: &str) -> BTreeMap<String, FileStamp> {
    let root = PathBuf::from(workspace);
    let mut out = BTreeMap::new();
    visit_dir(&root, &root, &mut out);
    out
}

fn visit_dir(root: &Path, dir: &Path, out: &mut BTreeMap<String, FileStamp>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(rel) = path.strip_prefix(root) else {
            continue;
        };
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if is_excluded_snapshot_path(&rel_str) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.is_dir() {
            visit_dir(root, &path, out);
        } else if meta.is_file() {
            let mtime_secs = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            out.insert(
                rel_str,
                FileStamp {
                    mtime_secs,
                    len: meta.len(),
                },
            );
        }
    }
}

fn is_excluded_snapshot_path(path: &str) -> bool {
    path == ".conversations"
        || path.starts_with(".conversations/")
        || path == ".Codex/automations"
        || path.starts_with(".Codex/automations/")
}

fn diff_snapshots(
    before: &BTreeMap<String, FileStamp>,
    after: &BTreeMap<String, FileStamp>,
) -> Vec<String> {
    after
        .iter()
        .filter_map(|(path, stamp)| match before.get(path) {
            None => Some(path.clone()),
            Some(prev) if prev != stamp => Some(path.clone()),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automation_types::{
        AutomationRunStatus, AutomationRunTrigger, AutomationSchedule, AutomationScope,
    };
    use chrono::Local;

    fn routine() -> AutomationRoutine {
        AutomationRoutine {
            id: "r_1".to_string(),
            title: "每日总结".to_string(),
            template_id: Some("daily-summary".to_string()),
            prompt: "总结昨天".to_string(),
            schedule: AutomationSchedule::Daily {
                time: "08:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            scope: AutomationScope::Relative {
                range: "yesterday".to_string(),
            },
            enabled: true,
            full_agent_access: true,
            created_at: "2026-05-30T08:00:00+08:00".to_string(),
            updated_at: "2026-05-30T08:00:00+08:00".to_string(),
            last_run: None,
        }
    }

    fn run() -> AutomationRun {
        AutomationRun {
            id: "run_1".to_string(),
            routine_id: "r_1".to_string(),
            trigger: AutomationRunTrigger::Manual,
            status: AutomationRunStatus::Running,
            started_at: Local::now().to_rfc3339(),
            completed_at: None,
            error: None,
            conversation_id: None,
            manifest: None,
        }
    }

    #[test]
    fn unattended_prompt_contains_no_question_rule() {
        let prompt = build_unattended_prompt(&routine(), &run());
        assert!(prompt.contains("不要向用户反问"));
        assert!(prompt.contains("完整 Agent 权限"));
        assert!(prompt.contains("总结昨天"));
    }

    #[test]
    fn manifest_classifies_changed_files() {
        let manifest = build_manifest(
            "/tmp/ws",
            "s_1",
            "每日总结",
            "创建了总结。",
            vec![
                "2605/30-每日总结.md".to_string(),
                "todos.md".to_string(),
                "identities/张三.md".to_string(),
                "raw/a.txt".to_string(),
            ],
        );
        assert_eq!(manifest.entries_created, vec!["2605/30-每日总结.md"]);
        assert_eq!(manifest.todos_changed, vec!["todos.md"]);
        assert_eq!(manifest.identities_changed, vec!["identities/张三.md"]);
        assert_eq!(manifest.conversation_id, "s_1");
    }

    #[test]
    fn snapshot_diff_detects_new_and_changed_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("2605")).unwrap();
        std::fs::write(root.join("2605/29-a.md"), "a").unwrap();
        let before = snapshot_workspace(root.to_str().unwrap());
        std::fs::write(root.join("2605/29-a.md"), "changed").unwrap();
        std::fs::write(root.join("todos.md"), "- x").unwrap();
        let after = snapshot_workspace(root.to_str().unwrap());
        let changed = diff_snapshots(&before, &after);
        assert!(changed.contains(&"2605/29-a.md".to_string()));
        assert!(changed.contains(&"todos.md".to_string()));
    }

    #[test]
    fn snapshot_excludes_conversations_and_automation_state() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join(".conversations")).unwrap();
        std::fs::create_dir_all(root.join(".Codex/automations")).unwrap();
        std::fs::write(root.join(".conversations/s_1.json"), "{}").unwrap();
        std::fs::write(root.join(".Codex/automations/routines.json"), "{}").unwrap();
        std::fs::write(root.join("todos.md"), "- x").unwrap();

        let snapshot = snapshot_workspace(root.to_str().unwrap());

        assert!(snapshot.contains_key("todos.md"));
        assert!(!snapshot.contains_key(".conversations/s_1.json"));
        assert!(!snapshot.contains_key(".Codex/automations/routines.json"));
    }
}
