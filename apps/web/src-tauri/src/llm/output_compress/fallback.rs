//! Fallback compressor — matches everything, just normalizes blanks.

use super::{normalize_blanks, Compressor};

pub struct FallbackCompressor;

impl Compressor for FallbackCompressor {
    fn matches(&self, _cmd: &str) -> bool {
        true
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        normalize_blanks(output)
    }
}
