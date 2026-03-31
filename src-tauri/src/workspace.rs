use chrono::Local;
use std::path::PathBuf;

pub fn year_month_dir(workspace: &str, year_month: &str) -> PathBuf {
    PathBuf::from(workspace).join(year_month)
}

pub fn raw_dir(workspace: &str, year_month: &str) -> PathBuf {
    year_month_dir(workspace, year_month).join("raw")
}

pub fn ensure_dirs(workspace: &str, year_month: &str) -> Result<(), String> {
    let raw = raw_dir(workspace, year_month);
    std::fs::create_dir_all(&raw).map_err(|e| format!("创建目录失败 {}: {}", raw.display(), e))
}

pub fn current_year_month() -> String {
    Local::now().format("%y%m").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn year_month_dir_structure() {
        let p = year_month_dir("/tmp/nb", "2603");
        assert_eq!(p, PathBuf::from("/tmp/nb/2603"));
    }

    #[test]
    fn raw_dir_structure() {
        let p = raw_dir("/tmp/nb", "2603");
        assert_eq!(p, PathBuf::from("/tmp/nb/2603/raw"));
    }

    #[test]
    fn ensure_dirs_creates_structure() {
        let tmp = std::env::temp_dir().join("journal_test_workspace");
        let ws = tmp.to_str().unwrap();
        ensure_dirs(ws, "2603").unwrap();
        assert!(tmp.join("2603").exists());
        assert!(tmp.join("2603/raw").exists());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn current_year_month_format() {
        let ym = current_year_month();
        assert_eq!(ym.len(), 4);
        assert!(ym.chars().all(|c| c.is_ascii_digit()));
    }
}
