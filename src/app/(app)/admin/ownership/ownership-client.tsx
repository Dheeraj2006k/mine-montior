"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type AssignedUser = { user_id: string; email: string | null; full_name: string | null; role: string };
type OwnershipData = {
  site_id: string;
  site_name: string;
  owner: { user_id: string; email: string | null } | null;
  assigned_users: AssignedUser[];
};

export default function AdminOwnershipClient() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-ownership"],
    queryFn: () => apiGet<OwnershipData>("/api/admin/ownership"),
  });
  const data = query.data?.data;

  const [selectedUserId, setSelectedUserId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function transferOwnership() {
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_owner_user_id: selectedUserId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Transfer failed");
      queryClient.invalidateQueries({ queryKey: ["admin-ownership"] });
      setConfirming(false);
      setSelectedUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (query.isLoading) {
    return <p style={{ color: "var(--muted)" }}>Loading...</p>;
  }
  if (query.error || !data) {
    return (
      <p className="text-sm" style={{ color: "var(--offline)" }}>
        {query.error instanceof Error ? query.error.message : "Failed to load site ownership"}
      </p>
    );
  }

  const candidateOwners = data.assigned_users.filter((u) => u.user_id !== data.owner?.user_id);
  const selectedUser = data.assigned_users.find((u) => u.user_id === selectedUserId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Site ownership</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          {data.site_name} ({data.site_id})
        </p>
      </div>

      <section className="panel p-4 md:p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Current owner</h2>
        {data.owner ? (
          <p className="text-sm">{data.owner.email ?? data.owner.user_id}</p>
        ) : (
          <p className="text-sm" style={{ color: "var(--faint)" }}>
            No owner assigned yet.
          </p>
        )}
      </section>

      <section className="panel p-4 md:p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Assigned users</h2>
        {data.assigned_users.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--faint)" }}>
            No users are assigned to this site yet. Assign a role to a user on{" "}
            <a href="/admin/users" className="hover:underline" style={{ color: "var(--accent)" }}>
              Users &amp; roles
            </a>
            , then transfer ownership to them from here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.assigned_users.map((u) => (
              <li key={u.user_id} className="text-sm flex items-center justify-between">
                <span>{u.full_name || u.email || u.user_id}</span>
                <span className="text-xs uppercase" style={{ color: "var(--muted)" }}>
                  {u.role}
                  {u.user_id === data.owner?.user_id ? " - owner" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4 md:p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Transfer ownership</h2>
        {candidateOwners.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--faint)" }}>
            No other assigned users are available to transfer ownership to yet.
          </p>
        ) : (
          <>
            <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">Select a new owner...</option>
              {candidateOwners.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name || u.email || u.user_id} ({u.role})
                </option>
              ))}
            </select>
            {selectedUser && !confirming && (
              <button className="btn btn-primary self-start" onClick={() => setConfirming(true)}>
                Transfer ownership
              </button>
            )}
            {confirming && selectedUser && (
              <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-sm">
                  <span style={{ color: "var(--muted)" }}>{data.owner?.email ?? "unassigned"}</span>
                  {" -> "}
                  <span className="font-medium">{selectedUser.full_name || selectedUser.email}</span>
                </p>
                <div className="flex gap-2">
                  <button className="btn btn-danger text-xs" onClick={transferOwnership} disabled={submitting}>
                    {submitting ? "Transferring..." : "Confirm transfer"}
                  </button>
                  <button className="btn btn-ghost text-xs" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="text-xs" style={{ color: "var(--offline)" }}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
