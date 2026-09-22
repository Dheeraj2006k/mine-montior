import { requireRolePage } from "@/lib/auth/roles";
import ContactsAdminPage from "./contacts-client";

export default async function Page() {
  await requireRolePage("admin");
  return <ContactsAdminPage />;
}
