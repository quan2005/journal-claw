use crate::{config, mdx};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

const EXCLUDED_DIRS: &[&str] = &[
    "raw",
    ".claude",
    ".Codex",
    "node_modules",
    ".directive-migration-backup",
];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct LegacyDirectiveFile {
    pub path: String,
    pub relative_path: String,
    pub extension: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApplyDirectiveMigrationRequest {
    pub source_path: String,
    pub destination_path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ApplyDirectiveMigrationResult {
    pub destination_path: String,
    pub backup_path: String,
}

fn has_legacy_directive(source: &str) -> bool {
    let mut fence: Option<char> = None;

    for line in source.lines() {
        let trimmed = line.trim_start();
        let marker = if trimmed.starts_with("```") {
            Some('`')
        } else if trimmed.starts_with("~~~") {
            Some('~')
        } else {
            None
        };

        if let Some(marker) = marker {
            if fence == Some(marker) {
                fence = None;
            } else if fence.is_none() {
                fence = Some(marker);
            }
            continue;
        }
        if fence.is_some() {
            continue;
        }

        if let Some(name) = trimmed.strip_prefix(":::") {
            if name
                .chars()
                .next()
                .is_some_and(|ch| ch.is_ascii_alphabetic())
            {
                return true;
            }
        }
    }

    false
}

fn scan_dir(
    workspace: &Path,
    dir: &Path,
    files: &mut Vec<LegacyDirectiveFile>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;

        if file_type.is_dir() {
            let name = entry.file_name();
            if EXCLUDED_DIRS
                .iter()
                .any(|excluded| name.to_string_lossy() == *excluded)
            {
                continue;
            }
            scan_dir(workspace, &path, files)?;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }

        let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
            continue;
        };
        if !matches!(extension, "md" | "mdx") {
            continue;
        }

        let source = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        if !has_legacy_directive(&source) {
            continue;
        }

        let relative = path
            .strip_prefix(workspace)
            .map_err(|error| error.to_string())?;
        files.push(LegacyDirectiveFile {
            path: path.to_string_lossy().into_owned(),
            relative_path: relative.to_string_lossy().into_owned(),
            extension: extension.to_string(),
        });
    }

    Ok(())
}

fn scan_workspace(workspace: &Path) -> Result<Vec<LegacyDirectiveFile>, String> {
    let workspace = workspace
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let mut files = Vec::new();
    scan_dir(&workspace, &workspace, &mut files)?;
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(files)
}

fn contains_unsafe_component(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::CurDir | Component::Prefix(_)
        )
    })
}

fn resolve_source(workspace: &Path, requested: &str) -> Result<PathBuf, String> {
    let requested = PathBuf::from(requested);
    if !requested.is_absolute() || contains_unsafe_component(&requested) {
        return Err("source path must be an absolute normalized path".to_string());
    }
    let resolved = requested
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !resolved.starts_with(workspace) || !resolved.is_file() {
        return Err("source path is outside the configured workspace".to_string());
    }
    Ok(resolved)
}

fn resolve_destination(workspace: &Path, requested: &str) -> Result<PathBuf, String> {
    let requested = PathBuf::from(requested);
    if !requested.is_absolute() || contains_unsafe_component(&requested) {
        return Err("destination path must be an absolute normalized path".to_string());
    }
    let parent = requested
        .parent()
        .ok_or_else(|| "destination path has no parent directory".to_string())?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !parent.starts_with(workspace) {
        return Err("destination path is outside the configured workspace".to_string());
    }
    let filename = requested
        .file_name()
        .ok_or_else(|| "destination path has no filename".to_string())?;
    Ok(parent.join(filename))
}

fn apply_in_workspace(
    workspace: &Path,
    request: &ApplyDirectiveMigrationRequest,
    timestamp: &str,
) -> Result<ApplyDirectiveMigrationResult, String> {
    let workspace = workspace
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let source = resolve_source(&workspace, &request.source_path)?;
    let destination = resolve_destination(&workspace, &request.destination_path)?;

    if destination.extension().and_then(|value| value.to_str()) != Some("mdx") {
        return Err("directive migration destination must use the .mdx extension".to_string());
    }
    if source != destination && destination.exists() {
        return Err("directive migration destination already exists".to_string());
    }

    mdx::validate_mdx_document(
        &request.content,
        Some(destination.to_string_lossy().into_owned()),
    )?;

    let relative_source = source
        .strip_prefix(&workspace)
        .map_err(|error| error.to_string())?;
    let backup = workspace
        .join(".Codex")
        .join("migrations")
        .join("directive-to-jsx")
        .join(timestamp)
        .join(relative_source);
    if let Some(parent) = backup.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(&source, &backup).map_err(|error| error.to_string())?;

    let filename = destination
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "destination filename is not valid UTF-8".to_string())?;
    let temporary = destination.with_file_name(format!(
        ".{filename}.directive-migration-{}.tmp",
        Uuid::new_v4()
    ));

    if let Err(error) = fs::write(&temporary, &request.content) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    if let Err(error) = fs::rename(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    if source != destination {
        fs::remove_file(&source).map_err(|error| error.to_string())?;
    }

    Ok(ApplyDirectiveMigrationResult {
        destination_path: destination.to_string_lossy().into_owned(),
        backup_path: backup.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub fn scan_legacy_directive_files(app: AppHandle) -> Result<Vec<LegacyDirectiveFile>, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    if workspace.is_empty() {
        return Ok(Vec::new());
    }
    scan_workspace(Path::new(&workspace))
}

#[tauri::command]
pub fn apply_directive_migration(
    app: AppHandle,
    request: ApplyDirectiveMigrationRequest,
) -> Result<ApplyDirectiveMigrationResult, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    if workspace.is_empty() {
        return Err("workspace_path not set".to_string());
    }
    let timestamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let result = apply_in_workspace(Path::new(&workspace), &request, &timestamp)?;
    let _ = app.emit("journal-updated", ());
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn write(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[test]
    fn scan_excludes_system_directories_and_fenced_examples() {
        let temp = tempdir().unwrap();
        write(
            &temp.path().join("2606/09-note.md"),
            ":::quote\ntext: visible\n:::",
        );
        write(
            &temp.path().join("topics/example.mdx"),
            "```md\n:::quote\ntext: example\n:::\n```",
        );
        for directory in EXCLUDED_DIRS {
            write(
                &temp.path().join(directory).join("ignored.md"),
                ":::quote\ntext: ignored\n:::",
            );
        }

        let files = scan_workspace(temp.path()).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].relative_path, "2606/09-note.md");
    }

    #[test]
    fn validation_failure_leaves_source_untouched() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("2606/09-note.md");
        let destination = temp.path().join("2606/09-note.mdx");
        write(&source, ":::hero\ntitle: old\n:::");
        let request = ApplyDirectiveMigrationRequest {
            source_path: source.to_string_lossy().into_owned(),
            destination_path: destination.to_string_lossy().into_owned(),
            content: "<Hero title=\"unterminated />".to_string(),
        };

        assert!(apply_in_workspace(temp.path(), &request, "test").is_err());
        assert_eq!(
            fs::read_to_string(&source).unwrap(),
            ":::hero\ntitle: old\n:::"
        );
        assert!(!destination.exists());
        assert!(!temp.path().join(".Codex").exists());
    }

    #[test]
    fn apply_backs_up_then_renames_markdown_to_mdx() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("2606/09-note.md");
        let destination = temp.path().join("2606/09-note.mdx");
        let original = ":::quote\ntext: old\n:::";
        let converted = "<Quote text=\"new\" />";
        write(&source, original);
        let request = ApplyDirectiveMigrationRequest {
            source_path: source.to_string_lossy().into_owned(),
            destination_path: destination.to_string_lossy().into_owned(),
            content: converted.to_string(),
        };

        let result = apply_in_workspace(temp.path(), &request, "20260609-120000").unwrap();

        assert!(!source.exists());
        assert_eq!(fs::read_to_string(&destination).unwrap(), converted);
        assert_eq!(fs::read_to_string(result.backup_path).unwrap(), original);
    }

    #[test]
    fn apply_rejects_existing_destination_without_mutation() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("2606/09-note.md");
        let destination = temp.path().join("2606/09-note.mdx");
        write(&source, ":::quote\ntext: old\n:::");
        write(&destination, "<Quote text=\"existing\" />");
        let request = ApplyDirectiveMigrationRequest {
            source_path: source.to_string_lossy().into_owned(),
            destination_path: destination.to_string_lossy().into_owned(),
            content: "<Quote text=\"new\" />".to_string(),
        };

        assert!(apply_in_workspace(temp.path(), &request, "test").is_err());
        assert!(source.exists());
        assert_eq!(
            fs::read_to_string(&destination).unwrap(),
            "<Quote text=\"existing\" />"
        );
    }
}
