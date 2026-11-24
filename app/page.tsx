import Landing from "@/components/Landing";
import SignedInHome from "@/components/SignedInHome";
import { currentUser } from "@/lib/auth/actions";
import { listWorkspaces } from "@/lib/workspaces/actions";

export default async function Home() {
  const user = await currentUser();
  if (!user) return <Landing />;
  const workspaces = await listWorkspaces();
  return <SignedInHome user={user} workspaces={workspaces} />;
}
