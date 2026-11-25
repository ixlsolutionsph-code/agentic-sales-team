"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import CreateTeamModal from "./CreateTeamModal";
import Landing from "./Landing";
import Shell from "./Shell";
import Toast from "./Toast";

const startsWith = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

// Decides what frame a page gets:
// - /reset is public and has no frame.
// - Signed out: the landing page (which opens Login in place).
// - /create: full screen, no shell.
// - Every other signed-in page: inside the shell.
// The "Create a team" modal and the toast are mounted once, for every page.
export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { signedIn } = useApp();
  const isReset = startsWith(pathname, "/reset");

  // Signed out on any other page (for example with an old session cookie,
  // which passes middleware's signature check): go to "/".
  useEffect(() => {
    if (!signedIn && !isReset && pathname !== "/") router.replace("/");
  }, [signedIn, isReset, pathname, router]);

  if (isReset) return <>{children}</>;
  if (!signedIn) return <Landing />;

  return (
    <>
      {startsWith(pathname, "/create") ? children : <Shell>{children}</Shell>}
      <CreateTeamModal />
      <Toast />
    </>
  );
}
