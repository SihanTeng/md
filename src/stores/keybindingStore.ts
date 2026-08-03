import { create } from 'zustand';
import { COMMANDS } from '../lib/keybindings';

const STORAGE_KEY = 'md-keybindings';

interface KeybindingState {
  /** commandId -> combo; commands missing here use their defaultCombo. */
  overrides: Record<string, string>;
  setBinding: (commandId: string, combo: string) => void;
  resetBinding: (commandId: string) => void;
  resetAll: () => void;
}

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const valid = new Set<string>(COMMANDS.map((c) => c.commandId));
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([id, combo]) => valid.has(id) && typeof combo === 'string',
      ),
    ) as Record<string, string>;
  } catch {
    return {}; // corrupted storage — start clean
  }
}

function persist(overrides: Record<string, string>) {
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }
}

export const useKeybindingStore = create<KeybindingState>((set) => ({
  overrides: loadOverrides(),
  setBinding: (commandId, combo) =>
    set((s) => {
      const overrides = { ...s.overrides, [commandId]: combo };
      persist(overrides);
      return { overrides };
    }),
  resetBinding: (commandId) =>
    set((s) => {
      const overrides = { ...s.overrides };
      delete overrides[commandId];
      persist(overrides);
      return { overrides };
    }),
  resetAll: () =>
    set(() => {
      persist({});
      return { overrides: {} };
    }),
}));

/** Effective combo for a command: override if present, else the default. */
export function effectiveCombo(
  commandId: string,
  overrides = useKeybindingStore.getState().overrides,
): string | null {
  if (commandId in overrides) return overrides[commandId];
  return COMMANDS.find((c) => c.commandId === commandId)?.defaultCombo ?? null;
}

/** The command currently bound to a combo, or null. */
export function commandForCombo(
  combo: string,
  overrides = useKeybindingStore.getState().overrides,
): string | null {
  for (const c of COMMANDS) {
    if (effectiveCombo(c.commandId, overrides) === combo) return c.commandId;
  }
  return null;
}
