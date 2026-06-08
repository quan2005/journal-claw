use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceLayout {
    root: PathBuf,
}

impl WorkspaceLayout {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn month_dir(&self, year_month: &str) -> PathBuf {
        self.root.join(year_month)
    }

    pub fn raw_dir(&self, year_month: &str) -> PathBuf {
        self.month_dir(year_month).join("raw")
    }

    pub fn dot_journal_dir(&self) -> PathBuf {
        self.root.join(".journal")
    }

    pub fn sessions_dir(&self) -> PathBuf {
        self.dot_journal_dir().join("sessions")
    }

    pub fn jobs_dir(&self) -> PathBuf {
        self.dot_journal_dir().join("jobs")
    }

    pub fn ensure_internal_dirs(&self) -> Result<(), String> {
        std::fs::create_dir_all(self.sessions_dir()).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(self.jobs_dir()).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn preserves_existing_month_raw_layout() {
        let layout = WorkspaceLayout::new(PathBuf::from("workspace"));

        assert_eq!(layout.root(), Path::new("workspace"));
        assert_eq!(layout.month_dir("2606"), PathBuf::from("workspace/2606"));
        assert_eq!(layout.raw_dir("2606"), PathBuf::from("workspace/2606/raw"));
    }

    #[test]
    fn stores_internal_sessions_and_jobs_under_dot_journal() {
        let layout = WorkspaceLayout::new(PathBuf::from("workspace"));

        assert_eq!(
            layout.sessions_dir(),
            PathBuf::from("workspace/.journal/sessions")
        );
        assert_eq!(layout.jobs_dir(), PathBuf::from("workspace/.journal/jobs"));
    }

    #[test]
    fn ensure_internal_dirs_creates_only_sessions_and_jobs() {
        let root = std::env::temp_dir().join(format!(
            "journal-workspace-layout-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        let layout = WorkspaceLayout::new(root.clone());

        layout.ensure_internal_dirs().unwrap();

        assert!(layout.sessions_dir().is_dir());
        assert!(layout.jobs_dir().is_dir());
        assert!(!layout.dot_journal_dir().join("cache").exists());
        assert!(!layout.dot_journal_dir().join("index.sqlite").exists());

        std::fs::remove_dir_all(root).unwrap();
    }
}
