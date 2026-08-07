import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface WelcomeProps {
  dark?: boolean;
}

export const Welcome: React.FC<WelcomeProps> = ({ dark = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const pulse = interpolate(frame % 90, [0, 45, 90], [0.96, 1, 0.96]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [12, 0]);

  const bg = dark ? '#1c1c1e' : '#f5f5f7';
  const ink = dark ? '#f5f5f7' : '#1d1d1f';
  const accent = dark ? '#8b7cf8' : '#6258F5';
  const muted = dark ? '#8e8e93' : '#86868b';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px) scale(${pulse})`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: accent,
            margin: '0 auto 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: '-0.03em',
            boxShadow: `0 8px 24px ${accent}44`,
          }}
        >
          TL
        </div>
        <div style={{ color: ink, fontSize: 16, fontWeight: 600 }}>Ready when you are</div>
        <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>⌘N new · ⌘O open</div>
      </div>
    </AbsoluteFill>
  );
};
