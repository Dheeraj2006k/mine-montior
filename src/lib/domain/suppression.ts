// PRD §12 / plan §8.4: suppression is a query-time filter in the notification
// engine ONLY. It must never be consulted by ingest, the alert engine, or
// anything that decides whether to persist/analyse data — structural
// separation, not a code comment, is what keeps this honest.
//
// There is no dedicated suppression table in the 14-table schema, so state is
// reconstructed from `alert_feedback` history: a `blast_or_disturbance`
// verdict on a given node/severity band suppresses further NOTIFICATIONS
// (never ingestion/analysis) for a bounded window from when it was recorded.

const SUPPRESSION_WINDOW_MS = 30 * 60 * 1000; // default 30 min, admin-configurable per plan

export type FeedbackForSuppression = {
  verdict: string;
  node_id: number | null;
  severity: string;
  created_at: string;
};

export type SuppressionResult =
  | { suppressed: false }
  | { suppressed: true; until: string };

export function computeSuppression(
  nodeId: number,
  severity: string,
  feedback: FeedbackForSuppression[],
  now: Date = new Date(),
): SuppressionResult {
  const relevant = feedback.filter(
    (f) => f.node_id === nodeId && f.severity === severity && f.verdict === "blast_or_disturbance",
  );
  if (relevant.length === 0) return { suppressed: false };

  const mostRecent = relevant.reduce((latest, f) =>
    new Date(f.created_at) > new Date(latest.created_at) ? f : latest,
  );
  const until = new Date(mostRecent.created_at).getTime() + SUPPRESSION_WINDOW_MS;

  if (now.getTime() < until) {
    return { suppressed: true, until: new Date(until).toISOString() };
  }
  return { suppressed: false };
}

export { SUPPRESSION_WINDOW_MS };
