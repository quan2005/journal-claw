// These serde/IPC contract types are consumed incrementally by later automation modules.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AutomationSchedule {
    Daily {
        time: String,
        timezone: String,
    },
    Weekdays {
        time: String,
        timezone: String,
    },
    Weekly {
        weekday: u32,
        time: String,
        timezone: String,
    },
    Monthly {
        day: u32,
        time: String,
        timezone: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AutomationScope {
    Relative {
        range: String,
    },
    RecentDays {
        days: u32,
    },
    Month {
        year_month: String,
    },
    Tags {
        tags: Vec<String>,
        range: Option<Box<AutomationScope>>,
    },
    Identities {
        identity_ids: Vec<String>,
        range: Option<Box<AutomationScope>>,
    },
    Keyword {
        query: String,
        range: Option<Box<AutomationScope>>,
    },
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

        let value = serde_json::to_value(&routine).unwrap();
        assert_eq!(value["schedule"]["kind"], "daily");
        assert_eq!(value["schedule"]["time"], "08:00");
        assert_eq!(value["schedule"]["timezone"], "Asia/Hong_Kong");
        assert_eq!(value["scope"]["kind"], "relative");
        assert_eq!(value["scope"]["range"], "yesterday");
        assert_eq!(value["template_id"], "daily-summary");

        let parsed: AutomationRoutine = serde_json::from_value(value).unwrap();
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
