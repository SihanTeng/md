import { exists } from '@tauri-apps/plugin-fs';
import { FilePlus, FileText, Folder, FolderOpen, FolderUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { openHref } from '../lib/openHref';
import { type DirListing, listDir, writeTextFile } from '../lib/tauri/files';
import { useDocumentStore } from '../stores/documentStore';

function parentOf(path: string): string | null {
  const normalized = path.replace(/[/\\]+$/, '');
  const idx = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (idx < 0) return null;
  if (idx === 0) return normalized.startsWith('/') ? '/' : null;
  return normalized.slice(0, idx);
}

/** Right-click target: an entry, or the pane background (the listed dir). */
interface MenuTarget {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
}

interface Props {
  onOpenFile: (path: string) => void;
}

export function FilesPane({ onOpenFile }: Props) {
  const docPath = useDocumentStore((s) => s.path);
  const workspace = useDocumentStore((s) => s.workspace);
  const setStoreError = useDocumentStore((s) => s.setError);
  // undefined = follow the workspace/document directory until the user navigates
  const [dir, setDir] = useState<string | null | undefined>(undefined);
  const [listing, setListing] = useState<DirListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fallbackDir = workspace ?? (docPath ? parentOf(docPath) : null);
  const effectiveDir = dir === undefined ? fallbackDir : dir;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey re-runs the listing after file creation
  useEffect(() => {
    let cancelled = false;
    setError(null);
    listDir(effectiveDir ?? undefined)
      .then((l) => {
        if (!cancelled) setListing(l);
      })
      .catch((e) => {
        if (cancelled) return;
        setListing(null);
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveDir, refreshKey]);

  // Dismiss the context menu on Escape
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const openMenu = useCallback((e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, path, isDir });
  }, []);

  const newFile = useCallback(
    async (target: MenuTarget) => {
      const baseDir = target.isDir ? target.path : parentOf(target.path);
      if (!baseDir) return;
      const name = window.prompt('New file name', 'Untitled.md');
      if (!name?.trim()) return;
      const trimmed = name.trim();
      const fileName = /\.(md|markdown|mdown|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
      const full = `${baseDir}/${fileName}`;
      try {
        // write_text_file overwrites silently — guard against data loss
        if (await exists(full).catch(() => false)) {
          setStoreError(`File already exists: ${fileName}`);
          return;
        }
        await writeTextFile(full, '');
        setRefreshKey((k) => k + 1);
        onOpenFile(full);
      } catch (e) {
        setStoreError(e instanceof Error ? e.message : String(e));
      }
    },
    [onOpenFile, setStoreError],
  );

  const rowClass =
    'flex w-full items-center gap-2 truncate rounded-[var(--radius-sm)] px-2 py-1 text-left text-[12.5px] text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]';

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click on the pane background targets the listed directory
    <div
      className="mac-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3"
      onContextMenu={listing ? (e) => openMenu(e, listing.dir, true) : undefined}
    >
      <div className="mt-3">
        <div
          className="mb-1 truncate px-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink-tertiary)]"
          title={listing?.dir}
        >
          {listing?.dir ?? 'Files'}
        </div>
        <div className="space-y-0.5">
          {error ? (
            <div className="px-2 py-1 text-[12px] text-[var(--color-danger)]">{error}</div>
          ) : null}
          {!error && !listing ? (
            <div className="px-2 py-1 text-[12px] text-[var(--color-ink-tertiary)]">Loading…</div>
          ) : null}
          {listing?.parent ? (
            <button type="button" className={rowClass} onClick={() => setDir(listing.parent)}>
              <FolderUp size={13} className="shrink-0" strokeWidth={1.75} />
              <span className="truncate">..</span>
            </button>
          ) : null}
          {listing?.entries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              title={entry.path}
              className={rowClass}
              onClick={() => (entry.isDir ? setDir(entry.path) : onOpenFile(entry.path))}
              onContextMenu={(e) => openMenu(e, entry.path, entry.isDir)}
            >
              {entry.isDir ? (
                <Folder
                  size={13}
                  className="shrink-0 text-[var(--color-accent)]"
                  strokeWidth={1.75}
                />
              ) : (
                <FileText size={13} className="shrink-0" strokeWidth={1.75} />
              )}
              <span className="truncate">{entry.name}</span>
            </button>
          ))}
          {listing && listing.entries.length === 0 && !error ? (
            <div className="px-2 py-1 text-[12px] text-[var(--color-ink-tertiary)]">
              No markdown files here
            </div>
          ) : null}
        </div>
      </div>

      {menu ? (
        // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: click-catcher overlay that dismisses the context menu; Escape is handled globally
        <div
          className="fixed inset-0 z-50"
          onClick={() => setMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(null);
          }}
        >
          <div
            className="absolute min-w-[180px] rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-popover)]"
            style={{
              left: Math.min(menu.x, window.innerWidth - 190),
              top: Math.min(menu.y, window.innerHeight - 80),
            }}
          >
            <button
              type="button"
              className={rowClass}
              onClick={() => {
                const target = menu;
                setMenu(null);
                void newFile(target);
              }}
            >
              <FilePlus size={13} className="shrink-0" strokeWidth={1.75} />
              <span className="truncate">New File…</span>
            </button>
            <button
              type="button"
              className={rowClass}
              onClick={() => {
                const target = menu;
                setMenu(null);
                void openHref(target.path);
              }}
            >
              <FolderOpen size={13} className="shrink-0" strokeWidth={1.75} />
              <span className="truncate">Open in File Manager</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
