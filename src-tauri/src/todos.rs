use serde::Serialize;
use std::path::{Path, PathBuf};

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

fn todos_path(workspace: &str) -> PathBuf {
    Path::new(workspace).join("todos.md")
}

fn read_todos_file(workspace: &str) -> String {
    let p = todos_path(workspace);
    std::fs::read_to_string(&p).unwrap_or_default()
}

fn write_todos_file(workspace: &str, content: &str) -> Result<(), String> {
    let p = todos_path(workspace);
    std::fs::write(&p, content).map_err(|e| format!("写入 todos.md 失败: {}", e))
}

pub fn list_todos_from_workspace(workspace: &str) -> Vec<TodoItem> {
    parse_todos(&read_todos_file(workspace))
}

pub fn add_todo_to_workspace(workspace: &str, text: &str, due: Option<&str>) -> Result<(), String> {
    let p = todos_path(workspace);
    let mut content = if p.exists() {
        std::fs::read_to_string(&p).map_err(|e| e.to_string())?
    } else {
        "---\ndescription: 全局待办清单，由用户手动添加或 AI 自动提取\nformat: GFM task list\nrules:\n  - 每行一条待办，`- [ ]` 未完成，`- [x]` 已完成\n  - 截止日期用 HTML 注释 `<!-- due:YYYY-MM-DD -->` 附在行尾（可选）\n  - 完成日期用 `<!-- done:YYYY-MM-DD -->` 附在行尾（勾选时自动添加）\n  - 新条目追加到未完成项末尾、已完成项之前\n  - 不要重复已存在的条目\n---\n\n# 待办\n\n".to_string()
    };

    let new_line = match due {
        Some(d) => format!("- [ ] {} <!-- due:{} -->", text, d),
        None => format!("- [ ] {}", text),
    };

    let lines: Vec<&str> = content.lines().collect();
    let first_done = lines.iter().position(|l| {
        let t = l.trim_start();
        t.starts_with("- [x] ") || t.starts_with("- [X] ")
    });

    match first_done {
        Some(pos) => {
            let mut new_lines: Vec<String> = lines[..pos].iter().map(|s| s.to_string()).collect();
            new_lines.push(new_line);
            new_lines.extend(lines[pos..].iter().map(|s| s.to_string()));
            content = new_lines.join("\n") + "\n";
        }
        None => {
            if !content.ends_with('\n') {
                content.push('\n');
            }
            content.push_str(&new_line);
            content.push('\n');
        }
    }

    write_todos_file(workspace, &content)
}

pub fn toggle_todo_in_workspace(workspace: &str, line_index: usize, checked: bool) -> Result<(), String> {
    let content = read_todos_file(workspace);
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    let line = &lines[line_index];
    let trimmed = line.trim_start();

    if checked {
        if trimmed.starts_with("- [ ] ") {
            let today = chrono::Local::now().format("%Y-%m-%d").to_string();
            let new_line = line.replacen("- [ ] ", "- [x] ", 1);
            lines[line_index] = format!("{} <!-- done:{} -->", new_line, today);
        }
    } else if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [X] ") {
        let new_line = line
            .replacen("- [x] ", "- [ ] ", 1)
            .replacen("- [X] ", "- [ ] ", 1);
        let cleaned = remove_comment(&new_line, "done:");
        lines[line_index] = cleaned;
    }

    write_todos_file(workspace, &(lines.join("\n") + "\n"))
}

pub fn delete_todo_in_workspace(workspace: &str, line_index: usize) -> Result<(), String> {
    let content = read_todos_file(workspace);
    let lines: Vec<&str> = content.lines().collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    let new_lines: Vec<&str> = lines.into_iter().enumerate()
        .filter(|(i, _)| *i != line_index)
        .map(|(_, l)| l)
        .collect();

    write_todos_file(workspace, &(new_lines.join("\n") + "\n"))
}

fn remove_comment(line: &str, prefix: &str) -> String {
    let mut result = line.to_string();
    let pattern = format!("<!-- {}", prefix);
    if let Some(start) = result.find(&pattern) {
        if let Some(end) = result[start..].find("-->") {
            result = format!("{}{}", result[..start].trim_end(), &result[start + end + 3..]);
        }
    }
    result.trim_end().to_string()
}

#[tauri::command]
pub fn list_todos(app: tauri::AppHandle) -> Result<Vec<TodoItem>, String> {
    let cfg = crate::config::load_config(&app)?;
    Ok(list_todos_from_workspace(&cfg.workspace_path))
}

#[tauri::command]
pub fn add_todo(app: tauri::AppHandle, text: String, due: Option<String>) -> Result<TodoItem, String> {
    let cfg = crate::config::load_config(&app)?;
    add_todo_to_workspace(&cfg.workspace_path, &text, due.as_deref())?;
    let items = list_todos_from_workspace(&cfg.workspace_path);
    items.into_iter().filter(|t| !t.done && t.text == text).last()
        .ok_or_else(|| "添加后未找到该待办".to_string())
}

#[tauri::command]
pub fn toggle_todo(app: tauri::AppHandle, line_index: usize, checked: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    toggle_todo_in_workspace(&cfg.workspace_path, line_index, checked)
}

#[tauri::command]
pub fn delete_todo(app: tauri::AppHandle, line_index: usize) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    delete_todo_in_workspace(&cfg.workspace_path, line_index)
}

pub fn set_todo_due_in_workspace(workspace: &str, line_index: usize, due: Option<&str>) -> Result<(), String> {
    let content = read_todos_file(workspace);
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    // Remove existing due comment
    let cleaned = remove_comment(&lines[line_index], "due:");
    // Append new due if provided
    lines[line_index] = match due {
        Some(d) if !d.is_empty() => format!("{} <!-- due:{} -->", cleaned, d),
        _ => cleaned,
    };

    write_todos_file(workspace, &(lines.join("\n") + "\n"))
}

#[tauri::command]
pub fn set_todo_due(app: tauri::AppHandle, line_index: usize, due: Option<String>) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    set_todo_due_in_workspace(&cfg.workspace_path, line_index, due.as_deref())
}

pub fn update_todo_text_in_workspace(workspace: &str, line_index: usize, new_text: &str) -> Result<(), String> {
    let content = read_todos_file(workspace);
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    let line = &lines[line_index];
    let trimmed = line.trim_start();

    // Preserve the checkbox prefix and any trailing comments (due/done)
    let prefix = if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [X] ") {
        "- [x] "
    } else if trimmed.starts_with("- [ ] ") {
        "- [ ] "
    } else {
        return Err("该行不是待办项".to_string());
    };

    // Extract existing comments
    let old_rest = &trimmed[6..];
    let mut comments = String::new();
    let mut tmp = old_rest.to_string();
    while let Some(start) = tmp.find("<!--") {
        if let Some(end) = tmp[start..].find("-->") {
            comments.push(' ');
            comments.push_str(&tmp[start..start + end + 3]);
            tmp = format!("{}{}", &tmp[..start], &tmp[start + end + 3..]);
        } else {
            break;
        }
    }

    lines[line_index] = if comments.is_empty() {
        format!("{}{}", prefix, new_text.trim())
    } else {
        format!("{}{}{}", prefix, new_text.trim(), comments)
    };

    write_todos_file(workspace, &(lines.join("\n") + "\n"))
}

#[tauri::command]
pub fn update_todo_text(app: tauri::AppHandle, line_index: usize, text: String) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    update_todo_text_in_workspace(&cfg.workspace_path, line_index, &text)
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

    #[test]
    fn list_todos_from_file() {
        let tmp = std::env::temp_dir().join("journal_todo_list_test");
        std::fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("todos.md");
        std::fs::write(&path, "# 待办\n\n- [ ] 任务一\n- [x] 任务二 <!-- done:2026-04-01 -->\n").unwrap();
        let items = list_todos_from_workspace(tmp.to_str().unwrap());
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].text, "任务一");
        assert!(items[1].done);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn list_todos_missing_file() {
        let tmp = std::env::temp_dir().join("journal_todo_missing_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let items = list_todos_from_workspace(tmp.to_str().unwrap());
        assert!(items.is_empty());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn add_todo_creates_file_if_missing() {
        let tmp = std::env::temp_dir().join("journal_todo_add_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        add_todo_to_workspace(tmp.to_str().unwrap(), "新待办", None).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.starts_with("---\n"));
        assert!(content.contains("# 待办"));
        assert!(content.contains("- [ ] 新待办"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn add_todo_with_due_date() {
        let tmp = std::env::temp_dir().join("journal_todo_add_due_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        add_todo_to_workspace(tmp.to_str().unwrap(), "截止任务", Some("2026-04-10")).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("- [ ] 截止任务 <!-- due:2026-04-10 -->"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn add_todo_appends_before_completed() {
        let tmp = std::env::temp_dir().join("journal_todo_add_order_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n- [ ] 已有任务\n- [x] 已完成\n").unwrap();
        add_todo_to_workspace(tmp.to_str().unwrap(), "新增任务", None).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        let lines: Vec<&str> = content.lines().collect();
        let new_pos = lines.iter().position(|l| l.contains("新增任务")).unwrap();
        let done_pos = lines.iter().position(|l| l.contains("已完成")).unwrap();
        assert!(new_pos < done_pos);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn toggle_todo_check() {
        let tmp = std::env::temp_dir().join("journal_todo_toggle_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n- [ ] 待办项\n").unwrap();
        toggle_todo_in_workspace(tmp.to_str().unwrap(), 2, true).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("- [x] 待办项"));
        assert!(content.contains("<!-- done:"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn toggle_todo_uncheck() {
        let tmp = std::env::temp_dir().join("journal_todo_uncheck_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n- [x] 已完成 <!-- done:2026-04-01 -->\n").unwrap();
        toggle_todo_in_workspace(tmp.to_str().unwrap(), 2, false).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("- [ ] 已完成"));
        assert!(!content.contains("<!-- done:"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn delete_todo_line() {
        let tmp = std::env::temp_dir().join("journal_todo_delete_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n- [ ] 保留\n- [ ] 删除\n- [ ] 也保留\n").unwrap();
        delete_todo_in_workspace(tmp.to_str().unwrap(), 3).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("保留"));
        assert!(!content.contains("删除"));
        assert!(content.contains("也保留"));
        std::fs::remove_dir_all(&tmp).ok();
    }
}
