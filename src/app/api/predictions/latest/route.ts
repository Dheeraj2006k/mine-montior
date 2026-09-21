import { ok } from "@/lib/api/envelope";
import { fetchPrediction } from "@/lib/adapters/ml-adapter";
import { DEMO_SITE_ID as SITE_ID } from "@/lib/config/site";

export async function GET() {
  const { source, data } = await fetchPrediction(SITE_ID);
  return ok(data, 200, source);
}
