/// Parse a YAML frontmatter field value (e.g. `name:` or `description:`).
///
/// Supports both well-formed frontmatter (`---` delimiters) and a fallback
/// scan of the first 30 lines for unclosed frontmatter blocks.
///
/// Returns the trimmed, unquoted value if found.
pub fn parse_frontmatter_field(content: &str, field: &str) -> Option<String> {
    let prefix = format!("{}:", field);

    // Try standard YAML frontmatter first: ---\n...\n---
    let trimmed = content.trim();
    if let Some(rest) = trimmed.strip_prefix("---") {
        if let Some(end) = rest.find("---") {
            let yaml_block = &rest[..end];
            for line in yaml_block.lines() {
                let line = line.trim().trim_start_matches('#').trim();
                if let Some(val) = line.strip_prefix(&prefix) {
                    return Some(trim_field_value(val));
                }
            }
        }
    }

    // Fallback: scan first 30 lines (handles unclosed frontmatter)
    for line in content.lines().take(30) {
        let line = line.trim().trim_start_matches('#').trim();
        if let Some(val) = line.strip_prefix(&prefix) {
            return Some(trim_field_value(val));
        }
    }

    None
}

fn trim_field_value(val: &str) -> String {
    val.trim().trim_matches('"').trim_matches('\'').to_string()
}

/// Parse the `source_digest` field from YAML frontmatter.
/// Returns the hex digest string if present.
pub fn parse_source_digest(content: &str) -> Option<String> {
    parse_frontmatter_field(content, "source_digest")
}

/// Check if a journal entry's source_digest matches the given digest.
/// Returns true if the entry has a matching digest (meaning re-processing would be redundant).
pub fn entry_has_digest(content: &str, digest: &str) -> bool {
    parse_source_digest(content).as_deref() == Some(digest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_frontmatter() {
        let content = "---\nname: ideate\ndescription: \"灵感探讨\"\n---\n\n# Content\n";
        assert_eq!(
            parse_frontmatter_field(content, "name").as_deref(),
            Some("ideate")
        );
        assert_eq!(
            parse_frontmatter_field(content, "description").as_deref(),
            Some("灵感探讨")
        );
    }

    #[test]
    fn parse_no_frontmatter_returns_none() {
        assert_eq!(parse_frontmatter_field("# Just a heading", "name"), None);
    }

    #[test]
    fn parse_unclosed_frontmatter() {
        let content = "---\nname: test-skill\ndescription: A skill\n\nBody without closing ---";
        assert_eq!(
            parse_frontmatter_field(content, "name").as_deref(),
            Some("test-skill")
        );
    }

    #[test]
    fn parse_single_quoted_value() {
        let content = "---\nname: 'my skill'\n---\n";
        assert_eq!(
            parse_frontmatter_field(content, "name").as_deref(),
            Some("my skill")
        );
    }

    #[test]
    fn parse_source_digest_present() {
        let content = "---\nsummary: test\nsource_digest: abc123\n---\n\n# Title\n";
        assert_eq!(parse_source_digest(content).as_deref(), Some("abc123"));
    }

    #[test]
    fn parse_source_digest_absent() {
        let content = "---\nsummary: test\n---\n\n# Title\n";
        assert_eq!(parse_source_digest(content), None);
    }

    #[test]
    fn entry_has_digest_match() {
        let content = "---\nsource_digest: abc123\n---\n\n# Title\n";
        assert!(entry_has_digest(content, "abc123"));
    }

    #[test]
    fn entry_has_digest_mismatch() {
        let content = "---\nsource_digest: abc123\n---\n\n# Title\n";
        assert!(!entry_has_digest(content, "def456"));
    }
}
