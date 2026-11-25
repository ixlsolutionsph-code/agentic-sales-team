import { requireUser } from "@/lib/auth/guard";
import LeadsEmpty from "./LeadsEmpty";

export default async function LeadsPage() {
  await requireUser();
  return (
    <div className="page">
      <LeadsEmpty />
    </div>
  );
}
