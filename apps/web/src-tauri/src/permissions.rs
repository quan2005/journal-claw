use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PermStatus {
    Granted,
    Denied,
    NotDetermined,
    Restricted,
    Unknown,
}

impl PermStatus {
    fn from_speech(n: i64) -> Self {
        // SFSpeechRecognizerAuthorizationStatus: 0=notDetermined, 1=denied, 2=restricted, 3=authorized
        match n {
            0 => Self::NotDetermined,
            1 => Self::Denied,
            2 => Self::Restricted,
            3 => Self::Granted,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppPermissions {
    pub speech_recognition: PermStatus,
}

// ---------------------------------------------------------------------------
// macOS ObjC FFI helpers – read-only TCC status queries, never show a dialog.
// ---------------------------------------------------------------------------
#[cfg(target_os = "macos")]
pub mod macos {
    use std::ffi::CString;
    use std::os::raw::{c_char, c_void};

    #[link(name = "objc", kind = "dylib")]
    #[link(name = "Speech", kind = "framework")]
    #[allow(clippy::duplicated_attributes)]
    extern "C" {
        fn objc_getClass(name: *const c_char) -> *mut c_void;
        fn sel_registerName(name: *const c_char) -> *mut c_void;
        fn objc_msgSend(receiver: *mut c_void, sel: *mut c_void, ...) -> *mut c_void;
    }

    /// Class method: `[ClassName selector]` → NSInteger  (no extra args)
    pub unsafe fn cls_msg_no_arg(class: &str, sel: &str) -> Option<i64> {
        let cls_name = CString::new(class).ok()?;
        let cls = objc_getClass(cls_name.as_ptr());
        if cls.is_null() {
            eprintln!("[permissions] objc_getClass({}) returned null", class);
            return None;
        }
        let sel_name = CString::new(sel).ok()?;
        let the_sel = sel_registerName(sel_name.as_ptr());
        type CallFn = unsafe extern "C" fn(*mut c_void, *mut c_void) -> i64;
        let call: CallFn = std::mem::transmute(objc_msgSend as *const ());
        Some(call(cls, the_sel))
    }

    pub fn speech_recognition_status() -> super::PermStatus {
        match unsafe { cls_msg_no_arg("SFSpeechRecognizer", "authorizationStatus") } {
            Some(n) => super::PermStatus::from_speech(n),
            None => {
                eprintln!(
                    "[permissions] failed to query speech recognition permission via ObjC FFI"
                );
                super::PermStatus::Unknown
            }
        }
    }
}

// ---------------------------------------------------------------------------

#[tauri::command]
pub fn check_app_permissions() -> Result<AppPermissions, String> {
    #[cfg(target_os = "macos")]
    let speech_recognition = macos::speech_recognition_status();

    #[cfg(not(target_os = "macos"))]
    let speech_recognition = PermStatus::Unknown;

    Ok(AppPermissions { speech_recognition })
}

// ---------------------------------------------------------------------------
// macOS ObjC FFI – compiled from permissions_ffi.m via cc crate
// ---------------------------------------------------------------------------
#[cfg(target_os = "macos")]
extern "C" {
    /// Returns SFSpeechRecognizerAuthorizationStatus: 0=notDetermined, 1=denied, 2=restricted, 3=authorized
    fn request_speech_recognition_access() -> i32;
}

/// Request a system permission (triggers the authorization dialog for `not_determined` status).
#[tauri::command]
pub fn request_permission(perm: String) -> Result<PermStatus, String> {
    match perm.as_str() {
        "speech_recognition" => {
            #[cfg(target_os = "macos")]
            {
                let n = unsafe { request_speech_recognition_access() } as i64;
                Ok(PermStatus::from_speech(n))
            }
            #[cfg(not(target_os = "macos"))]
            {
                Ok(PermStatus::Unknown)
            }
        }
        _ => Err(format!("unknown permission: {}", perm)),
    }
}

/// Open the appropriate System Settings privacy pane.
#[tauri::command]
pub fn open_privacy_settings(pane: String) -> Result<(), String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = pane;
        return Err("系统隐私设置跳转仅支持 macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let url = match pane.as_str() {
            "speech_recognition" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition"
            }
            _ => return Err(format!("unknown privacy pane: {}", pane)),
        };
        let status = std::process::Command::new("open")
            .arg(url)
            .status()
            .map_err(|e| format!("failed to open privacy settings: {}", e))?;
        if !status.success() {
            return Err(format!(
                "`open {}` exited with code {}",
                url,
                status.code().unwrap_or(-1)
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_speech_mapping() {
        assert_eq!(PermStatus::from_speech(0), PermStatus::NotDetermined);
        assert_eq!(PermStatus::from_speech(1), PermStatus::Denied);
        assert_eq!(PermStatus::from_speech(2), PermStatus::Restricted);
        assert_eq!(PermStatus::from_speech(3), PermStatus::Granted);
        assert_eq!(PermStatus::from_speech(99), PermStatus::Unknown);
    }

    #[test]
    fn perm_status_serde_snake_case() {
        let statuses = vec![
            PermStatus::Granted,
            PermStatus::Denied,
            PermStatus::NotDetermined,
            PermStatus::Restricted,
            PermStatus::Unknown,
        ];
        let json = serde_json::to_string(&statuses).unwrap();
        assert!(json.contains("\"granted\""));
        assert!(json.contains("\"denied\""));
        assert!(json.contains("\"not_determined\""));
        assert!(json.contains("\"restricted\""));
        assert!(json.contains("\"unknown\""));

        let roundtrip: Vec<PermStatus> = serde_json::from_str(&json).unwrap();
        assert_eq!(roundtrip, statuses);
    }

    #[test]
    fn app_permissions_serde_roundtrip() {
        let perms = AppPermissions {
            speech_recognition: PermStatus::NotDetermined,
        };
        let json = serde_json::to_string(&perms).unwrap();
        let parsed: AppPermissions = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.speech_recognition, PermStatus::NotDetermined);
    }

    #[test]
    fn app_permissions_null_fields() {
        let perms = AppPermissions {
            speech_recognition: PermStatus::Unknown,
        };
        let json = serde_json::to_string(&perms).unwrap();
        let parsed: AppPermissions = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.speech_recognition, PermStatus::Unknown);
    }
}
