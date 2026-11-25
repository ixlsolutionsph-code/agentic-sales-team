import { requireUser } from "@/lib/auth/guard";
import TeamDetail from "./TeamDetail";

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default async function TeamPage({ params }: { params: { id: string } }) {
  await requireUser();
  return <TeamDetail id={safeDecode(params.id)} />;
}
