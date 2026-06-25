use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

pub const EVENT_LOG_CAPACITY: usize = 500;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EventKind {
    JournalUpdated,
    TodosUpdated,
    IdentityUpdated,
    SpeakersUpdated,
    AiProcessing,
    RecordingProcessed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    pub seq: u64,
    pub timestamp_ms: u64,
    pub kind: EventKind,
    /// JSON-encoded payload specific to the event kind.
    /// JournalUpdated → year_month string
    /// TodosUpdated → null
    /// IdentityUpdated → null
    /// AiProcessing → ProcessingUpdate JSON
    pub payload: serde_json::Value,
}

pub struct EventLog {
    buffer: Mutex<VecDeque<DomainEvent>>,
    seq_counter: AtomicU64,
    capacity: usize,
}

impl EventLog {
    pub fn new() -> Self {
        Self {
            buffer: Mutex::new(VecDeque::with_capacity(EVENT_LOG_CAPACITY)),
            seq_counter: AtomicU64::new(1),
            capacity: EVENT_LOG_CAPACITY,
        }
    }

    /// Record an event, returning its sequence number.
    pub fn record(&self, kind: EventKind, payload: serde_json::Value) -> u64 {
        let seq = self.seq_counter.fetch_add(1, Ordering::Relaxed);
        let timestamp_ms = now_ms();
        let event = DomainEvent {
            seq,
            timestamp_ms,
            kind,
            payload,
        };
        let mut buf = self.buffer.lock().unwrap_or_else(|e| {
            eprintln!("[event_log] mutex poisoned, recovering");
            e.into_inner()
        });
        if buf.len() >= self.capacity {
            buf.pop_front();
        }
        buf.push_back(event);
        seq
    }

    /// Return all events with seq > since_seq.
    pub fn events_since(&self, since_seq: u64) -> Vec<DomainEvent> {
        let buf = self.buffer.lock().unwrap_or_else(|e| {
            eprintln!("[event_log] mutex poisoned, recovering");
            e.into_inner()
        });
        buf.iter().filter(|e| e.seq > since_seq).cloned().collect()
    }

    /// Current sequence number (next event will get this + 1).
    #[allow(dead_code)]
    pub fn current_seq(&self) -> u64 {
        self.seq_counter.load(Ordering::Relaxed)
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub struct EventLogState(pub EventLog);

#[tauri::command]
pub fn get_events_since(
    event_log: tauri::State<'_, EventLogState>,
    since_seq: u64,
) -> Vec<DomainEvent> {
    event_log.0.events_since(since_seq)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_and_retrieve() {
        let log = EventLog::new();
        let seq = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        assert!(seq >= 1);
        let events = log.events_since(0);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].seq, seq);
        assert_eq!(events[0].kind, EventKind::TodosUpdated);
    }

    #[test]
    fn events_since_filters_correctly() {
        let log = EventLog::new();
        let s1 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let s2 = log.record(EventKind::JournalUpdated, serde_json::json!("2603"));
        let s3 = log.record(EventKind::IdentityUpdated, serde_json::json!(null));
        // Get events after s1
        let events = log.events_since(s1);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].seq, s2);
        assert_eq!(events[1].seq, s3);
    }

    #[test]
    fn events_since_empty_when_all_old() {
        let log = EventLog::new();
        let s = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let events = log.events_since(s);
        assert!(events.is_empty());
    }

    #[test]
    fn buffer_capped_at_capacity() {
        let log = EventLog::new();
        // Capacity is 500; add 502 events
        for i in 0..502 {
            log.record(EventKind::TodosUpdated, serde_json::json!(i));
        }
        let events = log.events_since(0);
        assert_eq!(events.len(), 500);
        // First event should have been evicted; oldest remaining should have seq >= 3
        assert!(events[0].seq >= 3);
    }

    #[test]
    fn seq_monotonically_increases() {
        let log = EventLog::new();
        let s1 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let s2 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let s3 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        assert!(s1 < s2);
        assert!(s2 < s3);
    }
}
