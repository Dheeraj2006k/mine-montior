"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiGet } from "@/lib/api/client";
import { MockPositionLabel } from "@/components/labels";
import { IllustrativeSusceptibilityBadge } from "@/components/twin/illustrative-susceptibility-badge";
import { ViewModeToggle, useViewMode } from "@/components/view-mode/view-mode-context";
import {
  clampExtractionPct,
  deriveIllustrativeSusceptibility,
  deriveHypotheticalScrub,
  formatConfiguredValue,
} from "./twin-demo-logic";
import type { HealthState } from "@/lib/domain/node-health";
import type { PredictedZoneEntry, TwinNode } from "@/components/twin/twin-scene";

// three.js/canvas needs the browser - no SSR for this component.
const TwinScene = dynamic(() => import("@/components/twin/twin-scene").then((m) => m.TwinScene), {
  ssr: false,
  loading: () => <p style={{ color: "var(--muted)" }}>Loading 3D scene...</p>,
});

type NodeRow = {
  node_id: number;
  label: string;
  mock_latitude: number;
  mock_longitude: number;
  health_state: HealthState;
  latest_risk_score: number | null;
};

type PredictionData = {
  model_version: string;
  predicted_zone: PredictedZoneEntry[];
  trend: string;
  time_to_threshold: { low_days: number | null; high_days: number | null; confidence: number | null };
  is_stale: boolean;
};

type SiteConfigData = {
  mine_type: "longwall" | "bord_and_pillar";
  geometry: Record<string, unknown>;
  geology: Record<string, unknown>;
  mining_state: Record<string, unknown>;
  data_sources: Record<string, unknown>;
  is_assumed: Record<string, boolean>;
} | null;

export default function TwinPage() {
  const { mode: viewMode } = useViewMode();
  const [scrubT, setScrubT] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [planningMode, setPlanningMode] = useState(false);
  const [hypotheticalDays, setHypotheticalDays] = useState(7);
  const [extractionPct, setExtractionPct] = useState<number | null>(null);

  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const predictionQuery = useQuery({
    queryKey: ["prediction"],
    queryFn: () => apiGet<PredictionData>("/api/predictions/latest"),
  });
  const siteConfigQuery = useQuery({
    queryKey: ["site-config"],
    queryFn: () => apiGet<SiteConfigData>("/api/site-config"),
  });

  const nodes: TwinNode[] = (nodesQuery.data?.data ?? []).map((n) => ({
    node_id: n.node_id,
    label: n.label,
    mock_latitude: n.mock_latitude,
    mock_longitude: n.mock_longitude,
    health_state: n.health_state,
  }));
  const prediction = predictionQuery.data?.data;
  const predictedZone = prediction?.predicted_zone ?? [];
  const hasPrediction = predictedZone.length > 0;

  const siteConfig = siteConfigQuery.data?.data ?? null;
  const mineType = siteConfig?.mine_type ?? "longwall";
  const pillarWidthM = typeof siteConfig?.geometry?.pillar_width_m === "number" ? siteConfig.geometry.pillar_width_m : null;
  const galleryWidthM = typeof siteConfig?.geometry?.gallery_width_m === "number" ? siteConfig.geometry.gallery_width_m : null;
  const configuredExtractionPct =
    typeof siteConfig?.mining_state?.extraction_pct === "number" ? siteConfig.mining_state.extraction_pct : 0;
  const effectiveExtractionPct = extractionPct ?? configuredExtractionPct;

  const maxLiveRisk = nodesQuery.data?.data.length
    ? Math.max(...nodesQuery.data.data.map((n) => n.latest_risk_score ?? 0))
    : null;
  // Illustrative only - combines a real live risk score with a real
  // configured/slider extraction % via a simple, explicitly-labeled,
  // pure formula (twin-demo-logic.ts). Not a validated PHSR/CPHSR
  // structural model - none exists in this codebase.
  const combinedIllustrativeIndicator = deriveIllustrativeSusceptibility({
    maxLiveRisk,
    extractionPct: effectiveExtractionPct,
  });

  // Planning mode extrapolates the existing real predicted_zone severities
  // forward by a user-chosen number of days - still driven entirely by
  // real model output, just scaled, and always visually and textually
  // labeled hypothetical (PRD-2 §4: "rendered result visually distinct...
  // and labeled 'Hypothetical'").
  const effectiveScrubT = deriveHypotheticalScrub({ scrubT, hypotheticalDays, planningMode, mineType });

  if (reduceMotion) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Digital twin</h1>
          <button className="btn btn-ghost text-xs" onClick={() => setReduceMotion(false)}>
            Enable 3D view
          </button>
        </div>
        <IllustrativeModelBanner />
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Reduced-motion mode is on. Every fact reachable here is also reachable on{" "}
          <Link href="/nodes" className="underline">
            the 2D node list
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            Digital twin
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              {mineType === "longwall" ? "Longwall" : "Bord-and-Pillar"}
            </span>
          </h1>
          <div className="mt-1">
            <MockPositionLabel />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewModeToggle />
          {mineType === "longwall" && (
            <div className="inline-flex items-center rounded-full p-0.5 text-xs font-medium" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {(["monitoring", "planning"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPlanningMode(m === "planning")}
                  className="px-2.5 py-1 rounded-full capitalize transition-colors"
                  style={{
                    color: (m === "planning") === planningMode ? "#021016" : "var(--muted)",
                    background: (m === "planning") === planningMode ? "linear-gradient(135deg, var(--green), var(--accent))" : "transparent",
                    fontWeight: (m === "planning") === planningMode ? 600 : 500,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-ghost text-xs" onClick={() => setReduceMotion(true)}>
            Reduce motion / 2D only
          </button>
        </div>
      </div>

      <IllustrativeModelBanner />

      <PredictionMetadataBar
        modelVersion={prediction?.model_version ?? null}
        confidence={prediction?.time_to_threshold.confidence ?? null}
        isStale={prediction?.is_stale ?? false}
      />

      {!hasPrediction && mineType === "longwall" && (
        <p className="text-xs" style={{ color: "var(--faint)" }}>
          No prediction data available yet (ML service not connected in this build) - the terrain
          below is intentionally flat. Flat is not a claim of zero risk; it means no prediction
          exists to render.
        </p>
      )}

      {mineType === "longwall" && viewMode === "technical" && (
        <div className="panel p-4 flex flex-col gap-2">
          <span className="text-sm font-semibold">Configured longwall geometry</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <GeologyFact label="Depth" value={siteConfig?.geometry?.depth_m as number | undefined} unit="m" assumed={siteConfig?.is_assumed?.depth_m} />
            <GeologyFact
              label="Extraction thickness"
              value={siteConfig?.geometry?.extraction_thickness_m as number | undefined}
              unit="m"
              assumed={siteConfig?.is_assumed?.extraction_thickness_m}
            />
            <GeologyFact label="Extraction method" value={siteConfig?.geometry?.extraction_method as string | undefined} assumed={siteConfig?.is_assumed?.extraction_method} />
            <GeologyFact label="Status" value={siteConfig?.geometry?.status as string | undefined} assumed={siteConfig?.is_assumed?.status} />
          </div>
          <p className="text-[11px]" style={{ color: "var(--faint)" }}>
            From site setup - reused as configured, never fabricated. Values marked &quot;assumed&quot; were
            entered as placeholders during onboarding, not surveyed.
          </p>
        </div>
      )}

      {mineType === "longwall" && planningMode && (
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-4 flex-wrap"
          style={{ background: "color-mix(in srgb, var(--warning) 8%, var(--bg-elevated))", border: "1px dashed color-mix(in srgb, var(--warning) 45%, var(--border))" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--warning)" }}>
            Hypothetical
          </span>
          <label className="flex items-center gap-2 text-sm flex-1 min-w-45">
            <span style={{ color: "var(--muted)" }}>Project</span>
            <input type="range" min={0} max={30} value={hypotheticalDays} onChange={(e) => setHypotheticalDays(Number(e.target.value))} className="flex-1" />
            <span className="font-mono text-xs w-16 text-right">{hypotheticalDays} days</span>
          </label>
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            extrapolates existing model severities - not a re-run of the model
          </span>
        </div>
      )}

      {mineType === "bord_and_pillar" && (
        <div className="panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold">Structural susceptibility context</span>
            <span className="label-caveat">PHSR / CPHSR baseline - not available as a validated structural model</span>
          </div>
          {pillarWidthM != null && galleryWidthM != null ? (
            <p className="text-xs" style={{ color: "var(--faint)" }}>
              Pillar grid below is an illustrative pattern derived from configured dimensions
              (pillar {pillarWidthM}m / gallery {galleryWidthM}m) - not surveyed pillar positions.
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--faint)" }}>
              No pillar/gallery dimensions configured yet - complete{" "}
              <Link href="/setup" className="underline">
                site setup
              </Link>{" "}
              to see a dimension-derived grid.
            </p>
          )}
          <label className="flex items-center gap-3 text-sm">
            <span style={{ color: "var(--muted)" }}>Extraction / mining progression</span>
            <input
              type="range"
              min={0}
              max={100}
              value={effectiveExtractionPct}
              onChange={(e) => setExtractionPct(clampExtractionPct(Number(e.target.value)))}
              className="flex-1"
            />
            <span className="font-mono text-xs w-10 text-right">{Math.round(effectiveExtractionPct)}%</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="panel-2 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>PHSR / CPHSR baseline</div>
              <div className="text-sm mt-1" style={{ color: "var(--faint)" }}>Illustrative planning baseline - not available as a validated structural model</div>
            </div>
            <div className="panel-2 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>Combined indicator (illustrative)</div>
              <IllustrativeSusceptibilityBadge value={combinedIllustrativeIndicator} />
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "var(--faint)" }}>
            The combined indicator blends live node risk with the extraction % slider via a simple,
            unvalidated formula for demonstration - it is not a structural engineering model and is
            never written back to operational risk, alerts, predictions, or InSAR.
          </p>

          <div className="flex items-center gap-4 flex-wrap pt-2 mt-1 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#7891ad" }} />
              Pillar (remaining)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#8a5a42", opacity: 0.7 }} />
              Extracted panel
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#9fb4cc", opacity: 0.6 }} />
              Roof / overlying strata (illustrative)
            </span>
          </div>

          {viewMode === "technical" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <GeologyFact label="Rock-to-soil ratio" value={siteConfig?.geology?.rock_to_soil_ratio as number | undefined} assumed={siteConfig?.is_assumed?.rock_to_soil_ratio} />
              <GeologyFact label="Brittleness index" value={siteConfig?.geology?.brittleness_index as number | undefined} assumed={siteConfig?.is_assumed?.brittleness_index} />
              <GeologyFact
                label="Rock density"
                value={siteConfig?.geology?.rock_density as number | undefined}
                unit="kg/m3"
                assumed={siteConfig?.is_assumed?.rock_density}
              />
              {siteConfig?.data_sources?.use_static_geology_fixture === true && (
                <p className="text-[11px] sm:col-span-3" style={{ color: "var(--faint)" }}>
                  Geology values are from a static onboarding fixture, not a live geological survey feed.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="panel overflow-hidden" style={{ height: 480 }}>
        {nodesQuery.isLoading ? (
          <p className="p-4" style={{ color: "var(--muted)" }}>
            Loading nodes...
          </p>
        ) : (
          <TwinScene
            nodes={nodes}
            predictedZone={predictedZone}
            scrubT={effectiveScrubT}
            mode={mineType}
            pillarGeometry={pillarWidthM != null && galleryWidthM != null ? { pillarWidthM, galleryWidthM } : null}
            extractionPct={effectiveExtractionPct}
          />
        )}
      </div>

      {mineType === "longwall" && (
        <div className="panel p-4 flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            Past
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={scrubT}
            onChange={(e) => setScrubT(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            Predicted
          </span>
        </div>
      )}
    </div>
  );
}

// Replaces a single cramped run-on line ("Predicted deformation (model
// output - not observed). model_version: X - confidence: Y") with a clear
// primary claim + secondary metadata, visually subordinate to the 3D scene
// itself (small text, panel-2 background, muted colors). Wording content
// is unchanged - "Predicted deformation" / "Model output - not observed"
// - only the layout changed. Never relabels this as measured/observed.
function PredictionMetadataBar({
  modelVersion,
  confidence,
  isStale,
}: {
  modelVersion: string | null;
  confidence: number | null;
  isStale: boolean;
}) {
  return (
    <div className="panel-2 rounded-lg px-3.5 py-2.5 flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-semibold">Predicted deformation</span>
        <span className="label-caveat">model output &mdash; not observed</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs" style={{ color: "var(--faint)" }}>
        <span>
          Model version <span className="ml-1.5 font-mono" style={{ color: "var(--muted)" }}>{modelVersion ?? "—"}</span>
        </span>
        <span>
          Confidence <span className="ml-1.5 font-mono" style={{ color: "var(--muted)" }}>{confidence ?? "—"}</span>
        </span>
        {isStale && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ color: "var(--warning)", background: "color-mix(in srgb, var(--warning) 14%, transparent)" }}
          >
            Status: stale
          </span>
        )}
      </div>
    </div>
  );
}

// Persistent, always-visible - never conditional on view mode or mine type
// - so this reads as a fixed fact about the page, not a dismissible aside.
function IllustrativeModelBanner() {
  return (
    <div
      className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }}
    >
      <span aria-hidden>&#9678;</span>
      <span>
        <strong style={{ color: "var(--foreground)" }}>Illustrative model</strong> &mdash; not a validated
        physical simulation.
      </span>
    </div>
  );
}

function GeologyFact({
  label,
  value,
  unit,
  assumed,
}: {
  label: string;
  value: number | string | undefined;
  unit?: string;
  assumed?: boolean;
}) {
  return (
    <div className="panel-2 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--faint)" }}>
        {label}
        {assumed === true && (
          <span
            className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded"
            style={{ color: "var(--warning)", background: "color-mix(in srgb, var(--warning) 14%, transparent)" }}
          >
            assumed
          </span>
        )}
      </div>
      <div className="text-sm mt-0.5 font-mono">{formatConfiguredValue(value, unit)}</div>
    </div>
  );
}
