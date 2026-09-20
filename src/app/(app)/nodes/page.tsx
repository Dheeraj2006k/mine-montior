"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";
import { HealthBadge } from "@/components/status/health-badge";
import { RiskBadge } from "@/components/status/risk-badge";
import { SourceBadge } from "@/components/status/source-badge";
import { MockPositionLabel } from "@/components/labels";
import type { HealthState } from "@/lib/domain/node-health";

type NodeRow = {
  node_id: number;
  label: string;
  is_mock: boolean;
  latest_risk_score: number | null;
  last_seen_at: string | null;
  packet_loss_pct: number | null;
  health_state: HealthState;
  registered_at?: string | null;
  baseline_reading_id?: number | null;
};

type RegistrationDraft = {
  node_id: string;
  label: string;
  source: "mock" | "real";
  latitude: string;
  longitude: string;
};

const emptyDraft: RegistrationDraft = { node_id: "", label: "", source: "mock", latitude: "", longitude: "" };

function RegisterNodePanel({ onRegistered }: { onRegistered: () => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RegistrationDraft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: Number(draft.node_id),
          label: draft.label,
          source: draft.source,
          latitude: Number(draft.latitude),
          longitude: Number(draft.longitude),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `Registration failed (${res.status})`);
      setDraft(emptyDraft);
      setOpen(false);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Register node
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-4 md:p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Register node</h2>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--faint)" }}>Node ID</span>
          <input className="input" type="number" required value={draft.node_id} onChange={(e) => setDraft((d) => ({ ...d, node_id: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--faint)" }}>Label</span>
          <input className="input" required value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Node_03" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs" style={{ color: "var(--faint)" }}>Source</span>
        <div className="flex gap-2">
          {(["mock", "real"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, source: s }))}
              className="btn flex-1 capitalize"
              style={draft.source === s ? { background: "var(--surface-hover)", borderColor: "var(--border-strong)" } : undefined}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: "var(--faint)" }}>
          {draft.source === "real"
            ? "Captured once at installation via a registration device - not continuous GNSS tracking."
            : "Illustrative position for this prototype cycle - never real GNSS."}
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            {draft.source === "real" ? "GNSS latitude" : "Map latitude"}
          </span>
          <input className="input" type="number" step="any" required value={draft.latitude} onChange={(e) => setDraft((d) => ({ ...d, latitude: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            {draft.source === "real" ? "GNSS longitude" : "Map longitude"}
          </span>
          <input className="input" type="number" step="any" required value={draft.longitude} onChange={(e) => setDraft((d) => ({ ...d, longitude: e.target.value }))} />
        </label>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--offline)" }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary self-start" disabled={submitting}>
        {submitting ? "Registering..." : "Register node"}
      </button>
    </form>
  );
}

type SortKey = "label" | "risk" | "last_seen";

const HEALTH_FILTERS = ["all", "normal", "warning", "unknown", "stale", "offline"] as const;

export default function NodesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
    refetchInterval: 5000,
  });
  const allNodes = query.data?.data ?? [];

  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<(typeof HEALTH_FILTERS)[number]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "mock" | "real">("all");
  const [sortKey, setSortKey] = useState<SortKey>("label");

  const nodes = allNodes
    .filter((n) => (search.trim() ? n.label.toLowerCase().includes(search.trim().toLowerCase()) : true))
    .filter((n) => (healthFilter === "all" ? true : n.health_state === healthFilter))
    .filter((n) => (sourceFilter === "all" ? true : sourceFilter === "mock" ? n.is_mock : !n.is_mock))
    .sort((a, b) => {
      if (sortKey === "risk") return (b.latest_risk_score ?? -1) - (a.latest_risk_score ?? -1);
      if (sortKey === "last_seen") return (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "");
      return a.label.localeCompare(b.label);
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Nodes</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            {nodes.length} of {allNodes.length} sensor node{allNodes.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <MockPositionLabel />
        </div>
      </div>

      <RegisterNodePanel onRegistered={() => queryClient.invalidateQueries({ queryKey: ["nodes"] })} />

      <div className="flex items-center gap-2.5 flex-wrap">
        <input className="input flex-1 min-w-45" placeholder="Search nodes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as typeof healthFilter)}>
          {HEALTH_FILTERS.map((h) => (
            <option key={h} value={h}>
              {h === "all" ? "All health states" : h}
            </option>
          ))}
        </select>
        <select className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}>
          <option value="all">Real + mock</option>
          <option value="real">Real only</option>
          <option value="mock">Mock only</option>
        </select>
        <select className="input" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="label">Sort: label</option>
          <option value="risk">Sort: risk score</option>
          <option value="last_seen">Sort: last seen</option>
        </select>
      </div>

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Source</th>
              <th>Health</th>
              <th>Risk score</th>
              <th>Baseline</th>
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
                  <SourceBadge isMock={n.is_mock} registered={!!n.registered_at} />
                </td>
                <td>
                  <HealthBadge state={n.health_state} />
                </td>
                <td>
                  <RiskBadge score={n.latest_risk_score} />
                </td>
                <td className="text-xs" style={{ color: n.baseline_reading_id ? "var(--normal)" : "var(--faint)" }}>
                  {!n.registered_at ? "not registered" : n.baseline_reading_id ? "captured" : "pending first reading"}
                </td>
                <td style={{ color: "var(--muted)" }}>
                  {n.packet_loss_pct != null ? `${n.packet_loss_pct}%` : "—"}
                </td>
                <td style={{ color: "var(--muted)" }}>
                  {n.last_seen_at ? new Date(n.last_seen_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nodes.length === 0 && !query.isLoading && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            {allNodes.length === 0 ? "No nodes seeded yet." : "No nodes match these filters."}
          </p>
        )}
      </div>
    </div>
  );
}
