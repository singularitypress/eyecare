
#[cfg(target_os = "windows")]
use window_vibrancy::apply_acrylic;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            
            // By wrapping this in a block, the window variable is 
            // only instantiated when building for Windows.
            #[cfg(target_os = "windows")]
            {
                let window = app.get_webview_window("main").unwrap();
                apply_acrylic(&window, Some((18, 18, 18, 180)))
                    .expect("Failed to apply Windows acrylic effect");
            }

            // If you eventually add macOS vibrancy, you can add another block here:
            // #[cfg(target_os = "macos")]
            // {
            //     let window = app.get_webview_window("main").unwrap();
            //     window_vibrancy::apply_vibrancy(&window, window_vibrancy::NSVisualEffectMaterial::HudWindow, None, None)
            //         .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
            // }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}