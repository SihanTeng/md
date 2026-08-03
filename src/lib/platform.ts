import { isTauri } from '@tauri-apps/api/core';

/**
 * On Linux/Windows the Rust side removes native window decorations (see
 * src-tauri/src/lib.rs) and the frontend draws its own menu bar + window
 * controls instead (see src/components/MenuBar.tsx). macOS keeps the
 * native traffic lights and the native menu bar.
 */
export const customChrome =
  isTauri() && (navigator.userAgent.includes('Linux') || navigator.userAgent.includes('Windows'));
