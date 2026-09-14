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
      <h1 className="text-lg font-semibold">Notification &amp; call audit log</h1>

      <section className="panel overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold">Email / SMS</h2>
        </div>
        {notifications.map((n) => (
          <div
            key={n.id}
            className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm">
              {n.channel} {"->"} {n.contacts?.full_name ?? "unknown"} - {n.status}
              {n.provider === "demo" && (
                <span className="label-caveat ml-2" style={{ fontSize: "0.65rem" }}>
                  demo
                </span>
              )}
            </span>
            <span className="text-xs text-muted" style={{ color: "var(--muted)" }}>
              {new Date(n.created_at).toLocaleString()}
            </span>
          </div>
        ))}
        {notifications.length === 0 && !query.isLoading && (
          <p className="px-4 md:px-5 py-8 text-sm text-muted text-center" style={{ color: "var(--muted)" }}>
            No notifications sent yet.
          </p>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="px-4 md:px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold">Voice calls</h2>
        </div>
        {calls.map((c) => (
          <div
            key={c.id}
            className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm">
              {c.contacts?.full_name ?? "unknown"} - {c.outcome ?? "pending"}
              {c.dtmf_digit && ` - pressed ${c.dtmf_digit}`}
            </span>
            <span className="text-xs text-muted" style={{ color: "var(--muted)" }}>
              {new Date(c.created_at).toLocaleString()}
            </span>
          </div>
        ))}
        {calls.length === 0 && !query.isLoading && (
          <p className="px-4 md:px-5 py-8 text-sm text-muted text-center" style={{ color: "var(--muted)" }}>
            No calls placed yet.
          </p>
        )}
      </section>
    </div>
  );
}
