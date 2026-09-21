"use client";

import type { InsarGridObservationProperties } from "@/lib/insar-grid/types";
import { LosDisplacementLabel } from "@/components/labels";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs" style={{ color: "var(--faint)" }}>
        {label}
      </span>
      <span className="text-sm font-mono text-right">{children}</span>
    </div>
  );
}

export function InsarCellDetailPanel({ cell }: { cell: InsarGridObservationProperties | null }) {
  return (
    <section className="panel p-4 md:p-5 flex flex-col gap-1 h-full">
      <h2 className="text-sm font-semibold mb-1">Cell detail</h2>
      {!cell ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Click a grid cell on the map to see its measurement.
        </p>
      ) : (
        <>
          <Row label="Grid ID">{cell.grid_id}</Row>
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
                background:
                  cell.cell_coherence_quality === "GOOD"
                    ? "color-mix(in srgb, var(--accent-strong) 16%, transparent)"
                    : "var(--surface-hover)",
              }}
            >
              {cell.cell_coherence_quality}
            </span>
          </Row>
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
              LOS geometry
            </span>
            <Row label="Incidence angle">{cell.incidence_angle_rad != null ? `${cell.incidence_angle_rad.toFixed(4)} rad` : "—"}</Row>
            <Row label="Look vector φ (phi)">{cell.look_vector_phi_rad != null ? `${cell.look_vector_phi_rad.toFixed(4)} rad` : "—"}</Row>
            <Row label="Look vector θ (theta)">{cell.look_vector_theta_rad != null ? `${cell.look_vector_theta_rad.toFixed(4)} rad` : "—"}</Row>
          </div>
          <div className="mt-2">
            <LosDisplacementLabel />
          </div>
        </>
      )}
    </section>
  );
}
