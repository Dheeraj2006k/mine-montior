import type { InsarGridFeature } from "@/lib/insar-grid/types";

// Pure, DOM-free analysis logic for the dedicated /insar page - kept
// separate from the page component so it can be unit tested directly
// (this project's Vitest config runs in plain node, no jsdom/RTL).
//
// Every function here operates on the CURRENTLY SELECTED PAIR's features
// only - the API is deliberately filtered to one pair at a time (see
// GET /api/insar/grid's required `pair` param), so nothing here ever
// silently mixes pairs.

export type InsarPairSummary = {
  pair: number | null;
  totalCells: number;
  cellsWithLos: number;
  cellsWithoutLos: number;
  meanLosMm: number | null;
  medianLosMm: number | null;
  minLosMm: number | null;
  maxLosMm: number | null;
  meanCoherence: number | null;
  goodCoherenceCount: number;
  lowCoherenceCount: number;
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Summarises one pair's cells. LOS statistics (mean/median/min/max)
 * deliberately EXCLUDE cells with a null los_displacement_mm - a missing
 * measurement is not a value of 0 and must never be averaged in as one.
 * meanCoherence uses every cell (coherence is never null in this schema).
 */
export function computeInsarPairSummary(pair: number | null, features: InsarGridFeature[]): InsarPairSummary {
  const withLos = features.filter((f) => f.properties.los_displacement_mm != null);
  const losValues = withLos.map((f) => f.properties.los_displacement_mm as number);
  const coherenceValues = features.map((f) => f.properties.coherence);
  const lowCoherenceCount = features.filter((f) => f.properties.cell_coherence_quality === "LOW").length;

  return {
    pair,
    totalCells: features.length,
    cellsWithLos: withLos.length,
    cellsWithoutLos: features.length - withLos.length,
    meanLosMm: mean(losValues),
    medianLosMm: median(losValues),
    minLosMm: losValues.length > 0 ? Math.min(...losValues) : null,
    maxLosMm: losValues.length > 0 ? Math.max(...losValues) : null,
    meanCoherence: mean(coherenceValues),
    goodCoherenceCount: features.length - lowCoherenceCount,
    lowCoherenceCount,
  };
}

export type HistogramBucket = { label: string; count: number };

/**
 * Fixed-width histogram over non-null LOS displacement (mm) only. Null
 * (no-measurement) cells are excluded from the distribution entirely -
 * they are reported separately (cellsWithoutLos), never folded into a 0mm
 * bucket, which would misrepresent "no data" as "no movement".
 */
export function buildLosHistogram(features: InsarGridFeature[], binWidthMm = 5): HistogramBucket[] {
  const values = features
    .map((f) => f.properties.los_displacement_mm)
    .filter((v): v is number => v != null);
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const firstBinStart = Math.floor(min / binWidthMm) * binWidthMm;
  const lastBinStart = Math.floor(max / binWidthMm) * binWidthMm;
  const binCount = Math.round((lastBinStart - firstBinStart) / binWidthMm) + 1;

  const buckets: HistogramBucket[] = Array.from({ length: binCount }, (_, i) => {
    const start = firstBinStart + i * binWidthMm;
    return { label: `${start}`, count: 0 };
  });

  for (const v of values) {
    let idx = Math.floor((v - firstBinStart) / binWidthMm);
    if (idx < 0) idx = 0;
    if (idx >= buckets.length) idx = buckets.length - 1;
    buckets[idx].count += 1;
  }

  return buckets;
}

/**
 * Fixed 0-1 coherence histogram in 0.1-wide bins, so the 0.5 GOOD/LOW
 * threshold falls exactly on a bin boundary rather than splitting a bin.
 */
export function buildCoherenceHistogram(features: InsarGridFeature[]): HistogramBucket[] {
  const buckets: HistogramBucket[] = Array.from({ length: 10 }, (_, i) => ({
    label: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
    count: 0,
  }));
  for (const f of features) {
    const c = f.properties.coherence;
    let idx = Math.floor(c * 10);
    if (idx < 0) idx = 0;
    if (idx > 9) idx = 9;
    buckets[idx].count += 1;
  }
  return buckets;
}
