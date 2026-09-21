"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import type { HistogramBucket } from "./insar-analysis-utils";

const LOW_COHERENCE_COLOR = "#9aa0a6";
const GOOD_COHERENCE_COLOR = "#54d8ff";

export function InsarLosHistogramChart({ buckets }: { buckets: HistogramBucket[] }) {
  if (buckets.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No LOS measurements available for this pair.
      </p>
    );
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} label={{ value: "LOS displacement (mm)", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--muted)" }} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} label={{ value: "cells", angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--muted)" }} />
          <ReferenceLine x="0" stroke="var(--faint)" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value) => [`${value} cells`, "count"]}
            labelFormatter={(label) => `${label} mm`}
            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 11 }}
          />
          <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InsarCoherenceHistogramChart({ buckets }: { buckets: HistogramBucket[] }) {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No coherence data available for this pair.
      </p>
    );
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} label={{ value: "coherence (0-1)", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--muted)" }} />
          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} label={{ value: "cells", angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--muted)" }} />
          <Tooltip
            formatter={(value) => [`${value} cells`, "count"]}
            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 11 }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell key={b.label} fill={i < 5 ? LOW_COHERENCE_COLOR : GOOD_COHERENCE_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] mt-1" style={{ color: "var(--faint)" }}>
        Bins below 0.5 (grey) are LOW cell coherence quality; 0.5 and above (blue) are GOOD - see cell
        detail for the exact value.
      </p>
    </div>
  );
}
