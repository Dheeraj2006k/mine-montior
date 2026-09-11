import { riskBand, RISK_BAND_COLOR, RISK_BAND_LABEL } from "@/lib/domain/risk-band";

export function RiskBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score == null) {
    return (
      <span className="badge badge-unknown">
        <span aria-hidden>?</span> —
      </span>
    );
  }
  const band = riskBand(score);
  const color = RISK_BAND_COLOR[band];

  if (size === "lg") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-2xl font-bold" style={{ color }}>
          {RISK_BAND_LABEL[band]}
        </span>
        <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
          {score.toFixed(2)}
        </span>
      </span>
    );
  }

  return (
    <span
      className="badge"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {RISK_BAND_LABEL[band]} · {score.toFixed(2)}
    </span>
  );
}
