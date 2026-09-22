import { requireRolePage } from "@/lib/auth/roles";
import SetupPage from "./setup-client";

export default async function Page() {
  await requireRolePage("admin");
  return <SetupPage />;
}
