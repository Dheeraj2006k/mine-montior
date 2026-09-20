// Confidence (model agreement) must never share the risk color scale (PRD §3/§5).
// Rendered as a neutral icon + percentage, independent of RiskBadge's palette.
export function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="badge badge-unknown">
        <span aria-hidden>◐</span> confidence n/a
      </span>
    );
  }
  const pct = Math.round(value * 100);
  return (
    <span
      className="badge"
      style={{ color: "var(--accent-strong)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
      title="Model agreement - not a risk level"
    >
      <span aria-hidden>◎</span> {pct}% confidence
    </span>
  );
}
