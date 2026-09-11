import { supabaseAdmin } from "@/lib/db/supabase-server";
import { ok, fail } from "@/lib/api/envelope";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const blastId = Number(id);
  if (!Number.isInteger(blastId)) {
    return fail("INVALID_ID", "blast id must be an integer", [], 400);
  }

  const { error } = await supabaseAdmin.from("blast_schedule").delete().eq("id", blastId);
  if (error) {
    return fail("DATABASE_ERROR", "Failed to delete blast window", [{ issue: error.message }], 500);
  }
  return ok({ deleted: true });
}
