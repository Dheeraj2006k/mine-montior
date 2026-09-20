// PRD-2 Phase B: "For real nodes: display REAL / REGISTERED. For mock
// nodes: display MOCK everywhere." A distinct, deliberately unmissable
// label - separate from HealthBadge/RiskBadge so source and status are
// never conflated.
export function SourceBadge({ isMock, registered }: { isMock: boolean; registered?: boolean }) {
  if (isMock) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--faint)", background: "var(--surface-2)" }}>
        mock
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
      style={{
        color: "var(--accent-strong)",
        background: "color-mix(in srgb, var(--accent) 16%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--border))",
      }}
    >
      {registered ? "real · registered" : "real"}
    </span>
  );
}
