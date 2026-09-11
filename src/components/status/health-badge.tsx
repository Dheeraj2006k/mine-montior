import type { HealthState } from "@/lib/domain/node-health";

const STYLES: Record<HealthState, { label: string; className: string; icon: string }> = {
  normal: { label: "NORMAL", className: "badge-normal", icon: "●" },
  warning: { label: "WARNING", className: "badge-warning", icon: "▲" },
  unknown: { label: "UNKNOWN", className: "badge-unknown", icon: "?" },
  stale: { label: "STALE", className: "badge-stale", icon: "◐" },
  offline: { label: "OFFLINE", className: "badge-offline", icon: "✕" },
};

// PRD §14.1: unknown/stale/offline must never render as green/normal.
// Colour + icon + text together — never colour alone (§9.5, colour-blind safety).
export function HealthBadge({ state }: { state: HealthState }) {
  const style = STYLES[state];
  return (
    <span className={`badge ${style.className}`}>
      <span aria-hidden>{style.icon}</span> {style.label}
    </span>
  );
}
