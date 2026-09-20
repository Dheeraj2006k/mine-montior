"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";

type AlertRow = {
  id: number;
  node_id: number | null;
  severity: string;
  state: string;
  summary: string;
  reason: string;
  created_at: string;
  blast_suspected: boolean;
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--unknown)",
  warning: "var(--warning)",
  high: "var(--stale)",
  critical: "var(--offline)",
};

type TabKey = "active" | "acknowledged" | "resolved" | "all";

const TABS: { key: TabKey; label: string; states: string[] | null }[] = [
  { key: "active", label: "Active", states: ["new", "notified"] },
  { key: "acknowledged", label: "Acknowledged", states: ["acknowledged"] },
  { key: "resolved", label: "Resolved", states: ["resolved", "dismissed"] },
  { key: "all", label: "All", states: null },
];

export default function AlertsPage() {
  const [tab, setTab] = useState<TabKey>("active");
  const [severity, setSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["alerts", "all"],
    queryFn: () => apiGet<AlertRow[]>("/api/alerts"),
    refetchInterval: 5000,
  });
  const allAlerts = useMemo(() => query.data?.data ?? [], [query.data]);

  const activeStates = TABS.find((t) => t.key === tab)?.states;
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { active: 0, acknowledged: 0, resolved: 0, all: allAlerts.length };
    for (const t of TABS) {
      if (t.states) c[t.key] = allAlerts.filter((a) => t.states!.includes(a.state)).length;
    }
    return c;
  }, [allAlerts]);

  const filtered = allAlerts.filter((a) => {
    if (activeStates && !activeStates.includes(a.state)) return false;
    if (severity !== "all" && a.severity !== severity) return false;
    if (search.trim() && !a.summary.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Alerts</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          {allAlerts.length} total
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            style={{
              color: tab === t.key ? "var(--foreground)" : "var(--muted)",
              background: tab === t.key ? "var(--surface-2)" : "transparent",
              border: `1px solid ${tab === t.key ? "var(--border-strong)" : "var(--border)"}`,
            }}
          >
            {t.label} <span style={{ color: "var(--faint)" }}>({counts[t.key]})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <input
          className="input flex-1 min-w-45"
          placeholder="Search summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="panel overflow-hidden">
        {filtered.map((a) => (
          <Link
            key={a.id}
            href={`/alerts/${a.id}`}
            className="panel-row flex items-start gap-3 px-4 md:px-5 py-3.5 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="status-dot mt-1.5"
              style={{ color: SEVERITY_COLOR[a.severity], background: SEVERITY_COLOR[a.severity] }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{a.summary}</span>
                <span className="text-xs shrink-0" style={{ color: "var(--faint)" }}>
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--muted)" }}>
                <span className="capitalize">{a.severity} &middot; {a.state} &middot; {a.reason.replace(/_/g, " ")}</span>
                {a.blast_suspected && (
                  <span className="label-caveat normal-case" style={{ fontSize: "0.62rem" }}>
                    blast overlap
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && !query.isLoading && (
          <p className="px-4 md:px-5 py-8 text-sm text-center" style={{ color: "var(--muted)" }}>
            {allAlerts.length === 0 ? "No alerts yet." : "No alerts match these filters."}
          </p>
        )}
      </div>
    </div>
  );
}
