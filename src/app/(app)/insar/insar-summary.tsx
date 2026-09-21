"use client";

import type { InsarPairSummary } from "./insar-analysis-utils";

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="panel-2 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
        {label}
      </div>
      <div className="text-sm mt-0.5 font-mono">
        {value}
        {unit && (
          <span className="font-sans font-normal ml-1" style={{ color: "var(--faint)" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function InsarSummary({ summary }: { summary: InsarPairSummary }) {
  return (
    <section className="panel p-4 md:p-5 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">Pair analysis summary</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--faint)" }}>
          Statistics for pair {summary.pair ?? "—"} only - not a site-wide or all-pairs figure.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Metric label="Grid cells" value={String(summary.totalCells)} />
        <Metric label="Cells with LOS" value={String(summary.cellsWithLos)} />
        <Metric label="Cells with no LOS" value={String(summary.cellsWithoutLos)} />
        <Metric label="Low-coherence cells" value={String(summary.lowCoherenceCount)} />
        <Metric
          label="Mean LOS displacement"
          value={summary.meanLosMm != null ? summary.meanLosMm.toFixed(2) : "—"}
          unit={summary.meanLosMm != null ? "mm" : undefined}
        />
        <Metric
          label="Median LOS displacement"
          value={summary.medianLosMm != null ? summary.medianLosMm.toFixed(2) : "—"}
          unit={summary.medianLosMm != null ? "mm" : undefined}
        />
        <Metric
          label="Min LOS displacement"
          value={summary.minLosMm != null ? summary.minLosMm.toFixed(2) : "—"}
          unit={summary.minLosMm != null ? "mm" : undefined}
        />
        <Metric
          label="Max LOS displacement"
          value={summary.maxLosMm != null ? summary.maxLosMm.toFixed(2) : "—"}
          unit={summary.maxLosMm != null ? "mm" : undefined}
        />
        <Metric label="Mean coherence" value={summary.meanCoherence != null ? summary.meanCoherence.toFixed(3) : "—"} />
        <Metric label="Good-coherence cells" value={String(summary.goodCoherenceCount)} />
      </div>
      {summary.cellsWithLos === 0 && summary.totalCells > 0 && (
        <p className="text-xs" style={{ color: "var(--faint)" }}>
          No LOS measurements available for this pair - the LOS statistics above are not applicable.
        </p>
      )}
      <p className="text-[11px]" style={{ color: "var(--faint)" }}>
        LOS statistics exclude cells with no measurement rather than treating them as zero. These
        figures describe the selected pair&apos;s grid cells only, not overall site risk.
      </p>
    </section>
  );
}
