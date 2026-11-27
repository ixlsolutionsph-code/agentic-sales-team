import { currentUser } from "@/lib/auth/actions";
import ChatHome from "./ChatHome";

// Signed out, the frame shows the landing page instead of this.
// Signed in: chat home (02-sitemap.md §6). With no agents it shows "Hire your
// first agent".
export default async function Home() {
  const user = await currentUser();
  if (!user) return null;
  return <ChatHome />;
}
