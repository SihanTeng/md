/**
 * Central registry of app-level keyboard shortcuts.
 *
 * One source of truth consumed by the global keydown dispatcher (App.tsx),
 * the in-window MenuBar accelerators, toolbar tooltips, and the
 * ShortcutsOverlay (hints + rebind + reset). Editing commands owned by the
 * editor/webview itself (undo, cut/copy/paste, select all) are not here.
 */
import { isMac } from './platform';

export interface CommandSpec {
  /** Command id, as dispatched by handleMenuCommand in App.tsx. */
  commandId: string;
  label: string;
  section: 'File' | 'Edit' | 'View' | 'App';
  /** Normalized combo: modifiers in Ctrl/Alt/Shift order, then the key. */
  defaultCombo: string;
}

export const COMMANDS: CommandSpec[] = [
  { commandId: 'file_new', label: 'New', section: 'File', defaultCombo: 'Ctrl+N' },
  { commandId: 'file_open', label: 'Open…', section: 'File', defaultCombo: 'Ctrl+O' },
  { commandId: 'file_save', label: 'Save', section: 'File', defaultCombo: 'Ctrl+S' },
  { commandId: 'file_save_as', label: 'Save As…', section: 'File', defaultCombo: 'Ctrl+Shift+S' },
  { commandId: 'edit_find', label: 'Find…', section: 'Edit', defaultCombo: 'Ctrl+F' },
  { commandId: 'view_present', label: 'Present', section: 'View', defaultCombo: 'Ctrl+Shift+P' },
  {
    commandId: 'app_shortcuts',
    label: 'Keyboard Shortcuts',
    section: 'App',
    defaultCombo: 'Ctrl+/',
  },
];

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

/**
 * Normalize a keyboard event into a combo string like 'Ctrl+Shift+S'.
 * Cmd (metaKey) folds into Ctrl, matching the old CmdOrCtrl accelerators.
 * Returns null for bare modifier presses.
 */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join('+');
}

/** Rebinds require Ctrl or Alt so plain typing can't be swallowed. */
export function hasModifier(combo: string): boolean {
  return combo.startsWith('Ctrl+') || combo.startsWith('Alt+');
}

/** Display form: ⌘⌥⇧ glyphs on macOS, the stored 'Ctrl+…' form elsewhere. */
export function formatCombo(combo: string): string {
  if (!isMac) return combo;
  return combo.replace('Ctrl+', '⌘').replace('Alt+', '⌥').replace('Shift+', '⇧');
}
