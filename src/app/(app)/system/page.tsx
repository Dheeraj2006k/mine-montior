"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type Dependency = { name: string; status: "ok" | "degraded" | "down"; detail: string };
type NodeStatus = { label: string; state: string; last_seen_at: string | null };

const STATUS_COLOR: Record<Dependency["status"], string> = {
  ok: "var(--normal)",
  degraded: "var(--warning)",
  down: "var(--offline)",
};

export default function SystemHealthPage() {
  const query = useQuery({
    queryKey: ["system-health"],
    queryFn: () => apiGet<{ dependencies: Dependency[]; nodes: NodeStatus[] }>("/api/system/health"),
  });
  const dependencies = query.data?.data.dependencies ?? [];
  const nodes = query.data?.data.nodes ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">System health</h1>
        <p className="text-sm text-muted mt-1" style={{ color: "var(--muted)" }}>
          The scheduled ML pass row exists specifically because a silently-dead background job
          is otherwise invisible - this page is what&apos;s meant to notice.
        </p>
      </div>

      <section className="panel overflow-hidden">
        {dependencies.map((d) => (
          <div
            key={d.name}
            className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm font-medium capitalize">{d.name.replace(/_/g, " ")}</span>
            <span className="flex items-center gap-2 text-sm text-muted" style={{ color: "var(--muted)" }}>
              <span className="status-dot" style={{ color: STATUS_COLOR[d.status], background: STATUS_COLOR[d.status] }} />
              {d.detail}
            </span>
          </div>
        ))}
      </section>

      <section className="panel overflow-hidden">
        {nodes.map((n) => (
          <div
            key={n.label}
            className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm font-medium">{n.label}</span>
            <span className="text-sm text-muted" style={{ color: "var(--muted)" }}>
              {n.state} - last packet {n.last_seen_at ? new Date(n.last_seen_at).toLocaleString() : "never"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
