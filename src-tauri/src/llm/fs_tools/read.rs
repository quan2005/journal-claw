use super::super::types::{ImageData, ToolDefinition, ToolResult};
use super::{sandbox_resolve, MAX_READ_CHARS};
use serde_json::json;

fn compress_image(raw: &[u8]) -> (String, Vec<u8>) {
    use std::io::Cursor;
    let reader = match image::ImageReader::new(Cursor::new(raw)).with_guessed_format() {
        Ok(r) => r,
        Err(_) => return ("application/octet-stream".to_string(), raw.to_vec()),
    };
    let img: image::DynamicImage = match reader.decode() {
        Ok(i) => i,
        Err(_) => return ("application/octet-stream".to_string(), raw.to_vec()),
    };
    let (w, h) = (img.width(), img.height());
    let img = if w > 1568 || h > 1568 {
        img.resize(1568, 1568, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };
    let mut buf = Cursor::new(Vec::new());
    if img
        .write_with_encoder(image::codecs::jpeg::JpegEncoder::new_with_quality(
            &mut buf, 80,
        ))
        .is_err()
    {
        return ("application/octet-stream".to_string(), raw.to_vec());
    }
    ("image/jpeg".to_string(), buf.into_inner())
}

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "read".to_string(),
        description: "Read file contents within the workspace. Supports text files (auto-paginates at ~10K tokens) and image files (returns as base64 for vision).".to_string(),
        input_schema: json!({"type":"object","properties":{"path":{"type":"string","description":"Relative path to the file within the workspace"},"offset":{"type":"integer","description":"Character offset to start reading from (for pagination). Default: 0"},"limit":{"type":"integer","description":"Maximum characters to return. Default: 30000 (~10K tokens)"}},"required":["path"]}),
    }
}

pub async fn execute(
    input: &serde_json::Value,
    workspace: &str,
) -> (ToolResult, Option<ImageData>) {
    let path = match input.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return (
                ToolResult {
                    output: "error: missing 'path' field".to_string(),
                    is_error: true,
                },
                None,
            )
        }
    };
    let abs_path = match sandbox_resolve(workspace, path) {
        Ok(p) => p,
        Err(e) => return (e, None),
    };
    if !abs_path.exists() {
        return (
            ToolResult {
                output: format!("error: file not found: {}", path),
                is_error: true,
            },
            None,
        );
    }
    if abs_path.is_dir() {
        return (
            ToolResult {
                output: format!("error: path is a directory: {}", path),
                is_error: true,
            },
            None,
        );
    }
    const IMAGE_EXTS: &[&str] = &[
        "png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif", "ico", "svg",
    ];
    let is_image = abs_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false);
    if is_image {
        let raw = match tokio::fs::read(&abs_path).await {
            Ok(b) => b,
            Err(e) => {
                return (
                    ToolResult {
                        output: format!("error: failed to read image: {}", e),
                        is_error: true,
                    },
                    None,
                )
            }
        };
        let ext = abs_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png");
        if ext.eq_ignore_ascii_case("svg") {
            return (
                ToolResult {
                    output: format!("[SVG image: {}]\n{}", path, String::from_utf8_lossy(&raw)),
                    is_error: false,
                },
                None,
            );
        }
        let (media_type, data) = compress_image(&raw);
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        let size_kb = data.len() / 1024;
        return (
            ToolResult {
                output: format!("[image: {} — {}KB, {}]", path, size_kb, media_type),
                is_error: false,
            },
            Some(ImageData {
                media_type,
                data: b64,
            }),
        );
    }
    let content = match tokio::fs::read_to_string(&abs_path).await {
        Ok(c) => c,
        Err(e) => {
            return (
                ToolResult {
                    output: format!("error: failed to read file: {}", e),
                    is_error: true,
                },
                None,
            )
        }
    };
    let total_chars = content.chars().count();
    let offset_chars = input.get("offset").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let limit = input
        .get("limit")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize)
        .unwrap_or(MAX_READ_CHARS);
    if offset_chars >= total_chars {
        return (
            ToolResult {
                output: format!("(end of file — {} total characters)", total_chars),
                is_error: false,
            },
            None,
        );
    }
    // Convert char offset to byte offset safely
    let offset = content
        .char_indices()
        .nth(offset_chars)
        .map(|(i, _)| i)
        .unwrap_or(content.len());
    let slice = &content[offset..];
    let slice_chars = slice.chars().count();
    // Convert char limit to byte position
    let end_byte = if limit >= slice_chars {
        slice.len()
    } else {
        slice
            .char_indices()
            .nth(limit)
            .map(|(i, _)| i)
            .unwrap_or(slice.len())
    };
    let end = if end_byte < slice.len() {
        slice[..end_byte]
            .rfind('\n')
            .map(|p| p + 1)
            .unwrap_or(end_byte)
    } else {
        end_byte
    };
    let page = &slice[..end];
    let page_chars = page.chars().count();
    let has_more = offset_chars + page_chars < total_chars;
    let before_offset = &content[..offset];
    let start_line = before_offset.chars().filter(|&c| c == '\n').count() + 1;
    let mut output = String::new();
    for (i, line) in page.lines().enumerate() {
        output.push_str(&format!("{:>4}\t{}\n", start_line + i, line));
    }
    if has_more {
        let next_offset = offset_chars + page_chars;
        output.push_str(&format!(
            "\n[truncated — showing {}/{} chars. Use offset={} to continue]",
            page_chars, total_chars, next_offset
        ));
    }
    (
        ToolResult {
            output,
            is_error: false,
        },
        None,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn read_simple_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("hello.txt"), "line1\nline2\nline3").unwrap();
        let (result, img) = execute(
            &serde_json::json!({"path":"hello.txt"}),
            dir.path().to_str().unwrap(),
        )
        .await;
        assert!(!result.is_error);
        assert!(result.output.contains("line1"));
        assert!(img.is_none());
    }
    #[tokio::test]
    async fn read_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let (r, _) = execute(
            &serde_json::json!({"path":"nope.txt"}),
            dir.path().to_str().unwrap(),
        )
        .await;
        assert!(r.is_error);
    }
    #[tokio::test]
    async fn read_path_escape_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let (r, _) = execute(
            &serde_json::json!({"path":"../../etc/passwd"}),
            dir.path().to_str().unwrap(),
        )
        .await;
        assert!(r.is_error);
        assert!(r.output.contains("escapes"));
    }
    #[tokio::test]
    async fn read_image_returns_image_data() {
        let dir = tempfile::tempdir().unwrap();
        let png: Vec<u8> = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
            0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        std::fs::write(dir.path().join("test.png"), &png).unwrap();
        let (r, img) = execute(
            &serde_json::json!({"path":"test.png"}),
            dir.path().to_str().unwrap(),
        )
        .await;
        assert!(!r.is_error);
        assert!(img.is_some());
        let img = img.unwrap();
        assert!(!img.data.is_empty());
        assert!(img.media_type == "image/jpeg" || img.media_type == "application/octet-stream");
    }
    #[tokio::test]
    async fn read_large_cjk_no_panic() {
        let dir = tempfile::tempdir().unwrap();
        // 35,000 CJK chars exceeds MAX_READ_CHARS (30,000 chars)
        let cjk: String = "你好世界测试".chars().cycle().take(35_000).collect();
        std::fs::write(dir.path().join("big.md"), &cjk).unwrap();
        let (r, _) = execute(
            &serde_json::json!({"path":"big.md"}),
            dir.path().to_str().unwrap(),
        )
        .await;
        assert!(!r.is_error);
        assert!(r.output.contains("truncated"));
    }
    #[tokio::test]
    async fn read_svg_returns_text() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("i.svg"), "<svg></svg>").unwrap();
        let (r, img) = execute(
            &serde_json::json!({"path":"i.svg"}),
            dir.path().to_str().unwrap(),
        )
        .await;
        assert!(!r.is_error);
        assert!(img.is_none());
        assert!(r.output.contains("SVG"));
    }
}
