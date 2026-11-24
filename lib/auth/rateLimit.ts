import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { LIMITS, minutesLeft, type LimitAction } from "./rules";

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const ipKey = (action: LimitAction, ip: string) => `${action}:ip:${ip}`;
export const emailKey = (action: LimitAction, email: string) => `${action}:email:${sha256(email)}`;

// Counts one attempt on a fixed window. Returns the minutes left when the
// limit is passed, else null. Fails open: a database error never blocks.
async function hit(key: string, max: number, windowMin: number): Promise<number | null> {
  if (!db) return null;
  try {
    const res = await db.execute(sql`
      INSERT INTO auth_rate_limits (key, count, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN auth_rate_limits.window_start <= now() - make_interval(mins => ${windowMin})
                     THEN 1 ELSE auth_rate_limits.count + 1 END,
        window_start = CASE WHEN auth_rate_limits.window_start <= now() - make_interval(mins => ${windowMin})
                     THEN now() ELSE auth_rate_limits.window_start END
      RETURNING count, window_start`);
    const row = res.rows[0] as { count: number | string; window_start: string | Date } | undefined;
    if (!row) return null;
    if (Number(row.count) > max) return minutesLeft(new Date(row.window_start), windowMin);
    return null;
  } catch (e) {
    console.error("rate limit check failed (allowing)", e);
    return null;
  }
}

// Checks both the IP and the email limit. Returns minutes to wait, or null.
export async function checkLimits(action: LimitAction, ip: string, email: string): Promise<number | null> {
  const l = LIMITS[action];
  const [a, b] = await Promise.all([
    hit(ipKey(action, ip), l.ip, l.windowMin),
    email ? hit(emailKey(action, email), l.email, l.windowMin) : Promise.resolve(null),
  ]);
  if (a === null && b === null) return null;
  return Math.max(a ?? 0, b ?? 0);
}

export async function clearKey(key: string): Promise<void> {
  if (!db) return;
  try {
    await db.execute(sql`DELETE FROM auth_rate_limits WHERE key = ${key}`);
  } catch (e) {
    console.error("rate limit clear failed", e);
  }
}
