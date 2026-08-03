import type { Editor } from '@tiptap/react';
import { Fragment, useEffect, useReducer, useRef } from 'react';
import {
  applySlashItem,
  closeSlashMenu,
  filterSlashItems,
  SLASH_ITEMS,
  setSlashIndex,
  slashCommandsKey,
  slashState,
  stepSlash,
} from './slashCommands';

interface Props {
  editor: Editor;
}

const MENU_WIDTH = 260;
const ROW_HEIGHT = 36;

/**
 * Notion-style "/" menu (ref/tolaria-inspired), anchored at the trigger
 * character via fixed positioning and re-anchored on scroll. Keys are
 * captured at the window level before ProseMirror's own handlers (list
 * keymaps would otherwise eat Enter inside list items).
 */
export function SlashMenuOverlay({ editor }: Props) {
  // Re-render on editor transactions so state/position stay live
  const [, bump] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    editor.on('transaction', bump);
    return () => {
      editor.off('transaction', bump);
    };
  }, [editor]);

  // Keep the menu glued to the caret when the document scrolls
  useEffect(() => {
    window.addEventListener('scroll', bump, true);
    window.addEventListener('resize', bump);
    return () => {
      window.removeEventListener('scroll', bump, true);
      window.removeEventListener('resize', bump);
    };
  }, []);

  // Arrow keys / Enter / Escape, ahead of ProseMirror's keymaps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = slashCommandsKey.getState(editor.state);
      if (!st?.active) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        stepSlash(
          editor,
          e.key === 'ArrowDown' ? 1 : -1,
          filterSlashItems(SLASH_ITEMS, st.query).length,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        applySlashItem(editor);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeSlashMenu(editor);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [editor]);

  const st = slashState(editor);
  const items = st.active ? filterSlashItems(SLASH_ITEMS, st.query) : [];
  const index = st.active ? Math.min(st.index, Math.max(items.length - 1, 0)) : 0;
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected row visible while arrow-keying through a long list
  // biome-ignore lint/correctness/useExhaustiveDependencies: index is the scroll trigger — the effect reads only the DOM
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [index]);

  if (!st.active) return null;

  const coords = editor.view.coordsAtPos(st.from);
  const estimatedHeight = Math.min(items.length, 8) * ROW_HEIGHT + 40;
  const left = Math.max(8, Math.min(coords.left, window.innerWidth - MENU_WIDTH - 8));
  const flipUp =
    coords.bottom + 6 + estimatedHeight > window.innerHeight &&
    coords.top - 6 - estimatedHeight > 0;
  const style: React.CSSProperties = flipUp
    ? { left, bottom: window.innerHeight - coords.top + 6 }
    : { left, top: coords.bottom + 6 };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Insert block"
      style={style}
      className="fixed z-50 max-h-72 w-[260px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-popover)]"
    >
      {items.length === 0 ? (
        <div className="px-2 py-1.5 text-[12.5px] text-[var(--color-ink-tertiary)]">
          No matching blocks
        </div>
      ) : (
        items.map((item, i) => (
          <Fragment key={item.id}>
            {item.section !== items[i - 1]?.section ? (
              <div className="px-2 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-tertiary)]">
                {item.section}
              </div>
            ) : null}
            <button
              type="button"
              role="option"
              aria-selected={i === index}
              // mousedown (not click) + preventDefault keeps focus in the
              // editor, so the plugin state survives until the item runs
              onMouseDown={(e) => {
                e.preventDefault();
                applySlashItem(editor, item);
              }}
              onMouseMove={() => {
                if (i !== index) setSlashIndex(editor, i);
              }}
              className={`flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left ${
                i === index ? 'bg-[var(--color-hover)]' : ''
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-bg)] text-[var(--color-ink-secondary)]">
                <item.icon size={15} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-ink)]">
                {item.title}
              </span>
            </button>
          </Fragment>
        ))
      )}
    </div>
  );
}
