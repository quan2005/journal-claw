use serde::{Deserialize, Serialize};
use std::process::Command;

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
    fn from_av(n: i64) -> Self {
        // AVAuthorizationStatus: 0=notDetermined, 1=restricted, 2=denied, 3=authorized
        match n {
            0 => Self::NotDetermined,
            1 => Self::Restricted,
            2 => Self::Denied,
            3 => Self::Granted,
            _ => Self::Unknown,
        }
    }

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
    pub microphone: PermStatus,
    pub speech_recognition: PermStatus,
    pub claude_cli_path: Option<String>,
}

// ---------------------------------------------------------------------------
// macOS ObjC FFI helpers – read-only TCC status queries, never show a dialog.
// ---------------------------------------------------------------------------
#[cfg(target_os = "macos")]
mod macos {
    use std::ffi::CString;
    use std::os::raw::{c_char, c_void};

    #[link(name = "objc", kind = "dylib")]
    #[link(name = "AVFoundation", kind = "framework")]
    #[link(name = "Speech", kind = "framework")]
    extern "C" {
        fn objc_getClass(name: *const c_char) -> *mut c_void;
        fn sel_registerName(name: *const c_char) -> *mut c_void;
        fn objc_msgSend(receiver: *mut c_void, sel: *mut c_void, ...) -> *mut c_void;
    }

    /// Class method: `[ClassName selector: nsStringArg]` → NSInteger
    pub unsafe fn cls_msg_nsstr_arg(class: &str, sel: &str, arg: &str) -> Option<i64> {
        let cls_name = CString::new(class).ok()?;
        let cls = objc_getClass(cls_name.as_ptr());
        if cls.is_null() {
            eprintln!("[permissions] objc_getClass({}) returned null", class);
            return None;
        }

        // Build NSString for the argument
        let ns_cls_name = CString::new("NSString").ok()?;
        let ns_cls = objc_getClass(ns_cls_name.as_ptr());
        if ns_cls.is_null() {
            eprintln!("[permissions] objc_getClass(NSString) returned null");
            return None;
        }
        let make_sel_name = CString::new("stringWithUTF8String:").ok()?;
        let make_sel = sel_registerName(make_sel_name.as_ptr());
        let arg_cstr = CString::new(arg).ok()?;
        type MakeFn = unsafe extern "C" fn(*mut c_void, *mut c_void, *const c_char) -> *mut c_void;
        let make_fn: MakeFn = std::mem::transmute(objc_msgSend as *const ());
        let ns_arg = make_fn(ns_cls, make_sel, arg_cstr.as_ptr());
        if ns_arg.is_null() {
            eprintln!("[permissions] NSString stringWithUTF8String returned null for arg '{}'", arg);
            return None;
        }

        // Call the actual selector
        let sel_name = CString::new(sel).ok()?;
        let the_sel = sel_registerName(sel_name.as_ptr());
        type CallFn = unsafe extern "C" fn(*mut c_void, *mut c_void, *mut c_void) -> i64;
        let call: CallFn = std::mem::transmute(objc_msgSend as *const ());
        Some(call(cls, the_sel, ns_arg))
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

    pub fn microphone_status() -> super::PermStatus {
        // AVMediaTypeAudio = "soun"
        match unsafe { cls_msg_nsstr_arg("AVCaptureDevice", "authorizationStatusForMediaType:", "soun") } {
            Some(n) => super::PermStatus::from_av(n),
            None => {
                eprintln!("[permissions] failed to query microphone permission via ObjC FFI");
                super::PermStatus::Unknown
            }
        }
    }

    pub fn speech_recognition_status() -> super::PermStatus {
        match unsafe { cls_msg_no_arg("SFSpeechRecognizer", "authorizationStatus") } {
            Some(n) => super::PermStatus::from_speech(n),
            None => {
                eprintln!("[permissions] failed to query speech recognition permission via ObjC FFI");
                super::PermStatus::Unknown
            }
        }
    }
}

// ---------------------------------------------------------------------------

fn find_claude_cli() -> Option<String> {
    let output = Command::new("/usr/bin/which")
        .arg("claude")
        .env("PATH", crate::config::augmented_path())
        .output();
    match output {
        Ok(out) if out.status.success() => {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if path.is_empty() { None } else { Some(path) }
        }
        Ok(_) => None,
        Err(e) => {
            eprintln!("[permissions] failed to run `which claude`: {}", e);
            None
        }
    }
}

#[tauri::command]
pub fn check_app_permissions() -> Result<AppPermissions, String> {
    #[cfg(target_os = "macos")]
    let (microphone, speech_recognition) = (
        macos::microphone_status(),
        macos::speech_recognition_status(),
    );

    #[cfg(not(target_os = "macos"))]
    let (microphone, speech_recognition) = (PermStatus::Unknown, PermStatus::Unknown);

    Ok(AppPermissions {
        microphone,
        speech_recognition,
        claude_cli_path: find_claude_cli(),
    })
}

// ---------------------------------------------------------------------------
// macOS ObjC FFI – compiled from permissions_ffi.m via cc crate
// ---------------------------------------------------------------------------
#[cfg(target_os = "macos")]
extern "C" {
    /// Returns AVAuthorizationStatus: 0=notDetermined, 1=restricted, 2=denied, 3=authorized
    fn request_microphone_access() -> i32;
    /// Returns SFSpeechRecognizerAuthorizationStatus: 0=notDetermined, 1=denied, 2=restricted, 3=authorized
    fn request_speech_recognition_access() -> i32;
}

/// Request a system permission (triggers the authorization dialog for `not_determined` status).
#[tauri::command]
pub fn request_permission(perm: String) -> Result<PermStatus, String> {
    match perm.as_str() {
        "microphone" => {
            #[cfg(target_os = "macos")]
            {
                let n = unsafe { request_microphone_access() } as i64;
                Ok(PermStatus::from_av(n))
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = perm;
                Ok(PermStatus::Unknown)
            }
        }
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
    let url = match pane.as_str() {
        "microphone" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
        "speech_recognition" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition"
        }
        _ => return Err(format!("unknown privacy pane: {}", pane)),
    };
    let status = Command::new("open")
        .arg(url)
        .status()
        .map_err(|e| format!("failed to open privacy settings: {}", e))?;
    if !status.success() {
        return Err(format!("`open {}` exited with code {}", url, status.code().unwrap_or(-1)));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_av_mapping() {
        assert_eq!(PermStatus::from_av(0), PermStatus::NotDetermined);
        assert_eq!(PermStatus::from_av(1), PermStatus::Restricted);
        assert_eq!(PermStatus::from_av(2), PermStatus::Denied);
        assert_eq!(PermStatus::from_av(3), PermStatus::Granted);
        assert_eq!(PermStatus::from_av(99), PermStatus::Unknown);
    }

    #[test]
    fn from_speech_mapping() {
        // Note: Speech framework swaps 1↔2 vs AVFoundation
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
            microphone: PermStatus::Granted,
            speech_recognition: PermStatus::NotDetermined,
            claude_cli_path: Some("/usr/local/bin/claude".to_string()),
        };
        let json = serde_json::to_string(&perms).unwrap();
        let parsed: AppPermissions = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.microphone, PermStatus::Granted);
        assert_eq!(parsed.speech_recognition, PermStatus::NotDetermined);
        assert_eq!(parsed.claude_cli_path, Some("/usr/local/bin/claude".to_string()));
    }

    #[test]
    fn app_permissions_null_cli_path() {
        let perms = AppPermissions {
            microphone: PermStatus::Unknown,
            speech_recognition: PermStatus::Unknown,
            claude_cli_path: None,
        };
        let json = serde_json::to_string(&perms).unwrap();
        assert!(json.contains("\"claude_cli_path\":null"));
        let parsed: AppPermissions = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.claude_cli_path, None);
    }
}
