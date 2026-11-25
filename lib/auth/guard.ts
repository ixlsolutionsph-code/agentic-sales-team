import "server-only";
import { redirect } from "next/navigation";
import { currentUser, type CurrentUser } from "./actions";

// For signed-in pages: the current user, or a redirect to "/".
// Middleware checks the token signature; this also catches a token whose
// session version is old (for example after logging out elsewhere).
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/");
  return user;
}
