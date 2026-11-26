import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { drainQueue } from "@/lib/jobs/drain";

// Vercel Cron, every minute: up to 50 queued jobs of any workspace, so work
// keeps going with every tab closed. Needs "Authorization: Bearer CRON_SECRET".
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { ran, reaped } = await drainQueue({ workspaceId: null, maxJobs: 50 });
    return NextResponse.json({ ran: ran.length, reaped });
  } catch (e) {
    console.error("GET /api/cron/jobs failed", e);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
