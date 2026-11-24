import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS, WS_COOKIE, signSession, verifySession } from "./jwt";
import { UUID_RE } from "./rules";

export type Session = {
  userId: string; // the ACTIVE WORKSPACE id (what every data query filters on)
  accountId: string; // users.id
  email: string;
  name: string;
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

// Reads the session cookie, checks the session version against the account,
// and picks the active workspace (the `ws` cookie only if the account owns it).
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = cookies();
  const token = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!token || !db || !UUID_RE.test(token.userId)) return null;

  const wsCookie = jar.get(WS_COOKIE)?.value;
  const wantWs = wsCookie && UUID_RE.test(wsCookie) ? wsCookie : null;

  const res = await db.execute(sql`
    SELECT u.id, u.email, u.name, u.session_version,
           (SELECT w.id FROM workspaces w WHERE w.id = ${wantWs}::uuid AND w.owner_id = u.id) AS ws_id
    FROM users u WHERE u.id = ${token.userId}::uuid`);
  const row = res.rows[0] as
    | { id: string; email: string; name: string; session_version: number | string; ws_id: string | null }
    | undefined;
  if (!row || Number(row.session_version) !== token.sessionVersion) return null;

  return { userId: row.ws_id ?? row.id, accountId: row.id, email: row.email, name: row.name };
});

export async function setSessionCookie(p: { userId: string; email: string; name: string; sessionVersion: number }) {
  cookies().set(SESSION_COOKIE, await signSession(p), cookieOptions);
}

export function clearSessionCookies() {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(WS_COOKIE);
}

// Adds 1 to the account's session version, which ends every existing session.
export async function revokeSessions(accountId: string) {
  if (!db) return;
  await db.execute(sql`UPDATE users SET session_version = session_version + 1 WHERE id = ${accountId}::uuid`);
}
