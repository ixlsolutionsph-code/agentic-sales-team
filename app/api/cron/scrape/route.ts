import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";

// Vercel Cron, every minute: one queued lead search. The search itself comes
// in Milestone 8; until then this only checks the secret and does nothing.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ran: 0 });
}
