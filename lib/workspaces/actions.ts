"use server";

import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/auth/call-action";
import { WS_COOKIE } from "@/lib/auth/jwt";
import { MAX_WORKSPACES, MSG, UUID_RE, cleanWorkspaceName } from "@/lib/auth/rules";
import { cookieOptions, getSession } from "@/lib/auth/session";

export type Workspace = { id: string; name: string; active: boolean; first: boolean };

export async function listWorkspaces(): Promise<Workspace[]> {
  const s = await getSession();
  if (!s || !db) return [];
  const res = await db.execute(
    sql`SELECT id, name FROM workspaces WHERE owner_id = ${s.accountId}::uuid ORDER BY created_at ASC, id ASC`,
  );
  return res.rows.map((r) => {
    const row = r as { id: string; name: string };
    return { id: row.id, name: row.name, active: row.id === s.userId, first: row.id === s.accountId };
  });
}

// Makes a workspace (at most 10 per account) and switches to it.
export async function createWorkspace(input: { name: string }): Promise<ActionResult<{ id: string }>> {
  const s = await getSession();
  if (!s || !db) return { ok: false, error: MSG.serverDown };
  const name = cleanWorkspaceName(input?.name);
  if (!name) return { ok: false, error: MSG.noWorkspaceName };
  try {
    // The count check and the insert are one statement, so two quick clicks can't make an 11th.
    const res = await db.execute(sql`
      INSERT INTO workspaces (owner_id, name)
      SELECT ${s.accountId}::uuid, ${name}
      WHERE (SELECT count(*) FROM workspaces WHERE owner_id = ${s.accountId}::uuid) < ${MAX_WORKSPACES}
      RETURNING id`);
    const row = res.rows[0] as { id: string } | undefined;
    if (!row) return { ok: false, error: MSG.tooManyWorkspaces };
    cookies().set(WS_COOKIE, row.id, cookieOptions);
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error("createWorkspace failed", e);
    return { ok: false, error: MSG.serverDown };
  }
}

export async function switchWorkspace(input: { id: string }): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !db) return { ok: false, error: MSG.serverDown };
  const id = typeof input?.id === "string" ? input.id : "";
  if (!UUID_RE.test(id)) return { ok: false, error: "Workspace not found." };
  const res = await db.execute(
    sql`SELECT 1 FROM workspaces WHERE id = ${id}::uuid AND owner_id = ${s.accountId}::uuid`,
  );
  if (!res.rows.length) return { ok: false, error: "Workspace not found." };
  cookies().set(WS_COOKIE, id, cookieOptions);
  return { ok: true };
}
