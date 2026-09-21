"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

type TableApiData = {
  table: string;
  display_name: string;
  classification: string;
  primary_key: string;
  timestamp_field: string | null;
  rows: Record<string, unknown>[];
  row_count_estimate: number | null;
  limit: number;
  offset: number;
};

type ApiResponse = { data: TableApiData; meta: { generated_at: string; source: string } };

const REFRESH_MS = 2500;

function snapshotOf(data: TableApiData | undefined): Map<string, string> {
  const snapshot = new Map<string, string>();
  if (!data) return snapshot;
  for (const row of data.rows) {
    snapshot.set(String(row[data.primary_key]), JSON.stringify(row));
  }
  return snapshot;
}

export function useDataMonitorTable(
  tableKey: string,
  params: { filters?: Record<string, string>; limit?: number; offset?: number; paused?: boolean },
) {
  const { filters = {}, limit = 50, offset = 0, paused = false } = params;
  const filtersKey = JSON.stringify(filters);

  const search = new URLSearchParams();
  search.set("limit", String(limit));
  search.set("offset", String(offset));
  for (const [k, v] of Object.entries(filters)) {
    if (v) search.set(k, v);
  }

  const query = useQuery({
    queryKey: ["data-monitor", tableKey, search.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/data-monitor/${tableKey}?${search.toString()}`);
      const body: ApiResponse = await res.json();
      if (!res.ok) throw new Error((body as unknown as { error?: { message?: string } }).error?.message ?? "Request failed");
      return body;
    },
    refetchInterval: paused ? false : REFRESH_MS,
  });

  // "Adjusting state during rendering" (React's own documented pattern for
  // deriving state from a changed value without an extra render+effect
  // round trip, and without refs - this compiler config forbids reading a
  // ref during render too). `trackedData` IS the previous snapshot; there
  // is no separate ref to keep in sync.
  const [trackedIdentity, setTrackedIdentity] = useState<string | null>(null);
  const [trackedData, setTrackedData] = useState<TableApiData | undefined>(undefined);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const [updatedKeys, setUpdatedKeys] = useState<Set<string>>(new Set());
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const identity = `${tableKey}:${filtersKey}`;
  const currentData = query.data?.data;

  if (identity !== trackedIdentity) {
    // Switched table/filters - reset change-tracking so stale highlights
    // from a different table never bleed into this one.
    setTrackedIdentity(identity);
    setTrackedData(currentData);
    setNewKeys(new Set());
    setUpdatedKeys(new Set());
  } else if (currentData !== trackedData && currentData) {
    const previousSnapshot = snapshotOf(trackedData);
    const fresh = new Set<string>();
    const changed = new Set<string>();

    for (const row of currentData.rows) {
      const key = String(row[currentData.primary_key]);
      const hash = JSON.stringify(row);
      const prevHash = previousSnapshot.get(key);
      if (previousSnapshot.size > 0 && prevHash === undefined) {
        fresh.add(key);
      } else if (prevHash !== undefined && prevHash !== hash) {
        changed.add(key);
      }
    }

    setTrackedData(currentData);
    setNewKeys(fresh);
    setUpdatedKeys(changed);
    setLastSync(new Date());
  }

  return { query, newKeys, updatedKeys, lastSync };
}
