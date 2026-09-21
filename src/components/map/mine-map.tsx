"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HealthState } from "@/lib/domain/node-health";

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

export function MineMap({
  nodes,
  aoi,
  mineType,
  onSelectNode,
  heightClassName = "h-96",
}: {
  nodes: MapNode[];
  aoi?: Aoi | null;
  mineType?: "longwall" | "bord_and_pillar" | null;
  onSelectNode?: (nodeId: number) => void;
  /** Tailwind height class - lets the map be the dashboard centerpiece without changing map logic. */
  heightClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const aoiMarkerRef = useRef<maplibregl.Marker | null>(null);

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

    // MapLibre measures its container at construction time; in a flex
    // layout the container can still be mid-resize then, leaving the map
    // canvas stuck at a stale (often too-narrow) size. Keep it in sync.
    const resizeObserver = new ResizeObserver(() => mapRef.current?.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
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

  return (
    <div className="relative">
      <div ref={containerRef} className={`w-full ${heightClassName} rounded-lg overflow-hidden`} />
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
