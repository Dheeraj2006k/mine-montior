"use client";

import { useState } from "react";
import Link from "next/link";
import { useInsarPairOptions } from "@/components/map/use-insar-pair-options";
import { useInsarFullPair } from "@/app/(app)/insar/use-insar-full-pair";
import { computeInsarPairSummary } from "@/app/(app)/insar/insar-analysis-utils";
import { useViewMode } from "@/components/view-mode/view-mode-context";
import { LosDisplacementLabel } from "@/components/labels";
import { deriveInsarConfirmationLevel, INSAR_CONFIRMATION_LABEL, type InsarConfirmationLevel } from "./insar-evidence";

// Neutral "evidence" palette only - never the operational risk colors
// (--normal/--warning/--stale/--offline). Mirrors ConfidenceBadge's
// deliberate separation from RiskBadge's palette (PRD §3/§5): InSAR
// confirmation level is a different concept from operational risk and must
// never borrow its color language, even when data quality is limited.
const CONFIRMATION_STYLE: Record<InsarConfirmationLevel, { color: string; background: string }> = {
  unavailable: { color: "var(--faint)", background: "var(--surface-2)" },
  available: { color: "var(--accent-strong)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" },
  available_limited_coherence: { color: "var(--muted)", background: "var(--surface-2)" },
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel-2 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
        {label}
      </div>
      <div className="text-sm mt-0.5 font-mono">{value}</div>
    </div>
  );
}

export function InsarEvidenceCard() {
  const { mode } = useViewMode();
  const pairOptions = useInsarPairOptions(true);
  const [selectedPair, setSelectedPair] = useState<number | null>(null);
  const activePair = selectedPair ?? pairOptions.options[0]?.pair ?? null;

  const gridQuery = useInsarFullPair(activePair ?? 1);
  const features = activePair != null ? (gridQuery.data?.features ?? []) : [];
  const summary = computeInsarPairSummary(activePair, features);

  const settled = activePair != null && !gridQuery.isLoading && !gridQuery.isError;
  const confirmationLevel = settled
    ? deriveInsarConfirmationLevel({ totalCells: summary.totalCells, goodCoherenceCount: summary.goodCoherenceCount })
    : "unavailable";

  const selectedPairOption = pairOptions.options.find((o) => o.pair === activePair) ?? null;
  const confirmationStyle = CONFIRMATION_STYLE[settled ? confirmationLevel : "unavailable"];

  return (
    <section className="panel p-4 md:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">InSAR Evidence</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--faint)" }}>
            Supplementary satellite evidence
          </p>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
          style={{ color: confirmationStyle.color, background: confirmationStyle.background, border: "1px solid var(--border)" }}
          title="Confirmation Level - evidence availability, not a risk or probability score"
        >
          Confirmation Level: {gridQuery.isLoading ? "checking…" : INSAR_CONFIRMATION_LABEL[settled ? confirmationLevel : "unavailable"]}
        </span>
      </div>

      {pairOptions.options.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="dashboard-insar-pair" className="text-xs" style={{ color: "var(--faint)" }}>
            Pair
          </label>
          <select
            id="dashboard-insar-pair"
            className="input text-xs py-1"
            value={activePair ?? ""}
            onChange={(e) => setSelectedPair(Number(e.target.value))}
          >
            {pairOptions.options.map((o) => (
              <option key={o.pair} value={o.pair}>
                {formatDate(o.referenceDate)} &rarr; {formatDate(o.secondaryDate)}
              </option>
            ))}
          </select>
        </div>
      )}

      {gridQuery.isError ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Unable to load InSAR evidence.
        </p>
      ) : gridQuery.isLoading || activePair == null ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading InSAR evidence&hellip;
        </p>
      ) : mode === "plain" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            InSAR evidence {confirmationLevel === "unavailable" ? "is not available" : "is available"} for the
            selected acquisition{confirmationLevel === "available_limited_coherence" ? ", limited by low coherence" : ""}.
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {pairOptions.options.length} satellite acquisition pair{pairOptions.options.length === 1 ? "" : "s"}
            {" · "}
            {summary.totalCells.toLocaleString()} grid cells
            {" · "}
            LOS measurements available for {summary.cellsWithLos.toLocaleString()} cells
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Fact
            label="Pair dates"
            value={selectedPairOption ? `${formatDate(selectedPairOption.referenceDate)} → ${formatDate(selectedPairOption.secondaryDate)}` : "—"}
          />
          <Fact label="Grid cells" value={summary.totalCells.toLocaleString()} />
          <Fact label="Cells with LOS" value={summary.cellsWithLos.toLocaleString()} />
          <Fact label="Low-coherence cells" value={summary.lowCoherenceCount.toLocaleString()} />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <p className="text-[11px]" style={{ color: "var(--faint)" }}>
          InSAR grid cells cover a separate geographic area from the sensor map above - not shown to scale here.
        </p>
        <div className="flex items-center gap-3">
          <LosDisplacementLabel />
          <Link href="/insar" className="btn btn-primary text-xs shrink-0">
            Open InSAR Analysis &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
