use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct TodoItem {
    pub text: String,
    pub done: bool,
    pub due: Option<String>,
    pub done_date: Option<String>,
    pub source: Option<String>,
    pub line_index: usize,
    pub done_file: bool,
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
    let mut source: Option<String> = None;

    while let Some(start) = text.find("<!--") {
        if let Some(end) = text[start..].find("-->") {
            let comment = text[start + 4..start + end].trim();
            if let Some(val) = comment.strip_prefix("due:") {
                due = Some(val.trim().to_string());
            } else if let Some(val) = comment.strip_prefix("done:") {
                done_date = Some(val.trim().to_string());
            } else if let Some(val) = comment.strip_prefix("source:") {
                source = Some(val.trim().to_string());
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
        source,
        line_index,
        done_file: false,
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

fn todos_done_path(workspace: &str) -> PathBuf {
    Path::new(workspace).join("todos.done.md")
}

fn read_todos_file(workspace: &str) -> String {
    let p = todos_path(workspace);
    std::fs::read_to_string(&p).unwrap_or_default()
}

fn read_done_file(workspace: &str) -> String {
    let p = todos_done_path(workspace);
    std::fs::read_to_string(&p).unwrap_or_default()
}

fn write_todos_file(workspace: &str, content: &str) -> Result<(), String> {
    let p = todos_path(workspace);
    std::fs::write(&p, content).map_err(|e| format!("写入 todos.md 失败: {}", e))
}

fn write_done_file(workspace: &str, content: &str) -> Result<(), String> {
    let p = todos_done_path(workspace);
    std::fs::write(&p, content).map_err(|e| format!("写入 todos.done.md 失败: {}", e))
}

/// Find the first line after YAML frontmatter (after the closing `---`).
fn first_line_after_frontmatter(lines: &[&str]) -> usize {
    if lines.first().map(|l| l.trim()) == Some("---") {
        for (i, line) in lines.iter().enumerate().skip(1) {
            if line.trim() == "---" {
                return i + 1;
            }
        }
    }
    0
}

pub fn list_todos_from_workspace(workspace: &str) -> Vec<TodoItem> {
    let mut items = parse_todos(&read_todos_file(workspace));
    let mut done_items = parse_todos(&read_done_file(workspace));
    for item in &mut done_items {
        item.done_file = true;
    }
    items.extend(done_items);
    items
}

pub fn add_todo_to_workspace(workspace: &str, text: &str, due: Option<&str>, source: Option<&str>) -> Result<(), String> {
    let p = todos_path(workspace);
    let mut content = if p.exists() {
        std::fs::read_to_string(&p).map_err(|e| e.to_string())?
    } else {
        "---\ndescription: 待办清单（仅未完成项），由用户手动添加或 AI 自动提取\nformat: GFM task list\nrules:\n  - 每行一条待办，`- [ ]` 未完成\n  - 截止日期用 HTML 注释 `<!-- due:YYYY-MM-DD -->` 附在行尾（可选）\n  - 来源用 `<!-- source:filename.md -->` 附在行尾（可选）\n  - 新条目追加到文件末尾\n  - 勾选后自动移入 todos.done.md，不要在此文件写 `- [x]`\n  - 不要重复已存在的条目\n---\n\n# 待办\n\n".to_string()
    };

    let mut new_line = format!("- [ ] {}", text);
    if let Some(d) = due {
        new_line.push_str(&format!(" <!-- due:{} -->", d));
    }
    if let Some(s) = source {
        new_line.push_str(&format!(" <!-- source:{} -->", s));
    }

    // 始终追加到文件末尾（UI 已按 unchecked/checked 分组显示）
    if !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(&new_line);
    content.push('\n');

    write_todos_file(workspace, &content)
}

pub fn toggle_todo_in_workspace(workspace: &str, line_index: usize, checked: bool, done_file: bool) -> Result<(), String> {
    if checked && !done_file {
        // 勾选：从 todos.md 删除，插入到 todos.done.md 顶部
        let content = read_todos_file(workspace);
        let lines: Vec<&str> = content.lines().collect();
        if line_index >= lines.len() {
            return Err(format!("行号 {} 超出范围", line_index));
        }
        let line = lines[line_index];
        let trimmed = line.trim_start();
        if !trimmed.starts_with("- [ ] ") {
            return Err("该行不是未完成待办项".to_string());
        }
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let done_line = format!("{} <!-- done:{} -->", line.replacen("- [ ] ", "- [x] ", 1), today);

        // 从 todos.md 删除
        let new_lines: Vec<&str> = lines.into_iter().enumerate()
            .filter(|(i, _)| *i != line_index)
            .map(|(_, l)| l)
            .collect();
        write_todos_file(workspace, &(new_lines.join("\n") + "\n"))?;

        // 插入到 todos.done.md 顶部（frontmatter 之后）
        let done_content = read_done_file(workspace);
        if done_content.is_empty() {
            write_done_file(workspace, &format!("{}\n", done_line))?;
        } else {
            let done_lines: Vec<&str> = done_content.lines().collect();
            let insert_pos = first_line_after_frontmatter(&done_lines);
            let mut new_done: Vec<String> = done_lines[..insert_pos].iter().map(|s| s.to_string()).collect();
            new_done.push(done_line);
            new_done.extend(done_lines[insert_pos..].iter().map(|s| s.to_string()));
            write_done_file(workspace, &(new_done.join("\n") + "\n"))?;
        }
        Ok(())
    } else if !checked && done_file {
        // 取消勾选：从 todos.done.md 删除，追加到 todos.md 末尾
        let done_content = read_done_file(workspace);
        let done_lines: Vec<&str> = done_content.lines().collect();
        if line_index >= done_lines.len() {
            return Err(format!("行号 {} 超出范围", line_index));
        }
        let line = done_lines[line_index];
        let unchecked_line = line
            .replacen("- [x] ", "- [ ] ", 1)
            .replacen("- [X] ", "- [ ] ", 1);
        let unchecked_line = remove_comment(&unchecked_line, "done:");

        // 从 todos.done.md 删除
        let new_done: Vec<&str> = done_lines.into_iter().enumerate()
            .filter(|(i, _)| *i != line_index)
            .map(|(_, l)| l)
            .collect();
        write_done_file(workspace, &(new_done.join("\n") + "\n"))?;

        // 追加到 todos.md 末尾
        let mut content = read_todos_file(workspace);
        if !content.ends_with('\n') {
            content.push('\n');
        }
        content.push_str(&unchecked_line);
        content.push('\n');
        write_todos_file(workspace, &content)?;
        Ok(())
    } else {
        Ok(()) // 无效操作（已勾选再勾选等），静默忽略
    }
}

pub fn delete_todo_in_workspace(workspace: &str, line_index: usize, done_file: bool) -> Result<(), String> {
    let (content, writer): (String, Box<dyn Fn(&str, &str) -> Result<(), String>>) = if done_file {
        (read_done_file(workspace), Box::new(write_done_file))
    } else {
        (read_todos_file(workspace), Box::new(write_todos_file))
    };
    let lines: Vec<&str> = content.lines().collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    let new_lines: Vec<&str> = lines.into_iter().enumerate()
        .filter(|(i, _)| *i != line_index)
        .map(|(_, l)| l)
        .collect();

    writer(workspace, &(new_lines.join("\n") + "\n"))
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
pub fn add_todo(app: tauri::AppHandle, text: String, due: Option<String>, source: Option<String>) -> Result<TodoItem, String> {
    let cfg = crate::config::load_config(&app)?;
    add_todo_to_workspace(&cfg.workspace_path, &text, due.as_deref(), source.as_deref())?;
    let items = list_todos_from_workspace(&cfg.workspace_path);
    items.into_iter().filter(|t| !t.done && t.text == text).last()
        .ok_or_else(|| "添加后未找到该待办".to_string())
}

#[tauri::command]
pub fn toggle_todo(app: tauri::AppHandle, line_index: usize, checked: bool, done_file: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    toggle_todo_in_workspace(&cfg.workspace_path, line_index, checked, done_file)
}

#[tauri::command]
pub fn delete_todo(app: tauri::AppHandle, line_index: usize, done_file: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    delete_todo_in_workspace(&cfg.workspace_path, line_index, done_file)
}

pub fn set_todo_due_in_workspace(workspace: &str, line_index: usize, due: Option<&str>, done_file: bool) -> Result<(), String> {
    let (content, writer): (String, Box<dyn Fn(&str, &str) -> Result<(), String>>) = if done_file {
        (read_done_file(workspace), Box::new(write_done_file))
    } else {
        (read_todos_file(workspace), Box::new(write_todos_file))
    };
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    let cleaned = remove_comment(&lines[line_index], "due:");
    lines[line_index] = match due {
        Some(d) if !d.is_empty() => format!("{} <!-- due:{} -->", cleaned, d),
        _ => cleaned,
    };

    writer(workspace, &(lines.join("\n") + "\n"))
}

#[tauri::command]
pub fn set_todo_due(app: tauri::AppHandle, line_index: usize, due: Option<String>, done_file: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    set_todo_due_in_workspace(&cfg.workspace_path, line_index, due.as_deref(), done_file)
}

pub fn update_todo_text_in_workspace(workspace: &str, line_index: usize, new_text: &str, done_file: bool) -> Result<(), String> {
    let (content, writer): (String, Box<dyn Fn(&str, &str) -> Result<(), String>>) = if done_file {
        (read_done_file(workspace), Box::new(write_done_file))
    } else {
        (read_todos_file(workspace), Box::new(write_todos_file))
    };
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

    writer(workspace, &(lines.join("\n") + "\n"))
}

#[tauri::command]
pub fn update_todo_text(app: tauri::AppHandle, line_index: usize, text: String, done_file: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    update_todo_text_in_workspace(&cfg.workspace_path, line_index, &text, done_file)
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
        add_todo_to_workspace(tmp.to_str().unwrap(), "新待办", None, None).unwrap();
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
        add_todo_to_workspace(tmp.to_str().unwrap(), "截止任务", Some("2026-04-10"), None).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("- [ ] 截止任务 <!-- due:2026-04-10 -->"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn add_todo_appends_at_end() {
        let tmp = std::env::temp_dir().join("journal_todo_add_order_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n- [ ] 已有任务\n- [x] 已完成\n").unwrap();
        add_todo_to_workspace(tmp.to_str().unwrap(), "新增任务", None, None).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        let lines: Vec<&str> = content.lines().collect();
        let new_pos = lines.iter().position(|l| l.contains("新增任务")).unwrap();
        let done_pos = lines.iter().position(|l| l.contains("已完成")).unwrap();
        assert!(new_pos > done_pos, "新条目应追加到文件末尾");
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn toggle_todo_check() {
        let tmp = std::env::temp_dir().join("journal_todo_toggle_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n- [ ] 待办项\n").unwrap();
        toggle_todo_in_workspace(tmp.to_str().unwrap(), 2, true, false).unwrap();
        // 应从 todos.md 移除，出现在 todos.done.md
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(!content.contains("待办项"));
        let done = std::fs::read_to_string(tmp.join("todos.done.md")).unwrap();
        assert!(done.contains("- [x] 待办项"));
        assert!(done.contains("<!-- done:"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn toggle_todo_uncheck() {
        let tmp = std::env::temp_dir().join("journal_todo_uncheck_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n").unwrap();
        std::fs::write(tmp.join("todos.done.md"), "- [x] 已完成 <!-- done:2026-04-01 -->\n").unwrap();
        toggle_todo_in_workspace(tmp.to_str().unwrap(), 0, false, true).unwrap();
        // 应从 todos.done.md 移除，追加到 todos.md
        let done = std::fs::read_to_string(tmp.join("todos.done.md")).unwrap();
        assert!(!done.contains("已完成"));
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("- [ ] 已完成"));
        assert!(!content.contains("<!-- done:"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn toggle_done_inserts_at_top() {
        let tmp = std::env::temp_dir().join("journal_todo_done_top_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "- [ ] 第一\n- [ ] 第二\n").unwrap();
        std::fs::write(tmp.join("todos.done.md"), "- [x] 旧完成 <!-- done:2026-04-01 -->\n").unwrap();
        toggle_todo_in_workspace(tmp.to_str().unwrap(), 0, true, false).unwrap();
        let done = std::fs::read_to_string(tmp.join("todos.done.md")).unwrap();
        let lines: Vec<&str> = done.lines().collect();
        // 新完成项应在旧完成项之前
        let new_pos = lines.iter().position(|l| l.contains("第一")).unwrap();
        let old_pos = lines.iter().position(|l| l.contains("旧完成")).unwrap();
        assert!(new_pos < old_pos, "新完成项应插入到顶部");
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn delete_todo_line() {
        let tmp = std::env::temp_dir().join("journal_todo_delete_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(tmp.join("todos.md"), "# 待办\n\n- [ ] 保留\n- [ ] 删除\n- [ ] 也保留\n").unwrap();
        delete_todo_in_workspace(tmp.to_str().unwrap(), 3, false).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("保留"));
        assert!(!content.contains("删除"));
        assert!(content.contains("也保留"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn parse_item_with_source() {
        let items = parse_todos("- [ ] 确认权限 <!-- source:02-研发沟通.md -->\n");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].source.as_deref(), Some("02-研发沟通.md"));
        assert_eq!(items[0].text, "确认权限");
    }

    #[test]
    fn parse_item_with_all_metadata() {
        let items = parse_todos("- [x] 写代码 <!-- due:2026-04-05 --> <!-- done:2026-04-03 --> <!-- source:25-泼墨体.md -->\n");
        assert_eq!(items.len(), 1);
        assert!(items[0].done);
        assert_eq!(items[0].due.as_deref(), Some("2026-04-05"));
        assert_eq!(items[0].done_date.as_deref(), Some("2026-04-03"));
        assert_eq!(items[0].source.as_deref(), Some("25-泼墨体.md"));
    }

    #[test]
    fn add_todo_with_source() {
        let tmp = std::env::temp_dir().join("journal_todo_add_source_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        add_todo_to_workspace(tmp.to_str().unwrap(), "确认权限", None, Some("02-研发沟通.md")).unwrap();
        let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
        assert!(content.contains("- [ ] 确认权限 <!-- source:02-研发沟通.md -->"));
        std::fs::remove_dir_all(&tmp).ok();
    }
}
