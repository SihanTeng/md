import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface WelcomeProps {
  dark?: boolean;
}

/** Inline brand mark — glass page + light stroke on indigo→violet squircle. */
function TenLingMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-label="TenLing"
      style={{
        display: 'block',
        margin: '0 auto 14px',
        borderRadius: size * 0.22,
        boxShadow: '0 8px 24px rgba(98, 88, 245, 0.35)',
      }}
    >
      <title>TenLing</title>
      <defs>
        <linearGradient id="tl-bg" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#3B78F5" />
          <stop offset="45%" stopColor="#6B6AF0" />
          <stop offset="100%" stopColor="#B06AE8" />
        </linearGradient>
        <linearGradient id="tl-page" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F0ECFF" />
        </linearGradient>
        <linearGradient id="tl-stroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="124" height="124" rx="28" ry="28" fill="url(#tl-bg)" />
      <g transform="rotate(-8 64 64)">
        <rect x="34" y="30" width="60" height="72" rx="7" fill="url(#tl-page)" opacity="0.96" />
        <path d="M78 30 L94 30 L94 46 Z" fill="#D8D0F5" />
        <path d="M78 30 L78 46 L94 46 Z" fill="#EDE8FC" />
        <path
          d="M48 86 C58 62 72 52 88 40"
          fill="none"
          stroke="url(#tl-stroke)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="88" cy="40" r="3.2" fill="#FFFFFF" fillOpacity="0.9" />
      </g>
    </svg>
  );
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
        <TenLingMark size={52} />
        <div style={{ color: ink, fontSize: 16, fontWeight: 600 }}>Ready when you are</div>
        <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>⌘N new · ⌘O open</div>
      </div>
    </AbsoluteFill>
  );
};
