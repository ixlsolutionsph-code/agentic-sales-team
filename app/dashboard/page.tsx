import CreateTeamButton from "@/components/CreateTeamButton";
import EmptyState from "@/components/EmptyState";
import { requireUser } from "@/lib/auth/guard";

// Milestone 5 builds the dashboard. Until then: the "no teams" state.
export default async function DashboardPage() {
  await requireUser();
  return (
    <div className="page">
      <EmptyState icon="dashboard" title="No teams yet" action={<CreateTeamButton label="+ Create your first team" />} />
    </div>
  );
}
