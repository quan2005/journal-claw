use std::process::Command;

pub fn os_name() -> &'static str {
    std::env::consts::OS
}

pub fn os_display_name() -> String {
    match std::env::consts::OS {
        "macos" => macos_version()
            .map(|version| format!("macOS {}", version))
            .unwrap_or_else(|| "macOS".to_string()),
        "windows" => "Windows".to_string(),
        "linux" => "Linux".to_string(),
        other => other.to_string(),
    }
}

#[cfg(target_os = "macos")]
fn macos_version() -> Option<String> {
    Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|version| version.trim().to_string())
        .filter(|version| !version.is_empty())
}

#[cfg(not(target_os = "macos"))]
fn macos_version() -> Option<String> {
    None
}

pub fn open_with_system(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg(path);
        cmd
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", path]);
        cmd
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(path);
        cmd
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to open '{}': {}", path, error))
}

pub fn reveal_in_file_manager(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.args(["-R", path]);
        cmd
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("explorer");
        cmd.arg(format!("/select,{}", path));
        cmd
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let parent = std::path::Path::new(path)
            .parent()
            .unwrap_or_else(|| std::path::Path::new(path));
        let mut cmd = Command::new("xdg-open");
        cmd.arg(parent);
        cmd
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to reveal '{}': {}", path, error))
}
