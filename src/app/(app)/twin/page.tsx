"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiGet } from "@/lib/api/client";
import { MockPositionLabel } from "@/components/labels";
import { RiskBadge } from "@/components/status/risk-badge";
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
  mining_state: Record<string, unknown>;
} | null;

export default function TwinPage() {
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
  // configured/slider extraction % via a simple, explicitly-labeled
  // formula. Not a validated PHSR/CPHSR structural model - none exists in
  // this codebase yet (no such adapter, no such data source).
  const combinedIllustrativeIndicator =
    maxLiveRisk != null ? Math.min(1, maxLiveRisk * 0.7 + (effectiveExtractionPct / 100) * 0.3) : null;

  // Planning mode extrapolates the existing real predicted_zone severities
  // forward by a user-chosen number of days - still driven entirely by
  // real model output, just scaled, and always visually and textually
  // labeled hypothetical (PRD-2 §4: "rendered result visually distinct...
  // and labeled 'Hypothetical'").
  const hypotheticalMultiplier = 1 + Math.min(1, hypotheticalDays / 30) * 0.6;
  const effectiveScrubT = mineType === "longwall" && planningMode ? Math.min(1, scrubT * hypotheticalMultiplier) : scrubT;

  if (reduceMotion) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Digital twin</h1>
          <button className="btn btn-ghost text-xs" onClick={() => setReduceMotion(false)}>
            Enable 3D view
          </button>
        </div>
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
        <div className="flex items-center gap-2">
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

      <div className="label-caveat">
        Predicted deformation (model output - not observed). model_version:{" "}
        {prediction?.model_version ?? "-"} - confidence:{" "}
        {prediction?.time_to_threshold.confidence ?? "-"}
        {prediction?.is_stale && " - STALE"}
      </div>

      {!hasPrediction && mineType === "longwall" && (
        <p className="text-xs" style={{ color: "var(--faint)" }}>
          No prediction data available yet (ML service not connected in this build) - the terrain
          below is intentionally flat. Flat is not a claim of zero risk; it means no prediction
          exists to render.
        </p>
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
            <span className="label-caveat">PHSR/CPHSR not available - no structural model integrated yet</span>
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
            <span style={{ color: "var(--muted)" }}>Extraction %</span>
            <input
              type="range"
              min={0}
              max={100}
              value={effectiveExtractionPct}
              onChange={(e) => setExtractionPct(Number(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono text-xs w-10 text-right">{Math.round(effectiveExtractionPct)}%</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="panel-2 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>PHSR (baseline)</div>
              <div className="text-sm mt-1" style={{ color: "var(--faint)" }}>fixed - not computed</div>
            </div>
            <div className="panel-2 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>Combined indicator (illustrative)</div>
              {combinedIllustrativeIndicator != null ? <RiskBadge score={combinedIllustrativeIndicator} /> : <span className="text-sm" style={{ color: "var(--faint)" }}>-</span>}
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "var(--faint)" }}>
            The combined indicator blends live node risk with the extraction % slider via a simple,
            unvalidated formula for demonstration - it is not a structural engineering model.
          </p>
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
