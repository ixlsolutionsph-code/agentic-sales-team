import type { Metadata } from "next";
import localFont from "next/font/local";
import AppFrame from "@/components/AppFrame";
import { currentUser } from "@/lib/auth/actions";
import { AppProvider } from "@/lib/store";
import { EMPTY_WORKSPACE } from "@/lib/types";
import { loadWorkspace } from "@/lib/workspace/actions";
import { listWorkspaces } from "@/lib/workspaces/actions";
import "./globals.css";

// Source Sans 3: a free font by Adobe, standing in for Adobe Clean.
const sans = localFont({
  src: "../public/fonts/source-sans-3.woff2",
  weight: "400 900",
  variable: "--font-source",
  display: "swap",
});

const mono = localFont({
  src: "../public/fonts/jetbrains-mono.woff2",
  weight: "400 500",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agentic Sales Team",
  description: "An AI sales team that works for you in chat.",
  icons: { icon: "/logo-mark.png" },
};

// Fills the client store once per page load: the signed-in user and the
// active workspace's data.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const [workspace, workspaces] = user
    ? await Promise.all([loadWorkspace(), listWorkspaces()])
    : [EMPTY_WORKSPACE, []];

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <AppProvider user={user} workspace={workspace} workspaces={workspaces}>
          <AppFrame>{children}</AppFrame>
        </AppProvider>
      </body>
    </html>
  );
}
