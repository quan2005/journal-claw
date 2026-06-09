use sha2::{Digest, Sha256};

/// Compute a deterministic hex digest from material content + processing parameters.
/// Same inputs always produce the same digest; any change produces a different one.
pub fn compute_source_digest(
    material_bytes: &[u8],
    prompt_version: &str,
    model_id: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(material_bytes);
    hasher.update(prompt_version.as_bytes());
    hasher.update(model_id.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_inputs_same_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        assert_eq!(d1, d2);
    }

    #[test]
    fn different_content_different_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"world", "v1", "claude-sonnet");
        assert_ne!(d1, d2);
    }

    #[test]
    fn different_model_different_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"hello", "v1", "claude-haiku");
        assert_ne!(d1, d2);
    }

    #[test]
    fn different_prompt_version_different_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"hello", "v2", "claude-sonnet");
        assert_ne!(d1, d2);
    }

    #[test]
    fn digest_is_64_hex_chars() {
        let d = compute_source_digest(b"test", "v1", "model");
        assert_eq!(d.len(), 64);
        assert!(d.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn empty_input_still_produces_valid_digest() {
        let d = compute_source_digest(b"", "", "");
        assert_eq!(d.len(), 64);
    }
}
