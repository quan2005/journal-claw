//! Compressor for `ls` output — strips permissions/owner/group/date,
//! shows compact `name/ size` format. Filters noise directories.
//!
//! Ported from RTK (https://github.com/rtk-ai/rtk) src/cmds/system/ls.rs

use super::{cmd_matches, normalize_blanks, Compressor};

const NOISE_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "__pycache__",
    ".next",
    ".nuxt",
    "dist",
    "build",
    ".cache",
    ".turbo",
    ".svelte-kit",
    "coverage",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "vendor",
];

const MONTHS: &[&str] = &[
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

pub struct LsCompressor;

impl Compressor for LsCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(cmd, &["ls"])
    }

    fn compress(&self, cmd: &str, output: &str) -> String {
        let show_all = cmd.contains(" -a") || cmd.contains(" --all");
        compact_ls(output, show_all)
    }
}

fn human_size(bytes: u64) -> String {
    if bytes >= 1_048_576 {
        format!("{:.1}M", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1024 {
        format!("{:.1}K", bytes as f64 / 1024.0)
    } else {
        format!("{}B", bytes)
    }
}

/// Find the date field in an `ls -la` line, returning (start, end) byte offsets.
fn find_ls_date(line: &str) -> Option<(usize, usize)> {
    for month in MONTHS {
        let pattern = format!(" {} ", month);
        if let Some(month_pos) = line.find(&pattern) {
            let after_month = month_pos + pattern.len();
            let rest = &line[after_month..];
            let ws1 = rest.len() - rest.trim_start().len();
            let rest = &rest[ws1..];
            let day_end = rest
                .find(|c: char| !c.is_ascii_digit())
                .unwrap_or(rest.len());
            if day_end == 0 {
                continue;
            }
            let rest = &rest[day_end..];
            let ws2 = rest.len() - rest.trim_start().len();
            if ws2 == 0 {
                continue;
            }
            let rest = &rest[ws2..];
            let time_end = rest
                .find(|c: char| !c.is_ascii_digit() && c != ':')
                .unwrap_or(rest.len());
            if time_end == 0 {
                continue;
            }
            let rest = &rest[time_end..];
            let ws3 = rest.len() - rest.trim_start().len();
            let end = line.len() - rest.len() + ws3;
            if end > month_pos && end < line.len() {
                return Some((month_pos, end));
            }
        }
    }
    None
}

fn compact_ls(raw: &str, show_all: bool) -> String {
    let is_long = raw.lines().any(|l| {
        let t = l.trim();
        t.starts_with("drwx")
            || t.starts_with("-rw")
            || t.starts_with("lrwx")
            || t.starts_with("total ")
    });

    if !is_long {
        return normalize_blanks(raw);
    }

    let mut dirs: Vec<String> = Vec::new();
    let mut files: Vec<(String, String)> = Vec::new();

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("total ") || trimmed.is_empty() {
            continue;
        }

        let Some((date_start, date_end)) = find_ls_date(trimmed) else {
            continue;
        };
        let name = trimmed[date_end..].to_string();

        if name == "." || name == ".." {
            continue;
        }
        if !show_all && NOISE_DIRS.iter().any(|n| name == *n) {
            continue;
        }

        let file_type = trimmed.chars().next().unwrap_or('-');
        let before_date = &trimmed[..date_start];

        let mut size: u64 = 0;
        for part in before_date.split_whitespace().rev() {
            if let Ok(s) = part.parse::<u64>() {
                size = s;
                break;
            }
        }

        if file_type == 'd' {
            dirs.push(name);
        } else {
            files.push((name, human_size(size)));
        }
    }

    if dirs.is_empty() && files.is_empty() {
        return "(empty)\n".to_string();
    }

    let mut out = String::new();
    for d in &dirs {
        out.push_str(d);
        out.push_str("/\n");
    }
    for (name, size) in &files {
        out.push_str(name);
        out.push_str("  ");
        out.push_str(size);
        out.push('\n');
    }
    out.push_str(&format!("[{} files, {} dirs]\n", files.len(), dirs.len()));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_long_compressed() {
        let raw = "total 48\n\
                   drwxr-xr-x  2 user  staff    64 Jan  1 12:00 .\n\
                   drwxr-xr-x  2 user  staff    64 Jan  1 12:00 ..\n\
                   drwxr-xr-x  2 user  staff    64 Jan  1 12:00 src\n\
                   drwxr-xr-x  2 user  staff    64 Jan  1 12:00 node_modules\n\
                   -rw-r--r--  1 user  staff  1234 Jan  1 12:00 Cargo.toml\n\
                   -rw-r--r--  1 user  staff  5678 Jan  1 12:00 README.md\n";
        let out = compact_ls(raw, false);
        assert!(out.contains("src/"));
        assert!(out.contains("Cargo.toml"));
        assert!(out.contains("1.2K"));
        assert!(!out.contains("node_modules"));
        assert!(!out.contains("drwx"));
        assert!(!out.contains("staff"));
    }

    #[test]
    fn test_simple_passthrough() {
        let raw = "file1.txt\nfile2.txt\ndir1\n";
        let c = LsCompressor;
        let out = c.compress("ls", raw);
        assert!(out.contains("file1.txt"));
    }
}
