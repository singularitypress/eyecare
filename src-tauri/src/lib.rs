use tauri::Manager;

#[cfg(target_os = "windows")]
use window_vibrancy::apply_acrylic;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            apply_acrylic(&window, Some((18, 18, 18, 180)))
                .expect("Failed to apply Windows acrylic effect");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
