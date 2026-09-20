"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiGet } from "@/lib/api/client";
import { HealthBadge } from "@/components/status/health-badge";
import { RiskBadge } from "@/components/status/risk-badge";
import { MockPositionLabel, FuzzyIndexLabel } from "@/components/labels";
import { SourceBadge } from "@/components/status/source-badge";
import type { HealthState } from "@/lib/domain/node-health";

type NodeDetail = {
  node_id: number;
  label: string;
  site_id: string;
  mock_latitude: number;
  mock_longitude: number;
  is_mock: boolean;
  registered_latitude?: number | null;
  registered_longitude?: number | null;
  registered_at?: string | null;
  baseline_reading_id?: number | null;
  latest_risk_score: number | null;
  last_seen_at: string | null;
  packet_loss_pct: number | null;
  health_state: HealthState;
};

type HistoryPoint = {
  recorded_at: string;
  tilt_x_filt: number | null;
  tilt_y_filt: number | null;
  vibration_filt: number | null;
  displacement_filt: number | null;
  risk_score: number | null;
};

export default function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const nodeQuery = useQuery({
    queryKey: ["node", id],
    queryFn: () => apiGet<NodeDetail>(`/api/nodes/${id}`),
  });
  const historyQuery = useQuery({
    queryKey: ["node-history", id],
    queryFn: () => apiGet<HistoryPoint[]>(`/api/nodes/${id}/history`),
  });

  const node = nodeQuery.data?.data;
  const history = (historyQuery.data?.data ?? []).map((p) => ({
    ...p,
    t: new Date(p.recorded_at).toLocaleTimeString(),
  }));

  if (nodeQuery.isLoading) {
    return <p style={{ color: "var(--muted)" }}>Loading...</p>;
  }
  if (!node) {
    return <p style={{ color: "var(--muted)" }}>Node not found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/nodes" className="text-xs text-muted hover:text-foreground" style={{ color: "var(--muted)" }}>
        ← All nodes
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">{node.label}</h1>
          <div className="mt-1 flex items-center gap-2">
            <SourceBadge isMock={node.is_mock} registered={!!node.registered_at} />
            {node.is_mock && <MockPositionLabel />}
          </div>
        </div>
        <HealthBadge state={node.health_state} />
      </div>

      {!node.is_mock && node.registered_at && (
        <p className="label-caveat self-start">
          GNSS-registered {new Date(node.registered_at).toLocaleString()} at {node.registered_latitude?.toFixed(5)},{" "}
          {node.registered_longitude?.toFixed(5)} - captured once at install, not continuously tracked
        </p>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
            Risk score
          </div>
          <div className="mt-1.5">
            <RiskBadge score={node.latest_risk_score} size="lg" />
          </div>
          <div className="mt-1.5">
            <FuzzyIndexLabel />
          </div>
        </div>
        <Stat
          label="Packet loss"
          value={node.packet_loss_pct != null ? `${node.packet_loss_pct}%` : "-"}
        />
        <Stat
          label="Last seen"
          value={node.last_seen_at ? new Date(node.last_seen_at).toLocaleTimeString() : "-"}
        />
        <Stat
          label="Baseline"
          value={!node.registered_at ? "not registered" : node.baseline_reading_id ? "captured" : "pending"}
        />
      </section>

      <section className="panel p-4 md:p-5">
        <h2 className="text-sm font-semibold mb-3">Risk score over time</h2>
        <ChartBlock data={history} dataKey="risk_score" color="var(--accent)" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-3">Tilt (filtered)</h2>
          <ChartBlock data={history} dataKey="tilt_x_filt" color="var(--warning)" />
        </div>
        <div className="panel p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-3">Vibration (filtered, unit TBD)</h2>
          <ChartBlock data={history} dataKey="vibration_filt" color="var(--stale)" />
        </div>
        <div className="panel p-4 md:p-5">
          <h2 className="text-sm font-semibold mb-3">Displacement (filtered, mm)</h2>
          <ChartBlock data={history} dataKey="displacement_filt" color="var(--normal)" />
        </div>
      </section>

      {history.length === 0 && !historyQuery.isLoading && (
        <p className="text-sm text-muted" style={{ color: "var(--muted)" }}>
          No readings yet for this node. Run the simulator (<code>npm run simulate</code>) or send
          real gateway traffic to see this chart populate.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, caption }: { label: string; value: string | number; caption?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wide text-faint" style={{ color: "var(--faint)" }}>
        {label}
      </div>
      <div className="text-xl font-semibold mt-1.5">{value}</div>
      {caption && <div className="mt-1.5">{caption}</div>}
    </div>
  );
}

function ChartBlock({
  data,
  dataKey,
  color,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="t" stroke="var(--muted)" fontSize={11} />
        <YAxis stroke="var(--muted)" fontSize={11} />
        <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} />
        <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
