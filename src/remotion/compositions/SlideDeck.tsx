import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Slide } from "../../lib/slidesFromDoc";

export interface SlideDeckProps {
  slides: Slide[];
  dark?: boolean;
}

const FRAMES_PER_SLIDE = 90;

const SlideCard: React.FC<{
  slide: Slide;
  dark: boolean;
}> = ({ slide, dark }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const x = interpolate(enter, [0, 1], [28, 0]);

  const bg = dark ? "#111113" : "#fafafa";
  const ink = dark ? "#f5f5f7" : "#1d1d1f";
  const muted = dark ? "#a1a1a6" : "#6e6e73";
  const accent = dark ? "#0a84ff" : "#007aff";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        padding: 72,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <div style={{ opacity, transform: `translateX(${x}px)`, maxWidth: 900 }}>
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: accent,
            marginBottom: 28,
          }}
        />
        <h1
          style={{
            margin: 0,
            color: ink,
            fontSize: slide.level === 1 ? 56 : 44,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          {slide.title}
        </h1>
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          {slide.body.map((line, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                color: muted,
                fontSize: 24,
                lineHeight: 1.45,
                fontWeight: 400,
              }}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SlideDeck: React.FC<SlideDeckProps> = ({ slides, dark = false }) => {
  const list =
    slides.length > 0
      ? slides
      : [{ title: "No slides", body: ["Add headings to your document."], level: 1 as const }];

  return (
    <AbsoluteFill>
      {list.map((slide, i) => (
        <Sequence
          key={i}
          from={i * FRAMES_PER_SLIDE}
          durationInFrames={FRAMES_PER_SLIDE}
          name={slide.title}
        >
          <SlideCard slide={slide} dark={dark} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export function slideDeckDuration(slideCount: number): number {
  return Math.max(1, slideCount) * FRAMES_PER_SLIDE;
}

export { FRAMES_PER_SLIDE };
