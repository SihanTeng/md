import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { SlideDeck, FRAMES_PER_SLIDE, slideDeckDuration } from "../../remotion/compositions/SlideDeck";
import { slidesFromDoc } from "../../lib/slidesFromDoc";
import { resolveDark } from "../../lib/theme";
import { useDocumentStore } from "../../stores/documentStore";

interface Props {
  editor: Editor | null;
  onClose: () => void;
}

export function PresentOverlay({ editor, onClose }: Props) {
  const theme = useDocumentStore((s) => s.theme);
  const dark = resolveDark(theme);
  const slides = useMemo(
    () => slidesFromDoc(editor?.getJSON() ?? null),
    [editor],
  );
  const durationInFrames = slideDeckDuration(slides.length);
  const [index, setIndex] = useState(0);
  const [player, setPlayer] = useState<{
    seekTo: (f: number) => void;
  } | null>(null);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    setIndex(next);
    player?.seekTo(next * FRAMES_PER_SLIDE);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, player, slides.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: dark ? "#000" : "#111" }}
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
    >
      <div className="flex h-10 items-center justify-between px-3 text-white/80">
        <span className="text-[12px] tabular-nums">
          {index + 1} / {slides.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10"
            onClick={() => goTo(index - 1)}
            title="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10"
            onClick={() => goTo(index + 1)}
            title="Next"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10"
            onClick={onClose}
            title="Exit (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg shadow-2xl">
          <Player
            ref={(ref) => {
              if (ref) setPlayer(ref);
            }}
            component={SlideDeck}
            inputProps={{ slides, dark: true }}
            durationInFrames={durationInFrames}
            compositionWidth={1280}
            compositionHeight={720}
            fps={30}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            autoPlay={false}
            initiallyShowControls={false}
            acknowledgeRemotionLicense
          />
        </div>
      </div>

      <div className="pb-3 text-center text-[11px] text-white/40">
        ← → navigate · Esc exit
      </div>
    </div>
  );
}
