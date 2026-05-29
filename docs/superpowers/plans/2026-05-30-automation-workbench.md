# Automation Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a general automation workbench where high-quality templates create editable scheduled Routines, and each Routine runs as an unattended full-Agent conversation with manifest tracking.

**Architecture:** Add a focused Rust automation subsystem for types, schedule calculation, storage, templates, service lifecycle, runner, and Tauri commands. Reuse the existing conversation runner by adding an unattended execution entrypoint instead of building a second Agent engine. Add TypeScript IPC wrappers and a restrained React workbench UI that treats templates as entry points and Routines as the saved core model.

**Tech Stack:** Tauri v2, Rust, serde/serde_json, chrono, tokio, uuid, React 19, TypeScript, Vitest.

---

## File Structure

### Rust Backend

- Create `src-tauri/src/automation_types.rs`
  - Shared serializable types: schedules, scopes, templates, routines, runs, manifests, command requests.
- Create `src-tauri/src/automation_schedule.rs`
  - Pure schedule parsing, validation, and next-run calculation.
- Create `src-tauri/src/automation_store.rs`
  - Workspace-backed JSON storage under `.Codex/automations/`.
- Create `src-tauri/src/automation_templates.rs`
  - Built-in template registry.
- Create `src-tauri/src/automation_runner.rs`
  - Build unattended prompt, invoke conversation runner, snapshot changed files, save manifest.
- Create `src-tauri/src/automation.rs`
  - Runtime service: timers, in-flight prevention, lifecycle, status events.
- Create `src-tauri/src/automation_commands.rs`
  - Tauri command boundary.
- Modify `src-tauri/src/conversation.rs`
  - Add reusable `run_unattended_agent_session()` that runs synchronously and persists a conversation.
- Modify `src-tauri/src/main.rs`
  - Register modules, managed state, scheduler startup, and commands.
- Modify `src-tauri/src/auto_lint.rs`
  - Expose a small helper only if the `journal-lint` template needs to call existing lint logic directly.

### TypeScript / React

- Modify `src/types.ts`
  - Add automation types and extend `TreeSelection` / view model.
- Modify `src/lib/tauri.ts`
  - Add IPC wrappers and request/response types.
- Modify `src/tests/ipc-contract.test.ts`
  - Add IPC contract coverage for automation wrappers.
- Create `src/hooks/useAutomation.ts`
  - Fetch templates, routines, runs; perform create/update/delete/run/pause/resume.
- Create `src/components/AutomationWorkbench.tsx`
  - Main workbench surface.
- Create `src/components/AutomationRoutineList.tsx`
  - Sidebar-style routine list.
- Create `src/components/AutomationTemplateGrid.tsx`
  - Template entry cards.
- Create `src/components/AutomationRoutineDetail.tsx`
  - Selected routine details and last manifest.
- Create `src/components/AutomationEditorDialog.tsx`
  - New/edit modal.
- Modify `src/components/TreeSidebar.tsx`
  - Add Automation entry.
- Modify `src/contexts/UIContext.tsx`
  - Add `automation` view support.
- Modify `src/App.tsx`
  - Route center pane to Automation Workbench and open run conversation details.
- Modify `src/settings/components/SectionAutomation.tsx`
  - Downgrade to global automation settings and link to workbench.

---

## Task 1: Rust Domain Types

**Files:**
- Create: `src-tauri/src/automation_types.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `cd src-tauri && cargo test automation_types`

- [ ] **Step 1: Create serializable automation domain types**

Create `src-tauri/src/automation_types.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AutomationSchedule {
    Daily { time: String, timezone: String },
    Weekdays { time: String, timezone: String },
    Weekly { weekday: u32, time: String, timezone: String },
    Monthly { day: u32, time: String, timezone: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AutomationScope {
    Relative { range: String },
    RecentDays { days: u32 },
    Month { year_month: String },
    Tags { tags: Vec<String>, range: Option<Box<AutomationScope>> },
    Identities { identity_ids: Vec<String>, range: Option<Box<AutomationScope>> },
    Keyword { query: String, range: Option<Box<AutomationScope>> },
    Workspace,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutomationTemplate {
    pub id: String,
    pub title: String,
    pub category: String,
    pub description: String,
    pub default_prompt: String,
    pub default_schedule: AutomationSchedule,
    pub default_scope: AutomationScope,
    pub default_context: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutomationRoutine {
    pub id: String,
    pub title: String,
    pub template_id: Option<String>,
    pub prompt: String,
    pub schedule: AutomationSchedule,
    pub scope: AutomationScope,
    pub enabled: bool,
    pub full_agent_access: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_run: Option<AutomationRunSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutomationRunSummary {
    pub id: String,
    pub status: AutomationRunStatus,
    pub trigger: AutomationRunTrigger,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub summary: Option<String>,
    pub error: Option<String>,
    pub conversation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutomationRun {
    pub id: String,
    pub routine_id: String,
    pub trigger: AutomationRunTrigger,
    pub status: AutomationRunStatus,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub error: Option<String>,
    pub conversation_id: Option<String>,
    pub manifest: Option<RunManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AutomationRunTrigger {
    Scheduled,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AutomationRunStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct RunManifest {
    pub summary: String,
    pub files_read: Vec<String>,
    pub files_changed: Vec<String>,
    pub entries_created: Vec<String>,
    pub todos_changed: Vec<String>,
    pub identities_changed: Vec<String>,
    pub warnings: Vec<String>,
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CreateRoutineRequest {
    pub title: String,
    pub template_id: Option<String>,
    pub prompt: String,
    pub schedule: AutomationSchedule,
    pub scope: AutomationScope,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct UpdateRoutineRequest {
    pub title: Option<String>,
    pub prompt: Option<String>,
    pub schedule: Option<AutomationSchedule>,
    pub scope: Option<AutomationScope>,
    pub enabled: Option<bool>,
}

impl AutomationRun {
    pub fn summary(&self) -> AutomationRunSummary {
        AutomationRunSummary {
            id: self.id.clone(),
            status: self.status.clone(),
            trigger: self.trigger.clone(),
            started_at: self.started_at.clone(),
            completed_at: self.completed_at.clone(),
            summary: self.manifest.as_ref().map(|m| m.summary.clone()),
            error: self.error.clone(),
            conversation_id: self.conversation_id.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routine_round_trips_schedule_and_scope() {
        let routine = AutomationRoutine {
            id: "r_daily".to_string(),
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
        };

        let json = serde_json::to_string(&routine).unwrap();
        let parsed: AutomationRoutine = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, routine);
    }

    #[test]
    fn run_summary_copies_manifest_summary() {
        let run = AutomationRun {
            id: "run_1".to_string(),
            routine_id: "r_1".to_string(),
            trigger: AutomationRunTrigger::Manual,
            status: AutomationRunStatus::Succeeded,
            started_at: "2026-05-30T08:00:00+08:00".to_string(),
            completed_at: Some("2026-05-30T08:01:00+08:00".to_string()),
            error: None,
            conversation_id: Some("s_1".to_string()),
            manifest: Some(RunManifest {
                summary: "创建 1 篇日志".to_string(),
                conversation_id: "s_1".to_string(),
                ..RunManifest::default()
            }),
        };

        assert_eq!(run.summary().summary.as_deref(), Some("创建 1 篇日志"));
        assert_eq!(run.summary().conversation_id.as_deref(), Some("s_1"));
    }
}
```

- [ ] **Step 2: Register the module**

Modify the top of `src-tauri/src/main.rs`:

```rust
mod automation_types;
```

- [ ] **Step 3: Run the focused tests**

Run:

```bash
cd src-tauri && cargo test automation_types
```

Expected: both `automation_types` tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/automation_types.rs src-tauri/src/main.rs
git commit -m "feat: add automation domain types"
```

---

## Task 2: Schedule Calculation

**Files:**
- Create: `src-tauri/src/automation_schedule.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `cd src-tauri && cargo test automation_schedule`

- [ ] **Step 1: Add schedule validation and next-run calculation**

Create `src-tauri/src/automation_schedule.rs`:

```rust
use crate::automation_types::AutomationSchedule;
use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, Timelike, Weekday};

pub fn parse_time(time: &str) -> Result<(u32, u32), String> {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() != 2 {
        return Err("time must use HH:MM".to_string());
    }
    let hour: u32 = parts[0].parse().map_err(|_| "hour must be numeric".to_string())?;
    let minute: u32 = parts[1].parse().map_err(|_| "minute must be numeric".to_string())?;
    if hour > 23 || minute > 59 {
        return Err("time must be between 00:00 and 23:59".to_string());
    }
    Ok((hour, minute))
}

pub fn validate_schedule(schedule: &AutomationSchedule) -> Result<(), String> {
    match schedule {
        AutomationSchedule::Daily { time, timezone }
        | AutomationSchedule::Weekdays { time, timezone } => {
            parse_time(time)?;
            validate_timezone(timezone)
        }
        AutomationSchedule::Weekly {
            weekday,
            time,
            timezone,
        } => {
            if *weekday > 6 {
                return Err("weekday must be 0..6 where 0 is Sunday".to_string());
            }
            parse_time(time)?;
            validate_timezone(timezone)
        }
        AutomationSchedule::Monthly {
            day,
            time,
            timezone,
        } => {
            if *day == 0 || *day > 31 {
                return Err("monthly day must be 1..31".to_string());
            }
            parse_time(time)?;
            validate_timezone(timezone)
        }
    }
}

fn validate_timezone(timezone: &str) -> Result<(), String> {
    if timezone.trim().is_empty() {
        return Err("timezone is required".to_string());
    }
    if timezone != "Asia/Hong_Kong" && timezone != "Local" {
        return Err("first version supports Asia/Hong_Kong or Local timezone".to_string());
    }
    Ok(())
}

pub fn next_run_after(
    schedule: &AutomationSchedule,
    after: NaiveDateTime,
) -> Result<NaiveDateTime, String> {
    validate_schedule(schedule)?;
    match schedule {
        AutomationSchedule::Daily { time, .. } => next_daily(time, after),
        AutomationSchedule::Weekdays { time, .. } => next_weekdays(time, after),
        AutomationSchedule::Weekly { weekday, time, .. } => next_weekly(*weekday, time, after),
        AutomationSchedule::Monthly { day, time, .. } => next_monthly(*day, time, after),
    }
}

pub fn next_run_from_now(schedule: &AutomationSchedule) -> Result<NaiveDateTime, String> {
    next_run_after(schedule, Local::now().naive_local())
}

fn at_date(date: NaiveDate, time: &str) -> Result<NaiveDateTime, String> {
    let (hour, minute) = parse_time(time)?;
    date.and_hms_opt(hour, minute, 0)
        .ok_or_else(|| "invalid date/time".to_string())
}

fn next_daily(time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    let today = at_date(after.date(), time)?;
    if after < today {
        Ok(today)
    } else {
        Ok(today + Duration::days(1))
    }
}

fn next_weekdays(time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    for offset in 0..=7 {
        let date = after.date() + Duration::days(offset);
        let weekday = date.weekday();
        if matches!(
            weekday,
            Weekday::Mon | Weekday::Tue | Weekday::Wed | Weekday::Thu | Weekday::Fri
        ) {
            let candidate = at_date(date, time)?;
            if after < candidate {
                return Ok(candidate);
            }
        }
    }
    Err("could not compute weekday schedule".to_string())
}

fn next_weekly(weekday: u32, time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    for offset in 0..=7 {
        let date = after.date() + Duration::days(offset);
        if date.weekday().num_days_from_sunday() == weekday {
            let candidate = at_date(date, time)?;
            if after < candidate {
                return Ok(candidate);
            }
        }
    }
    Err("could not compute weekly schedule".to_string())
}

fn next_monthly(day: u32, time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    let mut year = after.year();
    let mut month = after.month();
    for _ in 0..14 {
        if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
            let candidate = at_date(date, time)?;
            if after < candidate {
                return Ok(candidate);
            }
        }
        if month == 12 {
            year += 1;
            month = 1;
        } else {
            month += 1;
        }
    }
    Err("could not compute monthly schedule".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").unwrap()
    }

    #[test]
    fn rejects_invalid_time() {
        assert!(parse_time("24:00").is_err());
        assert!(parse_time("08").is_err());
        assert!(parse_time("aa:bb").is_err());
    }

    #[test]
    fn daily_uses_today_when_time_is_future() {
        let schedule = AutomationSchedule::Daily {
            time: "08:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 07:30:00")).unwrap(),
            dt("2026-05-30 08:00:00")
        );
    }

    #[test]
    fn daily_uses_tomorrow_when_time_has_passed() {
        let schedule = AutomationSchedule::Daily {
            time: "08:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 08:00:00")).unwrap(),
            dt("2026-05-31 08:00:00")
        );
    }

    #[test]
    fn weekdays_skips_weekend() {
        let schedule = AutomationSchedule::Weekdays {
            time: "09:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 10:00:00")).unwrap(),
            dt("2026-06-01 09:00:00")
        );
    }

    #[test]
    fn weekly_uses_requested_weekday() {
        let schedule = AutomationSchedule::Weekly {
            weekday: 5,
            time: "17:30".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 10:00:00")).unwrap(),
            dt("2026-06-05 17:30:00")
        );
    }

    #[test]
    fn monthly_skips_month_without_day() {
        let schedule = AutomationSchedule::Monthly {
            day: 31,
            time: "09:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-06-01 00:00:00")).unwrap(),
            dt("2026-07-31 09:00:00")
        );
    }
}
```

- [ ] **Step 2: Register the module**

Modify `src-tauri/src/main.rs`:

```rust
mod automation_schedule;
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
cd src-tauri && cargo test automation_schedule
```

Expected: all schedule tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/automation_schedule.rs src-tauri/src/main.rs
git commit -m "feat: add automation schedule calculation"
```

---

## Task 3: Automation Store

**Files:**
- Create: `src-tauri/src/automation_store.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `cd src-tauri && cargo test automation_store`

- [ ] **Step 1: Add workspace-backed JSON storage**

Create `src-tauri/src/automation_store.rs`:

```rust
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
        AutomationRunStatus, AutomationRunTrigger, AutomationSchedule, AutomationScope,
        AutomationRunSummary,
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
```

- [ ] **Step 2: Register the module**

Modify `src-tauri/src/main.rs`:

```rust
mod automation_store;
```

- [ ] **Step 3: Run store tests**

Run:

```bash
cd src-tauri && cargo test automation_store
```

Expected: all store tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/automation_store.rs src-tauri/src/main.rs
git commit -m "feat: add automation workspace store"
```

---

## Task 4: Built-In Templates

**Files:**
- Create: `src-tauri/src/automation_templates.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `cd src-tauri && cargo test automation_templates`

- [ ] **Step 1: Add built-in template registry**

Create `src-tauri/src/automation_templates.rs`:

```rust
use crate::automation_types::{AutomationSchedule, AutomationScope, AutomationTemplate};

pub fn built_in_templates() -> Vec<AutomationTemplate> {
    vec![
        template(
            "daily-summary",
            "每日总结",
            "总结",
            "每天读取昨天，生成一篇自动化日志条目。",
            "阅读昨天的日志、待办变化和相关身份画像。请自主判断最合适的产物形式，通常创建一篇每日总结日志。不要向用户反问；信息不足时记录不确定性。结束前生成 run manifest。",
            AutomationSchedule::Daily {
                time: "08:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Relative {
                range: "yesterday".to_string(),
            },
            vec!["@todos.md", "@identities"],
        ),
        template(
            "weekly-summary",
            "周报总结",
            "总结",
            "每周聚合进展、会议脉络、待办状态和关键风险。",
            "阅读本周日志、待办和相关身份画像，生成一篇周报。突出项目进展、关键决策、风险和下周行动。可以自主创建日志或补充待办，结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 5,
                time: "17:30".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Relative {
                range: "this_week".to_string(),
            },
            vec!["@todos.md", "@done.md", "@identities"],
        ),
        template(
            "monthly-review",
            "月度回顾",
            "总结",
            "总结上月主题演进、重要人物、项目变化。",
            "阅读上月日志，生成月度回顾。关注长期主题、项目阶段变化、人物关系和未解决问题。可以自主创建或更新相关日志，结束前生成 run manifest。",
            AutomationSchedule::Monthly {
                day: 1,
                time: "09:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Relative {
                range: "last_month".to_string(),
            },
            vec!["@todos.md", "@identities"],
        ),
        template(
            "journal-lint",
            "日志库整理",
            "维护",
            "复用 /lint 规则，定期维护日志库。",
            "运行 /lint。严格遵守日志库维护规则：只整理关联记录区和 Identity 档案，不改日志正文，不改 raw/。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 0,
                time: "03:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Workspace,
            vec!["@/lint"],
        ),
        template(
            "todo-digest",
            "待办提取与归并",
            "维护",
            "从近期日志提取行动项，更新 todos.md / done.md。",
            "阅读最近 24 小时日志，提取明确行动项，去重并更新 todos.md / done.md。保留来源路径。结束前生成 run manifest。",
            AutomationSchedule::Daily {
                time: "21:30".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::RecentDays { days: 1 },
            vec!["@todos.md", "@done.md"],
        ),
        template(
            "identity-maintenance",
            "身份画像更新",
            "维护",
            "补充人物、项目、概念画像。",
            "阅读最近 7 天日志和 identities/，补充或修正人物、项目、概念画像。保留证据来源。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 1,
                time: "09:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::RecentDays { days: 7 },
            vec!["@identities"],
        ),
        template(
            "project-watch",
            "项目观察",
            "观察",
            "围绕项目或关键词持续观察。",
            "围绕用户配置的项目关键词或标签，阅读相关日志并生成观察报告。关注变化、阻塞、风险和下一步。结束前生成 run manifest。",
            AutomationSchedule::Daily {
                time: "22:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Keyword {
                query: "项目关键词".to_string(),
                range: Some(Box::new(AutomationScope::RecentDays { days: 7 })),
            },
            vec!["@todos.md", "@identities"],
        ),
        template(
            "person-watch",
            "人物动态追踪",
            "观察",
            "追踪指定人物相关动态和协作线索。",
            "围绕指定身份画像阅读近期日志，总结人物相关动态、承诺、协作风险和需要跟进的问题。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 1,
                time: "10:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Identities {
                identity_ids: Vec::new(),
                range: Some(Box::new(AutomationScope::RecentDays { days: 7 })),
            },
            vec!["@identities", "@todos.md"],
        ),
        template(
            "topic-research",
            "主题研究",
            "观察",
            "持续整理某个主题的观察和材料。",
            "围绕指定主题阅读相关日志，沉淀趋势、证据、问题和下一步研究方向。结束前生成 run manifest。",
            AutomationSchedule::Weekly {
                weekday: 5,
                time: "16:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Keyword {
                query: "主题关键词".to_string(),
                range: Some(Box::new(AutomationScope::RecentDays { days: 30 })),
            },
            vec!["@topics"],
        ),
        template(
            "custom-agent",
            "自定义 Agent",
            "高级",
            "从空白 prompt 创建定时完整 Agent。",
            "请写清楚这个自动化要完成的目标、输入范围和产物要求。自动化运行时不会向用户反问，结束前必须生成 run manifest。",
            AutomationSchedule::Daily {
                time: "08:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            AutomationScope::Workspace,
            Vec::new(),
        ),
    ]
}

pub fn get_template(id: &str) -> Option<AutomationTemplate> {
    built_in_templates().into_iter().find(|t| t.id == id)
}

fn template(
    id: &str,
    title: &str,
    category: &str,
    description: &str,
    default_prompt: &str,
    default_schedule: AutomationSchedule,
    default_scope: AutomationScope,
    default_context: Vec<&str>,
) -> AutomationTemplate {
    AutomationTemplate {
        id: id.to_string(),
        title: title.to_string(),
        category: category.to_string(),
        description: description.to_string(),
        default_prompt: default_prompt.to_string(),
        default_schedule,
        default_scope,
        default_context: default_context.into_iter().map(|s| s.to_string()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_contains_required_templates() {
        let ids: Vec<String> = built_in_templates().into_iter().map(|t| t.id).collect();
        assert!(ids.contains(&"daily-summary".to_string()));
        assert!(ids.contains(&"weekly-summary".to_string()));
        assert!(ids.contains(&"monthly-review".to_string()));
        assert!(ids.contains(&"journal-lint".to_string()));
        assert!(ids.contains(&"todo-digest".to_string()));
        assert!(ids.contains(&"identity-maintenance".to_string()));
        assert!(ids.contains(&"project-watch".to_string()));
        assert!(ids.contains(&"person-watch".to_string()));
        assert!(ids.contains(&"topic-research".to_string()));
        assert!(ids.contains(&"custom-agent".to_string()));
    }

    #[test]
    fn custom_agent_is_marked_advanced() {
        let template = get_template("custom-agent").unwrap();
        assert_eq!(template.category, "高级");
    }

    #[test]
    fn journal_lint_prompt_uses_lint_skill() {
        let template = get_template("journal-lint").unwrap();
        assert!(template.default_prompt.contains("/lint"));
        assert!(template.default_prompt.contains("不改 raw/"));
    }
}
```

- [ ] **Step 2: Register the module**

Modify `src-tauri/src/main.rs`:

```rust
mod automation_templates;
```

- [ ] **Step 3: Run template tests**

Run:

```bash
cd src-tauri && cargo test automation_templates
```

Expected: all template tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/automation_templates.rs src-tauri/src/main.rs
git commit -m "feat: add automation templates"
```

---

## Task 5: Unattended Conversation Entry Point

**Files:**
- Modify: `src-tauri/src/conversation.rs`
- Test: `cd src-tauri && cargo test conversation`

- [ ] **Step 1: Add public request/result types near conversation types**

Modify `src-tauri/src/conversation.rs` after `ImageAttachment`:

```rust
#[derive(Debug, Clone)]
pub struct UnattendedAgentRequest {
    pub title: String,
    pub user_message: String,
    pub context_files: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct UnattendedAgentResult {
    pub session_id: String,
    pub assistant_text: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
}
```

- [ ] **Step 2: Add helper to extract assistant text**

Add below `now_secs()`:

```rust
fn collect_assistant_text(messages: &[Message]) -> String {
    messages
        .iter()
        .rev()
        .find(|m| m.role == Role::Assistant)
        .map(|m| {
            m.content
                .iter()
                .filter_map(|block| match block {
                    ContentBlock::Text { text } => Some(text.as_str()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}
```

- [ ] **Step 3: Add tests for assistant text extraction**

Inside `#[cfg(test)] mod tests` in `conversation.rs`, add:

```rust
#[test]
fn collect_assistant_text_uses_latest_assistant_message() {
    let messages = vec![
        Message {
            role: Role::Assistant,
            content: vec![ContentBlock::Text {
                text: "old".to_string(),
            }],
        },
        Message {
            role: Role::User,
            content: vec![ContentBlock::Text {
                text: "again".to_string(),
            }],
        },
        Message {
            role: Role::Assistant,
            content: vec![
                ContentBlock::Text {
                    text: "new 1".to_string(),
                },
                ContentBlock::Text {
                    text: "new 2".to_string(),
                },
            ],
        },
    ];

    assert_eq!(collect_assistant_text(&messages), "new 1\nnew 2");
}
```

- [ ] **Step 4: Add synchronous unattended runner**

Add below `conversation_send()`:

```rust
pub async fn run_unattended_agent_session(
    app: AppHandle,
    request: UnattendedAgentRequest,
) -> Result<UnattendedAgentResult, String> {
    let cfg = config::load_config(&app)?;
    let workspace = cfg.workspace_path.clone();
    let session_id = generate_session_id();
    let global_skills = crate::workspace_settings::is_global_skills_enabled(&app);
    let base_system = llm::prompt::build_system_prompt(
        &workspace,
        crate::ai_processor::WORKSPACE_CLAUDE_MD,
        global_skills,
    )
    .await;
    let context_section = if request.context_files.is_empty() {
        String::new()
    } else {
        build_context_section(&request.context_files)
    };
    let system_prompt = format!("{}{}", base_system, context_section);

    let mut session = ConversationSession {
        messages: vec![Message {
            role: Role::User,
            content: vec![ContentBlock::Text {
                text: request.user_message.clone(),
            }],
        }],
        system_prompt: Some(system_prompt.clone()),
        cancel: Some(CancellationToken::new()),
        workspace: workspace.clone(),
        pending_user_messages: Vec::new(),
        title: Some(request.title.clone()),
        title_locked: true,
        created_at: now_secs(),
        first_turn_done: false,
        context: None,
        context_files: None,
        elapsed_secs: 0.0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        turn_started_at: Some(std::time::Instant::now()),
    };

    {
        let store = app.state::<ConversationStore>();
        store
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .insert(session_id.clone(), session);
    }

    let engine = create_engine(&cfg);
    let cancel = CancellationToken::new();
    let messages = vec![Message {
        role: Role::User,
        content: vec![ContentBlock::Text {
            text: request.user_message,
        }],
    }];

    let result = run_conversation_turn(
        engine.as_ref(),
        &workspace,
        &system_prompt,
        messages,
        &session_id,
        &app,
        cancel,
        global_skills,
    )
    .await;

    let store = app.state::<ConversationStore>();
    match result {
        Ok((updated_messages, input_tokens, output_tokens)) => {
            let assistant_text = collect_assistant_text(&updated_messages);
            let mut guard = store.0.lock().map_err(|e| e.to_string())?;
            session = guard
                .remove(&session_id)
                .ok_or_else(|| format!("session missing after run: {}", session_id))?;
            if let Some(started) = session.turn_started_at.take() {
                session.elapsed_secs += started.elapsed().as_secs_f64();
            }
            session.total_input_tokens = input_tokens;
            session.total_output_tokens = output_tokens;
            session.messages = updated_messages;
            session.cancel = None;
            session.first_turn_done = true;
            save_session_to_disk(&workspace, &session_id, &session);
            guard.insert(session_id.clone(), session);
            Ok(UnattendedAgentResult {
                session_id,
                assistant_text,
                input_tokens,
                output_tokens,
            })
        }
        Err((err, partial_messages, input_tokens, output_tokens)) => {
            let mut guard = store.0.lock().map_err(|e| e.to_string())?;
            if let Some(session) = guard.get_mut(&session_id) {
                session.messages = partial_messages;
                session.cancel = None;
                session.total_input_tokens = input_tokens;
                session.total_output_tokens = output_tokens;
                save_session_to_disk(&workspace, &session_id, session);
            }
            Err(format!("unattended agent failed: {}", err))
        }
    }
}
```

- [ ] **Step 5: Run conversation tests**

Run:

```bash
cd src-tauri && cargo test conversation
```

Expected: existing tests and the new extraction test pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/conversation.rs
git commit -m "feat: add unattended conversation runner"
```

---

## Task 6: Automation Runner

**Files:**
- Create: `src-tauri/src/automation_runner.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `cd src-tauri && cargo test automation_runner`

- [ ] **Step 1: Add workspace snapshot and manifest helpers**

Create `src-tauri/src/automation_runner.rs`:

```rust
use crate::automation_types::{AutomationRoutine, AutomationRun, RunManifest};
use crate::conversation::{run_unattended_agent_session, UnattendedAgentRequest};
use chrono::Local;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileStamp {
    mtime_secs: u64,
    len: u64,
}

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
    workspace: &str,
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
        if rel_str.starts_with(".conversations/") || rel_str.starts_with(".Codex/automations/") {
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
}
```

- [ ] **Step 2: Register the module**

Modify `src-tauri/src/main.rs`:

```rust
mod automation_runner;
```

- [ ] **Step 3: Run runner tests**

Run:

```bash
cd src-tauri && cargo test automation_runner
```

Expected: all runner helper tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/automation_runner.rs src-tauri/src/main.rs src-tauri/src/conversation.rs
git commit -m "feat: add automation agent runner"
```

---

## Task 7: Automation Service and Commands

**Files:**
- Create: `src-tauri/src/automation.rs`
- Create: `src-tauri/src/automation_commands.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `cd src-tauri && cargo test automation`

- [ ] **Step 1: Add service state and lifecycle**

Create `src-tauri/src/automation.rs`:

```rust
use crate::automation_runner::run_routine_agent;
use crate::automation_schedule::{next_run_after, next_run_from_now};
use crate::automation_store::AutomationStore;
use crate::automation_types::{
    AutomationRoutine, AutomationRun, AutomationRunStatus, AutomationRunTrigger,
    CreateRoutineRequest, UpdateRoutineRequest,
};
use crate::config;
use chrono::Local;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::Notify;
use uuid::Uuid;

pub struct AutomationNotify(pub Arc<Notify>);

pub struct AutomationRuntime {
    pub in_flight: Mutex<HashSet<String>>,
}

impl Default for AutomationRuntime {
    fn default() -> Self {
        Self {
            in_flight: Mutex::new(HashSet::new()),
        }
    }
}

pub fn start_scheduler(app: AppHandle) {
    let notify = app.state::<AutomationNotify>().0.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let wait = next_wait_duration(&app).unwrap_or(std::time::Duration::from_secs(60));
            tokio::select! {
                _ = tokio::time::sleep(wait) => {
                    run_due_routines(app.clone()).await;
                }
                _ = notify.notified() => {
                    continue;
                }
            }
        }
    });
}

pub fn notify_scheduler(app: &AppHandle) {
    let notify = app.state::<AutomationNotify>();
    notify.0.notify_waiters();
}

pub fn create_routine(app: &AppHandle, request: CreateRoutineRequest) -> Result<AutomationRoutine, String> {
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let now = Local::now().to_rfc3339();
    let routine = AutomationRoutine {
        id: format!("routine_{}", Uuid::new_v4()),
        title: request.title,
        template_id: request.template_id,
        prompt: request.prompt,
        schedule: request.schedule,
        scope: request.scope,
        enabled: request.enabled,
        full_agent_access: true,
        created_at: now.clone(),
        updated_at: now,
        last_run: None,
    };
    store.upsert_routine(routine.clone())?;
    notify_scheduler(app);
    Ok(routine)
}

pub fn update_routine(
    app: &AppHandle,
    id: &str,
    patch: UpdateRoutineRequest,
) -> Result<AutomationRoutine, String> {
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let mut routine = store.get_routine(id)?;
    if let Some(title) = patch.title {
        routine.title = title;
    }
    if let Some(prompt) = patch.prompt {
        routine.prompt = prompt;
    }
    if let Some(schedule) = patch.schedule {
        routine.schedule = schedule;
    }
    if let Some(scope) = patch.scope {
        routine.scope = scope;
    }
    if let Some(enabled) = patch.enabled {
        routine.enabled = enabled;
    }
    routine.updated_at = Local::now().to_rfc3339();
    store.upsert_routine(routine.clone())?;
    notify_scheduler(app);
    Ok(routine)
}

pub fn delete_routine(app: &AppHandle, id: &str) -> Result<(), String> {
    let workspace = config::load_config(app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).delete_routine(id)?;
    notify_scheduler(app);
    Ok(())
}

pub async fn run_routine_now(app: AppHandle, id: String) -> Result<AutomationRun, String> {
    run_routine(app, id, AutomationRunTrigger::Manual).await
}

async fn run_due_routines(app: AppHandle) {
    let Ok(workspace) = config::load_config(&app).map(|c| c.workspace_path) else {
        return;
    };
    let store = AutomationStore::for_workspace(&workspace);
    let Ok(routines) = store.list_routines() else {
        return;
    };
    let now = Local::now().naive_local();
    let probe = now - chrono::Duration::seconds(60);
    for routine in routines.into_iter().filter(|r| r.enabled) {
        if let Ok(candidate) = next_run_after(&routine.schedule, probe) {
            if candidate > now + chrono::Duration::seconds(2) {
                continue;
            }
            let app_for_run = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = run_routine(app_for_run, routine.id, AutomationRunTrigger::Scheduled).await;
            });
        }
    }
}

async fn run_routine(
    app: AppHandle,
    routine_id: String,
    trigger: AutomationRunTrigger,
) -> Result<AutomationRun, String> {
    {
        let runtime = app.state::<AutomationRuntime>();
        let mut in_flight = runtime.in_flight.lock().map_err(|e| e.to_string())?;
        if in_flight.contains(&routine_id) {
            return create_skipped_run(&app, &routine_id, trigger, "routine already running");
        }
        in_flight.insert(routine_id.clone());
    }

    let result = run_routine_inner(app.clone(), routine_id.clone(), trigger).await;

    {
        let runtime = app.state::<AutomationRuntime>();
        let mut in_flight = runtime.in_flight.lock().map_err(|e| e.to_string())?;
        in_flight.remove(&routine_id);
    }

    result
}

async fn run_routine_inner(
    app: AppHandle,
    routine_id: String,
    trigger: AutomationRunTrigger,
) -> Result<AutomationRun, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let routine = store.get_routine(&routine_id)?;
    let mut run = AutomationRun {
        id: format!("run_{}", Uuid::new_v4()),
        routine_id: routine.id.clone(),
        trigger,
        status: AutomationRunStatus::Running,
        started_at: Local::now().to_rfc3339(),
        completed_at: None,
        error: None,
        conversation_id: None,
        manifest: None,
    };
    store.upsert_run(run.clone())?;
    let _ = app.emit("automation-run-updated", &run);

    match run_routine_agent(app.clone(), &workspace, &routine, &run).await {
        Ok((conversation_id, manifest)) => {
            run.status = AutomationRunStatus::Succeeded;
            run.completed_at = Some(Local::now().to_rfc3339());
            run.conversation_id = Some(conversation_id);
            run.manifest = Some(manifest);
        }
        Err(error) => {
            run.status = AutomationRunStatus::Failed;
            run.completed_at = Some(Local::now().to_rfc3339());
            run.error = Some(error);
        }
    }
    store.upsert_run(run.clone())?;
    let mut updated_routine = routine;
    updated_routine.last_run = Some(run.summary());
    store.upsert_routine(updated_routine)?;
    let _ = app.emit("automation-run-updated", &run);
    let _ = app.emit("journal-updated", ());
    Ok(run)
}

fn create_skipped_run(
    app: &AppHandle,
    routine_id: &str,
    trigger: AutomationRunTrigger,
    reason: &str,
) -> Result<AutomationRun, String> {
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let run = AutomationRun {
        id: format!("run_{}", Uuid::new_v4()),
        routine_id: routine_id.to_string(),
        trigger,
        status: AutomationRunStatus::Skipped,
        started_at: Local::now().to_rfc3339(),
        completed_at: Some(Local::now().to_rfc3339()),
        error: Some(reason.to_string()),
        conversation_id: None,
        manifest: None,
    };
    store.upsert_run(run.clone())?;
    let _ = app.emit("automation-run-updated", &run);
    Ok(run)
}

fn next_wait_duration(app: &AppHandle) -> Result<std::time::Duration, String> {
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let now = Local::now().naive_local();
    let next = store
        .list_routines()?
        .into_iter()
        .filter(|routine| routine.enabled)
        .filter_map(|routine| next_run_from_now(&routine.schedule).ok())
        .min();
    Ok(match next {
        Some(next_at) => (next_at - now)
            .to_std()
            .unwrap_or(std::time::Duration::from_secs(1)),
        None => std::time::Duration::from_secs(60 * 60),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_starts_with_empty_in_flight_set() {
        let runtime = AutomationRuntime::default();
        assert!(runtime.in_flight.lock().unwrap().is_empty());
    }
}
```

- [ ] **Step 2: Add command wrappers**

Create `src-tauri/src/automation_commands.rs`:

```rust
use crate::automation;
use crate::automation_store::AutomationStore;
use crate::automation_templates;
use crate::automation_types::{
    AutomationRoutine, AutomationRun, AutomationTemplate, CreateRoutineRequest,
    UpdateRoutineRequest,
};
use crate::config;
use tauri::AppHandle;

#[tauri::command]
pub fn list_automation_templates() -> Result<Vec<AutomationTemplate>, String> {
    Ok(automation_templates::built_in_templates())
}

#[tauri::command]
pub fn list_routines(app: AppHandle) -> Result<Vec<AutomationRoutine>, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).list_routines()
}

#[tauri::command]
pub fn create_routine(
    app: AppHandle,
    request: CreateRoutineRequest,
) -> Result<AutomationRoutine, String> {
    automation::create_routine(&app, request)
}

#[tauri::command]
pub fn update_routine(
    app: AppHandle,
    id: String,
    patch: UpdateRoutineRequest,
) -> Result<AutomationRoutine, String> {
    automation::update_routine(&app, &id, patch)
}

#[tauri::command]
pub fn delete_routine(app: AppHandle, id: String) -> Result<(), String> {
    automation::delete_routine(&app, &id)
}

#[tauri::command]
pub fn pause_routine(app: AppHandle, id: String) -> Result<AutomationRoutine, String> {
    automation::update_routine(
        &app,
        &id,
        UpdateRoutineRequest {
            enabled: Some(false),
            ..UpdateRoutineRequest::default()
        },
    )
}

#[tauri::command]
pub fn resume_routine(app: AppHandle, id: String) -> Result<AutomationRoutine, String> {
    automation::update_routine(
        &app,
        &id,
        UpdateRoutineRequest {
            enabled: Some(true),
            ..UpdateRoutineRequest::default()
        },
    )
}

#[tauri::command]
pub async fn run_routine_now(app: AppHandle, id: String) -> Result<AutomationRun, String> {
    automation::run_routine_now(app, id).await
}

#[tauri::command]
pub fn list_routine_runs(app: AppHandle, id: String) -> Result<Vec<AutomationRun>, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).list_runs_for_routine(&id)
}

#[tauri::command]
pub fn get_automation_run(app: AppHandle, id: String) -> Result<AutomationRun, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).get_run(&id)
}
```

- [ ] **Step 3: Register modules, managed state, startup, and commands**

Modify `src-tauri/src/main.rs`:

```rust
mod automation;
mod automation_commands;
```

Add managed state in the builder chain:

```rust
.manage(automation::AutomationNotify(std::sync::Arc::new(
    tokio::sync::Notify::new(),
)))
.manage(automation::AutomationRuntime::default())
```

Add setup startup after the auto-lint scheduler while auto-lint remains during migration:

```rust
automation::start_scheduler(app.handle().clone());
```

Add commands to `invoke_handler`:

```rust
automation_commands::list_automation_templates,
automation_commands::list_routines,
automation_commands::create_routine,
automation_commands::update_routine,
automation_commands::delete_routine,
automation_commands::pause_routine,
automation_commands::resume_routine,
automation_commands::run_routine_now,
automation_commands::list_routine_runs,
automation_commands::get_automation_run,
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd src-tauri && cargo test automation
```

Expected: automation helper tests pass and command modules compile.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/automation.rs src-tauri/src/automation_commands.rs src-tauri/src/main.rs
git commit -m "feat: add automation service commands"
```

---

## Task 8: TypeScript IPC Types and Contracts

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauri.ts`
- Modify: `src/tests/ipc-contract.test.ts`
- Test: `npm test -- src/tests/ipc-contract.test.ts`

- [ ] **Step 1: Add frontend automation types**

Append to `src/types.ts` before tree sidebar types:

```ts
export type AutomationSchedule =
  | { kind: 'daily'; time: string; timezone: string }
  | { kind: 'weekdays'; time: string; timezone: string }
  | { kind: 'weekly'; weekday: number; time: string; timezone: string }
  | { kind: 'monthly'; day: number; time: string; timezone: string }

export type AutomationScope =
  | { kind: 'relative'; range: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' }
  | { kind: 'recent_days'; days: number }
  | { kind: 'month'; year_month: string }
  | { kind: 'tags'; tags: string[]; range?: AutomationScope }
  | { kind: 'identities'; identity_ids: string[]; range?: AutomationScope }
  | { kind: 'keyword'; query: string; range?: AutomationScope }
  | { kind: 'workspace' }

export interface AutomationTemplate {
  id: string
  title: string
  category: string
  description: string
  default_prompt: string
  default_schedule: AutomationSchedule
  default_scope: AutomationScope
  default_context: string[]
}

export interface AutomationRoutine {
  id: string
  title: string
  template_id: string | null
  prompt: string
  schedule: AutomationSchedule
  scope: AutomationScope
  enabled: boolean
  full_agent_access: boolean
  created_at: string
  updated_at: string
  last_run: AutomationRunSummary | null
}

export type AutomationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
export type AutomationRunTrigger = 'scheduled' | 'manual'

export interface AutomationRunSummary {
  id: string
  status: AutomationRunStatus
  trigger: AutomationRunTrigger
  started_at: string
  completed_at: string | null
  summary: string | null
  error: string | null
  conversation_id: string | null
}

export interface AutomationRun {
  id: string
  routine_id: string
  trigger: AutomationRunTrigger
  status: AutomationRunStatus
  started_at: string
  completed_at: string | null
  error: string | null
  conversation_id: string | null
  manifest: RunManifest | null
}

export interface RunManifest {
  summary: string
  files_read: string[]
  files_changed: string[]
  entries_created: string[]
  todos_changed: string[]
  identities_changed: string[]
  warnings: string[]
  conversation_id: string
}

export interface CreateRoutineRequest {
  title: string
  template_id: string | null
  prompt: string
  schedule: AutomationSchedule
  scope: AutomationScope
  enabled: boolean
}

export interface UpdateRoutineRequest {
  title?: string
  prompt?: string
  schedule?: AutomationSchedule
  scope?: AutomationScope
  enabled?: boolean
}
```

- [ ] **Step 2: Extend tree selection for automation**

Modify `TreeNodeType` in `src/types.ts`:

```ts
export type TreeNodeType =
  | 'pinned-section'
  | 'identity'
  | 'journal'
  | 'journal-month'
  | 'topic'
  | 'topic-file'
  | 'ideas'
  | 'automation'
```

- [ ] **Step 3: Add IPC wrappers**

Modify imports in `src/lib/tauri.ts`:

```ts
import type {
  Transcript,
  JournalEntry,
  SpeakerProfile,
  IdentityEntry,
  MergeMode,
  TodoItem,
  AutomationTemplate,
  AutomationRoutine,
  AutomationRun,
  CreateRoutineRequest,
  UpdateRoutineRequest,
} from '../types'
```

Append after auto-lint wrappers:

```ts
// Automation workbench
export const listAutomationTemplates = (): Promise<AutomationTemplate[]> =>
  invoke<AutomationTemplate[]>('list_automation_templates')

export const listRoutines = (): Promise<AutomationRoutine[]> =>
  invoke<AutomationRoutine[]>('list_routines')

export const createRoutine = (request: CreateRoutineRequest): Promise<AutomationRoutine> =>
  invoke<AutomationRoutine>('create_routine', { request })

export const updateRoutine = (
  id: string,
  patch: UpdateRoutineRequest,
): Promise<AutomationRoutine> => invoke<AutomationRoutine>('update_routine', { id, patch })

export const deleteRoutine = (id: string): Promise<void> =>
  invoke<void>('delete_routine', { id })

export const pauseRoutine = (id: string): Promise<AutomationRoutine> =>
  invoke<AutomationRoutine>('pause_routine', { id })

export const resumeRoutine = (id: string): Promise<AutomationRoutine> =>
  invoke<AutomationRoutine>('resume_routine', { id })

export const runRoutineNow = (id: string): Promise<AutomationRun> =>
  invoke<AutomationRun>('run_routine_now', { id })

export const listRoutineRuns = (id: string): Promise<AutomationRun[]> =>
  invoke<AutomationRun[]>('list_routine_runs', { id })

export const getAutomationRun = (id: string): Promise<AutomationRun> =>
  invoke<AutomationRun>('get_automation_run', { id })
```

- [ ] **Step 4: Add IPC contract tests**

Modify import list in `src/tests/ipc-contract.test.ts` to include:

```ts
  listAutomationTemplates,
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  pauseRoutine,
  resumeRoutine,
  runRoutineNow,
  listRoutineRuns,
  getAutomationRun,
  type CreateRoutineRequest,
```

Add to `noParamCases`:

```ts
  ['listAutomationTemplates', listAutomationTemplates, 'list_automation_templates'],
  ['listRoutines', listRoutines, 'list_routines'],
```

Add a new describe block:

```ts
describe('Automation', () => {
  const request: CreateRoutineRequest = {
    title: '每日总结',
    template_id: 'daily-summary',
    prompt: '总结昨天',
    schedule: { kind: 'daily', time: '08:00', timezone: 'Asia/Hong_Kong' },
    scope: { kind: 'relative', range: 'yesterday' },
    enabled: true,
  }

  it('createRoutine passes { request }', async () => {
    await createRoutine(request)
    expect(mockInvoke).toHaveBeenCalledWith('create_routine', { request })
  })

  it('updateRoutine passes { id, patch }', async () => {
    await updateRoutine('routine_1', { enabled: false })
    expect(mockInvoke).toHaveBeenCalledWith('update_routine', {
      id: 'routine_1',
      patch: { enabled: false },
    })
  })

  it('deleteRoutine passes { id }', async () => {
    await deleteRoutine('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('delete_routine', { id: 'routine_1' })
  })

  it('pauseRoutine passes { id }', async () => {
    await pauseRoutine('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('pause_routine', { id: 'routine_1' })
  })

  it('resumeRoutine passes { id }', async () => {
    await resumeRoutine('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('resume_routine', { id: 'routine_1' })
  })

  it('runRoutineNow passes { id }', async () => {
    await runRoutineNow('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('run_routine_now', { id: 'routine_1' })
  })

  it('listRoutineRuns passes { id }', async () => {
    await listRoutineRuns('routine_1')
    expect(mockInvoke).toHaveBeenCalledWith('list_routine_runs', { id: 'routine_1' })
  })

  it('getAutomationRun passes { id }', async () => {
    await getAutomationRun('run_1')
    expect(mockInvoke).toHaveBeenCalledWith('get_automation_run', { id: 'run_1' })
  })
})
```

- [ ] **Step 5: Run IPC tests**

Run:

```bash
npm test -- src/tests/ipc-contract.test.ts
```

Expected: IPC contract suite passes.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/tauri.ts src/tests/ipc-contract.test.ts
git commit -m "feat: add automation ipc contracts"
```

---

## Task 9: Automation Hook

**Files:**
- Create: `src/hooks/useAutomation.ts`
- Test: `npm run build`

- [ ] **Step 1: Add hook for templates, routines, and actions**

Create `src/hooks/useAutomation.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  createRoutine,
  deleteRoutine,
  listAutomationTemplates,
  listRoutines,
  listRoutineRuns,
  pauseRoutine,
  resumeRoutine,
  runRoutineNow,
  updateRoutine,
} from '../lib/tauri'
import type {
  AutomationRoutine,
  AutomationRun,
  AutomationTemplate,
  CreateRoutineRequest,
  UpdateRoutineRequest,
} from '../types'

export function useAutomation() {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [routines, setRoutines] = useState<AutomationRoutine[]>([])
  const [runsByRoutine, setRunsByRoutine] = useState<Record<string, AutomationRun[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const [nextTemplates, nextRoutines] = await Promise.all([
        listAutomationTemplates(),
        listRoutines(),
      ])
      setTemplates(nextTemplates)
      setRoutines(nextRoutines)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<AutomationRun>('automation-run-updated', () => {
      refresh()
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [refresh])

  const loadRuns = useCallback(async (routineId: string) => {
    const runs = await listRoutineRuns(routineId)
    setRunsByRoutine((prev) => ({ ...prev, [routineId]: runs }))
    return runs
  }, [])

  const create = useCallback(
    async (request: CreateRoutineRequest) => {
      const routine = await createRoutine(request)
      await refresh()
      return routine
    },
    [refresh],
  )

  const update = useCallback(
    async (id: string, patch: UpdateRoutineRequest) => {
      const routine = await updateRoutine(id, patch)
      await refresh()
      return routine
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteRoutine(id)
      await refresh()
    },
    [refresh],
  )

  const pause = useCallback(
    async (id: string) => {
      const routine = await pauseRoutine(id)
      await refresh()
      return routine
    },
    [refresh],
  )

  const resume = useCallback(
    async (id: string) => {
      const routine = await resumeRoutine(id)
      await refresh()
      return routine
    },
    [refresh],
  )

  const runNow = useCallback(
    async (id: string) => {
      const run = await runRoutineNow(id)
      await refresh()
      await loadRuns(id)
      return run
    },
    [loadRuns, refresh],
  )

  const counts = useMemo(() => {
    const enabled = routines.filter((r) => r.enabled).length
    const failed = routines.filter((r) => r.last_run?.status === 'failed').length
    return { enabled, failed, total: routines.length }
  }, [routines])

  return {
    templates,
    routines,
    runsByRoutine,
    loading,
    error,
    counts,
    refresh,
    loadRuns,
    create,
    update,
    remove,
    pause,
    resume,
    runNow,
  }
}
```

- [ ] **Step 2: Run TypeScript build**

Run:

```bash
npm run build
```

Expected: TypeScript compiles.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAutomation.ts
git commit -m "feat: add automation hook"
```

---

## Task 10: Main View Routing

**Files:**
- Modify: `src/contexts/UIContext.tsx`
- Modify: `src/components/TreeSidebar.tsx`
- Modify: `src/App.tsx`
- Test: `npm run build`

- [ ] **Step 1: Add automation view to UI context**

Modify `src/contexts/UIContext.tsx`:

```ts
type AppView = 'journal' | 'settings' | 'automation'

interface UIContextValue {
  view: AppView
  setView: Dispatch<SetStateAction<AppView>>
```

Update the state:

```ts
const [view, setView] = useState<AppView>('journal')
```

- [ ] **Step 2: Add TreeSidebar props for automation selection**

Modify `TreeSidebarProps` in `src/components/TreeSidebar.tsx`:

```ts
  automationSelected: boolean
  onSelectAutomation: () => void
```

Add props to component signature:

```ts
  automationSelected,
  onSelectAutomation,
```

Render an automation entry below Ideas:

```tsx
      <div
        onClick={onSelectAutomation}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 6px',
          margin: '0 0 6px',
          cursor: 'pointer',
          userSelect: 'none' as const,
          borderRadius: 6,
          background: automationSelected ? 'var(--item-selected-bg)' : 'transparent',
          transition: 'background-color 0.15s var(--ease-out)',
        }}
      >
        <span style={{ width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span
            style={{
              width: 3,
              height: 16,
              borderRadius: 2,
              background: 'var(--record-btn)',
              transform: automationSelected ? 'scaleY(1)' : 'scaleY(0)',
              transition: 'transform 0.2s var(--ease-out)',
            }}
          />
        </span>
        <span style={{ width: 13, display: 'flex', color: automationSelected ? 'var(--record-btn)' : 'var(--item-meta)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <span
          style={{
            fontSize: 'var(--text-base, 0.875rem)',
            fontWeight: 'var(--font-semibold, 600)',
            color: automationSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
          }}
        >
          自动化
        </span>
      </div>
```

- [ ] **Step 3: Wire App to automation view**

Import `AutomationWorkbench` in `src/App.tsx`:

```ts
import { AutomationWorkbench } from './components/AutomationWorkbench'
```

Add handler:

```ts
const handleSelectAutomation = useCallback(() => {
  setShowIdeas(false)
  setTreeSelection({ type: 'automation', path: '__automation__' })
  setView('automation')
}, [setShowIdeas, setTreeSelection, setView])
```

Pass props to `TreeSidebar`:

```tsx
automationSelected={view === 'automation'}
onSelectAutomation={handleSelectAutomation}
```

Update regular tree selection to leave automation view:

```ts
const handleTreeSelect = useCallback(
  (sel: TreeSelection) => {
    setView('journal')
    setShowIdeas(false)
    setTreeSelection(sel)
  },
  [setShowIdeas, setTreeSelection, setView],
)
```

Render center pane:

```tsx
{view === 'automation' ? (
  <AutomationWorkbench onOpenConversation={(sessionId) => openChatPanel(sessionId)} />
) : (
  <DetailView ... />
)}
```

- [ ] **Step 4: Add temporary placeholder component**

Before Task 11 creates the real component, create `src/components/AutomationWorkbench.tsx`:

```tsx
export function AutomationWorkbench({
  onOpenConversation: _onOpenConversation,
}: {
  onOpenConversation: (sessionId: string) => void
}) {
  return (
    <div style={{ padding: 28, color: 'var(--item-text)' }}>
      <div style={{ fontSize: 13, color: 'var(--month-label)', marginBottom: 8 }}>
        Automation Workbench
      </div>
      <h2 style={{ fontSize: 22, margin: 0 }}>自动化工作台</h2>
    </div>
  )
}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript compiles.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/UIContext.tsx src/components/TreeSidebar.tsx src/App.tsx src/components/AutomationWorkbench.tsx
git commit -m "feat: add automation main view route"
```

---

## Task 11: Workbench UI Components

**Files:**
- Modify: `src/components/AutomationWorkbench.tsx`
- Create: `src/components/AutomationTemplateGrid.tsx`
- Create: `src/components/AutomationRoutineList.tsx`
- Create: `src/components/AutomationRoutineDetail.tsx`
- Test: `npm run build`

- [ ] **Step 1: Add template grid**

Create `src/components/AutomationTemplateGrid.tsx`:

```tsx
import type { AutomationTemplate } from '../types'

export function AutomationTemplateGrid({
  templates,
  selectedTemplateId,
  onSelect,
}: {
  templates: AutomationTemplate[]
  selectedTemplateId: string | null
  onSelect: (template: AutomationTemplate) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
      }}
    >
      {templates.map((template) => {
        const selected = selectedTemplateId === template.id
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            style={{
              minHeight: 116,
              padding: 13,
              border: `1px solid ${selected ? 'color-mix(in srgb, var(--record-btn) 42%, var(--divider))' : 'var(--divider)'}`,
              borderRadius: 8,
              background: selected
                ? 'color-mix(in srgb, var(--record-btn) 6%, var(--detail-case-bg))'
                : 'var(--detail-case-bg)',
              color: 'var(--item-text)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{template.title}</div>
            <div style={{ marginTop: 7, color: 'var(--item-meta)', fontSize: 12 }}>
              {template.description}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <span style={chipStyle('gold')}>{template.category}</span>
              <span style={chipStyle()}>{scheduleLabel(template.default_schedule)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function scheduleLabel(schedule: AutomationTemplate['default_schedule']) {
  switch (schedule.kind) {
    case 'daily':
      return `每天 ${schedule.time}`
    case 'weekdays':
      return `工作日 ${schedule.time}`
    case 'weekly':
      return `每周 ${schedule.time}`
    case 'monthly':
      return `每月 ${schedule.day} 日`
  }
}

function chipStyle(tone?: 'gold'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    padding: '0 8px',
    borderRadius: 5,
    border: tone === 'gold' ? '1px solid rgba(200,147,59,0.32)' : '1px solid var(--divider)',
    color: tone === 'gold' ? 'var(--record-btn)' : 'var(--item-meta)',
    background: tone === 'gold' ? 'rgba(200,147,59,0.1)' : 'rgba(255,255,255,0.02)',
    fontSize: 11,
  }
}
```

- [ ] **Step 2: Add routine list**

Create `src/components/AutomationRoutineList.tsx`:

```tsx
import type { AutomationRoutine } from '../types'

export function AutomationRoutineList({
  routines,
  selectedId,
  onSelect,
}: {
  routines: AutomationRoutine[]
  selectedId: string | null
  onSelect: (routine: AutomationRoutine) => void
}) {
  if (routines.length === 0) {
    return (
      <div style={{ padding: 14, border: '1px solid var(--divider)', borderRadius: 8, color: 'var(--item-meta)', fontSize: 13 }}>
        还没有自动化。先从模板创建一个。
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--divider)', borderRadius: 8, overflow: 'hidden' }}>
      {routines.map((routine) => (
        <button
          key={routine.id}
          type="button"
          onClick={() => onSelect(routine)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) 150px 110px 130px',
            gap: 12,
            alignItems: 'center',
            width: '100%',
            minHeight: 58,
            padding: '11px 12px',
            border: 0,
            borderBottom: '1px solid var(--divider)',
            background:
              selectedId === routine.id
                ? 'color-mix(in srgb, var(--record-btn) 5%, var(--detail-case-bg))'
                : 'var(--detail-case-bg)',
            color: 'var(--item-text)',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 500 }}>{routine.title}</span>
            <span style={{ display: 'block', marginTop: 3, color: 'var(--duration-text)', fontSize: 12 }}>
              {routine.template_id ? `模板：${routine.template_id}` : '自定义 Agent'}
            </span>
          </span>
          <span>
            <span style={{ display: 'block', fontWeight: 500 }}>{scheduleLabel(routine)}</span>
            <span style={{ display: 'block', marginTop: 3, color: 'var(--duration-text)', fontSize: 12 }}>
              {scopeLabel(routine)}
            </span>
          </span>
          <span style={{ color: routine.enabled ? 'var(--status-success)' : 'var(--duration-text)', fontSize: 12 }}>
            {routine.enabled ? '已启用' : '暂停'}
          </span>
          <span style={{ color: 'var(--item-meta)', fontSize: 12 }}>
            {routine.last_run ? runLabel(routine.last_run.status) : '尚未运行'}
          </span>
        </button>
      ))}
    </div>
  )
}

function scheduleLabel(routine: AutomationRoutine) {
  const schedule = routine.schedule
  switch (schedule.kind) {
    case 'daily':
      return `每天 ${schedule.time}`
    case 'weekdays':
      return `工作日 ${schedule.time}`
    case 'weekly':
      return `每周 ${schedule.time}`
    case 'monthly':
      return `每月 ${schedule.day} 日`
  }
}

function scopeLabel(routine: AutomationRoutine) {
  switch (routine.scope.kind) {
    case 'relative':
      return routine.scope.range
    case 'recent_days':
      return `最近 ${routine.scope.days} 天`
    case 'month':
      return routine.scope.year_month
    case 'tags':
      return routine.scope.tags.join(', ')
    case 'identities':
      return `${routine.scope.identity_ids.length} 个画像`
    case 'keyword':
      return routine.scope.query
    case 'workspace':
      return '全库'
  }
}

function runLabel(status: AutomationRoutine['last_run']['status']) {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '运行中'
    case 'succeeded':
      return '上次成功'
    case 'failed':
      return '上次失败'
    case 'skipped':
      return '上次跳过'
  }
}
```

- [ ] **Step 3: Add routine detail**

Create `src/components/AutomationRoutineDetail.tsx`:

```tsx
import type { AutomationRoutine, AutomationRun } from '../types'

export function AutomationRoutineDetail({
  routine,
  runs,
  onRun,
  onEdit,
  onPause,
  onResume,
  onOpenConversation,
}: {
  routine: AutomationRoutine | null
  runs: AutomationRun[]
  onRun: (routine: AutomationRoutine) => void
  onEdit: (routine: AutomationRoutine) => void
  onPause: (routine: AutomationRoutine) => void
  onResume: (routine: AutomationRoutine) => void
  onOpenConversation: (sessionId: string) => void
}) {
  if (!routine) {
    return (
      <aside style={panelStyle}>
        <div style={{ padding: 16, color: 'var(--item-meta)', fontSize: 13 }}>
          选择一个自动化查看详情。
        </div>
      </aside>
    )
  }

  const latest = runs[0]

  return (
    <aside style={panelStyle}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--divider)' }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>{routine.title}</h3>
        <div style={{ marginTop: 8, color: 'var(--item-meta)', fontSize: 12 }}>
          完整 Agent 权限 · 自动执行 · 保留 manifest
        </div>
      </div>
      <div style={blockStyle}>
        <div style={labelStyle}>Prompt</div>
        <div style={{ padding: 12, border: '1px solid var(--divider)', borderRadius: 8, color: 'var(--item-meta)', fontSize: 12, lineHeight: 1.58 }}>
          {routine.prompt}
        </div>
      </div>
      <div style={blockStyle}>
        <div style={labelStyle}>上次运行</div>
        {latest?.manifest ? (
          <div style={{ display: 'grid', gap: 8, color: 'var(--item-meta)', fontSize: 12 }}>
            <ManifestRow label="Summary" value={latest.manifest.summary} />
            <ManifestRow label="Changed" value={latest.manifest.files_changed.join(', ') || '无文件变更'} />
            <ManifestRow label="Session" value={latest.manifest.conversation_id} />
          </div>
        ) : (
          <div style={{ color: 'var(--duration-text)', fontSize: 12 }}>
            {routine.last_run?.error ?? '尚无 manifest'}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 16 }}>
        <button style={primaryStyle} onClick={() => onRun(routine)}>立即运行</button>
        <button style={secondaryStyle} onClick={() => onEdit(routine)}>编辑</button>
        {routine.enabled ? (
          <button style={secondaryStyle} onClick={() => onPause(routine)}>暂停</button>
        ) : (
          <button style={secondaryStyle} onClick={() => onResume(routine)}>启用</button>
        )}
        {latest?.conversation_id && (
          <button style={secondaryStyle} onClick={() => onOpenConversation(latest.conversation_id!)}>
            会话
          </button>
        )}
      </div>
    </aside>
  )
}

function ManifestRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '82px minmax(0, 1fr)', gap: 10 }}>
      <strong style={{ color: 'var(--duration-text)', fontWeight: 500 }}>{label}</strong>
      <span>{value}</span>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--divider)',
  borderRadius: 8,
  background: 'var(--detail-case-bg)',
}

const blockStyle: React.CSSProperties = {
  padding: 16,
  borderBottom: '1px solid var(--divider)',
}

const labelStyle: React.CSSProperties = {
  marginBottom: 8,
  color: 'var(--duration-text)',
  fontSize: 11,
}

const primaryStyle: React.CSSProperties = {
  minHeight: 32,
  padding: '0 14px',
  border: 0,
  borderRadius: 6,
  background: 'var(--record-btn)',
  color: 'var(--record-btn-icon)',
  fontWeight: 600,
}

const secondaryStyle: React.CSSProperties = {
  minHeight: 30,
  padding: '0 11px',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--item-meta)',
}
```

- [ ] **Step 4: Compose the workbench**

Replace `src/components/AutomationWorkbench.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useAutomation } from '../hooks/useAutomation'
import type { AutomationRoutine, AutomationTemplate } from '../types'
import { AutomationRoutineDetail } from './AutomationRoutineDetail'
import { AutomationRoutineList } from './AutomationRoutineList'
import { AutomationTemplateGrid } from './AutomationTemplateGrid'

export function AutomationWorkbench({
  onOpenConversation,
}: {
  onOpenConversation: (sessionId: string) => void
}) {
  const automation = useAutomation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const selectedRoutine = useMemo(
    () => automation.routines.find((r) => r.id === selectedId) ?? automation.routines[0] ?? null,
    [automation.routines, selectedId],
  )

  useEffect(() => {
    if (selectedRoutine) {
      setSelectedId(selectedRoutine.id)
      automation.loadRuns(selectedRoutine.id)
    }
  }, [selectedRoutine?.id])

  const selectedRuns = selectedRoutine ? automation.runsByRoutine[selectedRoutine.id] ?? [] : []

  const handleTemplateSelect = (template: AutomationTemplate) => {
    setSelectedTemplateId(template.id)
  }

  const handleRun = async (routine: AutomationRoutine) => {
    await automation.runNow(routine.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: 'var(--bg)' }}>
      <header style={{ padding: '26px 30px 18px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ color: 'var(--month-label)', fontSize: 12, marginBottom: 5 }}>
          Automation Workbench
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>自动化工作台</h2>
        <p style={{ maxWidth: 680, margin: '8px 0 0', color: 'var(--item-meta)', fontSize: 13 }}>
          用模板开始，用 Routine 承载。每个任务都是一条定时完整 Agent 会话，运行后留下摘要、会话和改动清单。
        </p>
      </header>

      <div style={{ overflow: 'auto', padding: '20px 30px 28px' }}>
        <section style={{ paddingBottom: 22, borderBottom: '1px solid var(--divider)', marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Metric label="启用中" value={automation.counts.enabled} />
            <Metric label="全部自动化" value={automation.counts.total} />
            <Metric label="需查看失败" value={automation.counts.failed} />
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 0.9fr)', gap: 22, alignItems: 'start' }}>
          <div>
            <SectionTitle title="模板入口" subtitle="模板可展开成完整 Routine" />
            <AutomationTemplateGrid
              templates={automation.templates}
              selectedTemplateId={selectedTemplateId}
              onSelect={handleTemplateSelect}
            />

            <div style={{ height: 22 }} />
            <SectionTitle title="Routine 列表" subtitle="所有模板最终都是同一种底层对象" />
            <AutomationRoutineList
              routines={automation.routines}
              selectedId={selectedRoutine?.id ?? null}
              onSelect={(routine) => {
                setSelectedId(routine.id)
                automation.loadRuns(routine.id)
              }}
            />
          </div>

          <AutomationRoutineDetail
            routine={selectedRoutine}
            runs={selectedRuns}
            onRun={handleRun}
            onEdit={() => {}}
            onPause={(routine) => automation.pause(routine.id)}
            onResume={(routine) => automation.resume(routine.id)}
            onOpenConversation={onOpenConversation}
          />
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minHeight: 74, padding: 12, border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--detail-case-bg)' }}>
      <div style={{ color: 'var(--duration-text)', fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
      <span style={{ color: 'var(--duration-text)', fontSize: 12 }}>{subtitle}</span>
    </div>
  )
}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript compiles.

- [ ] **Step 6: Commit**

```bash
git add src/components/AutomationWorkbench.tsx src/components/AutomationTemplateGrid.tsx src/components/AutomationRoutineList.tsx src/components/AutomationRoutineDetail.tsx
git commit -m "feat: build automation workbench UI"
```

---

## Task 12: Automation Editor Dialog

**Files:**
- Create: `src/components/AutomationEditorDialog.tsx`
- Modify: `src/components/AutomationWorkbench.tsx`
- Test: `npm run build`

- [ ] **Step 1: Add editor dialog component**

Create `src/components/AutomationEditorDialog.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type {
  AutomationRoutine,
  AutomationSchedule,
  AutomationScope,
  AutomationTemplate,
  CreateRoutineRequest,
  UpdateRoutineRequest,
} from '../types'

export function AutomationEditorDialog({
  templates,
  routine,
  initialTemplate,
  onClose,
  onCreate,
  onUpdate,
}: {
  templates: AutomationTemplate[]
  routine: AutomationRoutine | null
  initialTemplate: AutomationTemplate | null
  onClose: () => void
  onCreate: (request: CreateRoutineRequest) => Promise<void>
  onUpdate: (id: string, patch: UpdateRoutineRequest) => Promise<void>
}) {
  const seed = routine ?? templateToDraft(initialTemplate ?? templates[0])
  const [title, setTitle] = useState(seed.title)
  const [prompt, setPrompt] = useState(seed.prompt)
  const [time, setTime] = useState(scheduleTime(seed.schedule))
  const [enabled, setEnabled] = useState(seed.enabled)
  const [scopeText, setScopeText] = useState(scopeLabel(seed.scope))

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === (routine?.template_id ?? initialTemplate?.id)) ?? templates[0],
    [initialTemplate?.id, routine?.template_id, templates],
  )

  const save = async () => {
    const schedule: AutomationSchedule = { kind: 'daily', time, timezone: 'Asia/Hong_Kong' }
    const scope: AutomationScope = scopeFromText(scopeText)
    if (routine) {
      await onUpdate(routine.id, { title, prompt, schedule, scope, enabled })
    } else {
      await onCreate({
        title,
        template_id: selectedTemplate?.id ?? null,
        prompt,
        schedule,
        scope,
        enabled,
      })
    }
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ width: 'min(940px, calc(100vw - 56px))', maxHeight: 'calc(100vh - 56px)', overflow: 'hidden', border: '1px solid var(--divider)', borderRadius: 8, background: 'var(--bg)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--divider)' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{routine ? '编辑自动化' : '新建自动化'}</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--item-meta)', fontSize: 12 }}>
            主入口是模板；任何选择最终都会生成 Routine。
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', minHeight: 500 }}>
          <div style={{ padding: 14, borderRight: '1px solid var(--divider)', background: 'var(--sidebar-bg)' }}>
            <div style={{ marginBottom: 8, color: 'var(--duration-text)', fontSize: 11 }}>模板</div>
            {templates.map((template) => (
              <div
                key={template.id}
                style={{
                  padding: 11,
                  borderRadius: 8,
                  background: template.id === selectedTemplate?.id ? 'var(--record-highlight)' : 'transparent',
                  color: template.id === selectedTemplate?.id ? 'var(--item-text)' : 'var(--item-meta)',
                }}
              >
                <strong>{template.title}</strong>
                <div style={{ marginTop: 3, color: 'var(--duration-text)', fontSize: 12 }}>
                  {template.description}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '18px 20px' }}>
            <Field label="名称">
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="频率">
              <input value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="输入范围">
              <input value={scopeText} onChange={(e) => setScopeText(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Prompt">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ ...inputStyle, height: 160, paddingTop: 10 }} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--item-meta)', fontSize: 13 }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              启用这个自动化
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={onClose} style={secondaryStyle}>取消</button>
              <button onClick={save} style={primaryStyle}>保存自动化</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function templateToDraft(template: AutomationTemplate): AutomationRoutine {
  return {
    id: '',
    title: template.title,
    template_id: template.id,
    prompt: template.default_prompt,
    schedule: template.default_schedule,
    scope: template.default_scope,
    enabled: true,
    full_agent_access: true,
    created_at: '',
    updated_at: '',
    last_run: null,
  }
}

function scheduleTime(schedule: AutomationSchedule) {
  return 'time' in schedule ? schedule.time : '08:00'
}

function scopeLabel(scope: AutomationScope) {
  switch (scope.kind) {
    case 'relative':
      return scope.range
    case 'recent_days':
      return `recent:${scope.days}`
    case 'month':
      return scope.year_month
    case 'tags':
      return scope.tags.join(',')
    case 'identities':
      return scope.identity_ids.join(',')
    case 'keyword':
      return scope.query
    case 'workspace':
      return 'workspace'
  }
}

function scopeFromText(text: string): AutomationScope {
  if (text === 'workspace') return { kind: 'workspace' }
  if (text.startsWith('recent:')) {
    const days = Number(text.slice('recent:'.length))
    return { kind: 'recent_days', days: Number.isFinite(days) && days > 0 ? days : 7 }
  }
  switch (text) {
    case 'today':
    case 'yesterday':
    case 'this_week':
    case 'last_week':
    case 'this_month':
    case 'last_month':
      return { kind: 'relative', range: text }
    default:
      return { kind: 'keyword', query: text }
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', marginBottom: 6, color: 'var(--duration-text)', fontSize: 11 }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 34,
  padding: '0 10px',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  background: 'var(--detail-case-bg)',
  color: 'var(--item-text)',
  fontSize: 13,
}

const primaryStyle: React.CSSProperties = {
  minHeight: 32,
  padding: '0 14px',
  border: 0,
  borderRadius: 6,
  background: 'var(--record-btn)',
  color: 'var(--record-btn-icon)',
  fontWeight: 600,
}

const secondaryStyle: React.CSSProperties = {
  minHeight: 30,
  padding: '0 11px',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--item-meta)',
}
```

- [ ] **Step 2: Wire editor into workbench**

Modify `src/components/AutomationWorkbench.tsx` imports:

```ts
import { AutomationEditorDialog } from './AutomationEditorDialog'
```

Add state:

```ts
const [editingRoutine, setEditingRoutine] = useState<AutomationRoutine | null>(null)
const [draftTemplate, setDraftTemplate] = useState<AutomationTemplate | null>(null)
```

Update template select:

```ts
const handleTemplateSelect = (template: AutomationTemplate) => {
  setSelectedTemplateId(template.id)
  setDraftTemplate(template)
}
```

Change `onEdit`:

```tsx
onEdit={(routine) => setEditingRoutine(routine)}
```

Render dialog at the bottom:

```tsx
{(editingRoutine || draftTemplate) && (
  <AutomationEditorDialog
    templates={automation.templates}
    routine={editingRoutine}
    initialTemplate={draftTemplate}
    onClose={() => {
      setEditingRoutine(null)
      setDraftTemplate(null)
    }}
    onCreate={async (request) => {
      const routine = await automation.create(request)
      setSelectedId(routine.id)
    }}
    onUpdate={async (id, patch) => {
      const routine = await automation.update(id, patch)
      setSelectedId(routine.id)
    }}
  />
)}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript compiles.

- [ ] **Step 4: Commit**

```bash
git add src/components/AutomationEditorDialog.tsx src/components/AutomationWorkbench.tsx
git commit -m "feat: add automation editor dialog"
```

---

## Task 13: Settings Integration

**Files:**
- Modify: `src/settings/components/SectionAutomation.tsx`
- Modify: `src/App.tsx`
- Test: `npm run build`

- [ ] **Step 1: Replace the auto-lint card with global automation settings**

Modify `SectionAutomation.tsx` so it keeps existing auto-lint imports only until migration is complete. Replace returned content with:

```tsx
return (
  <div style={sectionStyle}>
    <div
      style={{
        fontSize: 13,
        color: 'var(--month-label)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 16,
        fontWeight: 500,
      }}
    >
      {t('automation')}
    </div>
    <div
      style={{
        background: 'var(--detail-case-bg)',
        border: '1px solid var(--divider)',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--item-text)', marginBottom: 4 }}>
        自动化工作台
      </div>
      <div style={{ fontSize: 12, color: 'var(--item-meta)', marginBottom: 16 }}>
        自动化现在作为主界面工作台管理。这里保留全局后台运行和失败通知设置。
      </div>
      <SettingRow title="允许后台自动化运行" desc="关闭后，定时 Routine 暂停；手动运行仍可执行。" value="开启" />
      <SettingRow title="默认 Agent 权限" desc="自动化使用完整 Agent 权限，并保留完整会话与 manifest。" value="完整 Agent" />
      <SettingRow title="失败通知" desc="只在失败或连续跳过时提示，避免打扰阅读。" value="开启" />
    </div>
  </div>
)
```

Add helper inside the file:

```tsx
function SettingRow({ title, desc, value }: { title: string; desc: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        minHeight: 50,
        borderTop: '1px solid var(--divider)',
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--item-text)' }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 11, color: 'var(--duration-text)' }}>{desc}</div>
      </div>
      <span
        style={{
          padding: '3px 8px',
          borderRadius: 5,
          border: '1px solid color-mix(in srgb, var(--record-btn) 32%, var(--divider))',
          color: 'var(--record-btn)',
          fontSize: 11,
        }}
      >
        {value}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Keep legacy auto-lint commands callable**

Do not remove `getAutoLintConfig`, `setAutoLintConfig`, `getAutoLintStatus`, or `triggerLintNow` from `src/lib/tauri.ts`. Existing tests expect them and old settings data still exists.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript compiles.

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/SectionAutomation.tsx
git commit -m "feat: update automation settings surface"
```

---

## Task 14: Legacy Auto-Lint Migration

**Files:**
- Modify: `src-tauri/src/automation.rs`
- Modify: `src-tauri/src/automation_templates.rs`
- Modify: `src-tauri/src/auto_lint.rs`
- Test: `cd src-tauri && cargo test automation auto_lint`

- [ ] **Step 1: Add migration helper**

In `src-tauri/src/automation.rs`, add:

```rust
pub fn ensure_legacy_lint_routine(app: &AppHandle) -> Result<(), String> {
    let cfg = crate::workspace_settings::load_auto_lint_config(app).unwrap_or_default();
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let existing = store
        .list_routines()?
        .into_iter()
        .any(|routine| routine.template_id.as_deref() == Some("journal-lint"));
    if existing {
        return Ok(());
    }
    if !cfg.enabled {
        return Ok(());
    }
    let template = crate::automation_templates::get_template("journal-lint")
        .ok_or_else(|| "journal-lint template missing".to_string())?;
    let schedule = match cfg.frequency.as_str() {
        "daily" => crate::automation_types::AutomationSchedule::Daily {
            time: cfg.time,
            timezone: "Asia/Hong_Kong".to_string(),
        },
        "weekly" => crate::automation_types::AutomationSchedule::Weekly {
            weekday: 0,
            time: cfg.time,
            timezone: "Asia/Hong_Kong".to_string(),
        },
        "monthly" => crate::automation_types::AutomationSchedule::Monthly {
            day: 1,
            time: cfg.time,
            timezone: "Asia/Hong_Kong".to_string(),
        },
        _ => template.default_schedule,
    };
    let now = Local::now().to_rfc3339();
    store.upsert_routine(AutomationRoutine {
        id: "routine_journal_lint_legacy".to_string(),
        title: template.title,
        template_id: Some(template.id),
        prompt: format!(
            "{}\n\n仅当距离上次整理至少新增 {} 条日志时才执行整理；否则记录跳过原因。",
            template.default_prompt, cfg.min_entries
        ),
        schedule,
        scope: template.default_scope,
        enabled: true,
        full_agent_access: true,
        created_at: now.clone(),
        updated_at: now,
        last_run: None,
    })
}
```

- [ ] **Step 2: Call migration at startup**

Modify `src-tauri/src/main.rs` setup after workspace `.claude/` initialization:

```rust
let _ = automation::ensure_legacy_lint_routine(app.handle());
```

- [ ] **Step 3: Keep old auto-lint scheduler during one release**

Leave these lines in `main.rs` for this implementation:

```rust
auto_lint::check_missed_run(app.handle());
auto_lint::start_scheduler(app.handle().clone());
```

The next cleanup can remove the old scheduler after users have migrated.

- [ ] **Step 4: Run tests**

Run:

```bash
cd src-tauri && cargo test automation auto_lint
```

Expected: automation tests and existing auto-lint tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/automation.rs src-tauri/src/main.rs
git commit -m "feat: migrate auto lint into automation routine"
```

---

## Task 15: Verification

**Files:**
- No new source files.
- Verify all touched Rust and TypeScript code.

- [ ] **Step 1: Run frontend IPC and build checks**

Run:

```bash
npm test -- src/tests/ipc-contract.test.ts
npm run build
```

Expected: both commands pass.

- [ ] **Step 2: Run Rust tests**

Run:

```bash
cd src-tauri && cargo test
```

Expected: all Rust tests pass.

- [ ] **Step 3: Run lint if build passes**

Run:

```bash
npm run lint
```

Expected: ESLint passes. If it reports only unused imports introduced by the implementation, remove those imports and rerun.

- [ ] **Step 4: Manual smoke test**

Run:

```bash
npm run tauri dev
```

Expected manual checks:

- Sidebar shows 自动化 entry.
- 自动化工作台 opens without console errors.
- Templates load.
- Creating a Daily Summary routine adds it to the Routine list.
- Run now creates an automation run.
- Run detail shows manifest or failure error.
- If conversation id is present, the 会话 button opens the right chat panel.
- Settings > 自动化 shows only global automation settings.

- [ ] **Step 5: Final commit**

```bash
git status --short
git add src-tauri/src src src/tests
git commit -m "feat: add automation workbench"
```

Expected: working tree contains only unrelated user changes after commit.

---

## Self-Review

### Spec Coverage

- Mixed template/Routine model: Tasks 1, 4, 8, 11, 12.
- Timed triggers only: Tasks 2 and 7.
- Full Agent permission with Agent-owned output decisions: Tasks 5 and 6.
- Run manifest and conversation traceability: Tasks 5, 6, 7, 11.
- Main workbench plus settings global surface: Tasks 10, 11, 12, 13.
- First template set: Task 4.
- Auto-lint migration: Task 14.
- IPC boundary through `src/lib/tauri.ts`: Task 8.

### Scope Notes

This plan intentionally keeps timezone support to `Asia/Hong_Kong` and `Local` for the first implementation. The current product context is Asia/Hong_Kong, and expanding to a full timezone database would add dependency and UI scope that the approved spec does not require.

This plan also keeps the old auto-lint scheduler for one release while adding the new Routine. That avoids breaking existing users during migration. A cleanup plan can remove old auto-lint scheduling after the workbench has proven stable.
