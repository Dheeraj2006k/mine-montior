"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";
import { HealthBadge } from "@/components/status/health-badge";
import { MockPositionLabel } from "@/components/labels";
import type { HealthState } from "@/lib/domain/node-health";

type NodeRow = {
  node_id: number;
  label: string;
  latest_risk_score: number | null;
  last_seen_at: string | null;
  packet_loss_pct: number | null;
  health_state: HealthState;
};

export default function NodesPage() {
  const query = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const nodes = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Nodes</h1>
          <p className="text-sm text-muted mt-0.5" style={{ color: "var(--muted)" }}>
            {nodes.length} sensor node{nodes.length === 1 ? "" : "s"}
          </p>
        </div>
        <MockPositionLabel />
      </div>

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Health</th>
              <th>Risk score</th>
              <th>Packet loss</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.node_id}>
                <td>
                  <Link href={`/nodes/${n.node_id}`} className="font-medium hover:underline">
                    {n.label}
                  </Link>
                </td>
                <td>
                  <HealthBadge state={n.health_state} />
                </td>
                <td className="text-muted" style={{ color: "var(--muted)" }}>
                  {n.latest_risk_score?.toFixed(2) ?? "—"}
                </td>
                <td className="text-muted" style={{ color: "var(--muted)" }}>
                  {n.packet_loss_pct != null ? `${n.packet_loss_pct}%` : "—"}
                </td>
                <td className="text-muted" style={{ color: "var(--muted)" }}>
                  {n.last_seen_at ? new Date(n.last_seen_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nodes.length === 0 && !query.isLoading && (
          <p className="px-4 py-6 text-sm text-muted" style={{ color: "var(--muted)" }}>
            No nodes seeded yet.
          </p>
        )}
      </div>
    </div>
  );
}
