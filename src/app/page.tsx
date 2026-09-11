"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";
import { HealthBadge } from "@/components/status/health-badge";
import { MockPositionLabel, FuzzyIndexLabel } from "@/components/labels";
import { MineMap, type MapNode } from "@/components/map/mine-map";
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

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--unknown)",
  warning: "var(--warning)",
  high: "var(--stale)",
  critical: "var(--offline)",
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
        <StatTile
          label="Fuzzy Risk Index"
          value={maxRisk != null ? maxRisk.toFixed(2) : "—"}
          caption={<FuzzyIndexLabel />}
        />
      </section>

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
                  <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
                    risk {n.latest_risk_score?.toFixed(2) ?? "—"}
                  </span>
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
