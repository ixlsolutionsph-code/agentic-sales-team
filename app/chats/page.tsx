import CreateTeamButton from "@/components/CreateTeamButton";
import EmptyState from "@/components/EmptyState";
import { requireUser } from "@/lib/auth/guard";

// Milestone 9 builds the team chat. Until then: the "no teams" state.
export default async function ChatsPage() {
  await requireUser();
  return (
    <div className="page">
      <EmptyState
        icon="chat"
        title="No conversations yet"
        text="Chats happen with a team. Create one to get started."
        action={<CreateTeamButton label="Create a team" />}
      />
    </div>
  );
}
