"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { MineMap, type MapNode } from "@/components/map/mine-map";
import { useInsarPairOptions } from "@/components/map/use-insar-pair-options";
import { LosDisplacementLabel } from "@/components/labels";
import type { HealthState } from "@/lib/domain/node-health";
import type { InsarGridObservationProperties } from "@/lib/insar-grid/types";
import { useInsarFullPair } from "./use-insar-full-pair";
import { InsarPairFilterBar } from "./insar-pair-filter-bar";
import { InsarCellDetailPanel } from "./insar-cell-detail-panel";
import { InsarSummary } from "./insar-summary";
import { InsarLosHistogramChart, InsarCoherenceHistogramChart } from "./insar-charts";
import { computeInsarPairSummary, buildLosHistogram, buildCoherenceHistogram } from "./insar-analysis-utils";

type NodeRow = {
  node_id: number;
  label: string;
  mock_latitude: number;
  mock_longitude: number;
  is_mock: boolean;
  latest_risk_score: number | null;
  health_state: HealthState;
};

type SiteConfigRow = {
  mine_type: "longwall" | "bord_and_pillar";
  aoi_latitude: number | null;
  aoi_longitude: number | null;
} | null;

function parseCoherenceInput(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default function InsarAnalysisPage() {
  const [selectedPair, setSelectedPair] = useState(1);
  const [selectedCell, setSelectedCell] = useState<InsarGridObservationProperties | null>(null);
  const [coherenceMinInput, setCoherenceMinInput] = useState("");
  const [coherenceMaxInput, setCoherenceMaxInput] = useState("");

  const pairOptions = useInsarPairOptions(true);

  const coherenceMin = parseCoherenceInput(coherenceMinInput);
  const coherenceMax = parseCoherenceInput(coherenceMaxInput);
  const gridQuery = useInsarFullPair(selectedPair, coherenceMin, coherenceMax);

  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => apiGet<NodeRow[]>("/api/nodes"),
  });
  const siteConfigQuery = useQuery({
    queryKey: ["site-config"],
    queryFn: () => apiGet<SiteConfigRow>("/api/site-config"),
  });

  const featureCollection = gridQuery.data ?? null;
  const features = featureCollection?.features ?? [];
  const nodes = nodesQuery.data?.data ?? [];
  const siteConfig = siteConfigQuery.data?.data ?? null;

  const mapNodes: MapNode[] = nodes.map((n) => ({
    node_id: n.node_id,
    label: n.label,
    mock_latitude: n.mock_latitude,
    mock_longitude: n.mock_longitude,
    health_state: n.health_state,
    latest_risk_score: n.latest_risk_score,
    is_mock: n.is_mock,
  }));

  function handleSelectPair(pair: number) {
    setSelectedPair(pair);
    setSelectedCell(null);
  }

  function handleSelectCell(gridId: number) {
    const feature = features.find((f) => f.properties.grid_id === gridId);
    setSelectedCell(feature?.properties ?? null);
  }

  const summary = computeInsarPairSummary(selectedPair, features);
  const losBuckets = buildLosHistogram(features);
  const coherenceBuckets = buildCoherenceHistogram(features);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">InSAR Evidence</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Satellite-derived ground motion evidence
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-[11px] px-2 py-1 rounded-full"
            style={{ color: "var(--muted)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            Supplementary evidence &mdash; not a standalone alert trigger
          </span>
          <LosDisplacementLabel />
        </div>
      </div>

      <InsarPairFilterBar
        options={pairOptions.options}
        optionsLoading={pairOptions.isLoading}
        selectedPair={selectedPair}
        onSelectPair={handleSelectPair}
        coherenceMin={coherenceMinInput}
        coherenceMax={coherenceMaxInput}
        onCoherenceMinChange={setCoherenceMinInput}
        onCoherenceMaxChange={setCoherenceMaxInput}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
        <section className="panel overflow-hidden">
          {gridQuery.isError ? (
            <div className="p-5">
              <p className="text-sm" style={{ color: "var(--offline)" }}>
                Unable to load InSAR evidence.
              </p>
            </div>
          ) : gridQuery.isLoading ? (
            <div className="p-5">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Loading InSAR evidence&hellip;
              </p>
            </div>
          ) : (
            <MineMap
              nodes={mapNodes}
              mineType={siteConfig?.mine_type ?? null}
              aoi={
                siteConfig?.aoi_latitude != null && siteConfig?.aoi_longitude != null
                  ? { latitude: siteConfig.aoi_latitude, longitude: siteConfig.aoi_longitude }
                  : null
              }
              heightClassName="h-[520px]"
              insar={{
                enabled: true,
                featureCollection,
                selectedGridId: selectedCell?.grid_id ?? null,
                onSelectCell: handleSelectCell,
                fitBoundsOnLoad: true,
              }}
            />
          )}
          {!gridQuery.isLoading && !gridQuery.isError && features.length === 0 && (
            <p className="px-4 md:px-5 py-3 text-xs border-t" style={{ color: "var(--faint)", borderColor: "var(--border)" }}>
              No grid cells match the current filter for this pair.
            </p>
          )}
        </section>

        <InsarCellDetailPanel cell={selectedCell} />
      </div>

      {gridQuery.isError ? null : gridQuery.isLoading ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading InSAR evidence&hellip;
        </p>
      ) : (
        <>
          <InsarSummary summary={summary} />

          {summary.lowCoherenceCount > 0 && (
            <p className="text-xs px-1" style={{ color: "var(--faint)" }}>
              Low coherence cells contain reduced-quality InSAR evidence - shown de-emphasized on the map,
              not treated as stable or zero movement.
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="panel p-4 md:p-5">
              <h2 className="text-sm font-semibold mb-2">LOS displacement distribution</h2>
              <InsarLosHistogramChart buckets={losBuckets} />
            </section>
            <section className="panel p-4 md:p-5">
              <h2 className="text-sm font-semibold mb-2">Coherence distribution</h2>
              <InsarCoherenceHistogramChart buckets={coherenceBuckets} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
