"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { apiGet } from "@/lib/api/client";
import { HealthBadge } from "@/components/status/health-badge";
import { RiskBadge } from "@/components/status/risk-badge";
import type { HealthState } from "@/lib/domain/node-health";

type NodeSummary = {
  node_id: number;
  label: string;
  health_state: HealthState;
};

type HistoryPoint = {
  recorded_at: string;
  tilt_x_filt: number | null;
  tilt_y_filt: number | null;
  vibration_filt: number | null;
  displacement_filt: number | null;
  risk_score: number | null;
  sensor_ok: boolean | null;
};

const SPARKLINE_POINTS = 30;

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function secondsAgoLabel(recordedAt: string | undefined, now: number): string {
  if (!recordedAt) return "no data yet";
  const deltaS = Math.max(0, Math.round((now - new Date(recordedAt).getTime()) / 1000));
  if (deltaS < 60) return `${deltaS}s ago`;
  if (deltaS < 3600) return `${Math.floor(deltaS / 60)}m ago`;
  return `${Math.floor(deltaS / 3600)}h ago`;
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5 font-mono">
        {value}
        {unit && <span className="text-faint font-sans font-normal ml-0.5" style={{ color: "var(--faint)" }}>{unit}</span>}
      </div>
    </div>
  );
}

export function LiveSensorFeed({ nodes }: { nodes: NodeSummary[] }) {
  const now = useNow();

  const historyQueries = useQueries({
    queries: nodes.map((n) => ({
      queryKey: ["node-history-mini", n.node_id],
      queryFn: () => apiGet<HistoryPoint[]>(`/api/nodes/${n.node_id}/history?limit=${SPARKLINE_POINTS}`),
      refetchInterval: 5000,
    })),
  });

  return (
    <section className="panel p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "var(--normal)" }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--normal)" }} />
          </span>
          <h2 className="text-sm font-semibold">Live sensor feed</h2>
        </div>
        <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
          refreshes every 5s
        </span>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-muted" style={{ color: "var(--muted)" }}>
          No nodes seeded yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {nodes.map((node, i) => {
            const history = historyQueries[i]?.data?.data ?? [];
            const latest = history[history.length - 1];
            const sparkData = history.map((p) => ({ v: p.risk_score ?? 0 }));

            return (
              <Link
                key={node.node_id}
                href={`/nodes/${node.node_id}`}
                className="panel-2 rounded-lg p-4 block hover:opacity-95"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{node.label}</span>
                    <HealthBadge state={node.health_state} />
                  </div>
                  <RiskBadge score={latest?.risk_score ?? null} />
                </div>

                {history.length > 0 && (
                  <div className="h-10 mb-3 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkData}>
                        <YAxis domain={[0, 1]} hide />
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke="var(--accent)"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-3">
                  <Metric
                    label="Tilt X"
                    value={latest?.tilt_x_filt != null ? latest.tilt_x_filt.toFixed(2) : "—"}
                    unit="°"
                  />
                  <Metric
                    label="Tilt Y"
                    value={latest?.tilt_y_filt != null ? latest.tilt_y_filt.toFixed(2) : "—"}
                    unit="°"
                  />
                  <Metric
                    label="Vibration"
                    value={latest?.vibration_filt != null ? latest.vibration_filt.toFixed(2) : "—"}
                  />
                  <Metric
                    label="Displacement"
                    value={latest?.displacement_filt != null ? latest.displacement_filt.toFixed(2) : "—"}
                    unit="mm"
                  />
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: latest?.sensor_ok === false ? "var(--unknown)" : "var(--normal)" }}
                  >
                    {latest?.sensor_ok === false ? "sensor unhealthy" : "sensor ok"}
                  </span>
                  <span className="text-[10px] text-faint" style={{ color: "var(--faint)" }}>
                    {secondsAgoLabel(latest?.recorded_at, now)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
