// IRIS — Intelligent RealTime Instability Sensing.
// A literal minimal eye mark: an almond outline (the watch/sense idea),
// an iris ring, and a small catchlight for polish. Two shapes, two colors,
// legible down to ~16px and reads clean in monochrome if ever needed.
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
      <path
        d="M3 16C7.5 7 13 3.5 16 3.5S24.5 7 29 16C24.5 25 19 28.5 16 28.5S7.5 25 3 16Z"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="6.5" fill="var(--accent)" />
      <circle cx="16" cy="16" r="2.6" fill="var(--bg-elevated)" />
      <circle cx="13.8" cy="13.8" r="1.1" fill="white" opacity="0.9" />
    </svg>
  );
}
