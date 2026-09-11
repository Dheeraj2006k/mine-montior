"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type Notification = {
  id: number;
  channel: string;
  status: string;
  provider: string | null;
  error: string | null;
  created_at: string;
  contacts: { full_name: string } | null;
};

type CallSession = {
  id: number;
  outcome: string | null;
  dtmf_digit: string | null;
  started_at: string | null;
  created_at: string;
  contacts: { full_name: string } | null;
};

export default function NotificationsAdminPage() {
  const query = useQuery({
    queryKey: ["notifications-audit"],
    queryFn: () => apiGet<{ notifications: Notification[]; call_sessions: CallSession[] }>("/api/notifications"),
  });
  const notifications = query.data?.data.notifications ?? [];
  const calls = query.data?.data.call_sessions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Notification &amp; call audit log</h1>

      <section className="panel p-4">
        <h2 className="font-semibold mb-3">Email / SMS</h2>
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div key={n.id} className="text-sm flex justify-between panel-2 px-3 py-2 rounded-md">
              <span>
                {n.channel} → {n.contacts?.full_name ?? "unknown"} · {n.status}
                {n.provider === "demo" && " (demo)"}
              </span>
              <span style={{ color: "var(--muted)" }}>{new Date(n.created_at).toLocaleString()}</span>
            </div>
          ))}
          {notifications.length === 0 && !query.isLoading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No notifications sent yet.
            </p>
          )}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="font-semibold mb-3">Voice calls</h2>
        <div className="flex flex-col gap-2">
          {calls.map((c) => (
            <div key={c.id} className="text-sm flex justify-between panel-2 px-3 py-2 rounded-md">
              <span>
                {c.contacts?.full_name ?? "unknown"} · {c.outcome ?? "pending"}
                {c.dtmf_digit && ` · pressed ${c.dtmf_digit}`}
              </span>
              <span style={{ color: "var(--muted)" }}>{new Date(c.created_at).toLocaleString()}</span>
            </div>
          ))}
          {calls.length === 0 && !query.isLoading && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No calls placed yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
