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
    const combos = COMMANDS.map((c) => c.defaultCombo);
    expect(new Set(combos).size).toBe(combos.length);
    for (const c of COMMANDS) expect(commandForCombo(c.defaultCombo)).toBe(c.commandId);
  });
});
