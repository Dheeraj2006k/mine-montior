"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";
import { HealthBadge } from "@/components/status/health-badge";
import { RiskBadge } from "@/components/status/risk-badge";
import { MockPositionLabel, FuzzyIndexLabel } from "@/components/labels";
import { MineMap, type MapNode } from "@/components/map/mine-map";
import { LiveSensorFeed } from "@/components/nodes/live-sensor-feed";
import type { HealthState } from "@/lib/domain/node-health";

type NodeRow = {
  node_id: number;
  site_id: string;
  label: string;
  mock_latitude: number;
  mock_longitude: number;
  is_mock: boolean;
  latest_risk_score: number | null;
  last_seen_at: string | null;
  packet_loss_pct: number | null;
  health_state: HealthState;
};

type AlertRow = {
  id: number;
  severity: string;
  state: string;
  summary: string;
  created_at: string;
};

type PredictedZoneEntry = { node_id?: number; severity_0_to_1?: number };

type PredictionRow = {
  model_version: string;
  predicted_zone: PredictedZoneEntry[];
  trend: string;
  time_to_threshold: { low_days: number | null; high_days: number | null; confidence: number | null };
  generated_at: string | null;
  is_stale: boolean;
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--unknown)",
  warning: "var(--warning)",
  high: "var(--stale)",
  critical: "var(--offline)",
};

const TREND_STYLE: Record<string, { arrow: string; color: string }> = {
  accelerating: { arrow: "↑", color: "var(--offline)" },
  stable: { arrow: "→", color: "var(--muted)" },
  decelerating: { arrow: "↓", color: "var(--normal)" },
};

export default function DashboardPage() {
  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const alertsQuery = useQuery({
    queryKey: ["alerts", "all"],
    queryFn: () => apiGet<AlertRow[]>("/api/alerts"),
  });
  const predictionQuery = useQuery({
    queryKey: ["prediction"],
    queryFn: () => apiGet<PredictionRow>("/api/predictions/latest"),
  });

  const nodes = nodesQuery.data?.data ?? [];
  const alerts = (alertsQuery.data?.data ?? []).filter(
    (a) => a.state === "new" || a.state === "notified",
  );
  const mapNodes: MapNode[] = nodes.map((n) => ({
    node_id: n.node_id,
    label: n.label,
    mock_latitude: n.mock_latitude,
    mock_longitude: n.mock_longitude,
    health_state: n.health_state,
    latest_risk_score: n.latest_risk_score,
  }));

  const healthy = nodes.filter((n) => n.health_state === "normal").length;
  const maxRisk = nodes.length > 0 ? Math.max(...nodes.map((n) => n.latest_risk_score ?? 0)) : null;

  const prediction = predictionQuery.data?.data;
  const predictionSource = predictionQuery.data?.meta.source;
  const nodeLabelById = new Map(nodes.map((n) => [n.node_id, n.label]));
  const zoneEntries = (prediction?.predicted_zone ?? []).filter(
    (e): e is Required<PredictedZoneEntry> => typeof e.node_id === "number" && typeof e.severity_0_to_1 === "number",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Command Center</h1>
        <p className="text-sm text-muted mt-0.5" style={{ color: "var(--muted)" }}>
          Live sensor and alert status for SIH-DEMO-01
        </p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Nodes" value={nodes.length} />
        <StatTile
          label="Healthy"
          value={`${healthy}/${nodes.length}`}
          tone={nodes.length > 0 && healthy < nodes.length ? "warning" : undefined}
        />
        <StatTile
          label="Active alerts"
          value={alerts.length}
          tone={alerts.length > 0 ? "danger" : undefined}
        />
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
            Peak risk
          </div>
          <div className="mt-1.5">
            {maxRisk != null ? <RiskBadge score={maxRisk} size="lg" /> : <span className="text-2xl font-semibold">—</span>}
          </div>
          <div className="mt-1.5">
            <FuzzyIndexLabel />
          </div>
        </div>
      </section>

      <LiveSensorFeed nodes={nodes.map((n) => ({ node_id: n.node_id, label: n.label, health_state: n.health_state }))} />

      <section className="panel p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Node map</h2>
          <MockPositionLabel />
        </div>
        {nodesQuery.isLoading ? (
          <p className="text-sm text-muted" style={{ color: "var(--muted)" }}>
            Loading nodes…
          </p>
        ) : (
          <MineMap nodes={mapNodes} />
        )}
      </section>

      <section className="panel p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold">Prediction</h2>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
              style={{
                color: predictionSource === "live" ? "var(--normal)" : "var(--faint)",
                background:
                  predictionSource === "live"
                    ? "color-mix(in srgb, var(--normal) 14%, transparent)"
                    : "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              {predictionSource === "live" ? "live" : "mock"}
            </span>
            {prediction?.is_stale && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                style={{
                  color: "var(--warning)",
                  background: "color-mix(in srgb, var(--warning) 14%, transparent)",
                  border: "1px solid var(--border)",
                }}
              >
                stale
              </span>
            )}
            <Link href="/twin" className="text-xs text-muted hover:text-foreground" style={{ color: "var(--muted)" }}>
              View in 3D twin →
            </Link>
          </div>
        </div>

        {!prediction || zoneEntries.length === 0 ? (
          <p className="text-sm text-muted" style={{ color: "var(--muted)" }}>
            No prediction available yet — the ML service hasn&apos;t written a result. This is an
            honest empty state, not a placeholder.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
                  Trend
                </div>
                <div
                  className="text-lg font-semibold mt-0.5 flex items-center gap-1.5"
                  style={{ color: TREND_STYLE[prediction.trend]?.color ?? "var(--foreground)" }}
                >
                  <span>{TREND_STYLE[prediction.trend]?.arrow ?? "•"}</span>
                  <span className="capitalize">{prediction.trend}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
                  Time to threshold
                </div>
                <div className="text-lg font-semibold mt-0.5">
                  {prediction.time_to_threshold.low_days != null && prediction.time_to_threshold.high_days != null
                    ? `${prediction.time_to_threshold.low_days}–${prediction.time_to_threshold.high_days}d`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
                  Confidence
                </div>
                <div className="text-lg font-semibold mt-0.5">
                  {prediction.time_to_threshold.confidence != null
                    ? `${Math.round(prediction.time_to_threshold.confidence * 100)}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
                  Model version
                </div>
                <div className="text-lg font-semibold mt-0.5 font-mono">{prediction.model_version}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide text-faint mb-1.5" style={{ color: "var(--faint)" }}>
                Predicted zone severity by node
              </div>
              <div className="flex flex-col gap-1.5">
                {zoneEntries.map((z) => (
                  <div key={z.node_id} className="flex items-center gap-3">
                    <span className="text-xs w-16 shrink-0">{nodeLabelById.get(z.node_id) ?? `Node ${z.node_id}`}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(z.severity_0_to_1 * 100)}%`,
                          background:
                            z.severity_0_to_1 >= 0.85
                              ? "var(--offline)"
                              : z.severity_0_to_1 >= 0.65
                                ? "var(--stale)"
                                : z.severity_0_to_1 >= 0.4
                                  ? "var(--warning)"
                                  : "var(--normal)",
                        }}
                      />
                    </div>
                    <span className="text-xs text-faint w-10 text-right" style={{ color: "var(--faint)" }}>
                      {z.severity_0_to_1.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="label-caveat self-start">
              Model output — not observed. Never render as a single date, always a range.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold">Nodes</h2>
            <Link href="/nodes" className="text-xs text-muted hover:text-foreground" style={{ color: "var(--muted)" }}>
              View all →
            </Link>
          </div>
          <div>
            {nodes.map((n) => (
              <Link
                key={n.node_id}
                href={`/nodes/${n.node_id}`}
                className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{n.label}</span>
                  <RiskBadge score={n.latest_risk_score} />
                </div>
                <HealthBadge state={n.health_state} />
              </Link>
            ))}
            {nodes.length === 0 && !nodesQuery.isLoading && (
              <p className="px-4 md:px-5 py-6 text-sm text-muted" style={{ color: "var(--muted)" }}>
                No nodes seeded yet.
              </p>
            )}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold">Active alerts</h2>
            <Link href="/alerts" className="text-xs text-muted hover:text-foreground" style={{ color: "var(--muted)" }}>
              View all →
            </Link>
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 md:px-5 py-6 text-sm text-muted" style={{ color: "var(--muted)" }}>
              No active alerts.
            </p>
          ) : (
            <div>
              {alerts.map((a) => (
                <Link
                  key={a.id}
                  href={`/alerts/${a.id}`}
                  className="panel-row flex items-start gap-3 px-4 md:px-5 py-3 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="status-dot mt-1.5"
                    style={{ color: SEVERITY_COLOR[a.severity], background: SEVERITY_COLOR[a.severity] }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.summary}</div>
                    <div className="text-xs text-muted mt-0.5" style={{ color: "var(--muted)" }}>
                      {a.severity} · {a.state}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string | number;
  caption?: React.ReactNode;
  tone?: "warning" | "danger";
}) {
  const valueColor = tone === "danger" ? "var(--offline)" : tone === "warning" ? "var(--warning)" : "var(--foreground)";
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1.5" style={{ color: valueColor }}>
        {value}
      </div>
      {caption && <div className="mt-1.5">{caption}</div>}
    </div>
  );
}
