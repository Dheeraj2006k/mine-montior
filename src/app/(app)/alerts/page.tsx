"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";

type AlertRow = {
  id: number;
  severity: string;
  state: string;
  summary: string;
  reason: string;
  created_at: string;
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--unknown)",
  warning: "var(--warning)",
  high: "var(--stale)",
  critical: "var(--offline)",
};

export default function AlertsPage() {
  const query = useQuery({
    queryKey: ["alerts", "all"],
    queryFn: () => apiGet<AlertRow[]>("/api/alerts"),
  });
  const alerts = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Alerts</h1>
        <p className="text-sm text-muted mt-0.5" style={{ color: "var(--muted)" }}>
          {alerts.length} total
        </p>
      </div>
      <div className="panel overflow-hidden">
        {alerts.map((a) => (
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
                <span className="text-xs text-faint shrink-0" style={{ color: "var(--faint)" }}>
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-muted mt-0.5" style={{ color: "var(--muted)" }}>
                {a.severity} - {a.state} - {a.reason}
              </div>
            </div>
          </Link>
        ))}
        {alerts.length === 0 && !query.isLoading && (
          <p className="px-4 md:px-5 py-8 text-sm text-muted text-center" style={{ color: "var(--muted)" }}>
            No alerts yet.
          </p>
        )}
      </div>
    </div>
  );
}
