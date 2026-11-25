import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { requireUser } from "@/lib/auth/guard";

// Milestone 4 adds the agent cards. Until then: the "no agents" state.
export default async function AgentsPage() {
  await requireUser();
  return (
    <div className="page">
      <EmptyState
        icon="bot"
        title="No agents yet"
        action={
          <Link href="/create" className="btn btn-accent">
            + Create your first agent
          </Link>
        }
      />
    </div>
  );
}
