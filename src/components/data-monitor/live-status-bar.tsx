"use client";

type Status = "live" | "syncing" | "reconnecting" | "error";

export function LiveStatusBar({
  status,
  lastSync,
  paused,
  onTogglePause,
  onRefreshNow,
  rowCount,
}: {
  status: Status;
  lastSync: Date | null;
  paused: boolean;
  onTogglePause: () => void;
  onRefreshNow: () => void;
  rowCount: number | null;
}) {
  const STATUS_COPY: Record<Status, { label: string; color: string }> = {
    live: { label: "LIVE", color: "var(--normal)" },
    syncing: { label: "SYNCING", color: "var(--accent)" },
    reconnecting: { label: "RECONNECTING", color: "var(--warning)" },
    error: { label: "ERROR", color: "var(--offline)" },
  };
  const { label, color } = STATUS_COPY[paused ? "reconnecting" : status];
  const displayLabel = paused ? "PAUSED" : label;
  const displayColor = paused ? "var(--faint)" : color;

  return (
    <div className="flex items-center gap-4 flex-wrap px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: displayColor }}>
        <span className="relative flex h-2 w-2">
          {!paused && status === "live" && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: displayColor }} />
          )}
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: displayColor }} />
        </span>
        {displayLabel}
      </span>
      <span className="text-xs" style={{ color: "var(--faint)" }}>
        Last sync: {lastSync ? lastSync.toLocaleTimeString() : "—"}
      </span>
      <span className="text-xs" style={{ color: "var(--faint)" }}>
        Auto-refresh: {paused ? "paused" : "2.5s"}
      </span>
      {rowCount != null && (
        <span className="text-xs" style={{ color: "var(--faint)" }}>
          Rows: {rowCount}
        </span>
      )}
      <div className="flex items-center gap-1.5 ml-auto">
        <button type="button" className="btn btn-ghost text-xs" onClick={onTogglePause}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="btn btn-ghost text-xs" onClick={onRefreshNow}>
          Refresh now
        </button>
      </div>
    </div>
  );
}
