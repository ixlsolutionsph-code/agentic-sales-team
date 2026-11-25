import { requireUser } from "@/lib/auth/guard";
import AgentDetail from "./AgentDetail";

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default async function AgentPage({ params }: { params: { id: string } }) {
  await requireUser();
  return <AgentDetail id={safeDecode(params.id)} />;
}
