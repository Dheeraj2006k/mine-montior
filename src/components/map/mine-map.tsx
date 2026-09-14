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

export function MineMap({ nodes }: { nodes: MapNode[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] =
      nodes.length > 0 ? [nodes[0].mock_longitude, nodes[0].mock_latitude] : [86.43, 23.796];

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
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 4px rgba(0,0,0,0.5)";
      el.title = `${node.label} - ${node.health_state} - mock position`;

      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<strong>${node.label}</strong><br/>mock position (not GNSS)<br/>health: ${node.health_state}<br/>risk: ${
          node.latest_risk_score ?? "-"
        }`,
      );

      return new maplibregl.Marker({ element: el })
        .setLngLat([node.mock_longitude, node.mock_latitude])
        .setPopup(popup)
        .addTo(map);
    });
  }, [nodes]);

  return <div ref={containerRef} className="w-full h-96 rounded-lg overflow-hidden" />;
}
