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
            return None;
        }

        // Build NSString for the argument
        let ns_cls_name = CString::new("NSString").ok()?;
        let ns_cls = objc_getClass(ns_cls_name.as_ptr());
        if ns_cls.is_null() {
            return None;
        }
        let make_sel_name = CString::new("stringWithUTF8String:").ok()?;
        let make_sel = sel_registerName(make_sel_name.as_ptr());
        let arg_cstr = CString::new(arg).ok()?;
        type MakeFn = unsafe extern "C" fn(*mut c_void, *mut c_void, *const c_char) -> *mut c_void;
        let make_fn: MakeFn = std::mem::transmute(objc_msgSend as *const ());
        let ns_arg = make_fn(ns_cls, make_sel, arg_cstr.as_ptr());
        if ns_arg.is_null() {
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
            None => super::PermStatus::Unknown,
        }
    }

    pub fn speech_recognition_status() -> super::PermStatus {
        match unsafe { cls_msg_no_arg("SFSpeechRecognizer", "authorizationStatus") } {
            Some(n) => super::PermStatus::from_speech(n),
            None => super::PermStatus::Unknown,
        }
    }
}

// ---------------------------------------------------------------------------

fn find_claude_cli() -> Option<String> {
    let output = Command::new("which").arg("claude").output().ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() { None } else { Some(path) }
    } else {
        None
    }
}

#[tauri::command]
pub async fn check_app_permissions() -> Result<AppPermissions, String> {
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

/// Open the appropriate System Settings privacy pane.
#[tauri::command]
pub async fn open_privacy_settings(pane: String) -> Result<(), String> {
    let url = match pane.as_str() {
        "microphone" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
        "speech_recognition" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition"
        }
        _ => "x-apple.systempreferences:com.apple.preference.security",
    };
    Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
