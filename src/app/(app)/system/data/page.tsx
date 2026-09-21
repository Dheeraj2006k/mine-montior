"use client";

import { useState } from "react";
import { TABLE_REGISTRY, TABLE_KEYS, type TableClassification } from "@/lib/data-monitor/registry";
import { useDataMonitorTable } from "@/lib/data-monitor/use-table-query";
import { LiveStatusBar } from "@/components/data-monitor/live-status-bar";
import { DataTable } from "@/components/data-monitor/data-table";

const CLASSIFICATION_LABEL: Record<TableClassification, string> = {
  OPERATIONAL: "Operational",
  SAFE_INTERNAL: "Safe internal",
  ADMIN_PII: "Admin / PII",
  SYSTEM: "System",
};
const CLASSIFICATION_COLOR: Record<TableClassification, string> = {
  OPERATIONAL: "var(--accent)",
  SAFE_INTERNAL: "var(--normal)",
  ADMIN_PII: "var(--offline)",
  SYSTEM: "var(--muted)",
};

function ClassificationBadge({ c }: { c: TableClassification }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
      style={{ color: CLASSIFICATION_COLOR[c], background: `color-mix(in srgb, ${CLASSIFICATION_COLOR[c]} 14%, transparent)` }}
    >
      {CLASSIFICATION_LABEL[c]}
    </span>
  );
}

function OverviewCard({ tableKey, onOpen }: { tableKey: string; onOpen: () => void }) {
  const entry = TABLE_REGISTRY[tableKey];
  const { query, lastSync } = useDataMonitorTable(tableKey, { limit: 1 });
  const forbidden = query.error instanceof Error && query.error.message.includes("Requires");
  const row = query.data?.data.rows[0];
  const latestTs = entry.timestampField && row ? (row[entry.timestampField] as string | undefined) : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={forbidden}
      className="panel p-3.5 text-left flex flex-col gap-1.5 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{entry.displayName}</span>
        <ClassificationBadge c={entry.classification} />
      </div>
      <p className="text-xs" style={{ color: "var(--faint)" }}>
        {entry.description}
      </p>
      <div className="flex items-center justify-between mt-1 text-xs" style={{ color: "var(--muted)" }}>
        {forbidden ? (
          <span style={{ color: "var(--faint)" }}>restricted</span>
        ) : (
          <>
            <span>~{query.data?.data.row_count_estimate ?? "-"} rows</span>
            <span>{latestTs ? new Date(latestTs).toLocaleTimeString() : lastSync ? "no rows yet" : "..."}</span>
          </>
        )}
      </div>
    </button>
  );
}

function FilterBar({
  tableKey,
  filters,
  onChange,
}: {
  tableKey: string;
  filters: Record<string, string>;
  onChange: (f: Record<string, string>) => void;
}) {
  const entry = TABLE_REGISTRY[tableKey];
  if (entry.filterable.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {entry.filterable.map((f) => (
        <input
          key={f.column}
          className="input text-xs py-1.5"
          placeholder={f.label}
          value={filters[f.column] ?? ""}
          onChange={(e) => onChange({ ...filters, [f.column]: e.target.value })}
        />
      ))}
      {Object.values(filters).some(Boolean) && (
        <button type="button" className="btn btn-ghost text-xs" onClick={() => onChange({})}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function TableExplorer({ tableKey }: { tableKey: string }) {
  const entry = TABLE_REGISTRY[tableKey];
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [paused, setPaused] = useState(false);

  const { query, newKeys, updatedKeys, lastSync } = useDataMonitorTable(tableKey, { filters, limit, offset, paused });

  const forbidden = query.error instanceof Error && query.error.message.includes("Requires");
  const rows = query.data?.data.rows ?? [];
  const total = query.data?.data.row_count_estimate ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold">{entry.displayName}</h2>
          <ClassificationBadge c={entry.classification} />
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--faint)" }}>
          {entry.description}
        </p>
        <p className="text-[11px] mt-1 font-mono" style={{ color: "var(--faint)" }}>
          SOURCE: Supabase &rarr; /api/data-monitor/{tableKey} &rarr; UI
        </p>
      </div>

      {forbidden ? (
        <p className="text-sm panel p-4" style={{ color: "var(--muted)" }}>
          Your role doesn&apos;t have access to this table ({entry.minRole}+ required).
        </p>
      ) : (
        <>
          <LiveStatusBar
            status={query.isError ? "error" : query.isFetching ? "syncing" : "live"}
            lastSync={lastSync}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            onRefreshNow={() => query.refetch()}
            rowCount={rows.length}
          />

          <div className="flex items-center justify-between flex-wrap gap-2">
            <FilterBar tableKey={tableKey} filters={filters} onChange={(f) => { setFilters(f); setOffset(0); }} />
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: "var(--faint)" }}>
                Showing {offset + 1}-{offset + rows.length}
                {total != null ? ` of ~${total}` : ""}
              </span>
              <button type="button" className="btn btn-ghost text-xs" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
                Previous
              </button>
              <button type="button" className="btn btn-ghost text-xs" disabled={rows.length < limit} onClick={() => setOffset((o) => o + limit)}>
                Next
              </button>
              <select className="input text-xs py-1" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}>
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}/page</option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel overflow-hidden">
            {query.isLoading ? (
              <p className="px-4 py-8 text-sm text-center" style={{ color: "var(--muted)" }}>Loading...</p>
            ) : (
              <DataTable columns={entry.columns} rows={rows} primaryKey={entry.primaryKey} newKeys={newKeys} updatedKeys={updatedKeys} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NodeVerificationPanel() {
  const { query: nodesQuery } = useDataMonitorTable("nodes", { limit: 50 });
  const nodes = nodesQuery.data?.data.rows ?? [];
  const [nodeId, setNodeId] = useState<string>("");

  const activeNodeId = nodeId || (nodes[0] ? String(nodes[0].node_id) : "");

  const { query: nodeQuery } = useDataMonitorTable("nodes", { filters: { node_id: activeNodeId }, limit: 1 });
  const { query: latestQuery } = useDataMonitorTable("readings", { filters: { node_id: activeNodeId }, limit: 1 });
  const { query: historyQuery, newKeys, updatedKeys } = useDataMonitorTable("readings", { filters: { node_id: activeNodeId }, limit: 10 });

  const nodeRecord = nodeQuery.data?.data.rows[0];
  const latest = latestQuery.data?.data.rows[0];
  const history = historyQuery.data?.data.rows ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Node verification</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--faint)" }}>
          Confirm data inserted into Supabase is actually visible here - pick a node and watch it update.
        </p>
      </div>

      <select className="input w-fit" value={activeNodeId} onChange={(e) => setNodeId(e.target.value)}>
        {nodes.map((n) => (
          <option key={String(n.node_id)} value={String(n.node_id)}>
            {String(n.label)} (node_id={String(n.node_id)})
          </option>
        ))}
      </select>

      {!activeNodeId ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>No nodes registered yet.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel p-4">
            <h3 className="text-sm font-semibold mb-2">Node record</h3>
            {nodeRecord ? (
              <dl className="flex flex-col gap-1.5 text-xs">
                {["node_id", "site_id", "is_mock", "registered_latitude", "registered_longitude", "registered_at", "baseline_reading_id"].map((k) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt style={{ color: "var(--faint)" }}>{k}</dt>
                    <dd className="font-mono">{nodeRecord[k] == null ? "—" : String(nodeRecord[k])}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>Loading...</p>
            )}
          </div>

          <div className="panel p-4">
            <h3 className="text-sm font-semibold mb-2">Latest reading</h3>
            {latest ? (
              <dl className="flex flex-col gap-1.5 text-xs">
                {["recorded_at", "seq_num", "tilt_x_filt", "tilt_y_filt", "vibration_filt", "displacement_filt", "risk_score", "sensor_ok"].map((k) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt style={{ color: "var(--faint)" }}>{k}</dt>
                    <dd className="font-mono">{latest[k] == null ? "—" : String(latest[k])}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>Waiting for first reading&hellip;</p>
            )}
          </div>
        </div>
      )}

      {activeNodeId && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
            Recent history (latest 10)
          </div>
          <DataTable
            columns={["id", "recorded_at", "seq_num", "tilt_x_filt", "tilt_y_filt", "vibration_filt", "displacement_filt", "risk_score", "sensor_ok"]}
            rows={history}
            primaryKey="id"
            newKeys={newKeys}
            updatedKeys={updatedKeys}
          />
        </div>
      )}
    </div>
  );
}

export default function DataMonitorPage() {
  const [tab, setTab] = useState<string>("overview");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">IRIS Data Monitor</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          Live operational data from the IRIS backend - internal, for development and demonstration.
        </p>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:w-52 shrink-0">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="Overview" />
          <TabButton active={tab === "node-verify"} onClick={() => setTab("node-verify")} label="Node verification" />
          {TABLE_KEYS.map((k) => (
            <TabButton key={k} active={tab === k} onClick={() => setTab(k)} label={TABLE_REGISTRY[k].displayName} />
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          {tab === "overview" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {TABLE_KEYS.map((k) => (
                <OverviewCard key={k} tableKey={k} onOpen={() => setTab(k)} />
              ))}
            </div>
          )}
          {tab === "node-verify" && <NodeVerificationPanel />}
          {TABLE_KEYS.includes(tab) && <TableExplorer tableKey={tab} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  disabled,
  disabledNote,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  disabledNote?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabledNote}
      className="text-left text-sm px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        color: active ? "var(--foreground)" : "var(--muted)",
        background: active ? "var(--surface-2)" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}
