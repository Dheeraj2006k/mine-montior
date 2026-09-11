"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

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

export default function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
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

  if (query.isLoading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  if (!alert) return <p style={{ color: "var(--muted)" }}>Alert not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{alert.summary}</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {alert.severity} · {alert.state} · {alert.reason}
            {alert.blast_suspected && " · overlaps scheduled blast — human verification recommended"}
          </p>
        </div>
        {alert.state === "new" || alert.state === "notified" ? (
          <div className="flex gap-2">
            <ActionButton onClick={() => action.mutate("acknowledge")} disabled={action.isPending}>
              Acknowledge
            </ActionButton>
            <ActionButton onClick={() => action.mutate("resolve")} disabled={action.isPending}>
              Resolve
            </ActionButton>
            <ActionButton onClick={() => action.mutate("dismiss")} disabled={action.isPending}>
              Dismiss
            </ActionButton>
          </div>
        ) : alert.state === "acknowledged" ? (
          <ActionButton onClick={() => action.mutate("resolve")} disabled={action.isPending}>
            Resolve
          </ActionButton>
        ) : null}
      </div>

      {(alert.state === "new" || alert.state === "notified") && (
        <SimulateIvr alertId={id} onDone={() => queryClient.invalidateQueries({ queryKey: ["alert", id] })} />
      )}

      <section className="panel p-4">
        <h2 className="font-semibold mb-3">Pipeline timeline</h2>
        {alert.pipeline_trace.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No trace rows recorded for this alert.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alert.pipeline_trace.map((t, i) => (
              <li key={i} className="text-sm flex justify-between panel-2 px-3 py-2 rounded-md">
                <span>
                  {t.stage} · {t.status}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {new Date(t.occurred_at).toLocaleTimeString()}
                  {t.latency_ms != null ? ` (+${t.latency_ms}ms)` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4">
        <h2 className="font-semibold mb-3">Frozen evidence snapshot</h2>
        <pre className="text-xs overflow-x-auto" style={{ color: "var(--muted)" }}>
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
    <section className="panel p-4">
      <h2 className="font-semibold mb-1">Simulate IVR response (DEMO_MODE)</h2>
      <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
        No real phone call happens — this drives the exact same DTMF-handling code path a real
        Twilio call would. Disabled automatically once real voice credentials are configured.
      </p>
      <div className="flex gap-2">
        <ActionButton onClick={() => mutation.mutate("1")} disabled={mutation.isPending}>
          Press 1 — real event
        </ActionButton>
        <ActionButton onClick={() => mutation.mutate("2")} disabled={mutation.isPending}>
          Press 2 — blast/disturbance
        </ActionButton>
        <ActionButton onClick={() => mutation.mutate("3")} disabled={mutation.isPending}>
          Press 3 — uncertain
        </ActionButton>
      </div>
      {mutation.isError && (
        <p className="text-xs mt-2" style={{ color: "var(--offline)" }}>
          {(mutation.error as Error).message}
        </p>
      )}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-3 py-1.5 rounded-md panel-2"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}
