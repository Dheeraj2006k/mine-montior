import { requireRolePage } from "@/lib/auth/roles";
import AdminAuditClient from "./audit-client";

export default async function AdminAuditPage() {
  await requireRolePage("admin");
  return <AdminAuditClient />;
}
