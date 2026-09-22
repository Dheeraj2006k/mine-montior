import { requireRolePage } from "@/lib/auth/roles";
import BlastsAdminPage from "./blasts-client";

export default async function Page() {
  await requireRolePage("operator");
  return <BlastsAdminPage />;
}
