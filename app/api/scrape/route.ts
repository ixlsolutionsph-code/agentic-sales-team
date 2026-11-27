import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { UUID_RE } from "@/lib/products/shape";
import { runScrapeNow } from "@/lib/jobs/scrape";

// Runs one queued lead search of the signed-in workspace now (01-prd.md §7.5).
// The browser calls it right after queuing the search; the cron picks the
// search up if this call never arrives.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = body?.jobId;
  if (typeof jobId !== "string" || !UUID_RE.test(jobId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const ran = await runScrapeNow(s.userId, jobId);
    return NextResponse.json({ ran });
  } catch (e) {
    console.error("POST /api/scrape failed", e);
    return NextResponse.json({ error: "That search didn't complete. Please try again." }, { status: 500 });
  }
}
