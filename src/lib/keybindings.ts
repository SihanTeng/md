/**
 * Central catalog of app-level commands: one definition per action.
 *
 * Everything else is a view of this list — the global keydown dispatcher
 * (App.tsx), the in-window MenuBar items and accelerators, toolbar tooltips,
 * and the ShortcutsOverlay (hints + rebind + reset) all render from it, and
 * handleMenuCommand in App.tsx owns execution. Editing commands owned by the
 * editor/webview itself (undo, cut/copy/paste, select all) are not here.
 *
 * Rule: every command id dispatched anywhere (handleMenuCommand, MenuBar /
 * Toolbar onCommand, the native macOS menu in src-tauri/src/lib.rs) must be
 * listed here — keybindings.test.ts enforces the sync, so a new feature
 * ships with a catalog entry or the tests go red.
 */
import { isMac } from './platform';

export interface CommandSpec {
  /** Command id, as dispatched by handleMenuCommand in App.tsx. */
  commandId: string;
  label: string;
  section: 'File' | 'Edit' | 'View' | 'App';
  /**
   * Normalized combo: modifiers in Ctrl/Alt/Shift order, then the key.
   * null = no default shortcut; the command is menu-only until the user
   * rebinds it in the Shortcuts overlay.
   */
  defaultCombo: string | null;
}

export const COMMANDS = [
  { commandId: 'file_new', label: 'New', section: 'File', defaultCombo: 'Ctrl+N' },
  { commandId: 'file_open', label: 'Open…', section: 'File', defaultCombo: 'Ctrl+O' },
  { commandId: 'file_save', label: 'Save', section: 'File', defaultCombo: 'Ctrl+S' },
  { commandId: 'file_save_as', label: 'Save As…', section: 'File', defaultCombo: 'Ctrl+Shift+S' },
  { commandId: 'file_export_html', label: 'Export HTML…', section: 'File', defaultCombo: null },
  { commandId: 'file_export_pdf', label: 'Export PDF…', section: 'File', defaultCombo: null },
  { commandId: 'file_export_docx', label: 'Export Word…', section: 'File', defaultCombo: null },
  { commandId: 'edit_find', label: 'Find…', section: 'Edit', defaultCombo: 'Ctrl+F' },
  { commandId: 'edit_copy_html', label: 'Copy as HTML', section: 'Edit', defaultCombo: null },
  { commandId: 'view_present', label: 'Present', section: 'View', defaultCombo: 'Ctrl+Shift+P' },
  {
    commandId: 'app_shortcuts',
    label: 'Keyboard Shortcuts',
    section: 'App',
    defaultCombo: 'Ctrl+/',
  },
  {
    commandId: 'app_check_updates',
    label: 'Check for Updates…',
    section: 'App',
    defaultCombo: null,
  },
] as const satisfies readonly CommandSpec[];

/** Union of every cataloged command id — what UI surfaces may dispatch. */
export type CommandId = (typeof COMMANDS)[number]['commandId'];

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
