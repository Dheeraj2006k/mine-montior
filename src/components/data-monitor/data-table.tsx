"use client";

import { useState } from "react";

export type Row = Record<string, unknown>;

const TIMESTAMP_HINT = /(_at|date)$/i;

function formatCell(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span style={{ color: "var(--faint)" }}>&mdash;</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
        style={{
          color: value ? "var(--normal)" : "var(--faint)",
          background: value ? "color-mix(in srgb, var(--normal) 14%, transparent)" : "var(--surface-2)",
        }}
      >
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "object") {
    return <JsonCell value={value} />;
  }
  if (typeof value === "string" && TIMESTAMP_HINT.test(key) && !Number.isNaN(Date.parse(value))) {
    return (
      <span title={value} className="font-mono text-xs">
        {new Date(value).toLocaleString()}
      </span>
    );
  }
  if (typeof value === "string" && value.length > 60) {
    return <TruncatedText text={value} />;
  }
  return <span className="font-mono text-xs">{String(value)}</span>;
}

function JsonCell({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(value, null, 2);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline"
        style={{ color: "var(--accent-strong)" }}
      >
        {Array.isArray(value) ? `[${value.length}]` : "{...}"} expand
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1 max-w-xs">
      <pre
        className="text-[10px] font-mono p-2 rounded overflow-x-auto max-h-48"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
      >
        {text}
      </pre>
      <button type="button" onClick={() => setOpen(false)} className="text-xs underline self-start" style={{ color: "var(--faint)" }}>
        collapse
      </button>
    </div>
  );
}

function TruncatedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <span>
        {text}{" "}
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline" style={{ color: "var(--faint)" }}>
          less
        </button>
      </span>
    );
  }
  return (
    <span>
      {text.slice(0, 60)}&hellip;{" "}
      <button type="button" onClick={() => setOpen(true)} className="text-xs underline" style={{ color: "var(--accent-strong)" }}>
        more
      </button>
    </span>
  );
}

export function DataTable({
  columns,
  rows,
  primaryKey,
  newKeys,
  updatedKeys,
}: {
  columns: string[];
  rows: Row[];
  primaryKey: string;
  newKeys: Set<string>;
  updatedKeys: Set<string>;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-center" style={{ color: "var(--muted)" }}>
        No rows.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pk = String(row[primaryKey]);
            const isNew = newKeys.has(pk);
            const isUpdated = !isNew && updatedKeys.has(pk);
            return (
              <tr
                key={pk}
                style={
                  isNew
                    ? { background: "color-mix(in srgb, var(--normal) 10%, transparent)" }
                    : isUpdated
                      ? { background: "color-mix(in srgb, var(--warning) 10%, transparent)" }
                      : undefined
                }
              >
                {columns.map((c, i) => (
                  <td key={c}>
                    {i === 0 && (isNew || isUpdated) && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wide mr-1.5 px-1 py-0.5 rounded"
                        style={{
                          color: isNew ? "var(--normal)" : "var(--warning)",
                          background: isNew
                            ? "color-mix(in srgb, var(--normal) 18%, transparent)"
                            : "color-mix(in srgb, var(--warning) 18%, transparent)",
                        }}
                      >
                        {isNew ? "NEW" : "UPDATED"}
                      </span>
                    )}
                    {formatCell(c, row[c])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
