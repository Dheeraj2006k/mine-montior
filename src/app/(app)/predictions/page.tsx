"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { ConfidenceBadge } from "@/components/status/confidence-badge";
import { useTerm, useViewMode, useTrendCopy } from "@/components/view-mode/view-mode-context";

type PredictedZoneEntry = { node_id?: number; severity_0_to_1?: number };
type NodeRow = { node_id: number; label: string };

type PredictionData = {
  model_version: string;
  predicted_zone: PredictedZoneEntry[];
  trend: string;
  time_to_threshold: { low_days: number | null; high_days: number | null; confidence: number | null };
  generated_at: string | null;
  is_stale: boolean;
};

type SiteConfigData = { mine_type: "longwall" | "bord_and_pillar" } | null;

export default function PredictionsPage() {
  const { mode } = useViewMode();
  const predictionQuery = useQuery({
    queryKey: ["prediction"],
    queryFn: () => apiGet<PredictionData>("/api/predictions/latest"),
    refetchInterval: 10000,
  });
  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const siteConfigQuery = useQuery({
    queryKey: ["site-config"],
    queryFn: () => apiGet<SiteConfigData>("/api/site-config"),
  });

  const stabilityLabel = useTerm("fuzzyRiskIndex");
  const trendLabel = useTerm("trend");
  const actionWindowLabel = useTerm("timeToThreshold");

  const prediction = predictionQuery.data?.data;
  const source = predictionQuery.data?.meta.source;
  const nodeLabelById = new Map((nodesQuery.data?.data ?? []).map((n) => [n.node_id, n.label]));
  const zoneEntries = (prediction?.predicted_zone ?? []).filter(
    (e): e is Required<PredictedZoneEntry> => typeof e.node_id === "number" && typeof e.severity_0_to_1 === "number",
  );
  const mineType = siteConfigQuery.data?.data?.mine_type ?? "longwall";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Predictions</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            {mode === "technical" ? "Fuzzy Risk Index-derived model output - never a measurement." : "Model-based outlook, not a measurement."}
          </p>
        </div>
        {prediction && (
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
              style={{
                color: source === "live" ? "var(--normal)" : "var(--faint)",
                background: source === "live" ? "color-mix(in srgb, var(--normal) 14%, transparent)" : "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              {source === "live" ? "live" : "mock"}
            </span>
            {prediction.is_stale && (
              <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5" style={{ color: "var(--warning)", background: "color-mix(in srgb, var(--warning) 14%, transparent)", border: "1px solid var(--border)" }}>
                stale
              </span>
            )}
          </div>
        )}
      </div>

      {mineType === "bord_and_pillar" && (
        <p className="label-caveat self-start">
          Bord-and-pillar GP residual trend + uncertainty band UI is not yet wired to a data source
          (no such field exists in the predictions schema yet) - showing the generic prediction feed below.
        </p>
      )}

      <div className="panel p-4 md:p-5">
        {!prediction || zoneEntries.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Prediction not available yet&hellip;
            </p>
            <p className="text-xs" style={{ color: "var(--faint)" }}>
              The ML service hasn&apos;t written a result. This is an honest empty state, not a placeholder.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{trendLabel}</div>
                <PredictionTrendValue trend={prediction.trend} />
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{actionWindowLabel}</div>
                <div className="text-lg font-semibold mt-0.5">
                  {prediction.time_to_threshold.low_days != null && prediction.time_to_threshold.high_days != null
                    ? `${prediction.time_to_threshold.low_days}-${prediction.time_to_threshold.high_days}d`
                    : "-"}
                </div>
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>Confidence</div>
                <ConfidenceBadge value={prediction.time_to_threshold.confidence} />
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Model version</div>
                <div className="text-lg font-semibold mt-0.5 font-mono truncate">{prediction.model_version}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Generated at</div>
                <div className="text-sm mt-0.5">{prediction.generated_at ? new Date(prediction.generated_at).toLocaleString() : "—"}</div>
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{stabilityLabel} zones</div>
                <div className="text-sm mt-0.5">{zoneEntries.length} node{zoneEntries.length === 1 ? "" : "s"} with a predicted severity</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--faint)" }}>Predicted zone severity by node</div>
              <div className="flex flex-col gap-2">
                {zoneEntries
                  .slice()
                  .sort((a, b) => b.severity_0_to_1 - a.severity_0_to_1)
                  .map((z) => (
                    <div key={z.node_id} className="flex items-center gap-3">
                      <span className="text-xs w-20 shrink-0 font-medium">{nodeLabelById.get(z.node_id) ?? `Node ${z.node_id}`}</span>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(z.severity_0_to_1 * 100)}%`,
                            background:
                              z.severity_0_to_1 >= 0.85 ? "var(--offline)" : z.severity_0_to_1 >= 0.65 ? "var(--stale)" : z.severity_0_to_1 >= 0.4 ? "var(--warning)" : "var(--normal)",
                          }}
                        />
                      </div>
                      <span className="text-xs w-10 text-right font-mono" style={{ color: "var(--faint)" }}>{z.severity_0_to_1.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <p className="label-caveat self-start">
              Model output - not observed. Never render as a single date, always a range.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PredictionTrendValue({ trend }: { trend: string }) {
  const { arrow, text, color } = useTrendCopy(trend);
  return (
    <div className="text-lg font-semibold mt-0.5 flex items-center gap-1.5" style={{ color }}>
      <span>{arrow}</span>
      <span>{text}</span>
    </div>
  );
}
