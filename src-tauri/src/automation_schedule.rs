use crate::automation_types::AutomationSchedule;
use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, Weekday};

pub fn parse_time(time: &str) -> Result<(u32, u32), String> {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() != 2 {
        return Err("time must use HH:MM".to_string());
    }
    let hour: u32 = parts[0]
        .parse()
        .map_err(|_| "hour must be numeric".to_string())?;
    let minute: u32 = parts[1]
        .parse()
        .map_err(|_| "minute must be numeric".to_string())?;
    if hour > 23 || minute > 59 {
        return Err("time must be between 00:00 and 23:59".to_string());
    }
    Ok((hour, minute))
}

pub fn validate_schedule(schedule: &AutomationSchedule) -> Result<(), String> {
    match schedule {
        AutomationSchedule::Daily { time, timezone }
        | AutomationSchedule::Weekdays { time, timezone } => {
            parse_time(time)?;
            validate_timezone(timezone)
        }
        AutomationSchedule::Weekly {
            weekday,
            time,
            timezone,
        } => {
            if *weekday > 6 {
                return Err("weekday must be 0..6 where 0 is Sunday".to_string());
            }
            parse_time(time)?;
            validate_timezone(timezone)
        }
        AutomationSchedule::Monthly {
            day,
            time,
            timezone,
        } => {
            if *day == 0 || *day > 31 {
                return Err("monthly day must be 1..31".to_string());
            }
            parse_time(time)?;
            validate_timezone(timezone)
        }
    }
}

fn validate_timezone(timezone: &str) -> Result<(), String> {
    if timezone.trim().is_empty() {
        return Err("timezone is required".to_string());
    }
    if timezone != "Asia/Hong_Kong" && timezone != "Local" {
        return Err("first version supports Asia/Hong_Kong or Local timezone".to_string());
    }
    Ok(())
}

pub fn next_run_after(
    schedule: &AutomationSchedule,
    after: NaiveDateTime,
) -> Result<NaiveDateTime, String> {
    validate_schedule(schedule)?;
    match schedule {
        AutomationSchedule::Daily { time, .. } => next_daily(time, after),
        AutomationSchedule::Weekdays { time, .. } => next_weekdays(time, after),
        AutomationSchedule::Weekly { weekday, time, .. } => next_weekly(*weekday, time, after),
        AutomationSchedule::Monthly { day, time, .. } => next_monthly(*day, time, after),
    }
}

#[allow(dead_code)]
pub fn next_run_from_now(schedule: &AutomationSchedule) -> Result<NaiveDateTime, String> {
    next_run_after(schedule, Local::now().naive_local())
}

fn at_date(date: NaiveDate, time: &str) -> Result<NaiveDateTime, String> {
    let (hour, minute) = parse_time(time)?;
    date.and_hms_opt(hour, minute, 0)
        .ok_or_else(|| "invalid date/time".to_string())
}

fn next_daily(time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    let today = at_date(after.date(), time)?;
    if after < today {
        Ok(today)
    } else {
        Ok(today + Duration::days(1))
    }
}

fn next_weekdays(time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    for offset in 0..=7 {
        let date = after.date() + Duration::days(offset);
        let weekday = date.weekday();
        if matches!(
            weekday,
            Weekday::Mon | Weekday::Tue | Weekday::Wed | Weekday::Thu | Weekday::Fri
        ) {
            let candidate = at_date(date, time)?;
            if after < candidate {
                return Ok(candidate);
            }
        }
    }
    Err("could not compute weekday schedule".to_string())
}

fn next_weekly(weekday: u32, time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    for offset in 0..=7 {
        let date = after.date() + Duration::days(offset);
        if date.weekday().num_days_from_sunday() == weekday {
            let candidate = at_date(date, time)?;
            if after < candidate {
                return Ok(candidate);
            }
        }
    }
    Err("could not compute weekly schedule".to_string())
}

fn next_monthly(day: u32, time: &str, after: NaiveDateTime) -> Result<NaiveDateTime, String> {
    let mut year = after.year();
    let mut month = after.month();
    for _ in 0..14 {
        if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
            let candidate = at_date(date, time)?;
            if after < candidate {
                return Ok(candidate);
            }
        }
        if month == 12 {
            year += 1;
            month = 1;
        } else {
            month += 1;
        }
    }
    Err("could not compute monthly schedule".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").unwrap()
    }

    #[test]
    fn rejects_invalid_time() {
        assert!(parse_time("24:00").is_err());
        assert!(parse_time("08").is_err());
        assert!(parse_time("aa:bb").is_err());
    }

    #[test]
    fn daily_uses_today_when_time_is_future() {
        let schedule = AutomationSchedule::Daily {
            time: "08:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 07:30:00")).unwrap(),
            dt("2026-05-30 08:00:00")
        );
    }

    #[test]
    fn daily_uses_tomorrow_when_time_has_passed() {
        let schedule = AutomationSchedule::Daily {
            time: "08:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 08:00:00")).unwrap(),
            dt("2026-05-31 08:00:00")
        );
    }

    #[test]
    fn weekdays_skips_weekend() {
        let schedule = AutomationSchedule::Weekdays {
            time: "09:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 10:00:00")).unwrap(),
            dt("2026-06-01 09:00:00")
        );
    }

    #[test]
    fn weekly_uses_requested_weekday() {
        let schedule = AutomationSchedule::Weekly {
            weekday: 5,
            time: "17:30".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-05-30 10:00:00")).unwrap(),
            dt("2026-06-05 17:30:00")
        );
    }

    #[test]
    fn monthly_skips_month_without_day() {
        let schedule = AutomationSchedule::Monthly {
            day: 31,
            time: "09:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };
        assert_eq!(
            next_run_after(&schedule, dt("2026-06-01 00:00:00")).unwrap(),
            dt("2026-07-31 09:00:00")
        );
    }
}
