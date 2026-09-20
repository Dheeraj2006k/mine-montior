"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { SimulateOfflinePanel } from "@/components/system/simulate-offline-panel";

type Dependency = { name: string; status: "ok" | "degraded" | "down"; detail: string };
type NodeStatus = { label: string; state: string; last_seen_at: string | null };
type NodeRow = { node_id: number; label: string };

const STATUS_COLOR: Record<Dependency["status"], string> = {
  ok: "var(--normal)",
  degraded: "var(--warning)",
  down: "var(--offline)",
};

const STATUS_LABEL: Record<Dependency["status"], string> = {
  ok: "OK",
  degraded: "DEGRADED",
  down: "DOWN",
};

function StatusBadge({ status }: { status: Dependency["status"] }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="badge"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span aria-hidden>{status === "ok" ? "●" : status === "degraded" ? "▲" : "✕"}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function SystemHealthPage() {
  const query = useQuery({
    queryKey: ["system-health"],
    queryFn: () => apiGet<{ dependencies: Dependency[]; nodes: NodeStatus[] }>("/api/system/health"),
    refetchInterval: 15000,
  });
  const dependencies = query.data?.data.dependencies ?? [];
  const nodes = query.data?.data.nodes ?? [];
  const checkedAt = query.data?.meta.generated_at;

  const nodesQuery = useQuery({
    queryKey: ["nodes-summary"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const nodeSummaries = nodesQuery.data?.data ?? [];

  const okCount = dependencies.filter((d) => d.status === "ok").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">System health</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            The scheduled ML pass row exists specifically because a silently-dead background job
            is otherwise invisible - this page is what&apos;s meant to notice.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            {dependencies.length > 0 ? `${okCount}/${dependencies.length} OK` : ""}
          </span>
          {checkedAt && (
            <span className="text-xs" style={{ color: "var(--faint)" }}>
              checked {new Date(checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b text-xs font-semibold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
          Dependencies
        </div>
        {dependencies.map((d) => (
          <div
            key={d.name}
            className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0 gap-3"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm font-medium capitalize">{d.name.replace(/_/g, " ")}</span>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-right" style={{ color: "var(--muted)" }}>
                {d.detail}
              </span>
              <StatusBadge status={d.status} />
            </div>
          </div>
        ))}
        {dependencies.length === 0 && !query.isLoading && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No dependency data returned.
          </p>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b text-xs font-semibold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
          Node liveness
        </div>
        {nodes.map((n) => (
          <div
            key={n.label}
            className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm font-medium">{n.label}</span>
            <span className="text-sm capitalize" style={{ color: "var(--muted)" }}>
              {n.state} &middot; last packet {n.last_seen_at ? new Date(n.last_seen_at).toLocaleString() : "never"}
            </span>
          </div>
        ))}
        {nodes.length === 0 && !query.isLoading && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No nodes seeded yet.
          </p>
        )}
      </section>

      <SimulateOfflinePanel
        disabled={dependencies.find((d) => d.name === "voice_provider")?.status === "ok"}
        nodes={nodeSummaries}
      />
    </div>
  );
}
