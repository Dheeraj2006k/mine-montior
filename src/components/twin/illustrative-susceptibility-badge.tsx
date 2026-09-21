// Deliberately NOT RiskBadge/riskBand's operational red/orange/green scale
// (PRD §3/§5 - the same separation ConfidenceBadge already keeps for model
// confidence). The Twin's "combined indicator" is a demonstration blend of
// a real live risk score and the extraction % slider via a fixed,
// unvalidated formula (see twin-demo-logic.ts) - styling it identically to
// a real operational risk badge would misrepresent it as one.
export function IllustrativeSusceptibilityBadge({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="badge badge-unknown">
        <span aria-hidden>&#9678;</span> not available
      </span>
    );
  }
  const pct = Math.round(value * 100);
  return (
    <span
      className="badge"
      style={{ color: "var(--accent-strong)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
      title="Illustrative demonstration indicator - not a validated risk score or physical prediction"
    >
      {/* Leads with "illustrative", not the number - a bare number here
          would read as a score/percentage at a glance, exactly the
          operational-risk resemblance this badge exists to avoid. */}
      <span aria-hidden>&#9678;</span> illustrative &middot; {pct}
    </span>
  );
}
