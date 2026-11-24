import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/actions";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  return <SettingsClient workspaceName={user.workspaceName} name={user.name} />;
}
