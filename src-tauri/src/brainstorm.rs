use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionInfo {
    session_id: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SessionStore {
    sessions: HashMap<String, SessionInfo>,
}

fn sessions_path(workspace: &str) -> PathBuf {
    Path::new(workspace).join(".brainstorm-sessions.json")
}

fn load_sessions(workspace: &str) -> SessionStore {
    let p = sessions_path(workspace);
    if p.exists() {
        std::fs::read_to_string(&p)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        SessionStore::default()
    }
}

fn save_sessions(workspace: &str, store: &SessionStore) -> Result<(), String> {
    let p = sessions_path(workspace);
    let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    std::fs::write(&p, json).map_err(|e| format!("写入 session 映射失败: {}", e))
}

fn generate_session_id() -> String {
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = t.as_nanos();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (nanos & 0xFFFFFFFF) as u32,
        ((nanos >> 32) & 0xFFFF) as u16,
        ((nanos >> 48) & 0x0FFF) as u16,
        ((nanos >> 60) & 0xFFFF) as u16,
        ((nanos >> 76) & 0xFFFFFFFFFFFF) as u64 & 0xFFFFFFFFFFFF,
    )
}

/// 更新 session key（待办文本编辑时调用）
pub fn rename_session_key(workspace: &str, old_text: &str, new_text: &str) {
    let mut store = load_sessions(workspace);
    if let Some(info) = store.sessions.remove(old_text) {
        store.sessions.insert(new_text.to_string(), info);
        let _ = save_sessions(workspace, &store);
    }
}

/// 检测 iTerm2 是否正在运行
fn is_iterm_running() -> bool {
    let output = std::process::Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to (name of processes) contains \"iTerm2\""])
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

/// 尝试激活已有终端 tab（按 tab title 查找）
fn activate_terminal_tab(tab_title: &str) -> bool {
    if is_iterm_running() {
        activate_iterm_tab(tab_title)
    } else {
        activate_terminal_app_tab(tab_title)
    }
}

fn activate_iterm_tab(tab_title: &str) -> bool {
    let script = format!(
        r#"tell application "iTerm2"
    repeat with w in windows
        repeat with t in tabs of w
            repeat with s in sessions of t
                if name of s contains "{}" then
                    select t
                    set index of w to 1
                    activate
                    return true
                end if
            end repeat
        end repeat
    end repeat
    return false
end tell"#,
        tab_title
    );
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

fn activate_terminal_app_tab(tab_title: &str) -> bool {
    let script = format!(
        r#"tell application "Terminal"
    repeat with w in windows
        repeat with t in tabs of w
            if custom title of t is "{}" then
                set selected tab of w to t
                set index of w to 1
                activate
                return true
            end if
        end repeat
    end repeat
    return false
end tell"#,
        tab_title
    );
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

/// 打开新终端 tab 并执行命令
fn open_terminal_tab(tab_title: &str, command: &str) {
    if is_iterm_running() {
        open_iterm_tab(tab_title, command);
    } else {
        open_terminal_app_tab(tab_title, command);
    }
}

fn open_iterm_tab(tab_title: &str, command: &str) {
    let script = format!(
        r#"tell application "iTerm2"
    activate
    tell current window
        set newTab to (create tab with default profile)
        tell current session of newTab
            set name to "{}"
            write text "{}"
        end tell
    end tell
end tell"#,
        tab_title,
        command.replace('"', "\\\"")
    );
    let _ = std::process::Command::new("osascript")
        .args(["-e", &script])
        .spawn();
}

fn open_terminal_app_tab(tab_title: &str, command: &str) {
    let script = format!(
        r#"tell application "Terminal"
    activate
    do script "{}"
    set custom title of selected tab of front window to "{}"
end tell"#,
        command.replace('"', "\\\""),
        tab_title
    );
    let _ = std::process::Command::new("osascript")
        .args(["-e", &script])
        .spawn();
}

#[tauri::command]
pub fn open_brainstorm_terminal(
    app: tauri::AppHandle,
    text: String,
    line_index: usize,
    done_file: bool,
) -> Result<(), String> {
    let _ = (line_index, done_file); // reserved for future use

    let cfg = crate::config::load_config(&app)?;
    let workspace = &cfg.workspace_path;
    let cli = if cfg.claude_cli_path.is_empty() {
        crate::config::default_claude_cli_detect()
    } else {
        cfg.claude_cli_path.clone()
    };

    let mut store = load_sessions(workspace);
    let tab_title_prefix = "ideate";

    if let Some(info) = store.sessions.get(&text) {
        // Session exists — try to activate existing tab
        let tab_title = format!("{}-{}", tab_title_prefix, &info.session_id[..8]);
        if activate_terminal_tab(&tab_title) {
            return Ok(());
        }
        // Tab gone — resume session
        let cmd = format!(
            "cd '{}' && '{}' --resume --session-id {}",
            workspace.replace('\'', "'\\''"),
            cli.replace('\'', "'\\''"),
            info.session_id
        );
        open_terminal_tab(&tab_title, &cmd);
    } else {
        // New session
        let session_id = generate_session_id();
        let tab_title = format!("{}-{}", tab_title_prefix, &session_id[..8]);

        let escaped_text = text.replace('\'', "'\\''").replace('"', "\\\"");
        let cmd = format!(
            "cd '{}' && '{}' -p '/ideate {}' --session-id {}",
            workspace.replace('\'', "'\\''"),
            cli.replace('\'', "'\\''"),
            escaped_text,
            session_id
        );
        open_terminal_tab(&tab_title, &cmd);

        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        store.sessions.insert(
            text,
            SessionInfo {
                session_id,
                created_at: now,
            },
        );
        save_sessions(workspace, &store)?;
    }

    Ok(())
}
