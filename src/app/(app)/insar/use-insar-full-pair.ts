"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import type { InsarGridFeatureCollection } from "@/lib/insar-grid/types";

const PAGE_LIMIT = 1000; // API's documented max per request (MAX_LIMIT)

/**
 * Fetches ALL of one pair's grid cells (up to 1,591) by paging the
 * existing GET /api/insar/grid endpoint at its own max page size - the API
 * contract (pair-scoped, offset/limit) is unchanged, this just calls it
 * more than once when a pair has more rows than one page. Never fetches
 * more than one pair's worth of data at a time (never all 9,546 rows).
 */
export function useInsarFullPair(pair: number, coherenceMin?: number, coherenceMax?: number) {
  return useQuery({
    queryKey: ["insar-grid-full", pair, coherenceMin ?? null, coherenceMax ?? null],
    queryFn: async () => {
      let offset = 0;
      const features: InsarGridFeatureCollection["features"] = [];
      for (;;) {
        const params = new URLSearchParams({ pair: String(pair), limit: String(PAGE_LIMIT), offset: String(offset) });
        if (coherenceMin != null) params.set("coherence_min", String(coherenceMin));
        if (coherenceMax != null) params.set("coherence_max", String(coherenceMax));
        const page = await apiGet<InsarGridFeatureCollection>(`/api/insar/grid?${params.toString()}`);
        features.push(...page.data.features);
        if (page.data.features.length < PAGE_LIMIT) break;
        offset += PAGE_LIMIT;
      }
      const result: InsarGridFeatureCollection = { type: "FeatureCollection", features };
      return result;
    },
    staleTime: 5 * 60 * 1000, // analysis evidence, not a realtime sensor screen - no aggressive polling
  });
}
