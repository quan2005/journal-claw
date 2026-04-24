/// Unified SSE (Server-Sent Events) parser.
/// Byte-buffer approach (ported from claw-code): accumulates raw bytes,
/// scans for frame boundaries at the byte level, converts to UTF-8 only
/// when extracting complete frames.

#[derive(Debug, Clone)]
pub struct SseEvent {
    pub event_type: Option<String>,
    pub data: String,
}

pub struct SseParser {
    buffer: Vec<u8>,
}

impl SseParser {
    pub fn new() -> Self {
        Self { buffer: Vec::new() }
    }

    /// Feed a chunk of bytes into the parser and extract complete SSE events.
    pub fn feed(&mut self, chunk: &[u8]) -> Vec<SseEvent> {
        self.buffer.extend_from_slice(chunk);
        let mut events = Vec::new();
        while let Some(frame) = self.next_frame() {
            if let Some(event) = Self::parse_event(&frame) {
                events.push(event);
            }
        }
        events
    }

    /// Feed a string chunk into the parser.
    #[allow(dead_code)]
    pub fn feed_str(&mut self, chunk: &str) -> Vec<SseEvent> {
        self.feed(chunk.as_bytes())
    }

    /// Flush any trailing data when the stream ends.
    #[allow(dead_code)]
    pub fn finish(&mut self) -> Vec<SseEvent> {
        if self.buffer.is_empty() {
            return Vec::new();
        }
        let trailing = std::mem::take(&mut self.buffer);
        let text = String::from_utf8_lossy(&trailing);
        match Self::parse_event(&text) {
            Some(event) => vec![event],
            None => Vec::new(),
        }
    }

    /// Extract the next complete frame from the byte buffer.
    /// Scans for `\n\n` or `\r\n\r\n` boundaries at the byte level.
    fn next_frame(&mut self) -> Option<String> {
        let separator = self
            .buffer
            .windows(2)
            .position(|w| w == b"\n\n")
            .map(|pos| (pos, 2))
            .or_else(|| {
                self.buffer
                    .windows(4)
                    .position(|w| w == b"\r\n\r\n")
                    .map(|pos| (pos, 4))
            })?;

        let (position, separator_len) = separator;
        let frame_bytes: Vec<u8> = self.buffer.drain(..position + separator_len).collect();
        let frame_len = frame_bytes.len().saturating_sub(separator_len);
        Some(String::from_utf8_lossy(&frame_bytes[..frame_len]).into_owned())
    }

    fn parse_event(text: &str) -> Option<SseEvent> {
        let mut event_type: Option<String> = None;
        let mut data_lines: Vec<&str> = Vec::new();

        for line in text.lines() {
            let line = line.trim_end_matches('\r');

            if line.starts_with(':') {
                continue;
            }

            if let Some(val) = line.strip_prefix("event:") {
                event_type = Some(val.trim().to_string());
            } else if let Some(val) = line.strip_prefix("data:") {
                data_lines.push(val.trim_start_matches(' '));
            }
        }

        if matches!(event_type.as_deref(), Some("ping")) {
            return None;
        }

        if data_lines.is_empty() {
            return None;
        }

        let data = data_lines.join("\n");

        if data == "[DONE]" {
            return None;
        }

        Some(SseEvent { event_type, data })
    }

    /// Check if there's remaining buffered data (incomplete frame).
    #[allow(dead_code)]
    pub fn has_pending(&self) -> bool {
        !self.buffer.is_empty()
    }
}

/// Attempt to parse an SSE data line as an error object.
/// Returns Some((message, retryable)) if it's an error.
pub fn detect_error_in_data(data: &str) -> Option<(String, bool)> {
    let val: serde_json::Value = serde_json::from_str(data).ok()?;

    // Format: {"error": {"message": "...", "type": "...", "code": "..."}}
    if let Some(err_obj) = val.get("error") {
        let message = err_obj
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown error")
            .to_string();
        let err_type = err_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let code = err_obj.get("code").and_then(|v| v.as_str()).unwrap_or("");

        let retryable = matches!(
            err_type,
            "server_error" | "rate_limit_error" | "overloaded_error"
        ) || matches!(code, "rate_limit_exceeded" | "server_error");

        return Some((message, retryable));
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basic_event() {
        let mut parser = SseParser::new();
        let events = parser.feed(b"event: message_start\ndata: {\"type\":\"hello\"}\n\n");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type.as_deref(), Some("message_start"));
        assert_eq!(events[0].data, "{\"type\":\"hello\"}");
    }

    #[test]
    fn parse_crlf_separator() {
        let mut parser = SseParser::new();
        let events = parser.feed(b"data: {\"x\":1}\r\n\r\n");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].data, "{\"x\":1}");
    }

    #[test]
    fn parse_done_sentinel() {
        let mut parser = SseParser::new();
        let events = parser.feed(b"data: [DONE]\n\n");
        assert_eq!(events.len(), 0);
    }

    #[test]
    fn skip_comment_lines() {
        let mut parser = SseParser::new();
        let events = parser.feed(b": this is a comment\ndata: {\"ok\":true}\n\n");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].data, "{\"ok\":true}");
    }

    #[test]
    fn incomplete_frame_buffered() {
        let mut parser = SseParser::new();
        let events = parser.feed(b"data: {\"partial\":");
        assert_eq!(events.len(), 0);
        assert!(parser.has_pending());

        let events = parser.feed(b"true}\n\n");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].data, "{\"partial\":true}");
    }

    #[test]
    fn multiple_events_in_one_chunk() {
        let mut parser = SseParser::new();
        let events = parser.feed(b"data: {\"a\":1}\n\ndata: {\"b\":2}\n\n");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].data, "{\"a\":1}");
        assert_eq!(events[1].data, "{\"b\":2}");
    }

    #[test]
    fn no_event_type() {
        let mut parser = SseParser::new();
        let events = parser.feed(b"data: hello world\n\n");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, None);
        assert_eq!(events[0].data, "hello world");
    }

    #[test]
    fn multi_line_data() {
        let mut parser = SseParser::new();
        let events = parser.feed(b"data: line1\ndata: line2\n\n");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].data, "line1\nline2");
    }

    #[test]
    fn detect_error_object() {
        let data = r#"{"error":{"message":"Rate limit exceeded","type":"rate_limit_error","code":"rate_limit_exceeded"}}"#;
        let result = detect_error_in_data(data);
        assert!(result.is_some());
        let (msg, retryable) = result.unwrap();
        assert_eq!(msg, "Rate limit exceeded");
        assert!(retryable);
    }

    #[test]
    fn detect_non_retryable_error() {
        let data = r#"{"error":{"message":"Invalid API key","type":"authentication_error","code":"invalid_api_key"}}"#;
        let result = detect_error_in_data(data);
        assert!(result.is_some());
        let (msg, retryable) = result.unwrap();
        assert_eq!(msg, "Invalid API key");
        assert!(!retryable);
    }

    #[test]
    fn no_error_in_normal_data() {
        let data = r#"{"choices":[{"delta":{"content":"hello"}}]}"#;
        assert!(detect_error_in_data(data).is_none());
    }
}
