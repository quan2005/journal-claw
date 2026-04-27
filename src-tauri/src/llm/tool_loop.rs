use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use super::bash_tool;
use super::enable_skill;
use super::fs_tools;
use super::loop_detector::{LoopDetector, Severity};
use super::types::*;
use super::LlmEngine;

const MAX_TURNS: usize = 60;

/// Event emitted by the agent loop for external consumers (ai-log, etc.)
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum AgentEvent {
    /// LLM is producing text
    TextDelta(String),
    /// LLM requested a tool call — about to execute
    ToolStart {
        name: String,
        input: serde_json::Value,
    },
    /// Tool execution finished
    ToolEnd { name: String, is_error: bool },
    /// A full LLM turn completed (for cost/timing tracking)
    TurnComplete { turn: usize, usage: Option<Usage> },
    /// Agent finished
    Done {
        total_turns: usize,
        final_text: String,
    },
}

/// Run the agentic tool loop: LLM → tool calls → results → repeat.
///
/// Returns the final text output from the LLM.
pub async fn run_agent(
    engine: &dyn LlmEngine,
    workspace_path: &str,
    system_prompt: &str,
    user_prompt: &str,
    on_event: impl Fn(AgentEvent) + Send + Sync + 'static,
    cancel: CancellationToken,
) -> Result<String, LlmError> {
    let skills = super::prompt::scan_skills(workspace_path).await;
    let mut tools = vec![bash_tool::definition(), enable_skill::definition(&skills)];
    tools.extend(fs_tools::definitions());

    let mut messages: Vec<Message> = vec![Message {
        role: Role::User,
        content: vec![ContentBlock::Text {
            text: user_prompt.to_string(),
        }],
    }];

    let accumulated_text;

    let on_event = std::sync::Arc::new(on_event);
    let mut loop_detector = LoopDetector::new();

    for turn in 0..MAX_TURNS {
        if cancel.is_cancelled() {
            return Err(LlmError::Cancelled);
        }

        let (tx, mut rx) = mpsc::unbounded_channel::<StreamEvent>();
        let turn_text = std::sync::Arc::new(std::sync::Mutex::new(String::new()));

        // Spawn consumer task to drain stream events
        let consumer = {
            let turn_text = turn_text.clone();
            let on_event = on_event.clone();
            tokio::spawn(async move {
                while let Some(evt) = rx.recv().await {
                    match evt {
                        StreamEvent::TextDelta(ref text) => {
                            if let Ok(mut t) = turn_text.lock() {
                                t.push_str(text);
                            }
                            on_event(AgentEvent::TextDelta(text.clone()));
                        }
                        StreamEvent::Error(e) => {
                            eprintln!("[tool_loop] stream error: {}", e);
                        }
                        _ => {}
                    }
                }
            })
        };

        let response = engine
            .chat_stream(&messages, &tools, system_prompt, tx)
            .await;

        // Wait for consumer to finish draining
        let _ = consumer.await;

        let response = response?;

        // Get accumulated text for this turn
        let turn_text_str = turn_text.lock().unwrap_or_else(|e| e.into_inner()).clone();

        on_event(AgentEvent::TurnComplete {
            turn,
            usage: response.usage.clone(),
        });

        // Build assistant message content
        let mut assistant_content: Vec<ContentBlock> = Vec::new();

        // Thinking blocks must come first (API requirement for multi-turn)
        for block in &response.content {
            if let ContentBlock::Thinking { .. } = block {
                assistant_content.push(block.clone());
            }
        }

        if !turn_text_str.is_empty() {
            assistant_content.push(ContentBlock::Text {
                text: turn_text_str.clone(),
            });
        }

        // Collect client-side tool_use calls (bash, etc.)
        let tool_calls: Vec<(String, String, serde_json::Value)> = response
            .content
            .iter()
            .filter_map(|b| {
                if let ContentBlock::ToolUse { id, name, input } = b {
                    Some((id.clone(), name.clone(), input.clone()))
                } else {
                    None
                }
            })
            .collect();
        for (id, name, input) in &tool_calls {
            assistant_content.push(ContentBlock::ToolUse {
                id: id.clone(),
                name: name.clone(),
                input: input.clone(),
            });
        }

        // Preserve server-side blocks (web_search) for multi-turn pass-through
        for block in &response.content {
            match block {
                ContentBlock::ServerToolUse { .. } | ContentBlock::ServerToolResult(_) => {
                    assistant_content.push(block.clone());
                }
                _ => {}
            }
        }

        messages.push(Message {
            role: Role::Assistant,
            content: assistant_content,
        });

        match response.stop_reason {
            StopReason::EndTurn | StopReason::MaxTokens => {
                accumulated_text = turn_text_str;
                on_event(AgentEvent::Done {
                    total_turns: turn + 1,
                    final_text: accumulated_text.clone(),
                });
                return Ok(accumulated_text);
            }
            StopReason::PauseTurn => {
                continue;
            }
            StopReason::ToolUse => {
                if tool_calls.is_empty() {
                    continue;
                }

                // Execute client-side tool calls
                let mut results: Vec<ContentBlock> = Vec::new();
                for (id, name, input) in &tool_calls {
                    if cancel.is_cancelled() {
                        return Err(LlmError::Cancelled);
                    }

                    on_event(AgentEvent::ToolStart {
                        name: name.clone(),
                        input: input.clone(),
                    });

                    let (result, image_data) = match name.as_str() {
                        "bash" => (bash_tool::execute(input, workspace_path).await, None),
                        "load_skill" => (enable_skill::execute(input, workspace_path).await, None),
                        fs_name => {
                            if let Some((r, img)) =
                                fs_tools::execute(fs_name, input, workspace_path).await
                            {
                                (r, img)
                            } else {
                                (
                                    ToolResult {
                                        output: format!("unknown tool: {}", name),
                                        is_error: true,
                                    },
                                    None,
                                )
                            }
                        }
                    };

                    on_event(AgentEvent::ToolEnd {
                        name: name.clone(),
                        is_error: result.is_error,
                    });

                    // Loop detection: record and check
                    if let Some(det) = loop_detector.record(name, input, &result.output) {
                        match det.severity {
                            Severity::Warning => {
                                eprintln!("[loop_detector] warning: {}", det.message);
                                results.push(ContentBlock::ToolResult {
                                    tool_use_id: id.clone(),
                                    content: format!(
                                        "{}\n\n[循环检测警告] {}",
                                        result.output, det.message
                                    ),
                                    is_error: result.is_error,
                                    image: image_data,
                                });
                                continue;
                            }
                            Severity::Block => {
                                eprintln!("[loop_detector] blocked: {}", det.message);
                                results.push(ContentBlock::ToolResult {
                                    tool_use_id: id.clone(),
                                    content: format!("[循环检测] {}", det.message),
                                    is_error: true,
                                    image: None,
                                });
                                continue;
                            }
                            Severity::Break => {
                                eprintln!("[loop_detector] break: {}", det.message);
                                return Err(LlmError::LoopDetected(det.message));
                            }
                        }
                    }

                    results.push(ContentBlock::ToolResult {
                        tool_use_id: id.clone(),
                        content: result.output,
                        is_error: result.is_error,
                        image: image_data,
                    });
                }

                messages.push(Message {
                    role: Role::User,
                    content: results,
                });
            }
        }
    }

    Err(LlmError::MaxTurnsExceeded)
}
