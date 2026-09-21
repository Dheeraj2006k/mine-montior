"use client";

import { useQueries } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import type { InsarGridFeatureCollection } from "@/lib/insar-grid/types";

// The verified production import (see IMPLEMENTED_INSAR docs / STEP 5 live
// verification) has exactly 6 temporal pairs (9,546 observations / 1,591
// cells = 6). There is no /api/insar/pairs endpoint (deliberately not
// built - Phase 6 kept the API surface to the two grid routes), so real
// per-pair dates for the selector are read off the existing
// GET /api/insar/grid?pair=N&limit=1 route, one feature at a time - cheap
// (1 row per pair) and uses only the already-shipped, already-verified API.
const KNOWN_PAIR_COUNT = 6;

export type InsarPairOption = {
  pair: number;
  referenceDate: string;
  secondaryDate: string;
  temporalBaselineDays: number;
};

export function useInsarPairOptions(enabled: boolean) {
  const queries = useQueries({
    queries: Array.from({ length: KNOWN_PAIR_COUNT }, (_, i) => {
      const pair = i + 1;
      return {
        queryKey: ["insar-grid-pair-sample", pair],
        queryFn: () => apiGet<InsarGridFeatureCollection>(`/api/insar/grid?pair=${pair}&limit=1`),
        enabled,
        staleTime: Infinity,
      };
    }),
  });

  const isLoading = enabled && queries.some((q) => q.isLoading);
  const options: InsarPairOption[] = queries
    .map((q, i) => {
      const feature = q.data?.data.features[0];
      if (!feature) return null;
      const p = feature.properties;
      return {
        pair: i + 1,
        referenceDate: p.reference_date,
        secondaryDate: p.secondary_date,
        temporalBaselineDays: p.temporal_baseline_days,
      };
    })
    .filter((o): o is InsarPairOption => o !== null);

  return { options, isLoading };
}
