import { ok } from "@/lib/api/envelope";
import { fetchPrediction } from "@/lib/adapters/ml-adapter";
import { DEMO_SITE_ID as SITE_ID } from "@/lib/config/site";
import { requireRole } from "@/lib/auth/roles";

export async function GET() {
  const denied = await requireRole("viewer");
  if (denied) return denied;

  const { source, data } = await fetchPrediction(SITE_ID);
  return ok(data, 200, source);
}
