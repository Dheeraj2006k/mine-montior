"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";

type UserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: "viewer" | "operator" | "admin" | null;
  status: "active" | "inactive";
  assigned_site_id: string | null;
};

const ROLES = ["viewer", "operator", "admin"] as const;

const ROLE_BADGE_COLOR: Record<string, string> = {
  viewer: "var(--muted)",
  operator: "var(--accent)",
  admin: "var(--warning)",
};

function RoleBadge({ role }: { role: string | null }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
      style={{ color: ROLE_BADGE_COLOR[role ?? "viewer"], border: `1px solid ${ROLE_BADGE_COLOR[role ?? "viewer"]}` }}
    >
      {role ?? "viewer (default)"}
    </span>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
      style={{
        color: status === "active" ? "var(--normal)" : "var(--offline)",
        border: `1px solid ${status === "active" ? "var(--normal)" : "var(--offline)"}`,
      }}
    >
      {status}
    </span>
  );
}

export default function AdminUsersClient() {
  const queryClient = useQueryClient();
  const { role: currentUserRole, userId: currentUserId } = useCurrentUser();
  const [confirming, setConfirming] = useState<{ userId: string; action: "deactivate" | "reset-role" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiGet<UserRow[]>("/api/admin/users"),
  });
  const users = query.data?.data ?? [];

  async function callAdminApi(path: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const responseBody = await res.json().catch(() => null);
    if (!res.ok) {
      setError(responseBody?.error?.message ?? "Action failed");
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    return true;
  }

  async function setRole(userId: string, role: string) {
    await callAdminApi(`/api/admin/users/${userId}/role`, { role });
  }

  async function setStatus(userId: string, status: "active" | "inactive") {
    const ok = await callAdminApi(`/api/admin/users/${userId}/status`, { status });
    if (ok) setConfirming(null);
  }

  async function resetRole(userId: string) {
    const ok = await callAdminApi(`/api/admin/users/${userId}/reset-role`, {});
    if (ok) setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Users &amp; roles</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          viewer = read-only monitoring. operator = viewer + acknowledge/resolve alerts, register
          nodes. admin = operator + user/role management, site ownership, audit, system settings.
          Every new signup starts as viewer.
        </p>
      </div>

      {(error || query.error) && (
        <p className="text-sm" style={{ color: "var(--offline)" }}>
          {error ?? (query.error instanceof Error ? query.error.message : "Failed to load users")}
        </p>
      )}

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Created</th>
              <th>Last login</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned site</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.user_id === currentUserId;
              return (
                <tr key={u.user_id}>
                  <td className="font-medium">
                    <div className="flex flex-col">
                      <span>{u.full_name || u.email || u.user_id}</span>
                      {u.full_name && (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {u.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "never"}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <RoleBadge role={u.role} />
                      <select
                        className="input"
                        value={u.role ?? "viewer"}
                        onChange={(e) => setRole(u.user_id, e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td style={{ color: "var(--muted)" }}>{u.assigned_site_id ?? "-"}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {confirming?.userId === u.user_id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs" style={{ color: "var(--offline)" }}>
                            {confirming.action === "deactivate" ? "Deactivate this user?" : "Reset role to viewer?"}
                          </span>
                          <button
                            className="btn btn-danger text-xs"
                            onClick={() =>
                              confirming.action === "deactivate" ? setStatus(u.user_id, "inactive") : resetRole(u.user_id)
                            }
                          >
                            Confirm
                          </button>
                          <button className="btn btn-ghost text-xs" onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {u.status === "active" ? (
                            <button
                              className="btn text-xs"
                              disabled={isSelf}
                              onClick={() => setConfirming({ userId: u.user_id, action: "deactivate" })}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button className="btn text-xs" onClick={() => setStatus(u.user_id, "active")}>
                              Reactivate
                            </button>
                          )}
                          <button
                            className="btn text-xs"
                            onClick={() => setConfirming({ userId: u.user_id, action: "reset-role" })}
                          >
                            Reset role
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && !query.isLoading && !query.error && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No users found.
          </p>
        )}
      </div>

      {currentUserRole === "admin" && (
        <p className="text-xs" style={{ color: "var(--faint)" }}>
          Every role, status, and reset change here is recorded in the{" "}
          <a href="/admin/audit" className="hover:underline" style={{ color: "var(--accent)" }}>
            audit log
          </a>
          .
        </p>
      )}
    </div>
  );
}
