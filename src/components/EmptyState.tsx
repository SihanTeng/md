import { lazy, Suspense } from "react";
import { FilePlus, FolderOpen } from "lucide-react";

const WelcomePlayer = lazy(() =>
  import("../remotion/WelcomePlayer").then((m) => ({ default: m.WelcomePlayer })),
);

interface Props {
  onNew: () => void;
  onOpen: () => void;
}

export function EmptyState({ onNew, onOpen }: Props) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
      <div className="h-[160px] w-[280px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-[var(--shadow-popover)]">
        {reduced ? (
          <div className="flex h-full items-center justify-center text-[15px] font-medium text-[var(--color-ink)]">
            md
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-[var(--color-ink-tertiary)]">
                …
              </div>
            }
          >
            <WelcomePlayer />
          </Suspense>
        )}
      </div>

      <div className="text-center">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
          Markdown, quietly
        </h1>
        <p className="mt-1 max-w-sm text-[13px] text-[var(--color-ink-secondary)]">
          A simple WYSIWYG editor with present mode. Open a file or start a new
          document.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNew}
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3.5 text-[13px] font-medium text-white hover:brightness-105"
        >
          <FilePlus size={14} strokeWidth={1.75} />
          New Document
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-hairline-strong)] bg-[var(--color-surface)] px-3.5 text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-hover)]"
        >
          <FolderOpen size={14} strokeWidth={1.75} />
          Open…
        </button>
      </div>
    </div>
  );
}
