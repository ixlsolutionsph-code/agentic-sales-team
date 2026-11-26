import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { drainQueue } from "@/lib/jobs/drain";

// Runs up to 5 queued jobs of the signed-in workspace (01-prd.md §7.5).
// The browser calls it right after queuing a run.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 300;

export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const { ran, reaped } = await drainQueue({ workspaceId: s.userId, maxJobs: 5 });
    return NextResponse.json({ ran, reaped });
  } catch (e) {
    console.error("POST /api/jobs/run failed", e);
    return NextResponse.json({ error: "That run didn't complete. Please check the agent's page." }, { status: 500 });
  }
}
