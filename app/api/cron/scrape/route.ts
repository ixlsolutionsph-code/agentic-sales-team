import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { drainScrape } from "@/lib/jobs/scrape";

// Vercel Cron, every minute: one queued lead search of any workspace, so a
// search still runs when the browser tab was closed before it started.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await drainScrape());
  } catch (e) {
    console.error("GET /api/cron/scrape failed", e);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
