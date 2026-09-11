export type HealthState = "normal" | "warning" | "unknown" | "stale" | "offline";

export type ReadingLike = {
  seq_num: number;
  recorded_at: string;
  sensor_ok: boolean | null;
  low_battery: boolean | null;
  comm_quality_low: boolean | null;
  calibration_stale: boolean | null;
};

export type NodeHealth = {
  last_seen_at: string | null;
  packet_loss_pct: number | null;
  health_state: HealthState;
};

const STALE_AFTER_MS = 5 * 60 * 1000; // 3x an assumed 1/min baseline, PRD §11.6 pattern
const OFFLINE_AFTER_MS = 15 * 60 * 1000;

/**
 * Pure domain function — no DB/Next.js access. Sensor health rules follow the
 * PRD's non-negotiable principle: unknown is never coerced to "safe"/green.
 */
export function computeNodeHealth(
  recentReadings: ReadingLike[],
  now: Date = new Date(),
): NodeHealth {
  if (recentReadings.length === 0) {
    return { last_seen_at: null, packet_loss_pct: null, health_state: "unknown" };
  }

  const sorted = [...recentReadings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
  const latest = sorted[sorted.length - 1];
  const ageMs = now.getTime() - new Date(latest.recorded_at).getTime();

  const seqNums = sorted.map((r) => r.seq_num);
  const minSeq = Math.min(...seqNums);
  const maxSeq = Math.max(...seqNums);
  const expected = maxSeq - minSeq + 1;
  const packetLossPct =
    expected > 0 ? Math.max(0, ((expected - sorted.length) / expected) * 100) : 0;

  let healthState: HealthState;
  if (ageMs > OFFLINE_AFTER_MS) {
    healthState = "offline";
  } else if (latest.sensor_ok === false) {
    healthState = "unknown";
  } else if (ageMs > STALE_AFTER_MS) {
    healthState = "stale";
  } else if (latest.low_battery || latest.comm_quality_low || latest.calibration_stale) {
    healthState = "warning";
  } else {
    healthState = "normal";
  }

  return {
    last_seen_at: latest.recorded_at,
    packet_loss_pct: Math.round(packetLossPct * 100) / 100,
    health_state: healthState,
  };
}
