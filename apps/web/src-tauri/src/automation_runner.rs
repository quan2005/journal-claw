use crate::automation_types::{AutomationRoutine, AutomationRun, RunManifest};
use crate::conversation::{run_unattended_agent_session, UnattendedAgentRequest};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileStamp {
    mtime_nanos: u128,
    len: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct SnapshotDiff {
    created: Vec<String>,
    modified: Vec<String>,
    deleted: Vec<String>,
}

impl SnapshotDiff {
    fn files_changed(&self) -> Vec<String> {
        let mut changed =
            Vec::with_capacity(self.created.len() + self.modified.len() + self.deleted.len());
        changed.extend(self.created.iter().cloned());
        changed.extend(self.modified.iter().cloned());
        changed.extend(self.deleted.iter().cloned());
        changed.sort();
        changed
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct RoutineAgentFailure {
    pub message: String,
    pub conversation_id: Option<String>,
    pub manifest: Option<RunManifest>,
}

#[allow(dead_code)]
pub async fn run_routine_agent(
    app: AppHandle,
    workspace: &str,
    routine: &AutomationRoutine,
    run: &AutomationRun,
) -> Result<(String, RunManifest), RoutineAgentFailure> {
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
    .await;
    let after = snapshot_workspace(workspace);
    let changed = diff_snapshot_details(&before, &after);
    match result {
        Ok(result) => {
            let manifest = build_manifest(
                workspace,
                &result.session_id,
                &routine.title,
                &result.assistant_text,
                &result.files_read,
                &result.warnings,
                changed,
            );
            Ok((result.session_id, manifest))
        }
        Err(err) => {
            if err.session_id.is_empty() {
                return Err(RoutineAgentFailure {
                    message: err.message,
                    conversation_id: None,
                    manifest: None,
                });
            }
            let mut warnings = err.warnings.clone();
            warnings.push(format!("automation failed: {}", err.message));
            let manifest = build_manifest(
                workspace,
                &err.session_id,
                &routine.title,
                &err.assistant_text,
                &err.files_read,
                &warnings,
                changed,
            );
            Err(RoutineAgentFailure {
                message: err.message,
                conversation_id: Some(err.session_id),
                manifest: Some(manifest),
            })
        }
    }
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
    files_read: &[String],
    warnings: &[String],
    changed: SnapshotDiff,
) -> RunManifest {
    let files_changed = changed.files_changed();
    let entries_created = changed
        .created
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
        files_read: files_read.to_vec(),
        files_changed,
        entries_created,
        todos_changed,
        identities_changed,
        warnings: warnings.to_vec(),
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
        let Ok(meta) = std::fs::symlink_metadata(&path) else {
            continue;
        };
        if meta.file_type().is_symlink() && path.is_dir() {
            continue;
        }
        if meta.is_dir() {
            visit_dir(root, &path, out);
        } else if meta.is_file() {
            let mtime_nanos = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_nanos())
                .unwrap_or(0);
            out.insert(
                rel_str,
                FileStamp {
                    mtime_nanos,
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

fn diff_snapshot_details(
    before: &BTreeMap<String, FileStamp>,
    after: &BTreeMap<String, FileStamp>,
) -> SnapshotDiff {
    let created = after
        .keys()
        .filter(|path| !before.contains_key(*path))
        .cloned()
        .collect();
    let modified = after
        .iter()
        .filter_map(|(path, stamp)| match before.get(path) {
            Some(prev) if prev != stamp => Some(path.clone()),
            _ => None,
        })
        .collect();
    let deleted = before
        .keys()
        .filter(|path| !after.contains_key(*path))
        .cloned()
        .collect();
    SnapshotDiff {
        created,
        modified,
        deleted,
    }
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
            &["2605/29-旧总结.md".to_string()],
            &["warning".to_string()],
            SnapshotDiff {
                created: vec![
                    "2605/30-每日总结.md".to_string(),
                    "todos.md".to_string(),
                    "identities/张三.md".to_string(),
                    "raw/a.txt".to_string(),
                ],
                modified: Vec::new(),
                deleted: Vec::new(),
            },
        );
        assert_eq!(manifest.entries_created, vec!["2605/30-每日总结.md"]);
        assert_eq!(manifest.todos_changed, vec!["todos.md"]);
        assert_eq!(manifest.identities_changed, vec!["identities/张三.md"]);
        assert_eq!(manifest.files_read, vec!["2605/29-旧总结.md"]);
        assert_eq!(manifest.warnings, vec!["warning"]);
        assert_eq!(manifest.conversation_id, "s_1");
    }

    #[test]
    fn manifest_only_classifies_before_absent_journal_entries_as_created() {
        let manifest = build_manifest(
            "/tmp/ws",
            "s_1",
            "每日总结",
            "更新了总结。",
            &[],
            &[],
            SnapshotDiff {
                created: vec!["2605/30-new.md".to_string()],
                modified: vec!["2605/29-existing.md".to_string()],
                deleted: Vec::new(),
            },
        );

        assert_eq!(manifest.entries_created, vec!["2605/30-new.md"]);
        assert!(manifest
            .files_changed
            .contains(&"2605/29-existing.md".to_string()));
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
        let changed = diff_snapshot_details(&before, &after).files_changed();
        assert!(changed.contains(&"2605/29-a.md".to_string()));
        assert!(changed.contains(&"todos.md".to_string()));
    }

    #[test]
    fn snapshot_diff_detects_deleted_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("todos.md"), "- x").unwrap();
        let before = snapshot_workspace(root.to_str().unwrap());
        std::fs::remove_file(root.join("todos.md")).unwrap();
        let after = snapshot_workspace(root.to_str().unwrap());
        let diff = diff_snapshot_details(&before, &after);

        assert_eq!(diff.deleted, vec!["todos.md"]);
        assert!(diff.files_changed().contains(&"todos.md".to_string()));
    }

    #[test]
    fn snapshot_diff_detects_same_size_fast_edit() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("todos.md"), "abc").unwrap();
        let before = snapshot_workspace(root.to_str().unwrap());
        std::fs::write(root.join("todos.md"), "xyz").unwrap();
        let after = snapshot_workspace(root.to_str().unwrap());
        let diff = diff_snapshot_details(&before, &after);

        assert_eq!(diff.modified, vec!["todos.md"]);
    }

    #[cfg(unix)]
    #[test]
    fn snapshot_skips_symlinked_directories() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("outside.md"), "outside").unwrap();
        std::os::unix::fs::symlink(outside.path(), root.join("linked")).unwrap();

        let snapshot = snapshot_workspace(root.to_str().unwrap());

        assert!(!snapshot.contains_key("linked/outside.md"));
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
