// IRIS — Intelligent RealTime Instability Sensing. A small mark: a
// concentric "eye"/radar-sweep motif (watching the ground continuously)
// with a subtle upward tick standing in for a rising risk trend.
export function IrisLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="16" cy="16" r="14" stroke="var(--accent)" strokeWidth="2" opacity="0.35" />
      <circle cx="16" cy="16" r="9" stroke="var(--accent)" strokeWidth="2" opacity="0.7" />
      <circle cx="16" cy="16" r="4" fill="var(--accent)" />
      <path
        d="M16 2 A14 14 0 0 1 28.7 10"
        stroke="var(--warning)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
