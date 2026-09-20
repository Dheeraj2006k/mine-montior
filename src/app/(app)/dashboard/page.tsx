"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";
import { HealthBadge } from "@/components/status/health-badge";
import { RiskBadge } from "@/components/status/risk-badge";
import { ConfidenceBadge } from "@/components/status/confidence-badge";
import { SourceBadge } from "@/components/status/source-badge";
import { MockPositionLabel, FuzzyIndexLabel } from "@/components/labels";
import { MineMap, type MapNode } from "@/components/map/mine-map";
import { LiveSensorFeed } from "@/components/nodes/live-sensor-feed";
import { ViewModeToggle, useTerm } from "@/components/view-mode/view-mode-context";
import type { HealthState } from "@/lib/domain/node-health";

type NodeRow = {
  node_id: number;
  site_id: string;
  label: string;
  mock_latitude: number;
  mock_longitude: number;
  is_mock: boolean;
  latest_risk_score: number | null;
  last_seen_at: string | null;
  packet_loss_pct: number | null;
  health_state: HealthState;
};

type AlertRow = {
  id: number;
  node_id: number | null;
  severity: string;
  state: string;
  summary: string;
  created_at: string;
  blast_suspected: boolean;
};

type SiteConfigRow = {
  mine_type: "longwall" | "bord_and_pillar";
  setup_completed: boolean;
  aoi_latitude: number | null;
  aoi_longitude: number | null;
  site_name: string | null;
} | null;

type PredictedZoneEntry = { node_id?: number; severity_0_to_1?: number };

type PredictionRow = {
  model_version: string;
  predicted_zone: PredictedZoneEntry[];
  trend: string;
  time_to_threshold: { low_days: number | null; high_days: number | null; confidence: number | null };
  generated_at: string | null;
  is_stale: boolean;
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "var(--unknown)",
  warning: "var(--warning)",
  high: "var(--stale)",
  critical: "var(--offline)",
};

const TREND_STYLE: Record<string, { arrow: string; color: string }> = {
  accelerating: { arrow: "↑", color: "var(--offline)" },
  stable: { arrow: "→", color: "var(--muted)" },
  decelerating: { arrow: "↓", color: "var(--normal)" },
};

function ClockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function NodesGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="12" cy="18" r="2.4" />
      <path d="M8.2 7.2 10.5 15.8M15.8 7.2 13.5 15.8M8.5 6h7" />
    </svg>
  );
}
function PulseGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l2-7 4 14 2-7h8" />
    </svg>
  );
}
function AlertGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}
function GaugeGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15a8 8 0 0 1 16 0" /><path d="M12 15 16 9" /><circle cx="12" cy="15" r="1" fill="currentColor" />
    </svg>
  );
}
function MapGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" />
    </svg>
  );
}
function TrendGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17 9 11 13 15 21 7" /><path d="M15 7h6v6" />
    </svg>
  );
}
function ListGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function BellGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" /><path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}
function WifiGlyph() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5a16 16 0 0 1 18 0" /><path d="M6.5 12.5a11 11 0 0 1 11 0" /><path d="M10 16.5a5.5 5.5 0 0 1 4 0" />
      <circle cx="12" cy="20" r="0.6" fill="currentColor" />
    </svg>
  );
}

function SectionHeading({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
      <div className="flex items-center gap-2.5">
        <span className="section-icon">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function DashboardPage() {
  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
    refetchInterval: 5000,
  });
  const alertsQuery = useQuery({
    queryKey: ["alerts", "all"],
    queryFn: () => apiGet<AlertRow[]>("/api/alerts"),
    refetchInterval: 5000,
  });
  const predictionQuery = useQuery({
    queryKey: ["prediction"],
    queryFn: () => apiGet<PredictionRow>("/api/predictions/latest"),
    refetchInterval: 10000,
  });
  const siteConfigQuery = useQuery({
    queryKey: ["site-config"],
    queryFn: () => apiGet<SiteConfigRow>("/api/site-config"),
  });

  const stabilityLabel = useTerm("fuzzyRiskIndex");
  const trendLabel = useTerm("trend");
  const actionWindowLabel = useTerm("timeToThreshold");
  const modelLabel = useTerm("modelVersion");
  const zoneLabel = useTerm("predictedZone");

  const now = useClock();
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const nodes = nodesQuery.data?.data ?? [];
  const alerts = (alertsQuery.data?.data ?? []).filter(
    (a) => a.state === "new" || a.state === "notified",
  );
  const mapNodes: MapNode[] = nodes.map((n) => ({
    node_id: n.node_id,
    label: n.label,
    mock_latitude: n.mock_latitude,
    mock_longitude: n.mock_longitude,
    health_state: n.health_state,
    latest_risk_score: n.latest_risk_score,
    is_mock: n.is_mock,
  }));

  const healthy = nodes.filter((n) => n.health_state === "normal").length;
  const warningNodes = nodes.filter((n) => n.health_state === "warning").length;
  const troubledNodes = nodes.filter((n) => n.health_state === "unknown" || n.health_state === "stale" || n.health_state === "offline").length;
  const maxRisk = nodes.length > 0 ? Math.max(...nodes.map((n) => n.latest_risk_score ?? 0)) : null;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;

  const isConnected = !nodesQuery.isError && !alertsQuery.isError;
  const isRefreshing = nodesQuery.isFetching || alertsQuery.isFetching;
  const selectedNode = selectedNodeId != null ? nodes.find((n) => n.node_id === selectedNodeId) ?? null : null;

  const prediction = predictionQuery.data?.data;
  const predictionSource = predictionQuery.data?.meta.source;
  const nodeLabelById = new Map(nodes.map((n) => [n.node_id, n.label]));
  const zoneEntries = (prediction?.predicted_zone ?? []).filter(
    (e): e is Required<PredictedZoneEntry> => typeof e.node_id === "number" && typeof e.severity_0_to_1 === "number",
  );

  const allSystemsNormal = nodes.length > 0 && healthy === nodes.length && alerts.length === 0;

  const siteConfig = siteConfigQuery.data?.data ?? null;
  const showSetupBanner = !siteConfigQuery.isLoading && !siteConfig?.setup_completed;

  return (
    <div className="flex flex-col gap-6">
      {showSetupBanner && (
        <div
          className="rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "color-mix(in srgb, var(--warning) 10%, var(--bg-elevated))",
            border: "1px solid color-mix(in srgb, var(--warning) 35%, var(--border))",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="status-dot" style={{ color: "var(--warning)", background: "var(--warning)" }} />
            <p className="text-sm">
              This site hasn&apos;t completed setup yet - mine type, geometry and geology are unset.
            </p>
          </div>
          <Link href="/setup" className="btn btn-primary shrink-0">
            Complete site setup
          </Link>
        </div>
      )}

      {/* Command strip */}
      <div className="hero-strip px-5 py-4 md:px-6 md:py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight">Command Center</h1>
            <span className="live-pill">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: allSystemsNormal ? "var(--normal)" : "var(--warning)" }}
                />
                <span
                  className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ background: allSystemsNormal ? "var(--normal)" : "var(--warning)" }}
                />
              </span>
              {allSystemsNormal ? "All systems normal" : "Attention required"}
            </span>
          </div>
          <p className="text-sm mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--muted)" }}>
            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              SIH-DEMO-01
            </span>
            {siteConfig?.site_name ?? "live sensor and alert status"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-xs"
            style={{ color: isConnected ? "var(--faint)" : "var(--offline)" }}
            title={isConnected ? (isRefreshing ? "Refreshing..." : "Connected - polling every 5s") : "Connection issue - last request failed"}
          >
            <WifiGlyph />
            <span className="hidden sm:inline">{isConnected ? (isRefreshing ? "Syncing" : "Live") : "Reconnecting"}</span>
          </span>
          {now && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: "var(--faint)" }}>
              <ClockIcon />
              {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
            </span>
          )}
          <Link
            href="/alerts"
            className="relative flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            title={`${alerts.length} active alert${alerts.length === 1 ? "" : "s"}`}
          >
            <BellGlyph />
            {alerts.length > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: "var(--offline)", color: "#fff" }}
              >
                {alerts.length}
              </span>
            )}
          </Link>
          <ViewModeToggle />
        </div>
      </div>

      {/* Stat strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile label="Nodes online" value={`${nodes.length}`} icon={<NodesGlyph />} accent="var(--accent)" />
        <StatTile
          label="Normal"
          value={`${healthy}/${nodes.length}`}
          icon={<PulseGlyph />}
          accent={nodes.length > 0 && healthy < nodes.length ? "var(--warning)" : "var(--normal)"}
        />
        <StatTile
          label="Warning"
          value={warningNodes}
          icon={<AlertGlyph />}
          accent={warningNodes > 0 ? "var(--warning)" : "var(--normal)"}
          caption={troubledNodes > 0 ? `${troubledNodes} unknown/stale/offline` : undefined}
        />
        <StatTile
          label="High / critical"
          value={criticalAlerts}
          icon={<AlertGlyph />}
          accent={criticalAlerts > 0 ? "var(--offline)" : "var(--normal)"}
        />
        <StatTile
          label="Active alerts"
          value={alerts.length}
          icon={<BellGlyph />}
          accent={alerts.length > 0 ? "var(--offline)" : "var(--normal)"}
        />
        <StatTile
          label={stabilityLabel}
          value={maxRisk != null ? <RiskBadge score={maxRisk} size="lg" /> : "-"}
          icon={<GaugeGlyph />}
          accent={maxRisk != null && maxRisk >= 0.7 ? "var(--offline)" : maxRisk != null && maxRisk >= 0.4 ? "var(--warning)" : "var(--normal)"}
          caption={<FuzzyIndexLabel />}
          isBadgeValue
        />
      </section>

      <LiveSensorFeed nodes={nodes.map((n) => ({ node_id: n.node_id, label: n.label, health_state: n.health_state }))} />

      <section className="panel p-4 md:p-5">
        <SectionHeading icon={<MapGlyph />} title="Node map" right={<MockPositionLabel />} />
        {nodesQuery.isLoading ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Loading nodes...
          </p>
        ) : (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <MineMap
                nodes={mapNodes}
                mineType={siteConfig?.mine_type ?? null}
                aoi={
                  siteConfig?.aoi_latitude != null && siteConfig?.aoi_longitude != null
                    ? { latitude: siteConfig.aoi_latitude, longitude: siteConfig.aoi_longitude }
                    : null
                }
                onSelectNode={setSelectedNodeId}
              />
            </div>
            {selectedNode && (
              <div className="panel-2 rounded-lg p-4 w-full md:w-60 shrink-0 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{selectedNode.label}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(null)}
                    className="text-xs"
                    style={{ color: "var(--faint)" }}
                    aria-label="Close node panel"
                  >
                    &times;
                  </button>
                </div>
                <SourceBadge isMock={selectedNode.is_mock} />
                <HealthBadge state={selectedNode.health_state} />
                <RiskBadge score={selectedNode.latest_risk_score} />
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Last seen: {selectedNode.last_seen_at ? new Date(selectedNode.last_seen_at).toLocaleTimeString() : "—"}
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  Packet loss: {selectedNode.packet_loss_pct != null ? `${selectedNode.packet_loss_pct}%` : "—"}
                </div>
                <Link href={`/nodes/${selectedNode.node_id}`} className="btn btn-primary text-xs mt-1 self-start">
                  Full node detail &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel p-4 md:p-5">
        <SectionHeading
          icon={<TrendGlyph />}
          title="Prediction"
          right={
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                style={{
                  color: predictionSource === "live" ? "var(--normal)" : "var(--faint)",
                  background:
                    predictionSource === "live"
                      ? "color-mix(in srgb, var(--normal) 14%, transparent)"
                      : "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                {predictionSource === "live" ? "live" : "mock"}
              </span>
              {prediction?.is_stale && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                  style={{
                    color: "var(--warning)",
                    background: "color-mix(in srgb, var(--warning) 14%, transparent)",
                    border: "1px solid var(--border)",
                  }}
                >
                  stale
                </span>
              )}
              <Link href="/twin" className="text-xs hover:text-foreground" style={{ color: "var(--muted)" }}>
                View in 3D twin &rarr;
              </Link>
            </div>
          }
        />

        {siteConfig?.mine_type === "bord_and_pillar" && (
          <p className="label-caveat self-start mb-3">
            Bord-and-pillar GP residual/susceptibility prediction UI is not yet wired to a data source -
            showing the generic prediction feed below if one exists.
          </p>
        )}

        {!prediction || zoneEntries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No prediction available yet - the ML service hasn&apos;t written a result. This is an
            honest empty state, not a placeholder.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
                  {trendLabel}
                </div>
                <div
                  className="text-lg font-semibold mt-0.5 flex items-center gap-1.5"
                  style={{ color: TREND_STYLE[prediction.trend]?.color ?? "var(--foreground)" }}
                >
                  <span>{TREND_STYLE[prediction.trend]?.arrow ?? "-"}</span>
                  <span className="capitalize">{prediction.trend}</span>
                </div>
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
                  {actionWindowLabel}
                </div>
                <div className="text-lg font-semibold mt-0.5">
                  {prediction.time_to_threshold.low_days != null && prediction.time_to_threshold.high_days != null
                    ? `${prediction.time_to_threshold.low_days}-${prediction.time_to_threshold.high_days}d`
                    : "-"}
                </div>
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>
                  Confidence
                </div>
                <ConfidenceBadge value={prediction.time_to_threshold.confidence} />
              </div>
              <div className="panel-2 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
                  {modelLabel}
                </div>
                <div className="text-lg font-semibold mt-0.5 font-mono truncate">{prediction.model_version}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--faint)" }}>
                {zoneLabel}
              </div>
              <div className="flex flex-col gap-2">
                {zoneEntries.map((z) => (
                  <div key={z.node_id} className="flex items-center gap-3">
                    <span className="text-xs w-16 shrink-0 font-medium">{nodeLabelById.get(z.node_id) ?? `Node ${z.node_id}`}</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(z.severity_0_to_1 * 100)}%`,
                          background:
                            z.severity_0_to_1 >= 0.85
                              ? "var(--offline)"
                              : z.severity_0_to_1 >= 0.65
                                ? "var(--stale)"
                                : z.severity_0_to_1 >= 0.4
                                  ? "var(--warning)"
                                  : "var(--normal)",
                        }}
                      />
                    </div>
                    <span className="text-xs w-10 text-right font-mono" style={{ color: "var(--faint)" }}>
                      {z.severity_0_to_1.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="label-caveat self-start">
              Model output - not observed. Never render as a single date, always a range.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2.5">
              <span className="section-icon"><ListGlyph /></span>
              <h2 className="text-sm font-semibold">Nodes</h2>
            </div>
            <Link href="/nodes" className="text-xs hover:text-foreground" style={{ color: "var(--muted)" }}>
              View all &rarr;
            </Link>
          </div>
          <div>
            {nodes.map((n) => (
              <Link
                key={n.node_id}
                href={`/nodes/${n.node_id}`}
                className="panel-row flex items-center justify-between px-4 md:px-5 py-3 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{n.label}</span>
                  <SourceBadge isMock={n.is_mock} />
                  <RiskBadge score={n.latest_risk_score} />
                </div>
                <HealthBadge state={n.health_state} />
              </Link>
            ))}
            {nodes.length === 0 && !nodesQuery.isLoading && (
              <p className="px-4 md:px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
                No nodes seeded yet.
              </p>
            )}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2.5">
              <span className="section-icon"><BellGlyph /></span>
              <h2 className="text-sm font-semibold">Active alerts</h2>
            </div>
            <Link href="/alerts" className="text-xs hover:text-foreground" style={{ color: "var(--muted)" }}>
              View all &rarr;
            </Link>
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 md:px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
              No active alerts.
            </p>
          ) : (
            <div>
              {alerts.map((a) => (
                <Link
                  key={a.id}
                  href={`/alerts/${a.id}`}
                  className="panel-row flex items-start gap-3 px-4 md:px-5 py-3 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="status-dot mt-1.5"
                    style={{ color: SEVERITY_COLOR[a.severity], background: SEVERITY_COLOR[a.severity] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.summary}</div>
                    <div className="text-xs mt-0.5 capitalize flex items-center gap-1.5 flex-wrap" style={{ color: "var(--muted)" }}>
                      <span>{a.severity} &middot; {a.state}</span>
                      {a.node_id != null && nodeLabelById.get(a.node_id) && <span>&middot; {nodeLabelById.get(a.node_id)}</span>}
                      {a.blast_suspected && (
                        <span className="label-caveat normal-case" style={{ fontSize: "0.62rem" }}>
                          blast overlap - severity unchanged
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] shrink-0 whitespace-nowrap" style={{ color: "var(--faint)" }}>
                    {new Date(a.created_at).toLocaleTimeString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  caption,
  icon,
  accent,
  isBadgeValue,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
  isBadgeValue?: boolean;
}) {
  return (
    <div className="stat-tile" style={{ ["--tile-accent" as string]: accent }}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--faint)" }}>
          {label}
        </div>
        <span className="stat-tile-icon">{icon}</span>
      </div>
      <div className={isBadgeValue ? "mt-2" : "text-2xl font-semibold mt-1.5"} style={isBadgeValue ? undefined : { color: "var(--foreground)" }}>
        {value}
      </div>
      {caption && <div className="mt-1.5">{caption}</div>}
    </div>
  );
}
