import { FileText, Clock, ListTree } from "lucide-react";
import { useDocumentStore } from "../stores/documentStore";
import type { Editor } from "@tiptap/react";
import { scrollToPos } from "../lib/outline";

interface Props {
  editor: Editor | null;
  onOpenRecent: (path: string) => void;
}

export function Sidebar({ editor, onOpenRecent }: Props) {
  const open = useDocumentStore((s) => s.sidebarOpen);
  const outline = useDocumentStore((s) => s.outline);
  const recent = useDocumentStore((s) => s.recent);
  const title = useDocumentStore((s) => s.title);
  const dirty = useDocumentStore((s) => s.dirty);

  if (!open) return null;

  return (
    <aside
      className="flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--color-hairline)] backdrop-blur-xl"
      style={{ background: "var(--color-sidebar)" }}
    >
      <div className="px-3 pb-2 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink-tertiary)]">
          Document
        </div>
        <div className="mt-1.5 flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-[13px] font-medium text-[var(--color-ink)]">
          <FileText size={14} className="shrink-0 text-[var(--color-accent)]" strokeWidth={1.75} />
          <span className="truncate">
            {title}
            {dirty ? (
              <span className="ml-1 text-[var(--color-ink-tertiary)]">•</span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="mac-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
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

        <Section label="Recent" icon={<Clock size={12} strokeWidth={2} />}>
          {recent.length === 0 ? (
            <EmptyHint>No recent files</EmptyHint>
          ) : (
            recent.map((f) => (
              <button
                key={f.path}
                type="button"
                title={f.path}
                onClick={() => onOpenRecent(f.path)}
                className="block w-full truncate rounded-[var(--radius-sm)] px-2 py-1 text-left text-[12.5px] text-[var(--color-ink-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
              >
                {f.name}
              </button>
            ))
          )}
        </Section>
      </div>
    </aside>
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
  return (
    <div className="px-2 py-1 text-[12px] text-[var(--color-ink-tertiary)]">
      {children}
    </div>
  );
}
