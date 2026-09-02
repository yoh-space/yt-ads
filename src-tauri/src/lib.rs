#[cfg_attr(mobile, tauri::mobile_entry_point)]

/// Minimal desktop shell around the YT Advertisements web client.
///
/// The shell registers the plugin-updater so remote auto-updates work both in
/// development and production without touching the Next.js application logic.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running the YT Advertisements desktop shell");
}
