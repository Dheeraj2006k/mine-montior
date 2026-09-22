"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";

type PipelineTraceRow = {
  stage: string;
  status: string;
  occurred_at: string;
  latency_ms: number | null;
};

type AlertDetail = {
  id: number;
  severity: string;
  state: string;
  summary: string;
  reason: string;
  blast_suspected: boolean;
  evidence: Record<string, unknown>;
  created_at: string;
  pipeline_trace: PipelineTraceRow[];
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--unknown)",
  warning: "var(--warning)",
  high: "var(--stale)",
  critical: "var(--offline)",
};

const TRACE_STATUS_COLOR: Record<string, string> = {
  ok: "var(--normal)",
  degraded: "var(--warning)",
  failed: "var(--offline)",
  skipped: "var(--faint)",
};

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { can, isLoading: roleLoading } = useCurrentUser();
  // While the role hasn't loaded yet, don't flash enabled buttons a viewer
  // will only have rejected server-side a moment later.
  const canOperate = roleLoading ? false : can("operator");
  const query = useQuery({
    queryKey: ["alert", id],
    queryFn: () => apiGet<AlertDetail>(`/api/alerts/${id}`),
  });
  const alert = query.data?.data;

  const action = useMutation({
    mutationFn: async (path: "acknowledge" | "resolve" | "dismiss") => {
      const res = await fetch(`/api/alerts/${id}/${path}`, { method: "POST", body: "{}" });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Action failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert", id] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  if (query.isLoading) return <p className="text-muted" style={{ color: "var(--muted)" }}>Loading...</p>;
  if (!alert) return <p className="text-muted" style={{ color: "var(--muted)" }}>Alert not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/alerts" className="text-xs text-muted hover:text-foreground" style={{ color: "var(--muted)" }}>
        ← All alerts
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="status-dot"
              style={{ color: SEVERITY_COLOR[alert.severity], background: SEVERITY_COLOR[alert.severity] }}
            />
            <h1 className="text-lg font-semibold">{alert.summary}</h1>
          </div>
          <p className="text-sm text-muted mt-1" style={{ color: "var(--muted)" }}>
            {alert.severity} - {alert.state} - {alert.reason}
            {alert.blast_suspected && " - overlaps scheduled blast - human verification recommended"}
          </p>
        </div>
        {alert.state === "new" || alert.state === "notified" ? (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <button
                className="btn"
                onClick={() => action.mutate("acknowledge")}
                disabled={!canOperate || action.isPending}
                title={canOperate ? undefined : "Requires operator access"}
              >
                Acknowledge
              </button>
              <button
                className="btn"
                onClick={() => action.mutate("resolve")}
                disabled={!canOperate || action.isPending}
                title={canOperate ? undefined : "Requires operator access"}
              >
                Resolve
              </button>
              <button
                className="btn btn-danger"
                onClick={() => action.mutate("dismiss")}
                disabled={!canOperate || action.isPending}
                title={canOperate ? undefined : "Requires operator access"}
              >
                Dismiss
              </button>
            </div>
            {!roleLoading && !canOperate && (
              <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                Read-only - operator access required to act on alerts
              </span>
            )}
          </div>
        ) : alert.state === "acknowledged" ? (
          <div className="flex flex-col items-end gap-1.5">
            <button
              className="btn btn-primary"
              onClick={() => action.mutate("resolve")}
              disabled={!canOperate || action.isPending}
              title={canOperate ? undefined : "Requires operator access"}
            >
              Resolve
            </button>
            {!roleLoading && !canOperate && (
              <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                Read-only - operator access required to act on alerts
              </span>
            )}
          </div>
        ) : null}
      </div>

      {canOperate && (alert.state === "new" || alert.state === "notified") && (
        <SimulateIvr alertId={id} onDone={() => queryClient.invalidateQueries({ queryKey: ["alert", id] })} />
      )}

      <section className="panel p-4 md:p-5">
        <h2 className="text-sm font-semibold mb-3">Pipeline timeline</h2>
        {alert.pipeline_trace.length === 0 ? (
          <p className="text-sm text-muted" style={{ color: "var(--muted)" }}>
            No trace rows recorded for this alert.
          </p>
        ) : (
          <ul className="flex flex-col">
            {alert.pipeline_trace.map((t, i) => (
              <li
                key={i}
                className="text-sm flex items-center justify-between py-2.5 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="status-dot"
                    style={{ color: TRACE_STATUS_COLOR[t.status] ?? "var(--muted)", background: TRACE_STATUS_COLOR[t.status] ?? "var(--muted)" }}
                  />
                  <span className="font-mono text-xs">{t.stage}</span>
                  <span className="text-faint text-xs" style={{ color: "var(--faint)" }}>
                    {t.status}
                  </span>
                </span>
                <span className="text-muted text-xs" style={{ color: "var(--muted)" }}>
                  {new Date(t.occurred_at).toLocaleTimeString()}
                  {t.latency_ms != null ? ` (+${t.latency_ms}ms)` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4 md:p-5">
        <h2 className="text-sm font-semibold mb-3">Frozen evidence snapshot</h2>
        <pre
          className="text-xs overflow-x-auto rounded-lg p-3"
          style={{ color: "var(--muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
        >
          {JSON.stringify(alert.evidence, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function SimulateIvr({ alertId, onDone }: { alertId: string; onDone: () => void }) {
  const mutation = useMutation({
    mutationFn: async (digit: string) => {
      const res = await fetch(`/api/alerts/${alertId}/simulate-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digit }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Failed");
      return res.json();
    },
    onSuccess: onDone,
  });

  return (
    <section className="panel p-4 md:p-5">
      <h2 className="text-sm font-semibold mb-1">Simulate IVR response</h2>
      <p className="text-xs text-muted mb-3" style={{ color: "var(--muted)" }}>
        No real phone call happens - this drives the exact same DTMF-handling code path a real
        Twilio call would. Disabled automatically once real voice credentials are configured.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => mutation.mutate("1")} disabled={mutation.isPending}>
          Press 1 - real event
        </button>
        <button className="btn" onClick={() => mutation.mutate("2")} disabled={mutation.isPending}>
          Press 2 - blast/disturbance
        </button>
        <button className="btn" onClick={() => mutation.mutate("3")} disabled={mutation.isPending}>
          Press 3 - uncertain
        </button>
      </div>
      {mutation.isError && (
        <p className="text-xs mt-2" style={{ color: "var(--offline)" }}>
          {(mutation.error as Error).message}
        </p>
      )}
    </section>
  );
}
