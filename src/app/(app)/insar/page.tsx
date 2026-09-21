"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { LosDisplacementLabel, SinglePairLabel, NoDataLegend } from "@/components/labels";

type InsarLayer = {
  site_id: string;
  acquisition_dates: { from: string; to: string } | null;
  bbox: [number, number, number, number] | null;
  crs: string | null;
  coherence_threshold: number;
  available: boolean;
};

type InsarNodeFeature = {
  node_id: number;
  insar_los_velocity_mm: number | null;
  insar_coherence: number | null;
  no_data: boolean;
  raster_date: string;
};

type NodeRow = { node_id: number; label: string };

export default function InsarPage() {
  const layerQuery = useQuery({
    queryKey: ["insar-layer"],
    queryFn: () => apiGet<InsarLayer>("/api/insar/layer"),
  });
  const nodesFeatureQuery = useQuery({
    queryKey: ["insar-nodes"],
    queryFn: () => apiGet<InsarNodeFeature[]>("/api/insar/nodes"),
  });
  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });

  const layer = layerQuery.data?.data;
  const features = nodesFeatureQuery.data?.data ?? [];
  const nodeLabelById = new Map((nodesQuery.data?.data ?? []).map((n) => [n.node_id, n.label]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">InSAR</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Satellite line-of-sight displacement - never automatically vertical subsidence.
          </p>
        </div>
        <LosDisplacementLabel />
      </div>

      <section className="panel p-4 md:p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Acquisition</h2>
        {!layer || !layer.available ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Waiting for satellite observation&hellip;
            </p>
            <p className="text-xs" style={{ color: "var(--faint)" }}>
              No InSAR observation available yet - the InSAR team hasn&apos;t populated a raster for
              this site. This is an honest empty state, not a placeholder.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SinglePairLabel from={layer.acquisition_dates?.from ?? null} to={layer.acquisition_dates?.to ?? null} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Coherence threshold</div>
                <div className="text-sm mt-0.5 font-mono">{layer.coherence_threshold}</div>
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>CRS</div>
                <div className="text-sm mt-0.5 font-mono">{layer.crs ?? "—"}</div>
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Bounding box</div>
                <div className="text-sm mt-0.5 font-mono">{layer.bbox ? layer.bbox.join(", ") : "—"}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold">Per-node LOS displacement</h2>
          <NoDataLegend />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>LOS displacement (mm)</th>
              <th>Coherence</th>
              <th>Raster date</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.node_id}>
                <td className="font-medium">{nodeLabelById.get(f.node_id) ?? `Node ${f.node_id}`}</td>
                <td style={{ color: f.no_data ? "var(--faint)" : "var(--foreground)" }}>
                  {f.no_data ? "no data (low coherence)" : f.insar_los_velocity_mm != null ? f.insar_los_velocity_mm.toFixed(2) : "—"}
                </td>
                <td style={{ color: "var(--muted)" }}>{f.insar_coherence != null ? f.insar_coherence.toFixed(2) : "—"}</td>
                <td style={{ color: "var(--muted)" }}>{f.raster_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {features.length === 0 && !nodesFeatureQuery.isLoading && (
          <p className="px-4 md:px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No InSAR node features ingested yet.
          </p>
        )}
      </section>
    </div>
  );
}
