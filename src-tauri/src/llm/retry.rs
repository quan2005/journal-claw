use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use super::types::LlmError;

pub struct RetryPolicy {
    pub max_retries: u32,
    pub initial_backoff: Duration,
    pub max_backoff: Duration,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_retries: 8,
            initial_backoff: Duration::from_secs(1),
            max_backoff: Duration::from_secs(128),
        }
    }
}

impl RetryPolicy {
    pub fn backoff_for_attempt(&self, attempt: u32) -> Duration {
        let Some(multiplier) = 1_u32.checked_shl(attempt.saturating_sub(1)) else {
            return self.max_backoff;
        };
        self.initial_backoff
            .checked_mul(multiplier)
            .map_or(self.max_backoff, |delay| delay.min(self.max_backoff))
    }

    pub fn jittered_backoff_for_attempt(&self, attempt: u32) -> Duration {
        let base = self.backoff_for_attempt(attempt);
        base + jitter_for_base(base)
    }
}

/// Process-wide counter for distinct jitter samples even when clock resolution
/// is coarser than consecutive retry sleeps. (Ported from claw-code.)
static JITTER_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Additive jitter in `[0, base]` using splitmix64 finalizer.
/// Decorrelates retries from concurrent clients without requiring `rand`.
fn jitter_for_base(base: Duration) -> Duration {
    let base_nanos = u64::try_from(base.as_nanos()).unwrap_or(u64::MAX);
    if base_nanos == 0 {
        return Duration::ZERO;
    }
    let raw_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_nanos()).unwrap_or(u64::MAX))
        .unwrap_or(0);
    let tick = JITTER_COUNTER.fetch_add(1, Ordering::Relaxed);
    let mut mixed = raw_nanos
        .wrapping_add(tick)
        .wrapping_add(0x9E37_79B9_7F4A_7C15);
    mixed = (mixed ^ (mixed >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    mixed = (mixed ^ (mixed >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    mixed ^= mixed >> 31;
    let jitter_nanos = mixed % base_nanos.saturating_add(1);
    Duration::from_nanos(jitter_nanos)
}

/// Generic retry loop for LLM API requests.
///
/// `request_fn` is called on each attempt. It receives `events_emitted` to track
/// whether any streaming events have been sent to the client. If events were
/// already emitted, we don't retry (would cause duplicate partial responses).
///
/// `on_retry` is called before each retry sleep with (attempt, max_retries, delay, error_message).
pub async fn run_with_retry<F, Fut, T, R>(
    policy: &RetryPolicy,
    mut request_fn: F,
    on_retry: R,
) -> Result<T, LlmError>
where
    F: FnMut(Arc<AtomicBool>) -> Fut,
    Fut: std::future::Future<Output = Result<T, LlmError>>,
    R: Fn(u32, u32, Duration, &str),
{
    let mut last_err: Option<LlmError> = None;

    for attempt in 0..=policy.max_retries {
        if attempt > 0 {
            let delay = policy.jittered_backoff_for_attempt(attempt);
            let err_msg = last_err.as_ref().map(|e| e.to_string()).unwrap_or_default();
            eprintln!(
                "[retry] attempt {}/{} after {}ms: {}",
                attempt,
                policy.max_retries,
                delay.as_millis(),
                err_msg
            );
            on_retry(attempt, policy.max_retries, delay, &err_msg);
            tokio::time::sleep(delay).await;
        }

        let events_emitted = Arc::new(AtomicBool::new(false));

        match request_fn(events_emitted.clone()).await {
            Ok(result) => return Ok(result),
            Err(err) => {
                let streamed = events_emitted.load(Ordering::SeqCst);
                if streamed || !err.is_retryable() || attempt == policy.max_retries {
                    return Err(err);
                }
                eprintln!("[retry] retryable error: {}", err);
                last_err = Some(err);
            }
        }
    }

    Err(LlmError::RetriesExhausted {
        attempts: policy.max_retries + 1,
        last_error: Box::new(
            last_err.unwrap_or_else(|| LlmError::Network("max retries exceeded".to_string())),
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_policy_values() {
        let p = RetryPolicy::default();
        assert_eq!(p.max_retries, 8);
        assert_eq!(p.initial_backoff, Duration::from_secs(1));
        assert_eq!(p.max_backoff, Duration::from_secs(128));
    }

    #[test]
    fn backoff_doubles_until_maximum() {
        let p = RetryPolicy::default();
        assert_eq!(p.backoff_for_attempt(1), Duration::from_secs(1));
        assert_eq!(p.backoff_for_attempt(2), Duration::from_secs(2));
        assert_eq!(p.backoff_for_attempt(3), Duration::from_secs(4));
        assert_eq!(p.backoff_for_attempt(4), Duration::from_secs(8));
        assert_eq!(p.backoff_for_attempt(5), Duration::from_secs(16));
        assert_eq!(p.backoff_for_attempt(6), Duration::from_secs(32));
        assert_eq!(p.backoff_for_attempt(7), Duration::from_secs(64));
        assert_eq!(p.backoff_for_attempt(8), Duration::from_secs(128));
        // Capped at max_backoff
        assert_eq!(p.backoff_for_attempt(9), Duration::from_secs(128));
        assert_eq!(p.backoff_for_attempt(100), Duration::from_secs(128));
    }

    #[test]
    fn jittered_backoff_stays_within_bounds_and_varies() {
        let p = RetryPolicy::default();
        let mut seen_different = false;
        let mut prev = Duration::ZERO;

        for _ in 0..20 {
            let jittered = p.jittered_backoff_for_attempt(3);
            let base = p.backoff_for_attempt(3); // 4s
                                                 // Jittered should be in [base, 2*base] (base + [0, base])
            assert!(
                jittered >= base,
                "jittered {:?} < base {:?}",
                jittered,
                base
            );
            assert!(
                jittered <= base * 2,
                "jittered {:?} > 2*base {:?}",
                jittered,
                base * 2
            );
            if prev != Duration::ZERO && jittered != prev {
                seen_different = true;
            }
            prev = jittered;
        }
        assert!(seen_different, "jitter should produce varying values");
    }

    #[test]
    fn jitter_for_zero_base_is_zero() {
        assert_eq!(jitter_for_base(Duration::ZERO), Duration::ZERO);
    }

    #[tokio::test]
    async fn retry_succeeds_on_first_attempt() {
        let policy = RetryPolicy {
            max_retries: 3,
            initial_backoff: Duration::from_millis(1),
            max_backoff: Duration::from_millis(10),
        };
        let result: Result<&str, LlmError> =
            run_with_retry(&policy, |_events| async { Ok("ok") }, |_, _, _, _| {}).await;
        assert_eq!(result.unwrap(), "ok");
    }

    #[tokio::test]
    async fn retry_exhaustion_wraps_last_error() {
        let policy = RetryPolicy {
            max_retries: 2,
            initial_backoff: Duration::from_millis(1),
            max_backoff: Duration::from_millis(1),
        };
        let attempt = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let result: Result<String, LlmError> = run_with_retry(
            &policy,
            |_events| {
                let attempt = attempt.clone();
                async move {
                    attempt.fetch_add(1, Ordering::SeqCst);
                    Err(LlmError::Api {
                        status: 502,
                        message: "bad gateway".into(),
                        error_type: None,
                        request_id: None,
                        retryable: false,
                    })
                }
            },
            |_, _, _, _| {},
        )
        .await;

        let err = result.unwrap_err();
        assert!(matches!(err, LlmError::Api { .. }));
        assert_eq!(attempt.load(Ordering::SeqCst), 3); // initial + 2 retries
    }

    #[tokio::test]
    async fn no_retry_when_events_emitted() {
        let policy = RetryPolicy {
            max_retries: 3,
            initial_backoff: Duration::from_millis(1),
            max_backoff: Duration::from_millis(1),
        };
        let attempt = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let result: Result<String, LlmError> = run_with_retry(
            &policy,
            |events_emitted| {
                let attempt = attempt.clone();
                async move {
                    attempt.fetch_add(1, Ordering::SeqCst);
                    events_emitted.store(true, Ordering::SeqCst);
                    Err(LlmError::Api {
                        status: 502,
                        message: "bad gateway".into(),
                        error_type: None,
                        request_id: None,
                        retryable: false,
                    })
                }
            },
            |_, _, _, _| {},
        )
        .await;

        assert!(result.is_err());
        assert_eq!(attempt.load(Ordering::SeqCst), 1); // no retry
    }

    #[tokio::test]
    async fn no_retry_for_non_retryable_errors() {
        let policy = RetryPolicy {
            max_retries: 3,
            initial_backoff: Duration::from_millis(1),
            max_backoff: Duration::from_millis(1),
        };
        let attempt = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let result: Result<String, LlmError> = run_with_retry(
            &policy,
            |_events| {
                let attempt = attempt.clone();
                async move {
                    attempt.fetch_add(1, Ordering::SeqCst);
                    Err(LlmError::Api {
                        status: 401,
                        message: "unauthorized".into(),
                        error_type: None,
                        request_id: None,
                        retryable: false,
                    })
                }
            },
            |_, _, _, _| {},
        )
        .await;

        assert!(result.is_err());
        assert_eq!(attempt.load(Ordering::SeqCst), 1);
    }
}
