export type BaselineCandidate = {
  id: number;
  recorded_at: string;
};

/**
 * PRD-2 §2 Step 3: "baseline sensor reading at t=0 (auto-captured from the
 * first valid reading after registration)". Pure function - no DB access -
 * so the "first" logic is unit-testable independent of query ordering.
 * Callers should pass only readings that already passed validation
 * (sensor_ok, schema checks, etc); this function only handles ordering.
 */
export function findBaselineReading(
  candidates: BaselineCandidate[],
  registeredAt: string,
): BaselineCandidate | null {
  const registeredMs = new Date(registeredAt).getTime();
  const eligible = candidates.filter((c) => new Date(c.recorded_at).getTime() >= registeredMs);
  if (eligible.length === 0) return null;

  return eligible.reduce((earliest, current) =>
    new Date(current.recorded_at).getTime() < new Date(earliest.recorded_at).getTime() ? current : earliest,
  );
}
