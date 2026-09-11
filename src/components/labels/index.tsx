// Non-negotiable honesty labels (implementation plan §9.3 / PRD §17).
// Components, not strings, so they physically cannot be forgotten at a call site.

export function MockPositionLabel() {
  return <span className="label-caveat">mock position (not GNSS)</span>;
}

export function LosDisplacementLabel() {
  return <span className="label-caveat">LOS displacement — not vertical subsidence</span>;
}

export function FuzzyIndexLabel() {
  return <span className="label-caveat">Fuzzy Risk Index — rule-derived, not a probability</span>;
}

export function SinglePairLabel({ from, to }: { from: string | null; to: string | null }) {
  if (!from || !to) {
    return <span className="label-caveat">no InSAR acquisition pair available</span>;
  }
  return (
    <span className="label-caveat">
      displacement between {from} and {to} — not velocity
    </span>
  );
}

export function NoDataLegend() {
  return <span className="label-caveat">low coherence / no data — not zero movement</span>;
}
