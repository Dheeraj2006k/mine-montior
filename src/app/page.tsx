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

export default function DashboardPage() {
  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const alertsQuery = useQuery({
    queryKey: ["alerts", "active"],
    queryFn: () => apiGet<AlertRow[]>("/api/alerts?state=new"),
  });

  const nodes = nodesQuery.data?.data ?? [];
  const alerts = alertsQuery.data?.data ?? [];
  const mapNodes: MapNode[] = nodes.map((n) => ({
    node_id: n.node_id,
    label: n.label,
    mock_latitude: n.mock_latitude,
    mock_longitude: n.mock_longitude,
    health_state: n.health_state,
    latest_risk_score: n.latest_risk_score,
  }));

  const healthy = nodes.filter((n) => n.health_state === "normal").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Nodes" value={nodes.length} />
        <StatTile label="Healthy" value={`${healthy}/${nodes.length}`} />
        <StatTile label="Active alerts" value={alerts.length} />
        <StatTile
          label="Fuzzy Risk Index"
          value={
            nodes.length > 0
              ? Math.max(...nodes.map((n) => n.latest_risk_score ?? 0)).toFixed(2)
              : "—"
          }
          caption={<FuzzyIndexLabel />}
        />
      </section>

      <section className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Node map</h2>
          <MockPositionLabel />
        </div>
        {nodesQuery.isLoading ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Loading nodes…
          </p>
        ) : (
          <MineMap nodes={mapNodes} />
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-4">
          <h2 className="font-semibold mb-3">Nodes</h2>
          <ul className="flex flex-col gap-2">
            {nodes.map((n) => (
              <li key={n.node_id}>
                <Link
                  href={`/nodes/${n.node_id}`}
                  className="flex items-center justify-between panel-2 px-3 py-2 rounded-md hover:opacity-90"
                >
                  <span>{n.label}</span>
                  <HealthBadge state={n.health_state} />
                </Link>
              </li>
            ))}
            {nodes.length === 0 && !nodesQuery.isLoading && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No nodes seeded yet.
              </p>
            )}
          </ul>
        </div>

        <div className="panel p-4">
          <h2 className="font-semibold mb-3">Active alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No active alerts. (Alert engine is not built yet in this pass — this is a
              genuinely empty state, not a placeholder.)
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/alerts/${a.id}`} className="block panel-2 px-3 py-2 rounded-md">
                    <div className="text-sm font-medium">{a.summary}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {a.severity} · {a.state}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
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
}: {
  label: string;
  value: string | number;
  caption?: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {caption && <div className="mt-1">{caption}</div>}
    </div>
  );
}
