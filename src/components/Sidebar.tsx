import type { Editor } from '@tiptap/react';
import { Clock, Folder, ListTree, X } from 'lucide-react';
import { scrollToPos } from '../lib/outline';
import { type OutlineItem, type RecentFile, useDocumentStore } from '../stores/documentStore';
import { FilesPane } from './FilesPane';

interface Props {
  editor: Editor | null;
  onOpenRecent: (path: string) => void;
  onHideRecent: (path: string) => void;
}

export function Sidebar({ editor, onOpenRecent, onHideRecent }: Props) {
  const open = useDocumentStore((s) => s.sidebarOpen);
  const outline = useDocumentStore((s) => s.outline);
  const recent = useDocumentStore((s) => s.recent);
  const mode = useDocumentStore((s) => s.sidebarMode);
  const setMode = useDocumentStore((s) => s.setSidebarMode);

  if (!open) return null;

  return (
    <aside
      className="flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--color-hairline)] backdrop-blur-xl print:hidden"
      style={{ background: 'var(--color-sidebar)' }}
    >
      <div className="flex gap-1 px-3 pt-3">
        <ModeButton
          active={mode === 'outline'}
          onClick={() => setMode('outline')}
          title="Document outline"
        >
          <ListTree size={14} strokeWidth={1.75} />
        </ModeButton>
        <ModeButton active={mode === 'files'} onClick={() => setMode('files')} title="Browse files">
          <Folder size={14} strokeWidth={1.75} />
        </ModeButton>
      </div>

      {mode === 'files' ? (
        <FilesPane onOpenFile={onOpenRecent} />
      ) : (
        <OutlinePane
          editor={editor}
          outline={outline}
          recent={recent}
          onOpenRecent={onOpenRecent}
          onHideRecent={onHideRecent}
        />
      )}
    </aside>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${
        active
          ? 'bg-[var(--color-hover)] text-[var(--color-ink)]'
          : 'text-[var(--color-ink-tertiary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  );
}

function OutlinePane({
  editor,
  outline,
  recent,
  onOpenRecent,
  onHideRecent,
}: {
  editor: Editor | null;
  outline: OutlineItem[];
  recent: RecentFile[];
  onOpenRecent: (path: string) => void;
  onHideRecent: (path: string) => void;
}) {
  return (
    <>
      <div className="mac-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-3">
        <Section label="Outline" icon={<ListTree size={12} strokeWidth={2} />}>
          {outline.length === 0 ? (
            <EmptyHint>Headings appear here</EmptyHint>
          ) : (
            outline.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => editor && scrollToPos(editor, item.pos)}
                className="block w-full truncate rounded-[var(--radius-sm)] px-2 py-1 text-left text-[12.5px] text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
                style={{ paddingLeft: 8 + (item.level - 1) * 12 }}
              >
                {item.text}
              </button>
            ))
          )}
        </Section>
      </div>

      {/* Recent is pinned to the sidebar bottom with its own scroll area */}
      <div className="shrink-0 border-t border-[var(--color-hairline)] px-2 pb-2">
        <div className="mac-scroll max-h-[35vh] overflow-y-auto">
          <Section label="Recent" icon={<Clock size={12} strokeWidth={2} />}>
            {recent.length === 0 ? (
              <EmptyHint>No recent files</EmptyHint>
            ) : (
              recent.map((f) => (
                <div key={f.path} className="group relative">
                  <button
                    type="button"
                    title={f.path}
                    onClick={() => onOpenRecent(f.path)}
                    className="block w-full truncate rounded-[var(--radius-sm)] px-2 py-1 pr-6 text-left text-[12.5px] text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
                  >
                    {f.name}
                  </button>
                  <button
                    type="button"
                    title={`Hide ${f.name} from recent`}
                    aria-label={`Hide ${f.name} from recent`}
                    onClick={() => onHideRecent(f.path)}
                    className="absolute top-1/2 right-1 -translate-y-1/2 rounded-[var(--radius-sm)] p-0.5 text-[var(--color-ink-tertiary)] opacity-0 hover:bg-[var(--color-active)] hover:text-[var(--color-ink)] group-hover:opacity-100"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              ))
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink-tertiary)]">
        {icon}
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-[12px] text-[var(--color-ink-tertiary)]">{children}</div>;
}
