"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type UserRow = { user_id: string; email: string | null; created_at: string; role: "viewer" | "operator" | "admin" | null };

const ROLES = ["viewer", "operator", "admin"] as const;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiGet<UserRow[]>("/api/admin/users"),
  });
  const users = query.data?.data ?? [];

  async function setRole(userId: string, role: string) {
    await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Users &amp; roles</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          viewer = read-only. operator = acknowledge/resolve, feedback, blast scheduling, node
          registration. admin = contacts, site setup, roles. A user with no role assigned yet is
          treated as admin until one is set explicitly - so nothing changes on its own.
        </p>
      </div>

      {query.error && (
        <p className="text-sm" style={{ color: "var(--offline)" }}>
          {query.error instanceof Error ? query.error.message : "Failed to load users"}
        </p>
      )}

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td className="font-medium">{u.email ?? u.user_id}</td>
                <td style={{ color: "var(--muted)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <select
                    className="input"
                    value={u.role ?? ""}
                    onChange={(e) => setRole(u.user_id, e.target.value)}
                  >
                    <option value="" disabled>
                      {u.role ? u.role : "admin (default, unset)"}
                    </option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !query.isLoading && !query.error && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No users found.
          </p>
        )}
      </div>
    </div>
  );
}
