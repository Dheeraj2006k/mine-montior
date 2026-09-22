import { requireRolePage } from "@/lib/auth/roles";
import AdminOwnershipClient from "./ownership-client";

export default async function AdminOwnershipPage() {
  await requireRolePage("admin");
  return <AdminOwnershipClient />;
}
