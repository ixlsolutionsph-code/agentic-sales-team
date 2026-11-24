"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ActionResult } from "./call-action";
import { checkLimits, clearKey, emailKey, sha256 } from "./rateLimit";
import { MSG, MIN_PASSWORD, cleanEmail, cleanWorkspaceName, clientIp, isEmail, tooManyAttempts } from "./rules";
import { clearSessionCookies, getSession, revokeSessions, setSessionCookie } from "./session";

type Row = Record<string, unknown>;

function isDynamicUsage(e: unknown) {
  return typeof e === "object" && e !== null && (e as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE";
}

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<ActionResult> {
  const name = typeof input?.name === "string" ? input.name.trim().slice(0, 120) : "";
  const email = cleanEmail(input?.email);
  const password = typeof input?.password === "string" ? input.password : "";
  if (!name) return fail(MSG.noName);
  if (!isEmail(email)) return fail(MSG.badEmail);
  if (password.length < MIN_PASSWORD) return fail(MSG.shortPassword);
  if (!db) return fail(MSG.serverDown);

  const wait = await checkLimits("signup", clientIp(headers()), email);
  if (wait) return fail(tooManyAttempts(wait));

  try {
    const hash = await bcrypt.hash(password, 10);
    // One statement: make the user (no lookup first, so it never reveals a
    // registered email) and its first workspace with the SAME id.
    const res = await db.execute(sql`
      WITH u AS (
        INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash})
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, name, session_version, workspace_name
      ), w AS (
        INSERT INTO workspaces (id, owner_id, name) SELECT id, id, workspace_name FROM u RETURNING id
      )
      SELECT u.id, u.email, u.name, u.session_version FROM u JOIN w ON w.id = u.id`);
    const row = res.rows[0] as Row | undefined;
    if (!row) return fail(MSG.signupRefused);
    clearSessionCookies();
    await setSessionCookie({
      userId: String(row.id),
      email: String(row.email),
      name: String(row.name),
      sessionVersion: Number(row.session_version),
    });
    return { ok: true };
  } catch (e) {
    console.error("signUp failed", e);
    return fail(MSG.serverDown);
  }
}

export async function signIn(input: { email: string; password: string }): Promise<ActionResult> {
  const email = cleanEmail(input?.email);
  const password = typeof input?.password === "string" ? input.password : "";
  if (!db) return fail(MSG.serverDown);

  // Rate-limit BEFORE the lookup.
  const wait = await checkLimits("signin", clientIp(headers()), email);
  if (wait) return fail(tooManyAttempts(wait));
  if (!isEmail(email) || !password) return fail(MSG.wrongLogin);

  try {
    const res = await db.execute(
      sql`SELECT id, email, name, password_hash, session_version FROM users WHERE email = ${email}`,
    );
    const row = res.rows[0] as Row | undefined;
    const ok = row ? await bcrypt.compare(password, String(row.password_hash)) : false;
    if (!row || !ok) return fail(MSG.wrongLogin);

    await clearKey(emailKey("signin", email));
    clearSessionCookies(); // also drops `ws`: sign-in always lands in the first workspace
    await setSessionCookie({
      userId: String(row.id),
      email: String(row.email),
      name: String(row.name),
      sessionVersion: Number(row.session_version),
    });
    return { ok: true };
  } catch (e) {
    console.error("signIn failed", e);
    return fail(MSG.serverDown);
  }
}

// Logs out everywhere: bumps the session version, then clears the cookies.
export async function signOut(): Promise<ActionResult> {
  try {
    const s = await getSession();
    if (s) await revokeSessions(s.accountId);
  } catch (e) {
    console.error("signOut revoke failed", e);
  }
  clearSessionCookies();
  return { ok: true };
}

// Self-serve reset is off: this validates and rate-limits only, and writes nothing.
export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const email = cleanEmail(input?.email);
  if (!isEmail(email)) return fail(MSG.badEmail);
  const wait = await checkLimits("reset", clientIp(headers()), email);
  if (wait) return fail(tooManyAttempts(wait));
  return { ok: true };
}

export async function validateResetToken(token: string): Promise<ActionResult<{ valid: boolean }>> {
  if (!db) return fail(MSG.serverDown);
  if (typeof token !== "string" || !token || token.length > 200) return { ok: true, data: { valid: false } };
  try {
    const res = await db.execute(
      sql`SELECT 1 FROM password_reset_tokens WHERE token = ${sha256(token)} AND expires_at > now()`,
    );
    return { ok: true, data: { valid: res.rows.length > 0 } };
  } catch (e) {
    console.error("validateResetToken failed", e);
    return fail(MSG.serverDown);
  }
}

export async function resetPassword(input: { token: string; password: string }): Promise<ActionResult> {
  const password = typeof input?.password === "string" ? input.password : "";
  if (password.length < MIN_PASSWORD) return fail(MSG.shortPassword);
  if (!db) return fail(MSG.serverDown);
  if (typeof input?.token !== "string" || !input.token) return fail("Link expired or invalid");
  try {
    const hash = await bcrypt.hash(password, 10);
    // New hash, new session version, and every token of that user deleted, in one statement.
    const res = await db.execute(sql`
      WITH t AS (
        SELECT user_id FROM password_reset_tokens WHERE token = ${sha256(input.token)} AND expires_at > now()
      ), u AS (
        UPDATE users SET password_hash = ${hash}, session_version = session_version + 1
        WHERE id IN (SELECT user_id FROM t) RETURNING id
      ), d AS (
        DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM u) RETURNING 1
      )
      SELECT id FROM u`);
    if (!res.rows.length) return fail("Link expired or invalid");
    return { ok: true };
  } catch (e) {
    console.error("resetPassword failed", e);
    return fail(MSG.serverDown);
  }
}

export type CurrentUser = {
  accountId: string;
  email: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
};

// Never throws, except Next's DYNAMIC_SERVER_USAGE (needed for static detection).
export async function currentUser(): Promise<CurrentUser | null> {
  try {
    const s = await getSession();
    if (!s || !db) return null;
    const res = await db.execute(sql`SELECT name FROM workspaces WHERE id = ${s.userId}::uuid`);
    const ws = res.rows[0] as Row | undefined;
    return {
      accountId: s.accountId,
      email: s.email,
      name: s.name,
      workspaceId: s.userId,
      workspaceName: String(ws?.name ?? "My Workspace"),
    };
  } catch (e) {
    if (isDynamicUsage(e)) throw e;
    console.error("currentUser failed", e);
    return null;
  }
}

// Settings page: workspace name (the active workspace) and your name. Saved on blur.
export async function updateSettings(input: { workspaceName?: string; name?: string }): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !db) return fail(MSG.serverDown);
  try {
    if (input.workspaceName !== undefined) {
      const wsName = cleanWorkspaceName(input.workspaceName);
      if (!wsName) return fail(MSG.noWorkspaceName);
      await db.execute(
        sql`UPDATE workspaces SET name = ${wsName} WHERE id = ${s.userId}::uuid AND owner_id = ${s.accountId}::uuid`,
      );
    }
    if (input.name !== undefined) {
      const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
      if (!name) return fail(MSG.noName);
      await db.execute(sql`UPDATE users SET name = ${name} WHERE id = ${s.accountId}::uuid`);
    }
    return { ok: true };
  } catch (e) {
    console.error("updateSettings failed", e);
    return fail(MSG.serverDown);
  }
}
