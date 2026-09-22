import { requireRolePage } from "@/lib/auth/roles";
import AdminUsersClient from "./users-client";

// Server-side guard, not just nav hiding - a viewer/operator who navigates
// here directly is redirected before this page's shell ever renders. The
// real authorization boundary remains the /api/admin/* route handlers
// (requireRole/requirePermission), which reject the request independently.
export default async function AdminUsersPage() {
  await requireRolePage("admin");
  return <AdminUsersClient />;
}
