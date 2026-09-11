import { ok } from "@/lib/api/envelope";
import { fetchInsarNodeFeatures } from "@/lib/adapters/insar-adapter";

export async function GET() {
  const { source, data } = await fetchInsarNodeFeatures();
  return ok(data, 200, source);
}
