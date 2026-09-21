"use client";

import type { InsarPairOption } from "@/components/map/use-insar-pair-options";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function InsarPairFilterBar({
  options,
  optionsLoading,
  selectedPair,
  onSelectPair,
  coherenceMin,
  coherenceMax,
  onCoherenceMinChange,
  onCoherenceMaxChange,
}: {
  options: InsarPairOption[];
  optionsLoading: boolean;
  selectedPair: number;
  onSelectPair: (pair: number) => void;
  coherenceMin: string;
  coherenceMax: string;
  onCoherenceMinChange: (v: string) => void;
  onCoherenceMaxChange: (v: string) => void;
}) {
  const selected = options.find((o) => o.pair === selectedPair) ?? null;

  return (
    <section className="panel p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-[220px]">
          <label htmlFor="insar-analysis-pair" className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
            Acquisition pair
          </label>
          {optionsLoading && options.length === 0 ? (
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              Loading pairs&hellip;
            </span>
          ) : options.length === 0 ? (
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              No InSAR pairs available.
            </span>
          ) : (
            <select
              id="insar-analysis-pair"
              className="input text-sm"
              value={selectedPair}
              onChange={(e) => onSelectPair(Number(e.target.value))}
            >
              {options.map((o) => (
                <option key={o.pair} value={o.pair}>
                  Pair {o.pair}: {formatDate(o.referenceDate)} &rarr; {formatDate(o.secondaryDate)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
            Reference date
          </span>
          <span className="text-sm font-mono">{selected ? formatDate(selected.referenceDate) : "—"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
            Secondary date
          </span>
          <span className="text-sm font-mono">{selected ? formatDate(selected.secondaryDate) : "—"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
            Temporal baseline
          </span>
          <span className="text-sm font-mono">{selected ? `${selected.temporalBaselineDays} days` : "—"}</span>
        </div>

        <div className="flex items-end gap-2 ml-auto">
          <div className="flex flex-col gap-1">
            <label htmlFor="insar-coh-min" className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
              Coherence min
            </label>
            <input
              id="insar-coh-min"
              type="number"
              min={0}
              max={1}
              step={0.05}
              placeholder="0"
              className="input text-sm w-20"
              value={coherenceMin}
              onChange={(e) => onCoherenceMinChange(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="insar-coh-max" className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
              Coherence max
            </label>
            <input
              id="insar-coh-max"
              type="number"
              min={0}
              max={1}
              step={0.05}
              placeholder="1"
              className="input text-sm w-20"
              value={coherenceMax}
              onChange={(e) => onCoherenceMaxChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
