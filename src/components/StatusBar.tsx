import { openHref } from '../lib/openHref';
import { useDocumentStore } from '../stores/documentStore';

export function StatusBar() {
  const path = useDocumentStore((s) => s.path);
  const wordCount = useDocumentStore((s) => s.wordCount);
  const charCount = useDocumentStore((s) => s.charCount);
  const dirty = useDocumentStore((s) => s.dirty);
  const error = useDocumentStore((s) => s.error);

  return (
    <footer
      className="flex h-[var(--status-height)] shrink-0 items-center justify-between border-t border-[var(--color-hairline)] px-3 text-[11px] text-[var(--color-ink-tertiary)]"
      style={{ background: 'var(--color-toolbar)' }}
    >
      <div className="flex min-w-0 items-center gap-2 truncate">
        {error ? (
          <span className="truncate text-[var(--color-danger)]">{error}</span>
        ) : path ? (
          <button
            type="button"
            className="truncate rounded-sm hover:text-[var(--color-ink-secondary)] hover:underline"
            title={`Ctrl+click to reveal in file manager: ${path}`}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) void openHref(path);
            }}
          >
            {path}
          </button>
        ) : (
          <span className="truncate">Unsaved document</span>
        )}
        {dirty && !error ? (
          <span className="shrink-0 text-[var(--color-ink-secondary)]">Edited</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 tabular-nums">
        <span>
          {wordCount} word{wordCount === 1 ? '' : 's'}
        </span>
        <span>
          {charCount} char{charCount === 1 ? '' : 's'}
        </span>
        <span>Markdown</span>
      </div>
    </footer>
  );
}
