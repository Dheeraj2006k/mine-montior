"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type AuditRow = {
  id: number;
  actor: string;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string;
  target_user_id: string | null;
  from_state: string | null;
  to_state: string | null;
  detail: Record<string, unknown>;
  occurred_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  role_changed: "Role changed",
  role_reset: "Role reset",
  user_activated: "User activated",
  user_deactivated: "User deactivated",
  ownership_transferred: "Ownership transferred",
};

export default function AdminAuditClient() {
  const query = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => apiGet<AuditRow[]>("/api/admin/audit"),
    refetchInterval: 15000,
  });
  const rows = query.data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Audit log</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Role changes, account activation/deactivation, and ownership transfers - most recent first.
        </p>
      </div>

      {query.error && (
        <p className="text-sm" style={{ color: "var(--offline)" }}>
          {query.error instanceof Error ? query.error.message : "Failed to load audit log"}
        </p>
      )}

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ color: "var(--muted)" }}>{new Date(r.occurred_at).toLocaleString()}</td>
                <td className="font-mono text-xs">{r.actor}</td>
                <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="font-mono text-xs">
                  {r.entity_table}#{r.entity_id}
                </td>
                <td className="text-xs" style={{ color: "var(--muted)" }}>
                  {r.from_state ?? "-"} {"->"} {r.to_state ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !query.isLoading && !query.error && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No administrative actions recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
