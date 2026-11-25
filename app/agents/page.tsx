import { requireUser } from "@/lib/auth/guard";
import AgentsList from "./AgentsList";

export default async function AgentsPage() {
  await requireUser();
  return (
    <div className="page">
      <AgentsList />
    </div>
  );
}
