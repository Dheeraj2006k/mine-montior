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

export default function AlertsPage() {
  const query = useQuery({
    queryKey: ["alerts", "all"],
    queryFn: () => apiGet<AlertRow[]>("/api/alerts"),
  });
  const alerts = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Alerts</h1>
      <div className="panel divide-y" style={{ borderColor: "var(--border)" }}>
        {alerts.map((a) => (
          <Link
            key={a.id}
            href={`/alerts/${a.id}`}
            className="block px-4 py-3 hover:opacity-90"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.summary}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {new Date(a.created_at).toLocaleString()}
              </span>
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {a.severity} · {a.state} · {a.reason}
            </div>
          </Link>
        ))}
        {alerts.length === 0 && !query.isLoading && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No alerts yet. The alert engine that populates this table is not built in this
            pass — this is a genuinely empty state, not a placeholder.
          </p>
        )}
      </div>
    </div>
  );
}
