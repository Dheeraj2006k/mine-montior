"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type Dependency = { name: string; status: "ok" | "degraded" | "down"; detail: string };
type NodeStatus = { label: string; state: string; last_seen_at: string | null };

const STATUS_ICON: Record<Dependency["status"], string> = { ok: "🟢", degraded: "🟡", down: "🔴" };

export default function SystemHealthPage() {
  const query = useQuery({
    queryKey: ["system-health"],
    queryFn: () => apiGet<{ dependencies: Dependency[]; nodes: NodeStatus[] }>("/api/system/health"),
  });
  const dependencies = query.data?.data.dependencies ?? [];
  const nodes = query.data?.data.nodes ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">System health</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Per PRD §11.6 — the scheduled ML pass row exists specifically because a silently-dead
        background job is otherwise invisible. This page is the thing meant to notice.
      </p>

      <section className="panel divide-y" style={{ borderColor: "var(--border)" }}>
        {dependencies.map((d) => (
          <div key={d.name} className="px-4 py-3 flex items-center justify-between">
            <span className="font-medium">{d.name.replace(/_/g, " ")}</span>
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {STATUS_ICON[d.status]} {d.detail}
            </span>
          </div>
        ))}
      </section>

      <section className="panel divide-y" style={{ borderColor: "var(--border)" }}>
        {nodes.map((n) => (
          <div key={n.label} className="px-4 py-3 flex items-center justify-between">
            <span className="font-medium">{n.label}</span>
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {n.state} · last packet {n.last_seen_at ? new Date(n.last_seen_at).toLocaleString() : "never"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
