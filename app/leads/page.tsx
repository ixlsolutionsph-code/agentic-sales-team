import { requireUser } from "@/lib/auth/guard";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage() {
  await requireUser();
  return <LeadsClient />;
}
