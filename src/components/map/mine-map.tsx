"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import type { HealthState } from "@/lib/domain/node-health";
import { apiGet } from "@/lib/api/client";
import type { InsarGridFeatureCollection, InsarGridObservationProperties } from "@/lib/insar-grid/types";
import { InsarGridLayer } from "./insar-grid-layer";
import { InsarToggle, InsarPairSelector, InsarLegend, InsarCellDetailPanel, InsarStatusBanner } from "./insar-controls";
import { useInsarPairOptions } from "./use-insar-pair-options";

export type MapNode = {
  node_id: number;
  label: string;
  mock_latitude: number;
  mock_longitude: number;
  health_state: HealthState;
  latest_risk_score: number | null;
  is_mock: boolean;
};

const RISK_COLORS: Record<HealthState, string> = {
  normal: "#34c759",
  warning: "#f5b301",
  unknown: "#8b95a7",
  stale: "#ff9f45",
  offline: "#ff4d4f",
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "(c) OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export type Aoi = { latitude: number; longitude: number };

/**
 * Optional controlled InSAR mode - lets a page (e.g. the dedicated /insar
 * analysis page) drive the grid layer/selection from its own state (so it
 * can share the same fetched pair data with a summary/charts/detail panel
 * laid out as real page sections) instead of MineMap's default
 * self-contained toggle+overlay behaviour used on the dashboard. When
 * provided, MineMap does not fetch or manage InSAR state itself - it only
 * renders the shared layer/legend driven by these values. This is
 * additive: existing callers that omit this prop are unaffected.
 */
export type InsarControl = {
  enabled: boolean;
  featureCollection: InsarGridFeatureCollection | null;
  selectedGridId: number | null;
  onSelectCell: (gridId: number) => void;
  /**
   * Opt-in only (default false) - frame the map to the real grid bounds
   * whenever a new feature collection loads. Only the dedicated /insar
   * analysis page should set this; the dashboard's shared sensor map must
   * never be silently recentered onto the InSAR grid.
   */
  fitBoundsOnLoad?: boolean;
};

export function MineMap({
  nodes,
  aoi,
  mineType,
  onSelectNode,
  heightClassName = "h-96",
  insar,
}: {
  nodes: MapNode[];
  aoi?: Aoi | null;
  mineType?: "longwall" | "bord_and_pillar" | null;
  onSelectNode?: (nodeId: number) => void;
  /** Tailwind height class - lets the map be the dashboard centerpiece without changing map logic. */
  heightClassName?: string;
  /** Controlled InSAR mode - see InsarControl. Omit for the default self-contained dashboard behaviour. */
  insar?: InsarControl;
}) {
  const controlled = insar != null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const aoiMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Mirrors mapRef in React state (refs alone don't trigger re-renders) so
  // the InSAR layer - a real React component that needs the map instance
  // as a prop to know when to attach - can mount at the right time.
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  // InSAR evidence layer: off by default, self-contained (no new required
  // props on MineMap), so every existing call site gets this "for free".
  // See Phase 7 spec: this must never feed operational risk/alerts, and
  // must never be implemented as a dashboard-specific integration.
  const [insarEnabled, setInsarEnabled] = useState(false);
  const [selectedPair, setSelectedPair] = useState<number>(1);
  const [selectedCell, setSelectedCell] = useState<InsarGridObservationProperties | null>(null);

  const pairOptions = useInsarPairOptions(!controlled && insarEnabled);
  const insarGridQuery = useQuery({
    queryKey: ["insar-grid", selectedPair],
    queryFn: () => apiGet<InsarGridFeatureCollection>(`/api/insar/grid?pair=${selectedPair}`),
    enabled: !controlled && insarEnabled,
  });
  const internalFeatureCollection = insarGridQuery.data?.data ?? null;

  const effectiveInsarEnabled = controlled ? insar.enabled : insarEnabled;
  const effectiveFeatureCollection = controlled ? insar.featureCollection : internalFeatureCollection;
  const effectiveSelectedGridId = controlled ? insar.selectedGridId : selectedCell?.grid_id ?? null;
  const effectiveOnSelectCell = controlled ? insar.onSelectCell : (gridId: number) => handleSelectInsarCell(gridId);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Anchor to the configured AOI (PRD-2 §2/§3) first - only fall back to
    // a node position or the hardcoded default when no site_config exists
    // yet, so setup is what actually drives where the map opens.
    const center: [number, number] = aoi
      ? [aoi.longitude, aoi.latitude]
      : nodes.length > 0
        ? [nodes[0].mock_longitude, nodes[0].mock_latitude]
        : [86.43, 23.796];

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom: 15,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");
    setMapInstance(mapRef.current);

    // MapLibre measures its container at construction time; in a flex
    // layout the container can still be mid-resize then, leaving the map
    // canvas stuck at a stale (often too-narrow) size. Keep it in sync.
    const resizeObserver = new ResizeObserver(() => mapRef.current?.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = nodes.map((node) => {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.background = RISK_COLORS[node.health_state];
      // Mock nodes get a dashed ring instead of a solid border - a real
      // node's GNSS-registered position vs. an illustrative one should
      // read differently at a glance, not just in a tooltip.
      el.style.border = node.is_mock ? "2px dashed rgba(255,255,255,0.85)" : "2px solid white";
      el.style.boxShadow = "0 0 4px rgba(0,0,0,0.5)";
      el.style.cursor = onSelectNode ? "pointer" : "default";
      el.title = `${node.label} - ${node.health_state} - ${node.is_mock ? "mock position" : "GNSS-registered"}`;

      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<strong>${node.label}</strong><br/>${
          node.is_mock ? "mock position (not GNSS)" : "real · GNSS-registered"
        }<br/>health: ${node.health_state}<br/>risk: ${node.latest_risk_score ?? "-"}`,
      );

      if (onSelectNode) {
        el.addEventListener("click", () => onSelectNode(node.node_id));
      }

      return new maplibregl.Marker({ element: el })
        .setLngLat([node.mock_longitude, node.mock_latitude])
        .setPopup(popup)
        .addTo(map);
    });
  }, [nodes, onSelectNode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    aoiMarkerRef.current?.remove();
    aoiMarkerRef.current = null;
    if (!aoi) return;

    const el = document.createElement("div");
    el.style.width = "14px";
    el.style.height = "14px";
    el.style.border = "2px solid var(--accent-strong, #54d8ff)";
    el.style.borderRadius = "3px";
    el.style.background = "transparent";
    el.style.boxShadow = "0 0 0 3px rgba(0,166,214,0.18)";
    el.title = "AOI center (from site setup)";

    const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
      `<strong>AOI center</strong><br/>from site setup - ${mineType ?? "mine type not set"}`,
    );

    aoiMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([aoi.longitude, aoi.latitude])
      .setPopup(popup)
      .addTo(map);
  }, [aoi, mineType]);

  function handleSelectInsarCell(gridId: number) {
    const feature = internalFeatureCollection?.features.find((f) => f.properties.grid_id === gridId);
    setSelectedCell(feature?.properties ?? null);
  }

  function handleSelectPair(pair: number) {
    setSelectedPair(pair);
    setSelectedCell(null);
  }

  function handleToggleInsar() {
    setInsarEnabled((v) => {
      if (v) setSelectedCell(null);
      return !v;
    });
  }

  return (
    <div className="relative">
      <div ref={containerRef} className={`w-full ${heightClassName} rounded-lg overflow-hidden`} />
      <InsarGridLayer
        map={mapInstance}
        featureCollection={effectiveInsarEnabled ? effectiveFeatureCollection : null}
        selectedGridId={effectiveSelectedGridId}
        onSelectCell={effectiveOnSelectCell}
        fitBoundsOnLoad={controlled ? (insar.fitBoundsOnLoad ?? false) : false}
      />
      {!controlled && <InsarToggle enabled={insarEnabled} onToggle={handleToggleInsar} />}
      {effectiveInsarEnabled && (
        <>
          {!controlled && (
            <>
              <InsarPairSelector
                options={pairOptions.options}
                loading={pairOptions.isLoading}
                selectedPair={selectedPair}
                onSelectPair={handleSelectPair}
              />
              <InsarStatusBanner
                loading={insarGridQuery.isLoading}
                error={insarGridQuery.isError ? (insarGridQuery.error as Error).message : null}
              />
              {selectedCell && <InsarCellDetailPanel cell={selectedCell} onClose={() => setSelectedCell(null)} />}
            </>
          )}
          <InsarLegend />
        </>
      )}
      {mineType && (
        <span
          className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full z-10"
          style={{ color: "var(--foreground)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {mineType === "longwall" ? "Longwall" : "Bord-and-Pillar"}
        </span>
      )}
      <div
        className="absolute bottom-2 left-2 z-10 rounded-lg px-2.5 py-2 flex flex-col gap-1 text-[10px]"
        style={{ background: "color-mix(in srgb, var(--surface-2) 92%, transparent)", border: "1px solid var(--border)", color: "var(--muted)" }}
      >
        {(["normal", "warning", "unknown", "stale", "offline"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5 capitalize">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_COLORS[s] }} />
            {s}
          </span>
        ))}
        <span className="flex items-center gap-1.5 pt-1 mt-0.5" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ border: "1.5px dashed var(--faint)" }} />
          mock position
        </span>
      </div>
    </div>
  );
}
