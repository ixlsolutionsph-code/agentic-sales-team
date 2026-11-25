import { requireUser } from "@/lib/auth/guard";
import CreateWizard from "./CreateWizard";

// Full screen, no shell (AppFrame leaves /create bare).
export default async function CreatePage() {
  await requireUser();
  return <CreateWizard />;
}
