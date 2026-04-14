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
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = t.as_nanos();
    let pid = std::process::id();

    // Mix nanos + pid through a hasher for the trailing segments
    let mut h = DefaultHasher::new();
    nanos.hash(&mut h);
    pid.hash(&mut h);
    let hash = h.finish();

    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (nanos & 0xFFFFFFFF) as u32,
        ((nanos >> 32) & 0xFFFF) as u16,
        ((nanos >> 48) & 0x0FFF) as u16,
        ((hash >> 48) & 0xFFFF) as u16,
        (hash & 0xFFFFFFFFFFFF),
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

/// PID/app file paths for a session (stored in temp dir)
fn pid_file(session_short: &str) -> PathBuf {
    std::env::temp_dir().join(format!("journal-ideate-{}.pid", session_short))
}

fn app_file(session_short: &str) -> PathBuf {
    std::env::temp_dir().join(format!("journal-ideate-{}.app", session_short))
}

/// Check if a terminal process is still alive (no side effects).
fn is_process_alive(session_short: &str) -> bool {
    let pf = pid_file(session_short);
    if let Ok(pid_str) = std::fs::read_to_string(&pf) {
        if let Ok(pid) = pid_str.trim().parse::<i32>() {
            return unsafe { libc::kill(pid, 0) == 0 };
        }
    }
    false
}

/// Check if a terminal process is still alive, and activate it if so.
fn try_activate_existing(session_short: &str) -> bool {
    let pf = pid_file(session_short);
    let af = app_file(session_short);

    if let Ok(pid_str) = std::fs::read_to_string(&pf) {
        if let Ok(pid) = pid_str.trim().parse::<i32>() {
            if unsafe { libc::kill(pid, 0) == 0 } {
                // Process alive — activate the terminal app
                if let Ok(app_name) = std::fs::read_to_string(&af) {
                    let name = app_name.trim().to_string();
                    if !name.is_empty() {
                        let _ = std::process::Command::new("osascript")
                            .args(["-e", &format!("tell application \"{}\" to activate", name)])
                            .spawn();
                    }
                }
                return true;
            }
        }
    }
    false
}

fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}/{}", home, rest);
        }
    }
    path.to_string()
}

fn setup_ideate_symlink(workspace: &str, target_dir: &str) {
    let src = Path::new(workspace).join(".claude/skills/ideate");
    if !src.exists() {
        return;
    }
    let skills_dir = Path::new(target_dir).join(".claude/skills");
    let link = skills_dir.join("ideate");
    if link.exists() || link.is_symlink() {
        return;
    }
    let _ = std::fs::create_dir_all(&skills_dir);
    #[cfg(unix)]
    let _ = std::os::unix::fs::symlink(&src, &link);
}

/// Detect the user's preferred terminal app for opening .command files.
/// Checks TERM_PROGRAM env var first, then looks for running terminal processes.
fn detect_preferred_terminal() -> Option<String> {
    // 1. Check TERM_PROGRAM (set when app is launched from a terminal)
    if let Ok(term) = std::env::var("TERM_PROGRAM") {
        let app = match term.as_str() {
            "ghostty" => "Ghostty",
            "iTerm.app" => "iTerm",
            "Apple_Terminal" => "Terminal",
            "WarpTerminal" => "Warp",
            "Alacritty" => "Alacritty",
            "kitty" => "kitty",
            "WezTerm" => "WezTerm",
            "Hyper" => "Hyper",
            _ => "",
        };
        if !app.is_empty() {
            return Some(app.to_string());
        }
    }

    // 2. Check running terminal processes (covers Finder/Spotlight launch)
    if let Ok(output) = std::process::Command::new("ps")
        .args(["-eo", "comm="])
        .output()
    {
        let ps_out = String::from_utf8_lossy(&output.stdout);
        // Order: prefer non-Apple terminals first
        let known = [
            ("ghostty", "Ghostty"),
            ("iTerm2", "iTerm"),
            ("Warp", "Warp"),
            ("Alacritty", "Alacritty"),
            ("kitty", "kitty"),
            ("WezTerm", "WezTerm"),
            ("Hyper", "Hyper"),
        ];
        for (pattern, app) in known {
            if ps_out.lines().any(|l| l.contains(pattern)) {
                return Some(app.to_string());
            }
        }
    }

    None
}

/// Spawn a terminal running a command, tracking PID and terminal app name.
fn spawn_tracked_terminal(
    session_short: &str,
    workspace: &str,
    command: &str,
) -> Result<(), String> {
    let pf = pid_file(session_short);
    let af = app_file(session_short);

    let detect_terminal = format!(
        "_pid=$$; while true; do _ppid=$(ps -o ppid= -p $_pid 2>/dev/null | tr -d ' '); \
        [ -z \"$_ppid\" ] || [ \"$_ppid\" = \"0\" ] || [ \"$_ppid\" = \"1\" ] && break; \
        _comm=$(ps -o comm= -p $_ppid 2>/dev/null); \
        case \"$_comm\" in \
        *Terminal*|*iTerm*|*Warp*|*Alacritty*|*kitty*|*WezTerm*|*Hyper*|*Ghostty*) \
        echo \"$_comm\" | awk '{{print $1}}' > '{}'; break;; esac; _pid=$_ppid; done",
        af.display(),
    );

    let script = format!(
        "#!/bin/bash\necho $$ > '{}'\n{}\ncd '{}'\n{}\nrm -f '{}' '{}'",
        pf.display(),
        detect_terminal,
        workspace,
        command,
        pf.display(),
        af.display(),
    );

    let tmp_path = std::env::temp_dir().join(format!("journal-ideate-{}.command", session_short));
    std::fs::write(&tmp_path, &script).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }

    let mut cmd = std::process::Command::new("open");
    if let Some(app) = detect_preferred_terminal() {
        cmd.args(["-a", &app]);
    }
    cmd.arg(&tmp_path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_brainstorm_session(app: tauri::AppHandle, text: String) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    let mut store = load_sessions(&cfg.workspace_path);
    store.sessions.remove(&text);
    save_sessions(&cfg.workspace_path, &store)
}

#[tauri::command]
pub fn list_brainstorm_keys(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let cfg = crate::config::load_config(&app)?;
    let store = load_sessions(&cfg.workspace_path);
    Ok(store.sessions.keys().cloned().collect())
}

/// Returns keys whose terminal process is currently alive (no window activation).
#[tauri::command]
pub fn list_open_brainstorm_keys(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let cfg = crate::config::load_config(&app)?;
    let store = load_sessions(&cfg.workspace_path);
    let open: Vec<String> = store
        .sessions
        .iter()
        .filter(|(_, info)| is_process_alive(&info.session_id[..8]))
        .map(|(key, _)| key.clone())
        .collect();
    Ok(open)
}

#[tauri::command]
pub fn open_brainstorm_terminal(
    app: tauri::AppHandle,
    text: String,
    line_index: usize,
    done_file: bool,
    path: Option<String>,
) -> Result<(), String> {
    let _ = (line_index, done_file);

    let cfg = crate::config::load_config(&app)?;
    let workspace = &cfg.workspace_path;

    // Resolve cwd: use todo path if provided, else workspace
    let cwd = match path.as_deref() {
        Some(p) if !p.is_empty() => {
            let resolved = expand_tilde(p);
            setup_ideate_symlink(workspace, &resolved);
            resolved
        }
        _ => workspace.clone(),
    };
    let cli = if cfg.claude_cli_path.is_empty() {
        crate::config::default_claude_cli_detect()
    } else {
        cfg.claude_cli_path.clone()
    };

    let mut store = load_sessions(workspace);

    if let Some(info) = store.sessions.get(&text) {
        let short = &info.session_id[..8];

        // Terminal still alive → just activate
        if try_activate_existing(short) {
            return Ok(());
        }

        // Terminal closed → resume session
        let cmd = format!(
            "'{}' --dangerously-skip-permissions --resume {}",
            cli.replace('\'', "'\\''"),
            info.session_id
        );
        spawn_tracked_terminal(short, &cwd, &cmd)?;
    } else {
        // New session
        let session_id = generate_session_id();
        let short = session_id[..8].to_string();

        let escaped_text = text.replace('\'', "'\\''");
        let cmd = format!(
            "'{}' --dangerously-skip-permissions '/ideate {}' --session-id {}",
            cli.replace('\'', "'\\''"),
            escaped_text,
            session_id
        );
        spawn_tracked_terminal(&short, &cwd, &cmd)?;

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
