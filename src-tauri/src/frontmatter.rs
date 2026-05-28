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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_frontmatter() {
        let content = "---\nname: ideate\ndescription: \"灵感探讨\"\n---\n\n# Content\n";
        assert_eq!(parse_frontmatter_field(content, "name").as_deref(), Some("ideate"));
        assert_eq!(parse_frontmatter_field(content, "description").as_deref(), Some("灵感探讨"));
    }

    #[test]
    fn parse_no_frontmatter_returns_none() {
        assert_eq!(parse_frontmatter_field("# Just a heading", "name"), None);
    }

    #[test]
    fn parse_unclosed_frontmatter() {
        let content = "---\nname: test-skill\ndescription: A skill\n\nBody without closing ---";
        assert_eq!(parse_frontmatter_field(content, "name").as_deref(), Some("test-skill"));
    }

    #[test]
    fn parse_single_quoted_value() {
        let content = "---\nname: 'my skill'\n---\n";
        assert_eq!(parse_frontmatter_field(content, "name").as_deref(), Some("my skill"));
    }
}
