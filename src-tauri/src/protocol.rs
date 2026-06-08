use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TurnStats {
    pub elapsed_secs: f64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolOutput {
    pub content: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ConversationEvent {
    #[serde(rename_all = "camelCase")]
    TurnStarted { session_id: String, turn_id: String },
    #[serde(rename_all = "camelCase")]
    TextDelta {
        session_id: String,
        turn_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ThinkingDelta {
        session_id: String,
        turn_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ToolStarted {
        session_id: String,
        turn_id: String,
        tool_call: ToolCall,
    },
    #[serde(rename_all = "camelCase")]
    ToolFinished {
        session_id: String,
        turn_id: String,
        tool_call_id: String,
        output: ToolOutput,
    },
    #[serde(rename_all = "camelCase")]
    ArtifactDelta {
        session_id: String,
        turn_id: String,
        artifact_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ArtifactFinished {
        session_id: String,
        turn_id: String,
        artifact_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Usage {
        session_id: String,
        usage: TokenUsage,
    },
    #[serde(rename_all = "camelCase")]
    Failed {
        session_id: String,
        error: AppError,
    },
    #[serde(rename_all = "camelCase")]
    TurnFinished {
        session_id: String,
        stats: TurnStats,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEvent {
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JobEvent {
    pub job_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AppError>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalUpdatedEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsChangedEvent {
    pub keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum AppEventKind {
    #[serde(rename = "workspace.changed")]
    WorkspaceChanged(WorkspaceEvent),
    #[serde(rename = "journal.updated")]
    JournalUpdated(JournalUpdatedEvent),
    #[serde(rename = "job.updated")]
    JobUpdated(JobEvent),
    #[serde(rename = "conversation.event")]
    Conversation(ConversationEvent),
    #[serde(rename = "settings.changed")]
    SettingsChanged(SettingsChangedEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppEvent {
    pub v: u8,
    #[serde(flatten)]
    pub kind: AppEventKind,
}

impl AppEvent {
    pub fn conversation(event: ConversationEvent) -> Self {
        Self {
            v: 1,
            kind: AppEventKind::Conversation(event),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_versioned_conversation_text_delta() {
        let event = AppEvent::conversation(ConversationEvent::TextDelta {
            session_id: "ses_1".to_string(),
            turn_id: "turn_1".to_string(),
            delta: "hello".to_string(),
        });

        let json = serde_json::to_value(event).unwrap();

        assert_eq!(json["v"], 1);
        assert_eq!(json["type"], "conversation.event");
        assert_eq!(json["data"]["kind"], "text_delta");
        assert_eq!(json["data"]["sessionId"], "ses_1");
    }
}
