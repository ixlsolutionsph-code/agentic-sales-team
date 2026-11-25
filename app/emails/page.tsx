import EmptyState from "@/components/EmptyState";
import { requireUser } from "@/lib/auth/guard";

// Milestone 7 adds the drafts. Until then: the empty state.
export default async function EmailsPage() {
  await requireUser();
  return (
    <div className="page">
      <EmptyState icon="mail" title="No drafts yet. Ask an agent to draft outreach and the emails show here." />
    </div>
  );
}
