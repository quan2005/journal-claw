use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct TodoItem {
    pub text: String,
    pub done: bool,
    pub due: Option<String>,
    pub done_date: Option<String>,
    pub line_index: usize,
}

/// Parse a single markdown line into a TodoItem, if it matches GFM task list syntax.
fn parse_todo_line(line: &str, line_index: usize) -> Option<TodoItem> {
    let trimmed = line.trim_start();

    // Match "- [ ] text" or "- [x] text" or "- [X] text"
    let (done, rest) = if trimmed.starts_with("- [ ] ") {
        (false, &trimmed[6..])
    } else if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [X] ") {
        (true, &trimmed[6..])
    } else {
        return None;
    };

    // Extract HTML comment metadata
    let mut text = rest.to_string();
    let mut due: Option<String> = None;
    let mut done_date: Option<String> = None;

    while let Some(start) = text.find("<!--") {
        if let Some(end) = text[start..].find("-->") {
            let comment = text[start + 4..start + end].trim();
            if let Some(val) = comment.strip_prefix("due:") {
                due = Some(val.trim().to_string());
            } else if let Some(val) = comment.strip_prefix("done:") {
                done_date = Some(val.trim().to_string());
            }
            text = format!("{}{}", &text[..start], &text[start + end + 3..]);
        } else {
            break;
        }
    }

    Some(TodoItem {
        text: text.trim().to_string(),
        done,
        due,
        done_date,
        line_index,
    })
}

/// Parse the entire todos.md content into a Vec<TodoItem>.
pub fn parse_todos(content: &str) -> Vec<TodoItem> {
    content
        .lines()
        .enumerate()
        .filter_map(|(i, line)| parse_todo_line(line, i))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_unchecked_item() {
        let items = parse_todos("---\ndescription: test\n---\n\n# 待办\n\n- [ ] 买牛奶\n");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].text, "买牛奶");
        assert!(!items[0].done);
        assert!(items[0].due.is_none());
    }

    #[test]
    fn parse_checked_item() {
        let items = parse_todos("- [x] 完成报告 <!-- done:2026-04-02 -->\n");
        assert_eq!(items.len(), 1);
        assert!(items[0].done);
        assert_eq!(items[0].done_date.as_deref(), Some("2026-04-02"));
    }

    #[test]
    fn parse_item_with_due_date() {
        let items = parse_todos("- [ ] 提交设计稿 <!-- due:2026-04-10 -->\n");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].due.as_deref(), Some("2026-04-10"));
        assert_eq!(items[0].text, "提交设计稿");
    }

    #[test]
    fn parse_item_with_both_dates() {
        let items = parse_todos("- [x] 写代码 <!-- due:2026-04-05 --> <!-- done:2026-04-03 -->\n");
        assert_eq!(items.len(), 1);
        assert!(items[0].done);
        assert_eq!(items[0].due.as_deref(), Some("2026-04-05"));
        assert_eq!(items[0].done_date.as_deref(), Some("2026-04-03"));
    }

    #[test]
    fn ignores_non_task_lines() {
        let items = parse_todos("---\ndescription: test\nrules:\n  - rule1\n---\n\n# 待办\n\n一段普通文字\n- 普通列表\n- [ ] 真正的待办\n");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].text, "真正的待办");
    }

    #[test]
    fn empty_file() {
        let items = parse_todos("");
        assert!(items.is_empty());
    }
}
