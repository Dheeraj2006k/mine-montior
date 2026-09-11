"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { projectToLocalMetres } from "@/lib/geo/project";
import type { HealthState } from "@/lib/domain/node-health";

export type TwinNode = {
  node_id: number;
  label: string;
  mock_latitude: number;
  mock_longitude: number;
  health_state: HealthState;
};

export type PredictedZoneEntry = { node_id?: number; severity_0_to_1?: number };

const HEALTH_COLORS: Record<HealthState, string> = {
  normal: "#34c759",
  warning: "#f5b301",
  unknown: "#8b95a7",
  stale: "#ff9f45",
  offline: "#ff4d4f",
};

const GRID_SIZE = 100; // metres
const GRID_SEGMENTS = 64;
const MAX_DEFORMATION_M = 4;
const INFLUENCE_RADIUS_M = 25;

function Terrain({
  nodes,
  origin,
  severityByNode,
  scrubT,
}: {
  nodes: TwinNode[];
  origin: { lat: number; lon: number };
  severityByNode: Map<number, number>;
  scrubT: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const nodePositions = useMemo(
    () =>
      nodes.map((n) => ({
        node_id: n.node_id,
        ...projectToLocalMetres({ lat: n.mock_latitude, lon: n.mock_longitude }, origin),
      })),
    [nodes, origin],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const position = mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      let deform = 0;
      for (const np of nodePositions) {
        const severity = severityByNode.get(np.node_id) ?? 0;
        if (severity <= 0) continue;
        const dist = Math.hypot(x - np.x, y - np.y);
        const falloff = Math.max(0, 1 - dist / INFLUENCE_RADIUS_M);
        deform += severity * falloff;
      }
      position.setZ(i, -deform * MAX_DEFORMATION_M * scrubT);
    }
    position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[GRID_SIZE, GRID_SIZE, GRID_SEGMENTS, GRID_SEGMENTS]} />
      <meshStandardMaterial color="#1a2230" wireframe={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function NodePin({
  node,
  position,
  pulse,
}: {
  node: TwinNode;
  position: [number, number, number];
  pulse: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !pulse) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.25;
    ref.current.scale.setScalar(s);
  });

  return (
    <group position={position}>
      <mesh ref={ref} position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={HEALTH_COLORS[node.health_state]}
          emissive={HEALTH_COLORS[node.health_state]}
          emissiveIntensity={0.6}
        />
      </mesh>
      <Html distanceFactor={30} position={[0, 3, 0]}>
        <div
          style={{
            background: "rgba(18,22,31,0.85)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "2px 6px",
            fontSize: 11,
            color: "#e6e9ef",
            whiteSpace: "nowrap",
          }}
        >
          {node.label} · mock position
        </div>
      </Html>
    </group>
  );
}

export function TwinScene({
  nodes,
  predictedZone,
  scrubT,
}: {
  nodes: TwinNode[];
  predictedZone: PredictedZoneEntry[];
  scrubT: number;
}) {
  const origin = useMemo(
    () =>
      nodes.length > 0
        ? { lat: nodes[0].mock_latitude, lon: nodes[0].mock_longitude }
        : { lat: 23.7957, lon: 86.4304 },
    [nodes],
  );

  const severityByNode = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of predictedZone) {
      if (typeof entry.node_id === "number" && typeof entry.severity_0_to_1 === "number") {
        map.set(entry.node_id, entry.severity_0_to_1);
      }
    }
    return map;
  }, [predictedZone]);

  const nodePositions = useMemo(
    () =>
      nodes.map((n) => ({
        node: n,
        pos: projectToLocalMetres({ lat: n.mock_latitude, lon: n.mock_longitude }, origin),
        node_id: n.node_id,
      })),
    [nodes, origin],
  );

  return (
    <Canvas shadows camera={{ position: [40, 40, 40], fov: 45 }} frameloop="always">
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 50, 20]} intensity={1} castShadow />
      <Terrain nodes={nodes} origin={origin} severityByNode={severityByNode} scrubT={scrubT} />
      {nodePositions.map(({ node, pos }) => (
        <NodePin
          key={node.node_id}
          node={node}
          position={[pos.x, 0, pos.y]}
          pulse={node.health_state === "warning" || node.health_state === "offline"}
        />
      ))}
      <OrbitControls />
    </Canvas>
  );
}
