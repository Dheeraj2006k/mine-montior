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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nodes</h1>
        <MockPositionLabel />
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-2">Node</th>
              <th className="px-4 py-2">Health</th>
              <th className="px-4 py-2">Risk score</th>
              <th className="px-4 py-2">Packet loss</th>
              <th className="px-4 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.node_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2">
                  <Link href={`/nodes/${n.node_id}`} className="hover:underline">
                    {n.label}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <HealthBadge state={n.health_state} />
                </td>
                <td className="px-4 py-2">{n.latest_risk_score ?? "—"}</td>
                <td className="px-4 py-2">
                  {n.packet_loss_pct != null ? `${n.packet_loss_pct}%` : "—"}
                </td>
                <td className="px-4 py-2">
                  {n.last_seen_at ? new Date(n.last_seen_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nodes.length === 0 && !query.isLoading && (
          <p className="px-4 py-4 text-sm" style={{ color: "var(--muted)" }}>
            No nodes seeded yet.
          </p>
        )}
      </div>
    </div>
  );
}
