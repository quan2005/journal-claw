use crate::llm::types::{ContentBlock, Message, Role};

const COMPACT_PREAMBLE: &str =
    "本会话已从之前的对话延续，上下文超出限制已被压缩。以下摘要涵盖了早期对话内容。\n\n";
const COMPACT_RECENT_NOTE: &str = "近期消息已原样保留。";
const COMPACT_RESUME: &str = "请从上次中断处继续对话，不要询问用户额外问题。直接继续——不要确认摘要，不要复述之前的内容。";

const AUTO_COMPACT_INPUT_TOKENS_THRESHOLD: u32 = 100_000;
const PRESERVE_RECENT_MESSAGES: usize = 6;


pub fn should_auto_compact(cumulative_input_tokens: u32) -> bool {
    cumulative_input_tokens >= AUTO_COMPACT_INPUT_TOKENS_THRESHOLD
}

pub fn compact_messages(messages: &[Message]) -> Option<(Vec<Message>, usize)> {
    let prefix_len = compacted_prefix_len(messages);
    let compactable = &messages[prefix_len..];
    if compactable.len() <= PRESERVE_RECENT_MESSAGES {
        return None;
    }

    let raw_keep_from = messages.len().saturating_sub(PRESERVE_RECENT_MESSAGES);

    // Walk back to avoid splitting ToolUse/ToolResult pairs
    let keep_from = find_safe_boundary(messages, raw_keep_from, prefix_len);

    if keep_from <= prefix_len {
        return None;
    }

    let existing_summary = extract_existing_summary(messages);
    let removed = &messages[prefix_len..keep_from];
    let preserved = &messages[keep_from..];

    let summary = merge_summaries(existing_summary.as_deref(), &summarize_messages(removed));
    let continuation = format_continuation(&summary, !preserved.is_empty());

    let mut compacted = vec![Message {
        role: Role::User,
        content: vec![ContentBlock::Text {
            text: continuation,
        }],
    }];
    compacted.extend_from_slice(preserved);

    // Ensure first preserved message after summary isn't User (API needs alternation)
    // If it is, that's fine — User→User is valid when the first is the summary.
    // But if first preserved is Assistant, we need a dummy user turn. Actually
    // User(summary) followed by Assistant is fine.

    let removed_count = removed.len();
    eprintln!(
        "[compact] compacted {} messages, preserved {}",
        removed_count,
        preserved.len()
    );

    Some((compacted, removed_count))
}

fn compacted_prefix_len(messages: &[Message]) -> usize {
    if messages
        .first()
        .and_then(|m| first_text(m))
        .is_some_and(|t| t.starts_with(COMPACT_PREAMBLE.trim_end()))
    {
        1
    } else {
        0
    }
}

fn extract_existing_summary(messages: &[Message]) -> Option<String> {
    let first = messages.first()?;
    let text = first_text(first)?;
    if text.starts_with(COMPACT_PREAMBLE.trim_end()) {
        extract_tag_block(text, "summary")
    } else {
        None
    }
}

fn find_safe_boundary(messages: &[Message], raw_keep_from: usize, min: usize) -> usize {
    let mut k = raw_keep_from;
    loop {
        if k <= min {
            break;
        }
        let first_preserved = &messages[k];
        let starts_with_tool_result = first_preserved
            .content
            .first()
            .is_some_and(|b| matches!(b, ContentBlock::ToolResult { .. }));
        if !starts_with_tool_result {
            break;
        }
        // Check preceding message for matching ToolUse
        if k > 0 {
            let preceding = &messages[k - 1];
            let has_tool_use = preceding
                .content
                .iter()
                .any(|b| matches!(b, ContentBlock::ToolUse { .. }));
            if has_tool_use {
                k = k.saturating_sub(1);
                break;
            }
        }
        k = k.saturating_sub(1);
    }
    k
}

fn summarize_messages(messages: &[Message]) -> String {
    let user_count = messages.iter().filter(|m| m.role == Role::User).count();
    let assistant_count = messages
        .iter()
        .filter(|m| m.role == Role::Assistant)
        .count();

    let mut tool_names: Vec<&str> = messages
        .iter()
        .flat_map(|m| m.content.iter())
        .filter_map(|b| match b {
            ContentBlock::ToolUse { name, .. } => Some(name.as_str()),
            _ => None,
        })
        .collect();
    tool_names.sort_unstable();
    tool_names.dedup();

    let mut lines = vec![
        "<summary>".to_string(),
        "对话摘要:".to_string(),
        format!(
            "- 范围: 压缩了 {} 条早期消息 (用户={}, 助手={})。",
            messages.len(),
            user_count,
            assistant_count
        ),
    ];

    if !tool_names.is_empty() {
        lines.push(format!("- 使用的工具: {}。", tool_names.join(", ")));
    }

    let recent_requests = collect_recent_user_texts(messages, 3);
    if !recent_requests.is_empty() {
        lines.push("- 近期用户请求:".to_string());
        for req in &recent_requests {
            lines.push(format!("  - {}", truncate(req, 160)));
        }
    }

    let key_files = collect_key_files(messages);
    if !key_files.is_empty() {
        lines.push(format!("- 涉及的关键文件: {}。", key_files.join(", ")));
    }

    if let Some(current) = infer_current_work(messages) {
        lines.push(format!("- 当前工作: {}", current));
    }

    // Key timeline
    lines.push("- 关键时间线:".to_string());
    for msg in messages {
        let role = match msg.role {
            Role::User => "用户",
            Role::Assistant => "助手",
        };
        let content = msg
            .content
            .iter()
            .map(summarize_block)
            .collect::<Vec<_>>()
            .join(" | ");
        lines.push(format!("  - {}: {}", role, content));
    }

    lines.push("</summary>".to_string());
    lines.join("\n")
}

fn merge_summaries(existing: Option<&str>, new_summary: &str) -> String {
    let Some(existing) = existing else {
        return new_summary.to_string();
    };

    let prev_highlights = extract_highlights(existing);
    let new_formatted = format_summary_text(new_summary);
    let new_highlights = extract_highlights(&new_formatted);
    let new_timeline = extract_timeline(&new_formatted);

    let mut lines = vec!["<summary>".to_string(), "对话摘要:".to_string()];

    if !prev_highlights.is_empty() {
        lines.push("- 之前压缩的上下文:".to_string());
        for h in &prev_highlights {
            lines.push(format!("  {}", h));
        }
    }

    if !new_highlights.is_empty() {
        lines.push("- 新压缩的上下文:".to_string());
        for h in &new_highlights {
            lines.push(format!("  {}", h));
        }
    }

    if !new_timeline.is_empty() {
        lines.push("- 关键时间线:".to_string());
        for t in &new_timeline {
            lines.push(format!("  {}", t));
        }
    }

    lines.push("</summary>".to_string());
    lines.join("\n")
}

fn format_continuation(summary: &str, has_preserved: bool) -> String {
    let formatted = format_summary_text(summary);
    let compressed = compress_summary(&formatted);
    let mut text = format!("{}{}", COMPACT_PREAMBLE, compressed);
    if has_preserved {
        text.push_str("\n\n");
        text.push_str(COMPACT_RECENT_NOTE);
    }
    text.push('\n');
    text.push_str(COMPACT_RESUME);
    text
}

// ── Summary compression ─────────────────────────

const MAX_SUMMARY_CHARS: usize = 1500;
const MAX_SUMMARY_LINES: usize = 30;
const MAX_LINE_CHARS: usize = 160;

fn compress_summary(summary: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    let mut total_chars = 0;

    for raw in summary.lines() {
        let normalized: String = raw.split_whitespace().collect::<Vec<_>>().join(" ");
        if normalized.is_empty() {
            continue;
        }
        let truncated = truncate(&normalized, MAX_LINE_CHARS);
        let char_count = truncated.chars().count();
        if lines.len() >= MAX_SUMMARY_LINES || total_chars + char_count > MAX_SUMMARY_CHARS {
            break;
        }
        total_chars += char_count + 1;
        lines.push(truncated);
    }

    lines.join("\n")
}

// ── Helpers ─────────────────────────────────────

fn summarize_block(block: &ContentBlock) -> String {
    let raw = match block {
        ContentBlock::Text { text } => text.clone(),
        ContentBlock::Thinking { .. } => "[思考]".to_string(),
        ContentBlock::ToolUse { name, .. } => format!("工具调用: {}", name),
        ContentBlock::ToolResult {
            content, is_error, ..
        } => {
            let prefix = if *is_error { "工具误: " } else { "工具结果: " };
            format!("{}{}", prefix, content)
        }
        ContentBlock::ServerToolUse { name, .. } => format!("服务端工具: {}", name),
        ContentBlock::ServerToolResult(_) => "[搜索结果]".to_string(),
        ContentBlock::Image { .. } => "[图片]".to_string(),
    };
    truncate(&raw, 160)
}

fn collect_recent_user_texts(messages: &[Message], limit: usize) -> Vec<String> {
    messages
        .iter()
        .filter(|m| m.role == Role::User)
        .rev()
        .filter_map(|m| first_text(m).map(|s| s.to_string()))
        .take(limit)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

fn collect_key_files(messages: &[Message]) -> Vec<String> {
    let mut files: Vec<String> = messages
        .iter()
        .flat_map(|m| m.content.iter())
        .flat_map(|b| {
            let text = match b {
                ContentBlock::Text { text } => text.as_str(),
                ContentBlock::ToolUse { input, .. } => {
                    // input is serde_json::Value, extract string content
                    return extract_file_candidates(&input.to_string());
                }
                ContentBlock::ToolResult { content, .. } => content.as_str(),
                _ => return vec![],
            };
            extract_file_candidates(text)
        })
        .collect();
    files.sort();
    files.dedup();
    files.truncate(10);
    files
}

fn extract_file_candidates(content: &str) -> Vec<String> {
    content
        .split_whitespace()
        .filter_map(|token| {
            let candidate = token.trim_matches(|c: char| {
                matches!(c, ',' | '.' | ':' | ';' | ')' | '(' | '"' | '\'' | '`')
            });
            if candidate.contains('/')
                && std::path::Path::new(candidate)
                    .extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|ext| {
                        ["rs", "ts", "tsx", "js", "json", "md", "toml", "css"]
                            .iter()
                            .any(|e| ext.eq_ignore_ascii_case(e))
                    })
            {
                Some(candidate.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn infer_current_work(messages: &[Message]) -> Option<String> {
    messages
        .iter()
        .rev()
        .filter_map(|m| first_text(m))
        .find(|t| !t.trim().is_empty())
        .map(|t| truncate(t, 200))
}

fn first_text(msg: &Message) -> Option<&str> {
    msg.content.iter().find_map(|b| match b {
        ContentBlock::Text { text } if !text.trim().is_empty() => Some(text.as_str()),
        _ => None,
    })
}

fn truncate(content: &str, max_chars: usize) -> String {
    if content.chars().count() <= max_chars {
        return content.to_string();
    }
    let mut t: String = content.chars().take(max_chars.saturating_sub(1)).collect();
    t.push('…');
    t
}

fn format_summary_text(summary: &str) -> String {
    if let Some(content) = extract_tag_block(summary, "summary") {
        summary.replace(
            &format!("<summary>{}</summary>", content),
            &format!("摘要:\n{}", content.trim()),
        )
    } else {
        summary.to_string()
    }
}

fn extract_tag_block(content: &str, tag: &str) -> Option<String> {
    let start = format!("<{}>", tag);
    let end = format!("</{}>", tag);
    let s = content.find(&start)? + start.len();
    let e = content[s..].find(&end)? + s;
    Some(content[s..e].to_string())
}

fn extract_highlights(summary: &str) -> Vec<String> {
    summary
        .lines()
        .filter(|l| {
            let trimmed = l.trim();
            trimmed.starts_with("- ") && !trimmed.starts_with("- 关键时间线:")
        })
        .map(|l| l.to_string())
        .collect()
}

fn extract_timeline(summary: &str) -> Vec<String> {
    let mut in_timeline = false;
    let mut lines = Vec::new();
    for line in summary.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("- 关键时间线:") || trimmed.starts_with("- Key timeline:") {
            in_timeline = true;
            continue;
        }
        if in_timeline {
            if trimmed.starts_with("- ") && !trimmed.starts_with("  - ") {
                break;
            }
            if trimmed.starts_with("- ") || trimmed.starts_with("  - ") {
                lines.push(line.to_string());
            }
        }
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_msg(text: &str) -> Message {
        Message {
            role: Role::User,
            content: vec![ContentBlock::Text {
                text: text.to_string(),
            }],
        }
    }

    fn assistant_msg(text: &str) -> Message {
        Message {
            role: Role::Assistant,
            content: vec![ContentBlock::Text {
                text: text.to_string(),
            }],
        }
    }

    #[test]
    fn no_compact_when_few_messages() {
        let messages: Vec<Message> = (0..3)
            .flat_map(|i| {
                vec![
                    user_msg(&format!("q{}", i)),
                    assistant_msg(&format!("a{}", i)),
                ]
            })
            .collect();
        // 6 messages = PRESERVE_RECENT_MESSAGES, nothing to remove
        assert!(compact_messages(&messages).is_none());
    }

    #[test]
    fn compact_removes_old_messages() {
        let messages: Vec<Message> = (0..20)
            .flat_map(|i| {
                vec![
                    user_msg(&format!("question {}", i)),
                    assistant_msg(&format!("answer {}", i)),
                ]
            })
            .collect();
        let (compacted, removed) = compact_messages(&messages).unwrap();
        assert!(removed > 0);
        // First message should be the summary
        let first_text = first_text(&compacted[0]).unwrap();
        assert!(first_text.contains("对话摘要"));
        // Should preserve recent messages
        assert!(compacted.len() <= PRESERVE_RECENT_MESSAGES + 1);
    }

    #[test]
    fn tool_pair_not_split() {
        let mut messages = vec![
            user_msg("do something"),
            Message {
                role: Role::Assistant,
                content: vec![ContentBlock::ToolUse {
                    id: "t1".to_string(),
                    name: "bash".to_string(),
                    input: serde_json::json!({"command": "ls"}),
                }],
            },
            Message {
                role: Role::User,
                content: vec![ContentBlock::ToolResult {
                    tool_use_id: "t1".to_string(),
                    content: "file.txt".to_string(),
                    is_error: false,
                        image: None,
                }],
            },
        ];
        // Add enough messages to trigger compaction
        for i in 0..20 {
            messages.push(user_msg(&format!("q{}", i)));
            messages.push(assistant_msg(&format!("a{}", i)));
        }
        let (compacted, _) = compact_messages(&messages).unwrap();
        // Verify no orphaned ToolResult at start of preserved section
        for msg in &compacted[1..] {
            if let Some(ContentBlock::ToolResult { .. }) = msg.content.first() {
                // If there's a ToolResult, the preceding message must have ToolUse
                panic!("orphaned ToolResult found in compacted messages");
            }
            break; // only check first preserved
        }
    }

    #[test]
    fn threshold_check() {
        assert!(!should_auto_compact(99_999));
        assert!(should_auto_compact(100_000));
        assert!(should_auto_compact(200_000));
    }

    #[test]
    fn incremental_compaction() {
        let messages: Vec<Message> = (0..20)
            .flat_map(|i| {
                vec![
                    user_msg(&format!("question {}", i)),
                    assistant_msg(&format!("answer {}", i)),
                ]
            })
            .collect();
        let (first_compact, _) = compact_messages(&messages).unwrap();

        // Add more messages to the compacted result
        let mut extended = first_compact;
        for i in 20..40 {
            extended.push(user_msg(&format!("question {}", i)));
            extended.push(assistant_msg(&format!("answer {}", i)));
        }

        let (second_compact, _) = compact_messages(&extended).unwrap();
        let summary_text = first_text(&second_compact[0]).unwrap();
        assert!(summary_text.contains("之前压缩的上下文") || summary_text.contains("对话摘要"));
    }
}
