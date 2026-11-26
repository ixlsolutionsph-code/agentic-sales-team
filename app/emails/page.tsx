import { requireUser } from "@/lib/auth/guard";
import EmailsClient from "./EmailsClient";

export default async function EmailsPage() {
  await requireUser();
  return <EmailsClient />;
}
