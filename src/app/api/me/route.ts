import { ok, fail } from "@/lib/api/envelope";
import { getCurrentUserRole } from "@/lib/auth/roles";

// Lets the app shell show the signed-in user's own role without exposing
// the admin-only /api/admin/users directory to every viewer.
export async function GET() {
  const { userId, role } = await getCurrentUserRole();
  if (!userId) return fail("UNAUTHENTICATED", "Sign in required", [], 401);
  return ok({ role });
}
