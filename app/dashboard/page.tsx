import { requireUser } from "@/lib/auth/guard";
import HomeClient from "./HomeClient";

export default async function DashboardPage() {
  await requireUser();
  return <HomeClient />;
}
