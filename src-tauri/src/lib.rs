use tauri::Manager;

/// Minimal desktop shell around the YT Advertisements web client.
///
/// The shell registers the plugin-updater so remote auto-updates work both in
/// development and production without touching the Next.js application logic.
#[tauri::command]
fn play_notification_sound(app: tauri::AppHandle) -> Result<(), String> {
    use rodio::{Decoder, OutputStream, Sink};
    use std::fs::File;
    use std::io::BufReader;

    let sound_path = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Unable to resolve Tauri resource directory: {error}"))?
        .join("notification.wav");
    let file = File::open(&sound_path)
        .map_err(|error| format!("Unable to open notification sound at {}: {error}", sound_path.display()))?;
    let source = Decoder::new(BufReader::new(file))
        .map_err(|error| format!("Unable to decode notification sound: {error}"))?;
    let (_stream, stream_handle) = OutputStream::try_default()
        .map_err(|error| format!("Unable to open the system audio output: {error}"))?;
    let sink = Sink::try_new(&stream_handle)
        .map_err(|error| format!("Unable to create the notification audio sink: {error}"))?;
    sink.append(source);
    sink.sleep_until_end();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![play_notification_sound])
        .run(tauri::generate_context!())
        .expect("error while running the YT Advertisements desktop shell");
}
