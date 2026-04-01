fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/permissions_ffi.m")
            .flag("-fobjc-arc")
            .compile("permissions_ffi");
        println!("cargo:rustc-link-lib=framework=AVFoundation");
        println!("cargo:rustc-link-lib=framework=Speech");
    }
    tauri_build::build()
}
