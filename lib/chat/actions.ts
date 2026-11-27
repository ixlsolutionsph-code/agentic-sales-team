"use server";

import type { ActionResult } from "@/lib/auth/call-action";
import { getSession } from "@/lib/auth/session";
import { dismissTeamJobs } from "@/lib/pod/decisions";
import type { ChatMessage } from "@/lib/types";
import type { ChatResult } from "./contract";
import { runTeamChat } from "./reply";
import { chatLeadRows, teamExists, teamMemberIds } from "./teamFacts";
import { MSG_MAX_CHARS, MSG_TOO_LONG, chatUnread, deleteTeamMessages, listTeamMessages } from "./teamMessages";

const NOT_SIGNED_IN = "Please sign in again.";
const NO_TEAM = "This team no longer exists.";
const isTeamId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 80;

// The server entry (01-prd.md §7.4). `message` may carry ⟦answer:…⟧ or
// ⟦writeanswer:…⟧ from a card. `leadIds` come from /lead picks.
export async function teamChat(teamId: string, message: string, leadIds?: string[], timeZone?: string): Promise<ActionResult<ChatResult>> {
  const s = await getSession();
  if (!s) return { ok: false, error: NOT_SIGNED_IN };
  if (!isTeamId(teamId)) return { ok: false, error: NO_TEAM };
  const text = typeof message === "string" ? message : "";
  if (text.length > MSG_MAX_CHARS) return { ok: false, error: MSG_TOO_LONG };
  return runTeamChat(s.userId, s.accountId, teamId, text, Array.isArray(leadIds) ? leadIds : [], typeof timeZone === "string" ? timeZone : "UTC");
}

// The thread after a cursor (0 = all).
export async function loadThread(teamId: string, afterId: number): Promise<ChatMessage[]> {
  const s = await getSession();
  if (!s || !isTeamId(teamId)) return [];
  if (!(await teamExists(s.userId, teamId))) return [];
  const after = Number.isFinite(Number(afterId)) && Number(afterId) > 0 ? Math.floor(Number(afterId)) : 0;
  return listTeamMessages(s.userId, teamId, after);
}

// Hard-deletes the thread and dismisses the team's waiting jobs.
export async function clearChat(teamId: string): Promise<ActionResult<null>> {
  const s = await getSession();
  if (!s) return { ok: false, error: NOT_SIGNED_IN };
  if (!isTeamId(teamId) || !(await teamExists(s.userId, teamId))) return { ok: false, error: NO_TEAM };
  await deleteTeamMessages(s.userId, teamId);
  await dismissTeamJobs(s.userId, teamId);
  return { ok: true, data: null };
}

// Unread agent messages per team; `seen` = team id → last seen message id.
export async function loadChatUnread(seen: Record<string, number>): Promise<Record<string, number>> {
  const s = await getSession();
  if (!s) return {};
  const clean: Record<string, number> = {};
  if (seen && typeof seen === "object") {
    for (const [k, v] of Object.entries(seen).slice(0, 200)) {
      const n = Math.floor(Number(v));
      if (isTeamId(k) && Number.isFinite(n) && n >= 0 && n < 2 ** 31) clean[k] = n;
    }
  }
  return chatUnread(s.userId, clean);
}

// Leads for the /lead picker and the cards: id, name, company, review, fit, platform, profile url.
export type ChatLead = { id: string; name: string; company: string; title: string; review: string; fitReason: string; platform: string | null; profileUrl: string | null; email: string; score: number; research: { summary: string; angle: string } | null; createdAt: string };
export async function loadTeamChatLeads(teamId: string, ids?: string[]): Promise<ChatLead[]> {
  const s = await getSession();
  if (!s || !isTeamId(teamId)) return [];
  if (Array.isArray(ids)) {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const list = [...new Set(ids.filter((x) => typeof x === "string" && UUID.test(x)))].slice(0, 200);
    if (!(await teamExists(s.userId, teamId))) return [];
    return chatLeadRows(s.userId, { ids: list });
  }
  const members = await teamMemberIds(s.userId, teamId);
  if (!members) return [];
  return chatLeadRows(s.userId, { agentIds: members });
}
