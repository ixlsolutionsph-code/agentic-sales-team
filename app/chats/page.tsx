import { requireUser } from "@/lib/auth/guard";
import TeamChat from "./TeamChat";

// /chats: the team chat (Milestone 9). The team comes from the store.
export default async function ChatsPage() {
  await requireUser();
  return <TeamChat />;
}
