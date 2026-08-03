import { getCurrentWindow, type Window } from '@tauri-apps/api/window';
import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { customChrome } from '../lib/platform';

const BAR_HEIGHT = 32;

// Mirrors the (unexported) ResizeDirection parameter of startResizeDragging
type ResizeDirection =
  | 'East'
  | 'North'
  | 'NorthEast'
  | 'NorthWest'
  | 'South'
  | 'SouthEast'
  | 'SouthWest'
  | 'West';

type MenuEntry =
  | {
      kind: 'item';
      label: string;
      shortcut?: string;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { kind: 'separator' };

interface MenuSection {
  id: string;
  label: string;
  entries: MenuEntry[];
}

interface MenuBarProps {
  editor: Editor | null;
  /** Dispatches the same command ids the native (macOS) menu emits. */
  onCommand: (id: string) => void;
}

export function MenuBar(props: MenuBarProps) {
  if (!customChrome) return null;
  return <MenuBarImpl {...props} />;
}

function MenuBarImpl({ editor, onCommand }: MenuBarProps) {
  const [appWindow] = useState(() => getCurrentWindow());
  const [maximized, setMaximized] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void appWindow.isMaximized().then(setMaximized);
    const unlisten = appWindow.onResized(() => {
      void appWindow.isMaximized().then(setMaximized);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  // Close the open menu on outside click or Escape
  useEffect(() => {
    if (!openId) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menubar]')) setOpenId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openId]);

  const sections = buildSections(editor, onCommand, appWindow);

  // Drag the window from the bar's empty areas; double-click maximizes.
  const onBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    if (e.detail === 2) {
      void appWindow.toggleMaximize();
      return;
    }
    void appWindow.startDragging();
  };

  const openIndex = sections.findIndex((s) => s.id === openId);
  const stepSection = (delta: number) => {
    const next = (openIndex + delta + sections.length) % sections.length;
    setOpenId(sections[next].id);
  };

  return (
    <>
      <ResizeHandles appWindow={appWindow} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: window drag region — interactive children are excluded via data-no-drag, double-click maximizes */}
      <div
        data-menubar
        onMouseDown={onBarMouseDown}
        className="fixed top-0 right-0 left-0 z-40 flex select-none print:hidden"
        style={{
          height: BAR_HEIGHT,
          background: 'var(--color-toolbar)',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <div className="flex h-full items-center" data-no-drag>
          {sections.map((section) => (
            <MenuDropdown
              key={section.id}
              section={section}
              open={openId === section.id}
              anyOpen={openId !== null}
              onOpen={() => setOpenId(section.id)}
              onClose={() => setOpenId(null)}
              onStep={stepSection}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1" />
        <WindowControls appWindow={appWindow} maximized={maximized} />
      </div>
    </>
  );
}

function MenuDropdown({
  section,
  open,
  anyOpen,
  onOpen,
  onClose,
  onStep,
}: {
  section: MenuSection;
  open: boolean;
  anyOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open]);

  const itemButtons = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const items = itemButtons();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onStep(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onStep(-1);
    }
  };

  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        onMouseEnter={() => {
          if (anyOpen && !open) onOpen();
        }}
        className={`h-full px-3 text-[13px] ${
          open
            ? 'bg-[var(--color-active)] text-[var(--color-ink)]'
            : 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]'
        }`}
      >
        {section.label}
      </button>
      {open ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: keydown bubbles up from the focused item buttons it navigates between
        <div
          ref={listRef}
          onKeyDown={onListKeyDown}
          className="absolute top-full left-0 min-w-[220px] rounded-[var(--radius-md)] border border-[var(--color-hairline)] py-1"
          style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-popover)' }}
        >
          {section.entries.map((entry, i) =>
            entry.kind === 'separator' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: separators have no stable id
              <div key={i} className="mx-2 my-1 h-px bg-[var(--color-hairline)]" />
            ) : (
              <button
                key={entry.label}
                type="button"
                disabled={entry.disabled}
                onClick={() => {
                  onClose();
                  entry.onSelect();
                }}
                className="flex w-full items-center justify-between gap-8 px-3 py-1 text-left text-[13px] text-[var(--color-ink)] hover:bg-[var(--color-accent)] hover:text-white focus:bg-[var(--color-accent)] focus:text-white focus:outline-none disabled:opacity-40"
              >
                <span>{entry.label}</span>
                {entry.shortcut ? (
                  <span className="text-xs opacity-60">{entry.shortcut}</span>
                ) : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function WindowControls({ appWindow, maximized }: { appWindow: Window; maximized: boolean }) {
  const btn =
    'flex h-full w-[46px] items-center justify-center text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]';
  return (
    <div className="flex h-full items-center" data-no-drag>
      <button
        type="button"
        title="Minimize"
        className={btn}
        onClick={() => void appWindow.minimize()}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          stroke="currentColor"
          strokeWidth="1"
          aria-hidden="true"
        >
          <path d="M1.5 5h7" />
        </svg>
      </button>
      <button
        type="button"
        title={maximized ? 'Restore' : 'Maximize'}
        className={btn}
        onClick={() => void appWindow.toggleMaximize()}
      >
        {maximized ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            aria-hidden="true"
          >
            <rect x="0.5" y="3" width="6.5" height="6.5" />
            <path d="M3 3V0.5h6.5V7H7" />
          </svg>
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="8" height="8" />
          </svg>
        )}
      </button>
      <button
        type="button"
        title="Close"
        className="flex h-full w-[46px] items-center justify-center text-[var(--color-ink-secondary)] hover:bg-[var(--color-danger)] hover:text-white"
        onClick={() => void appWindow.close()}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          stroke="currentColor"
          strokeWidth="1"
          aria-hidden="true"
        >
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </button>
    </div>
  );
}

/** Invisible 6px edge/corner strips — decorations are off, so resizing is manual. */
function ResizeHandles({ appWindow }: { appWindow: Window }) {
  const handles: Array<{ dir: ResizeDirection; className: string }> = [
    { dir: 'North', className: 'top-0 right-1.5 left-1.5 h-1.5 cursor-n-resize' },
    { dir: 'South', className: 'right-1.5 bottom-0 left-1.5 h-1.5 cursor-s-resize' },
    { dir: 'East', className: 'top-1.5 right-0 bottom-1.5 w-1.5 cursor-e-resize' },
    { dir: 'West', className: 'top-1.5 bottom-0 left-0 w-1.5 cursor-w-resize' },
    { dir: 'NorthEast', className: 'top-0 right-0 h-1.5 w-1.5 cursor-ne-resize' },
    { dir: 'NorthWest', className: 'top-0 left-0 h-1.5 w-1.5 cursor-nw-resize' },
    { dir: 'SouthEast', className: 'right-0 bottom-0 h-1.5 w-1.5 cursor-se-resize' },
    { dir: 'SouthWest', className: 'bottom-0 left-0 h-1.5 w-1.5 cursor-sw-resize' },
  ];
  return (
    <>
      {handles.map((h) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: window-resize strip — mouse-only by nature, keyboard users have the OS window manager
        <div
          key={h.dir}
          className={`fixed z-30 print:hidden ${h.className}`}
          onMouseDown={(e) => {
            if (e.button === 0) void appWindow.startResizeDragging(h.dir);
          }}
        />
      ))}
    </>
  );
}

function buildSections(
  editor: Editor | null,
  onCommand: (id: string) => void,
  appWindow: Window,
): MenuSection[] {
  const sep: MenuEntry = { kind: 'separator' };
  const clipboard = (cmd: 'cut' | 'copy') => () => {
    document.execCommand(cmd);
    editor?.chain().focus().run();
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && editor) {
        editor.chain().focus().insertContent(text).run();
        return;
      }
    } catch {
      // clipboard API unavailable — try the legacy path below
    }
    document.execCommand('paste');
  };

  return [
    {
      id: 'file',
      label: 'File',
      entries: [
        { kind: 'item', label: 'New', shortcut: 'Ctrl+N', onSelect: () => onCommand('file_new') },
        {
          kind: 'item',
          label: 'Open…',
          shortcut: 'Ctrl+O',
          onSelect: () => onCommand('file_open'),
        },
        sep,
        { kind: 'item', label: 'Save', shortcut: 'Ctrl+S', onSelect: () => onCommand('file_save') },
        {
          kind: 'item',
          label: 'Save As…',
          shortcut: 'Ctrl+Shift+S',
          onSelect: () => onCommand('file_save_as'),
        },
        sep,
        {
          kind: 'item',
          label: 'Export HTML…',
          onSelect: () => onCommand('file_export_html'),
        },
        { kind: 'item', label: 'Export PDF…', onSelect: () => onCommand('file_export_pdf') },
        sep,
        {
          kind: 'item',
          label: 'Check for Updates…',
          onSelect: () => onCommand('app_check_updates'),
        },
        sep,
        // Goes through the Rust CloseRequested guard, so unsaved changes
        // still get confirmed before the window is destroyed.
        { kind: 'item', label: 'Quit', onSelect: () => void appWindow.close() },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      entries: [
        {
          kind: 'item',
          label: 'Undo',
          shortcut: 'Ctrl+Z',
          disabled: !editor,
          onSelect: () => editor?.chain().focus().undo().run(),
        },
        {
          kind: 'item',
          label: 'Redo',
          shortcut: 'Ctrl+Y',
          disabled: !editor,
          onSelect: () => editor?.chain().focus().redo().run(),
        },
        sep,
        {
          kind: 'item',
          label: 'Cut',
          shortcut: 'Ctrl+X',
          disabled: !editor,
          onSelect: clipboard('cut'),
        },
        {
          kind: 'item',
          label: 'Copy',
          shortcut: 'Ctrl+C',
          disabled: !editor,
          onSelect: clipboard('copy'),
        },
        {
          kind: 'item',
          label: 'Paste',
          shortcut: 'Ctrl+V',
          disabled: !editor,
          onSelect: () => void paste(),
        },
        {
          kind: 'item',
          label: 'Select All',
          shortcut: 'Ctrl+A',
          disabled: !editor,
          onSelect: () => editor?.chain().focus().selectAll().run(),
        },
        sep,
        {
          kind: 'item',
          label: 'Find…',
          shortcut: 'Ctrl+F',
          onSelect: () => onCommand('edit_find'),
        },
        { kind: 'item', label: 'Copy as HTML', onSelect: () => onCommand('edit_copy_html') },
      ],
    },
    {
      id: 'view',
      label: 'View',
      entries: [
        {
          kind: 'item',
          label: 'Present',
          shortcut: 'Ctrl+Shift+P',
          onSelect: () => onCommand('view_present'),
        },
      ],
    },
  ];
}
