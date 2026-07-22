use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

const RECENT_MAX: usize = 12;
const RECENT_FILE: &str = "recent.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    pub path: String,
    pub name: String,
}

fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| e.to_string())
}

fn recent_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = config_dir(app)?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir.join(RECENT_FILE))
}

fn file_name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string()
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
        }
    }
    // Write via temp + rename when possible for safer saves
    let tmp = format!("{path}.tmp");
    fs::write(&tmp, contents.as_bytes()).map_err(|e| format!("Failed to write file: {e}"))?;
    match fs::rename(&tmp, &path) {
        Ok(()) => Ok(()),
        Err(_) => {
            let _ = fs::remove_file(&tmp);
            fs::write(&path, contents.as_bytes())
                .map_err(|e| format!("Failed to save file: {e}"))
        }
    }
}

#[tauri::command]
fn list_recent(app: tauri::AppHandle) -> Result<Vec<RecentFile>, String> {
    let path = recent_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let list: Vec<RecentFile> = serde_json::from_str(&raw).unwrap_or_default();
    Ok(list)
}

#[tauri::command]
fn push_recent(app: tauri::AppHandle, path: String) -> Result<Vec<RecentFile>, String> {
    let mut list = list_recent(app.clone())?;
    list.retain(|f| f.path != path);
    list.insert(
        0,
        RecentFile {
            name: file_name_from_path(&path),
            path: path.clone(),
        },
    );
    list.truncate(RECENT_MAX);
    let dest = recent_path(&app)?;
    let raw = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    fs::write(dest, raw).map_err(|e| e.to_string())?;
    Ok(list)
}

#[tauri::command]
fn clear_recent(app: tauri::AppHandle) -> Result<(), String> {
    let dest = recent_path(&app)?;
    if dest.exists() {
        fs::write(dest, "[]").map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let new = MenuItem::with_id(app, "file_new", "New", true, Some("CmdOrCtrl+N"))?;
    let open = MenuItem::with_id(app, "file_open", "Open…", true, Some("CmdOrCtrl+O"))?;
    let save = MenuItem::with_id(app, "file_save", "Save", true, Some("CmdOrCtrl+S"))?;
    let save_as =
        MenuItem::with_id(app, "file_save_as", "Save As…", true, Some("CmdOrCtrl+Shift+S"))?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit"))?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&new, &open, &sep, &save, &save_as, &sep, &quit],
    )?;

    let present =
        MenuItem::with_id(app, "view_present", "Present", true, Some("CmdOrCtrl+Shift+P"))?;
    let view_menu = Submenu::with_items(app, "View", true, &[&present])?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            list_recent,
            push_recent,
            clear_recent
        ])
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;

            let handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                let id = event.id().as_ref();
                let _ = handle.emit("menu", id);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
