import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { commandForCombo, effectiveCombo, useKeybindingStore } from '../stores/keybindingStore';
import { COMMANDS, comboFromEvent, formatCombo, hasModifier } from './keybindings';

function key(init: KeyboardEventInit) {
  return new KeyboardEvent('keydown', init);
}

describe('comboFromEvent', () => {
  it('normalizes modifiers and letter keys', () => {
    expect(comboFromEvent(key({ key: 'n', ctrlKey: true }))).toBe('Ctrl+N');
    expect(comboFromEvent(key({ key: 'S', ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+S');
    expect(comboFromEvent(key({ key: '/', ctrlKey: true }))).toBe('Ctrl+/');
  });

  it('folds Cmd (metaKey) into Ctrl', () => {
    expect(comboFromEvent(key({ key: 'n', metaKey: true }))).toBe('Ctrl+N');
  });

  it('returns null for bare modifier presses', () => {
    expect(comboFromEvent(key({ key: 'Control', ctrlKey: true }))).toBeNull();
    expect(comboFromEvent(key({ key: 'Shift', shiftKey: true }))).toBeNull();
  });
});

describe('hasModifier', () => {
  it('requires Ctrl or Alt', () => {
    expect(hasModifier('Ctrl+N')).toBe(true);
    expect(hasModifier('Alt+F4')).toBe(true);
    expect(hasModifier('Shift+F')).toBe(false);
    expect(hasModifier('A')).toBe(false);
  });
});

describe('formatCombo', () => {
  it('keeps the stored form off macOS (jsdom UA)', () => {
    expect(formatCombo('Ctrl+Shift+S')).toBe('Ctrl+Shift+S');
  });
});

describe('keybindingStore', () => {
  beforeEach(() => {
    useKeybindingStore.getState().resetAll();
  });

  it('falls back to defaults when no override exists', () => {
    expect(effectiveCombo('file_new')).toBe('Ctrl+N');
    expect(commandForCombo('Ctrl+N')).toBe('file_new');
  });

  it('overrides win over defaults and persist to localStorage', () => {
    useKeybindingStore.getState().setBinding('file_new', 'Ctrl+Alt+N');
    expect(effectiveCombo('file_new')).toBe('Ctrl+Alt+N');
    expect(commandForCombo('Ctrl+Alt+N')).toBe('file_new');
    expect(commandForCombo('Ctrl+N')).toBeNull();
    expect(JSON.parse(localStorage.getItem('md-keybindings') ?? '{}')).toEqual({
      file_new: 'Ctrl+Alt+N',
    });
  });

  it('resetBinding restores the default, resetAll restores everything', () => {
    const store = useKeybindingStore.getState();
    store.setBinding('file_new', 'Ctrl+Alt+N');
    store.setBinding('file_save', 'Ctrl+Alt+S');
    useKeybindingStore.getState().resetBinding('file_new');
    expect(effectiveCombo('file_new')).toBe('Ctrl+N');
    expect(effectiveCombo('file_save')).toBe('Ctrl+Alt+S');
    useKeybindingStore.getState().resetAll();
    expect(effectiveCombo('file_save')).toBe('Ctrl+S');
    expect(localStorage.getItem('md-keybindings')).toBeNull();
  });

  it('every default combo is unique and dispatchable', () => {
    const combos = COMMANDS.map((c) => c.defaultCombo).filter((c) => c !== null);
    expect(new Set(combos).size).toBe(combos.length);
    for (const c of COMMANDS) {
      if (c.defaultCombo) expect(commandForCombo(c.defaultCombo)).toBe(c.commandId);
    }
  });

  it('commands without a default combo are unbound until rebound, then unbound again on reset', () => {
    expect(effectiveCombo('file_export_pdf')).toBeNull();
    expect(commandForCombo('Ctrl+Alt+P')).toBeNull();
    useKeybindingStore.getState().setBinding('file_export_pdf', 'Ctrl+Alt+P');
    expect(effectiveCombo('file_export_pdf')).toBe('Ctrl+Alt+P');
    expect(commandForCombo('Ctrl+Alt+P')).toBe('file_export_pdf');
    useKeybindingStore.getState().resetBinding('file_export_pdf');
    expect(effectiveCombo('file_export_pdf')).toBeNull();
    expect(commandForCombo('Ctrl+Alt+P')).toBeNull();
  });
});

// The catalog is the single source of truth for app commands. These guards
// keep the surfaces that dispatch command ids — the App.tsx switch, the
// in-window MenuBar/Toolbar, and the native macOS menu in Rust — from
// drifting away from it (or from each other).
describe('command catalog coverage', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
  const catalogIds = new Set<string>(COMMANDS.map((c) => c.commandId));

  it('every id handled by handleMenuCommand (App.tsx) is in the catalog', () => {
    // Command ids follow the `<section>_<action>` convention; the prefix
    // keeps this guard from tripping on unrelated switch cases in App.tsx.
    const dispatched = [
      ...read('src/App.tsx').matchAll(/case '((?:file|edit|view|app)_[a-z_]+)':/g),
    ].map((m) => m[1]);
    expect(dispatched.length).toBeGreaterThan(0);
    for (const id of dispatched) {
      expect(catalogIds.has(id), `'${id}' is dispatched but missing from COMMANDS`).toBe(true);
    }
  });

  it('every command id dispatched by MenuBar/Toolbar is in the catalog', () => {
    for (const file of ['src/components/MenuBar.tsx', 'src/components/Toolbar.tsx']) {
      const dispatched = [...read(file).matchAll(/(?:onCommand|item)\('([a-z_]+)'\)/g)].map(
        (m) => m[1],
      );
      expect(dispatched.length).toBeGreaterThan(0);
      for (const id of dispatched) {
        expect(catalogIds.has(id), `'${id}' in ${file} is missing from COMMANDS`).toBe(true);
      }
    }
  });

  it('native macOS menu items (Rust) match catalog ids and labels', () => {
    const items = [
      ...read('src-tauri/src/lib.rs').matchAll(
        /MenuItem::with_id\(\s*app,\s*"([a-z_]+)",\s*"([^"]+)"/g,
      ),
    ].map((m) => ({ id: m[1], label: m[2] }));
    expect(items.length).toBeGreaterThan(0);
    for (const { id, label } of items) {
      const spec = COMMANDS.find((c) => c.commandId === id);
      expect(spec, `Rust menu item '${id}' is missing from COMMANDS`).toBeDefined();
      expect(spec?.label, `Rust menu label for '${id}' drifted from the catalog`).toBe(label);
    }
  });
});
