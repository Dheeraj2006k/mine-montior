import { ok } from "@/lib/api/envelope";
import { fetchPrediction } from "@/lib/adapters/ml-adapter";

const SITE_ID = "SIH-DEMO-01";

export async function GET() {
  const { source, data } = await fetchPrediction(SITE_ID);
  return ok(data, 200, source);
}
