// Store APIs are consumed by later automation command/service tasks.
#![allow(dead_code)]

use crate::automation_types::{AutomationRoutine, AutomationRun, RunManifest};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct AutomationStore {
    root: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RoutinesFile {
    routines: Vec<AutomationRoutine>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RunsFile {
    runs: Vec<AutomationRun>,
}

impl AutomationStore {
    pub fn for_workspace(workspace: &str) -> Self {
        Self {
            root: PathBuf::from(workspace).join(".Codex").join("automations"),
        }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn ensure_dirs(&self) -> Result<(), String> {
        fs::create_dir_all(self.root.join("manifests")).map_err(|e| e.to_string())
    }

    pub fn list_routines(&self) -> Result<Vec<AutomationRoutine>, String> {
        let file = self.read_routines_file()?;
        Ok(file.routines)
    }

    pub fn save_routines(&self, routines: &[AutomationRoutine]) -> Result<(), String> {
        self.ensure_dirs()?;
        let file = RoutinesFile {
            routines: routines.to_vec(),
        };
        write_json(&self.routines_path(), &file)
    }

    pub fn upsert_routine(&self, routine: AutomationRoutine) -> Result<(), String> {
        let mut routines = self.list_routines()?;
        if let Some(existing) = routines.iter_mut().find(|r| r.id == routine.id) {
            *existing = routine;
        } else {
            routines.push(routine);
        }
        self.save_routines(&routines)
    }

    pub fn get_routine(&self, id: &str) -> Result<AutomationRoutine, String> {
        self.list_routines()?
            .into_iter()
            .find(|r| r.id == id)
            .ok_or_else(|| format!("routine not found: {}", id))
    }

    pub fn delete_routine(&self, id: &str) -> Result<(), String> {
        let routines: Vec<AutomationRoutine> = self
            .list_routines()?
            .into_iter()
            .filter(|r| r.id != id)
            .collect();
        self.save_routines(&routines)
    }

    pub fn list_runs(&self) -> Result<Vec<AutomationRun>, String> {
        let file = self.read_runs_file()?;
        Ok(file.runs)
    }

    pub fn list_runs_for_routine(&self, routine_id: &str) -> Result<Vec<AutomationRun>, String> {
        let mut runs: Vec<AutomationRun> = self
            .list_runs()?
            .into_iter()
            .filter(|run| run.routine_id == routine_id)
            .collect();
        runs.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        Ok(runs)
    }

    pub fn upsert_run(&self, run: AutomationRun) -> Result<(), String> {
        self.ensure_dirs()?;
        if let Some(manifest) = &run.manifest {
            self.save_manifest(&run.id, manifest)?;
        }

        let mut runs = self.list_runs()?;
        if let Some(existing) = runs.iter_mut().find(|r| r.id == run.id) {
            *existing = run;
        } else {
            runs.push(run);
        }
        write_json(&self.runs_path(), &RunsFile { runs })
    }

    pub fn get_run(&self, run_id: &str) -> Result<AutomationRun, String> {
        self.list_runs()?
            .into_iter()
            .find(|run| run.id == run_id)
            .ok_or_else(|| format!("automation run not found: {}", run_id))
    }

    pub fn save_manifest(&self, run_id: &str, manifest: &RunManifest) -> Result<(), String> {
        self.ensure_dirs()?;
        write_json(&self.manifest_path(run_id), manifest)
    }

    fn read_routines_file(&self) -> Result<RoutinesFile, String> {
        read_json_or_default(&self.routines_path())
    }

    fn read_runs_file(&self) -> Result<RunsFile, String> {
        read_json_or_default(&self.runs_path())
    }

    fn routines_path(&self) -> PathBuf {
        self.root.join("routines.json")
    }

    fn runs_path(&self) -> PathBuf {
        self.root.join("runs.json")
    }

    fn manifest_path(&self, run_id: &str) -> PathBuf {
        self.root.join("manifests").join(format!("{}.json", run_id))
    }
}

fn read_json_or_default<T>(path: &Path) -> Result<T, String>
where
    T: for<'de> Deserialize<'de> + Default,
{
    if !path.exists() {
        return Ok(T::default());
    }

    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| format!("invalid json {}: {}", path.display(), e))
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automation_types::{
        AutomationRunStatus, AutomationRunSummary, AutomationRunTrigger, AutomationSchedule,
        AutomationScope,
    };

    fn routine(id: &str) -> AutomationRoutine {
        AutomationRoutine {
            id: id.to_string(),
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

    #[test]
    fn upsert_and_get_routine() {
        let dir = tempfile::tempdir().unwrap();
        let store = AutomationStore::for_workspace(dir.path().to_str().unwrap());
        store.upsert_routine(routine("r_1")).unwrap();

        assert_eq!(store.list_routines().unwrap().len(), 1);
        assert_eq!(store.get_routine("r_1").unwrap().title, "每日总结");
    }

    #[test]
    fn delete_routine_keeps_runs() {
        let dir = tempfile::tempdir().unwrap();
        let store = AutomationStore::for_workspace(dir.path().to_str().unwrap());
        store.upsert_routine(routine("r_1")).unwrap();
        store
            .upsert_run(AutomationRun {
                id: "run_1".to_string(),
                routine_id: "r_1".to_string(),
                trigger: AutomationRunTrigger::Manual,
                status: AutomationRunStatus::Succeeded,
                started_at: "2026-05-30T08:00:00+08:00".to_string(),
                completed_at: Some("2026-05-30T08:01:00+08:00".to_string()),
                error: None,
                conversation_id: Some("s_1".to_string()),
                manifest: Some(RunManifest {
                    summary: "完成".to_string(),
                    conversation_id: "s_1".to_string(),
                    ..RunManifest::default()
                }),
            })
            .unwrap();

        store.delete_routine("r_1").unwrap();

        assert!(store.list_routines().unwrap().is_empty());
        assert_eq!(store.list_runs_for_routine("r_1").unwrap().len(), 1);
        assert!(store.root().join("manifests/run_1.json").exists());
    }

    #[test]
    fn upsert_replaces_existing_routine() {
        let dir = tempfile::tempdir().unwrap();
        let store = AutomationStore::for_workspace(dir.path().to_str().unwrap());
        let mut r = routine("r_1");
        store.upsert_routine(r.clone()).unwrap();
        r.title = "新的标题".to_string();
        r.last_run = Some(AutomationRunSummary {
            id: "run_1".to_string(),
            status: AutomationRunStatus::Succeeded,
            trigger: AutomationRunTrigger::Manual,
            started_at: "2026-05-30T08:00:00+08:00".to_string(),
            completed_at: Some("2026-05-30T08:01:00+08:00".to_string()),
            summary: Some("完成".to_string()),
            error: None,
            conversation_id: Some("s_1".to_string()),
        });
        store.upsert_routine(r).unwrap();

        let routines = store.list_routines().unwrap();
        assert_eq!(routines.len(), 1);
        assert_eq!(routines[0].title, "新的标题");
        assert_eq!(routines[0].last_run.as_ref().unwrap().id, "run_1");
    }
}
