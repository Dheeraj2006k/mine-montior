import { ok } from "@/lib/api/envelope";
import { fetchInsarLayer } from "@/lib/adapters/insar-adapter";

const SITE_ID = "SIH-DEMO-01";

export async function GET() {
  const { source, data } = await fetchInsarLayer(SITE_ID);
  return ok(data, 200, source);
}
