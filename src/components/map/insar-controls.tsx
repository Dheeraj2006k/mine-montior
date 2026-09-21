"use client";

import type { InsarGridObservationProperties } from "@/lib/insar-grid/types";
import { LosDisplacementLabel, NoDataLegend } from "@/components/labels";
import { INSAR_LEGEND_STOPS, INSAR_NO_DATA_COLOR } from "./insar-palette";
import type { InsarPairOption } from "./use-insar-pair-options";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function pairLabel(o: InsarPairOption): string {
  return `${formatDate(o.referenceDate)} → ${formatDate(o.secondaryDate)} (${o.temporalBaselineDays}d)`;
}

export function InsarToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-medium"
      style={{
        background: "color-mix(in srgb, var(--surface-2) 92%, transparent)",
        border: `1px solid ${enabled ? "var(--accent-strong)" : "var(--border)"}`,
        color: enabled ? "var(--accent-strong)" : "var(--muted)",
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block w-7 h-3.5 rounded-full relative"
        style={{ background: enabled ? "var(--accent-strong)" : "var(--faint)" }}
      >
        <span
          className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all"
          style={{ left: enabled ? "15px" : "2px" }}
        />
      </span>
      InSAR Evidence
    </button>
  );
}

export function InsarPairSelector({
  options,
  loading,
  selectedPair,
  onSelectPair,
}: {
  options: InsarPairOption[];
  loading: boolean;
  selectedPair: number;
  onSelectPair: (pair: number) => void;
}) {
  return (
    <div
      className="absolute top-11 right-2 z-10 rounded-lg px-2.5 py-2 flex flex-col gap-1.5 text-[11px] max-w-[220px]"
      style={{ background: "color-mix(in srgb, var(--surface-2) 94%, transparent)", border: "1px solid var(--border)" }}
    >
      <label htmlFor="insar-pair-select" className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
        Acquisition pair
      </label>
      {loading && options.length === 0 ? (
        <span style={{ color: "var(--muted)" }}>Loading pairs&hellip;</span>
      ) : options.length === 0 ? (
        <span style={{ color: "var(--muted)" }}>No InSAR pairs available.</span>
      ) : (
        <select
          id="insar-pair-select"
          className="input text-[11px] py-1"
          value={selectedPair}
          onChange={(e) => onSelectPair(Number(e.target.value))}
        >
          {options.map((o) => (
            <option key={o.pair} value={o.pair}>
              {pairLabel(o)}
            </option>
          ))}
        </select>
      )}
      <LosDisplacementLabel />
    </div>
  );
}

export function InsarLegend() {
  return (
    <div
      className="absolute bottom-2 right-2 z-10 rounded-lg px-2.5 py-2 flex flex-col gap-1.5 text-[10px] max-w-[190px]"
      style={{ background: "color-mix(in srgb, var(--surface-2) 92%, transparent)", border: "1px solid var(--border)", color: "var(--muted)" }}
    >
      <span className="uppercase tracking-wide" style={{ color: "var(--faint)" }}>
        LOS displacement (mm)
      </span>
      <div
        className="h-2 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${INSAR_LEGEND_STOPS.map(([, c]) => c).join(", ")})`,
        }}
      />
      <div className="flex justify-between">
        <span>{INSAR_LEGEND_STOPS[0][0]}</span>
        <span>0</span>
        <span>+{INSAR_LEGEND_STOPS[INSAR_LEGEND_STOPS.length - 1][0]}</span>
      </div>
      <div className="flex items-center gap-1.5 pt-1 mt-0.5" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: INSAR_NO_DATA_COLOR }} />
        <NoDataLegend />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm opacity-35" style={{ background: "var(--foreground)" }} />
        low coherence (dimmed, still shown)
      </div>
    </div>
  );
}

export function InsarCellDetailPanel({
  cell,
  onClose,
}: {
  cell: InsarGridObservationProperties;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-11 left-2 z-10 rounded-lg px-3 py-2.5 flex flex-col gap-1.5 text-[11px] max-w-[240px]"
      style={{ background: "color-mix(in srgb, var(--surface-2) 96%, transparent)", border: "1px solid var(--border-strong)", color: "var(--foreground)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Grid cell {cell.grid_id}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close InSAR cell detail"
          className="text-[13px] leading-none px-1 rounded"
          style={{ color: "var(--muted)" }}
        >
          &times;
        </button>
      </div>
      <Row label="Pair">{cell.pair}</Row>
      <Row label="Reference date">{formatDate(cell.reference_date)}</Row>
      <Row label="Secondary date">{formatDate(cell.secondary_date)}</Row>
      <Row label="Temporal baseline">{cell.temporal_baseline_days} days</Row>
      <Row label="LOS displacement">
        {cell.los_displacement_mm != null ? (
          `${cell.los_displacement_mm.toFixed(2)} mm`
        ) : (
          <span style={{ color: "var(--faint)" }}>No LOS measurement</span>
        )}
      </Row>
      <Row label="Coherence">{cell.coherence.toFixed(3)}</Row>
      <Row label="Cell coherence quality">
        <span
          className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
          style={{
            color: cell.cell_coherence_quality === "GOOD" ? "var(--accent-strong)" : "var(--faint)",
            background: cell.cell_coherence_quality === "GOOD" ? "color-mix(in srgb, var(--accent-strong) 16%, transparent)" : "var(--surface-hover)",
          }}
        >
          {cell.cell_coherence_quality}
        </span>
      </Row>
      <div className="pt-1 mt-0.5" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
          Geometry (LOS)
        </span>
        <Row label="Incidence angle">{cell.incidence_angle_rad != null ? `${cell.incidence_angle_rad.toFixed(4)} rad` : "—"}</Row>
        <Row label="Look vector φ">{cell.look_vector_phi_rad != null ? `${cell.look_vector_phi_rad.toFixed(4)} rad` : "—"}</Row>
        <Row label="Look vector θ">{cell.look_vector_theta_rad != null ? `${cell.look_vector_theta_rad.toFixed(4)} rad` : "—"}</Row>
      </div>
      <LosDisplacementLabel />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--faint)" }}>{label}</span>
      <span className="font-mono text-right">{children}</span>
    </div>
  );
}

export function InsarStatusBanner({ loading, error }: { loading: boolean; error: string | null }) {
  if (!loading && !error) return null;
  return (
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-full px-3 py-1 text-[11px]"
      style={{
        background: "color-mix(in srgb, var(--surface-2) 94%, transparent)",
        border: `1px solid ${error ? "var(--offline)" : "var(--border)"}`,
        color: error ? "var(--offline)" : "var(--muted)",
      }}
    >
      {error ? `InSAR data unavailable: ${error}` : "Loading InSAR evidence…"}
    </div>
  );
}
