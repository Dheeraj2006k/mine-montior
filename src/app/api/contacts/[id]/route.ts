import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";
import { requireRole } from "@/lib/auth/roles";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  const { id } = await params;
  const contactId = Number(id);
  if (!Number.isInteger(contactId)) {
    return fail("INVALID_ID", "contact id must be an integer", [], 400);
  }

  // Soft delete only, per plan §6.4 - a contact might be referenced by
  // historical notifications/call_sessions/audit rows.
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .update({ is_active: false })
    .eq("id", contactId)
    .select("*")
    .single();

  if (error || !data) {
    return fail("DATABASE_ERROR", "Failed to deactivate contact", [{ issue: error?.message }], 500);
  }
  return ok(data);
}
