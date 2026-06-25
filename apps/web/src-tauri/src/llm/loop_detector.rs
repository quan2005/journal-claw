use std::collections::{HashSet, VecDeque};
use std::hash::{Hash, Hasher};

const DEFAULT_WINDOW_SIZE: usize = 20;
const EXACT_REPEAT_THRESHOLD: usize = 3;
const PING_PONG_CYCLES: usize = 4;
const NO_PROGRESS_THRESHOLD: usize = 5;

#[derive(Debug, Clone)]
struct ToolCallRecord {
    name: String,
    args_hash: u64,
    result_hash: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Severity {
    Warning,
    Block,
    Break,
}

#[derive(Debug, Clone)]
pub struct LoopDetectionResult {
    pub severity: Severity,
    #[allow(dead_code)]
    pub pattern: String,
    pub message: String,
}

pub struct LoopDetector {
    window: VecDeque<ToolCallRecord>,
    window_size: usize,
}

impl LoopDetector {
    pub fn new() -> Self {
        Self {
            window: VecDeque::with_capacity(DEFAULT_WINDOW_SIZE),
            window_size: DEFAULT_WINDOW_SIZE,
        }
    }

    pub fn record(
        &mut self,
        name: &str,
        input: &serde_json::Value,
        output: &str,
    ) -> Option<LoopDetectionResult> {
        let record = ToolCallRecord {
            name: name.to_string(),
            args_hash: canonical_hash(input),
            result_hash: string_hash(output),
        };

        self.window.push_back(record);
        if self.window.len() > self.window_size {
            self.window.pop_front();
        }

        // Check patterns in escalation-priority order
        if let Some(r) = self.detect_exact_repeat() {
            return Some(r);
        }
        if let Some(r) = self.detect_ping_pong() {
            return Some(r);
        }
        self.detect_no_progress()
    }

    fn detect_exact_repeat(&self) -> Option<LoopDetectionResult> {
        let len = self.window.len();
        if len < EXACT_REPEAT_THRESHOLD {
            return None;
        }

        let last = self.window.back()?;
        let mut consecutive = 1usize;
        for i in (0..len - 1).rev() {
            let r = &self.window[i];
            if r.name == last.name
                && r.args_hash == last.args_hash
                && r.result_hash == last.result_hash
            {
                consecutive += 1;
            } else {
                break;
            }
        }

        if consecutive >= EXACT_REPEAT_THRESHOLD {
            let severity = match consecutive {
                n if n >= EXACT_REPEAT_THRESHOLD + 2 => Severity::Break,
                n if n >= EXACT_REPEAT_THRESHOLD + 1 => Severity::Block,
                _ => Severity::Warning,
            };
            Some(LoopDetectionResult {
                severity,
                pattern: "exact_repeat".to_string(),
                message: format!(
                    "工具 '{}' 已连续 {} 次使用相同参数且返回相同结果，请换一种方式。",
                    last.name, consecutive
                ),
            })
        } else {
            None
        }
    }

    fn detect_ping_pong(&self) -> Option<LoopDetectionResult> {
        let len = self.window.len();
        if len < PING_PONG_CYCLES * 2 {
            return None;
        }

        let tail: Vec<&str> = self.window.iter().rev().map(|r| r.name.as_str()).collect();
        let a = tail[0];
        let b = tail[1];
        if a == b {
            return None;
        }

        let mut pairs = 0usize;
        for chunk in tail.chunks(2) {
            if chunk.len() == 2 && chunk[0] == a && chunk[1] == b {
                pairs += 1;
            } else {
                break;
            }
        }

        if pairs >= PING_PONG_CYCLES {
            let severity = match pairs {
                n if n >= PING_PONG_CYCLES + 2 => Severity::Break,
                n if n >= PING_PONG_CYCLES + 1 => Severity::Block,
                _ => Severity::Warning,
            };
            Some(LoopDetectionResult {
                severity,
                pattern: "ping_pong".to_string(),
                message: format!(
                    "工具 '{}' 和 '{}' 交替调用已达 {} 轮，可能陷入循环。",
                    a, b, pairs
                ),
            })
        } else {
            None
        }
    }

    fn detect_no_progress(&self) -> Option<LoopDetectionResult> {
        let len = self.window.len();
        if len < NO_PROGRESS_THRESHOLD {
            return None;
        }

        let last = self.window.back()?;
        let same_tool_same_result: Vec<&ToolCallRecord> = self
            .window
            .iter()
            .rev()
            .take_while(|r| r.name == last.name && r.result_hash == last.result_hash)
            .collect();

        let count = same_tool_same_result.len();
        if count < NO_PROGRESS_THRESHOLD {
            return None;
        }

        // Must have varying args — otherwise exact_repeat handles it
        let unique_args: HashSet<u64> = same_tool_same_result.iter().map(|r| r.args_hash).collect();
        if unique_args.len() < 2 {
            return None;
        }

        let severity = match count {
            n if n >= NO_PROGRESS_THRESHOLD + 2 => Severity::Break,
            n if n >= NO_PROGRESS_THRESHOLD + 1 => Severity::Block,
            _ => Severity::Warning,
        };
        Some(LoopDetectionResult {
            severity,
            pattern: "no_progress".to_string(),
            message: format!(
                "工具 '{}' 已调用 {} 次，参数不同但结果相同，没有实质进展。",
                last.name, count
            ),
        })
    }
}

fn canonical_hash(value: &serde_json::Value) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    hash_value(value, &mut hasher);
    hasher.finish()
}

fn hash_value(value: &serde_json::Value, hasher: &mut impl Hasher) {
    match value {
        serde_json::Value::Null => 0u8.hash(hasher),
        serde_json::Value::Bool(b) => {
            1u8.hash(hasher);
            b.hash(hasher);
        }
        serde_json::Value::Number(n) => {
            2u8.hash(hasher);
            n.to_string().hash(hasher);
        }
        serde_json::Value::String(s) => {
            3u8.hash(hasher);
            s.hash(hasher);
        }
        serde_json::Value::Array(arr) => {
            4u8.hash(hasher);
            for item in arr {
                hash_value(item, hasher);
            }
        }
        serde_json::Value::Object(obj) => {
            5u8.hash(hasher);
            let mut keys: Vec<&String> = obj.keys().collect();
            keys.sort();
            for key in keys {
                key.hash(hasher);
                hash_value(&obj[key], hasher);
            }
        }
    }
}

fn string_hash(s: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn no_detection_on_varied_calls() {
        let mut d = LoopDetector::new();
        assert!(d
            .record("bash", &json!({"command": "ls"}), "file1\nfile2")
            .is_none());
        assert!(d
            .record("bash", &json!({"command": "cat foo"}), "hello")
            .is_none());
        assert!(d
            .record("read_file", &json!({"path": "a.rs"}), "code")
            .is_none());
    }

    #[test]
    fn exact_repeat_fires_at_threshold() {
        let mut d = LoopDetector::new();
        let input = json!({"command": "npm test"});
        let output = "FAIL: 3 tests failed";
        assert!(d.record("bash", &input, output).is_none());
        assert!(d.record("bash", &input, output).is_none());
        let r = d.record("bash", &input, output).unwrap();
        assert_eq!(r.severity, Severity::Warning);
        assert_eq!(r.pattern, "exact_repeat");
    }

    #[test]
    fn exact_repeat_escalates() {
        let mut d = LoopDetector::new();
        let input = json!({"command": "npm test"});
        let output = "FAIL";
        for _ in 0..3 {
            d.record("bash", &input, output);
        }
        let r = d.record("bash", &input, output).unwrap();
        assert_eq!(r.severity, Severity::Block);

        let r = d.record("bash", &input, output).unwrap();
        assert_eq!(r.severity, Severity::Break);
    }

    #[test]
    fn same_input_different_output_no_trigger() {
        let mut d = LoopDetector::new();
        let input = json!({"command": "date"});
        assert!(d.record("bash", &input, "Mon 10:00").is_none());
        assert!(d.record("bash", &input, "Mon 10:01").is_none());
        assert!(d.record("bash", &input, "Mon 10:02").is_none());
    }

    #[test]
    fn ping_pong_fires_and_escalates() {
        let mut d = LoopDetector::new();
        let a_input = json!({"command": "cat a.rs"});
        let b_input = json!({"command": "sed s/x/y/ a.rs"});
        // Build up PING_PONG_CYCLES (4) pairs: a,b,a,b,a,b,a,b
        for i in 0..(PING_PONG_CYCLES * 2) {
            let r = if i % 2 == 0 {
                d.record("read_file", &a_input, "code")
            } else {
                d.record("bash", &b_input, "ok")
            };
            if i < PING_PONG_CYCLES * 2 - 1 {
                // exact_repeat won't fire since tools alternate
                // ping_pong needs full cycles before triggering
            } else {
                assert!(r.is_some(), "should detect ping-pong at cycle {}", i);
                assert_eq!(r.unwrap().severity, Severity::Warning);
            }
        }
        // 5th pair → Block
        d.record("read_file", &a_input, "code");
        let r = d.record("bash", &b_input, "ok").unwrap();
        assert_eq!(r.severity, Severity::Block);
        // 6th pair → Break
        d.record("read_file", &a_input, "code");
        let r = d.record("bash", &b_input, "ok").unwrap();
        assert_eq!(r.severity, Severity::Break);
    }

    #[test]
    fn canonical_hash_key_order_independent() {
        let a = json!({"a": 1, "b": 2});
        let b = json!({"b": 2, "a": 1});
        assert_eq!(canonical_hash(&a), canonical_hash(&b));
    }
}
