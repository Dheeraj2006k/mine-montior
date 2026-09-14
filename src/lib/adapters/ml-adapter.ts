import { supabaseAdmin } from "@/lib/db/supabase-server";

// Fixed exit contract, PRD §11.2 - the entire point of this adapter boundary
// is that nothing downstream needs to change when the underlying source
// changes (mock -> DB row written by the ML team's own process -> a live
// FastAPI /predict call), per plan §4.2/§18 Phase 8's exit criterion:
// flipping ML_MODE requires zero component code changes.
export type PredictionContract = {
  site_id: string;
  model_version: string;
  predicted_zone: unknown;
  trend: string;
  time_to_threshold: { low_days: number | null; high_days: number | null; confidence: number | null };
  generated_at: string | null;
  is_stale: boolean;
};

export type PredictionResult = { source: "live" | "mock"; data: PredictionContract };

const STALE_AFTER_MS = 60 * 60 * 1000; // PRD §12: background pass staleness is a safety signal

function mockPrediction(siteId: string): PredictionContract {
  return {
    site_id: siteId,
    model_version: "mock-0.0",
    predicted_zone: [],
    trend: "stable",
    time_to_threshold: { low_days: null, high_days: null, confidence: null },
    generated_at: null,
    is_stale: true,
  };
}

async function fetchFromHttpService(siteId: string): Promise<PredictionContract | null> {
  const url = process.env.ML_SERVICE_URL;
  if (!url) return null;
  try {
    const res = await fetch(`${url}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ML_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.ML_SERVICE_TOKEN}` } : {}),
      },
      body: JSON.stringify({ site_id: siteId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const generatedAtMs = body.generated_at ? new Date(body.generated_at).getTime() : 0;
    return {
      site_id: siteId,
      model_version: body.model_version,
      predicted_zone: body.predicted_zone,
      trend: body.trend,
      time_to_threshold: body.time_to_threshold,
      generated_at: body.generated_at ?? null,
      is_stale: Date.now() - generatedAtMs > STALE_AFTER_MS,
    };
  } catch {
    return null; // unreachable/slow service - caller falls back, never crashes the dashboard
  }
}

async function fetchFromDb(siteId: string): Promise<PredictionContract | null> {
  const { data } = await supabaseAdmin
    .from("predictions")
    .select("*")
    .eq("site_id", siteId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const generatedAtMs = new Date(data.generated_at).getTime();
  return {
    site_id: data.site_id,
    model_version: data.model_version,
    predicted_zone: data.predicted_zone,
    trend: data.trend,
    time_to_threshold: {
      low_days: data.time_to_threshold_low_days,
      high_days: data.time_to_threshold_high_days,
      confidence: data.confidence,
    },
    generated_at: data.generated_at,
    is_stale: Date.now() - generatedAtMs > STALE_AFTER_MS,
  };
}

/**
 * Preference order: a live FastAPI service (ML_SERVICE_URL configured) >
 * a row the ML team's own process wrote to `predictions` > a clearly
 * labelled mock. This mirrors the plan's real|mock adapter switching
 * without needing a separate flag - presence of real infrastructure is
 * the switch, exactly like the email/SMS/voice adapters in this codebase.
 */
export async function fetchPrediction(siteId: string): Promise<PredictionResult> {
  const fromHttp = await fetchFromHttpService(siteId);
  if (fromHttp) return { source: "live", data: fromHttp };

  const fromDb = await fetchFromDb(siteId);
  if (fromDb) return { source: "live", data: fromDb };

  return { source: "mock", data: mockPrediction(siteId) };
}
