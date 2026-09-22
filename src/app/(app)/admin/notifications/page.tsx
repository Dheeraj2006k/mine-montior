import { requireRolePage } from "@/lib/auth/roles";
import NotificationsAdminPage from "./notifications-client";

export default async function Page() {
  await requireRolePage("admin");
  return <NotificationsAdminPage />;
}
