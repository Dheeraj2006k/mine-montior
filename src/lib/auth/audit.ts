import { supabaseAdmin } from "@/lib/db/supabase-server";

// Thin wrapper around the existing generic `audit_log` table (0001) for
// admin/RBAC actions specifically - role changes, activation, ownership
// transfers. Reuses the same table the alert pipeline already writes to
// (see src/app/api/alerts/[id]/acknowledge/route.ts) rather than creating a
// second audit table, but always sets actor_user_id/target_user_id so these
// rows are queryable relationally (/api/admin/audit).
export async function recordAdminAudit(entry: {
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  entityTable: string;
  entityId: string;
  targetUserId?: string | null;
  fromState?: string | null;
  toState?: string | null;
  reason?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("audit_log").insert({
    actor: entry.actorEmail ? `admin:${entry.actorEmail}` : `admin:${entry.actorUserId}`,
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_table: entry.entityTable,
    entity_id: entry.entityId,
    target_user_id: entry.targetUserId ?? null,
    from_state: entry.fromState ?? null,
    to_state: entry.toState ?? null,
    detail: { ...(entry.detail ?? {}), ...(entry.reason ? { reason: entry.reason } : {}) },
  });
}
