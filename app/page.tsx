import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { currentUser } from "@/lib/auth/actions";

// Signed out, the frame shows the landing page instead of this.
// Signed in: chat home. Milestone 9 builds the full chat home; until then it
// shows the "no agents yet" state from 02-sitemap.md §6.
export default async function Home() {
  const user = await currentUser();
  if (!user) return null;
  return (
    <div className="page">
      <EmptyState
        icon="bot"
        title="Hire your first agent"
        text="Agents research leads, write first emails and follow up. Nothing goes out until you approve it."
        action={
          <Link href="/create" className="btn btn-accent">
            Add an agent
          </Link>
        }
      />
    </div>
  );
}
