"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import { apiGet } from "@/lib/api/client";
import { MockPositionLabel } from "@/components/labels";
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
};

type PredictionData = {
  model_version: string;
  predicted_zone: PredictedZoneEntry[];
  trend: string;
  time_to_threshold: { low_days: number | null; high_days: number | null; confidence: number | null };
  is_stale: boolean;
};

export default function TwinPage() {
  const [scrubT, setScrubT] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const predictionQuery = useQuery({
    queryKey: ["prediction"],
    queryFn: () => apiGet<PredictionData>("/api/predictions/latest"),
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

  if (reduceMotion) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Digital twin</h1>
          <button className="btn btn-ghost text-xs" onClick={() => setReduceMotion(false)}>
            Enable 3D view
          </button>
        </div>
        <p className="text-sm text-muted" style={{ color: "var(--muted)" }}>
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
          <h1 className="text-lg font-semibold">Digital twin</h1>
          <div className="mt-1">
            <MockPositionLabel />
          </div>
        </div>
        <button className="btn btn-ghost text-xs" onClick={() => setReduceMotion(true)}>
          Reduce motion / 2D only
        </button>
      </div>

      <div className="label-caveat">
        Predicted deformation (model output - not observed). model_version:{" "}
        {prediction?.model_version ?? "-"} - confidence:{" "}
        {prediction?.time_to_threshold.confidence ?? "-"}
        {prediction?.is_stale && " - STALE"}
      </div>

      {!hasPrediction && (
        <p className="text-xs text-faint" style={{ color: "var(--faint)" }}>
          No prediction data available yet (ML service not connected in this build) - the terrain
          below is intentionally flat. Flat is not a claim of zero risk; it means no prediction
          exists to render.
        </p>
      )}

      <div className="panel overflow-hidden" style={{ height: 480 }}>
        {nodesQuery.isLoading ? (
          <p className="p-4 text-muted" style={{ color: "var(--muted)" }}>
            Loading nodes...
          </p>
        ) : (
          <TwinScene nodes={nodes} predictedZone={predictedZone} scrubT={scrubT} />
        )}
      </div>

      <div className="panel p-4 flex items-center gap-3">
        <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
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
        <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
          Predicted
        </span>
      </div>
    </div>
  );
}
