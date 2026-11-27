// The team chat thread on the client: merging, cards and text pieces. Pure,
// so it can be unit tested (05-build-guide.md M9).
import type { ChatMessage } from "@/lib/types";
import { findMarker, parseMarkers, readJsonMarker, stripMarkers, type Offer, type ScrapeBriefCard, type WritePick } from "./markers";

export { stripMarkers };

// A row on screen. Local rows (my message before the server stored it, or a
// local error) have negative ids.
export type ChatRow = ChatMessage & { local?: boolean; error?: boolean };

export const LOCAL_ERROR = "I'm sorry. I could not process that now.";
export const STILL_WORKING = "Still working on it in the background. The result will appear here when it's done.";

// Merges new stored messages into the thread:
// - stored rows are deduped by id and kept in id order;
// - local rows stay last;
// - a newly stored "me" row replaces the oldest local "me" row with the same text.
export function mergeThread(thread: ChatRow[], incoming: ChatMessage[]): ChatRow[] {
  const byId = new Map<number, ChatRow>();
  for (const r of thread) if (!r.local) byId.set(r.id, r);
  const fresh: ChatMessage[] = [];
  for (const m of incoming) {
    if (!byId.has(m.id)) fresh.push(m);
    byId.set(m.id, m);
  }
  let locals = thread.filter((r) => r.local);
  for (const m of fresh) {
    if (m.who !== "me") continue;
    const i = locals.findIndex((l) => l.who === "me" && !l.error && l.text.trim() === m.text.trim());
    if (i >= 0) locals = [...locals.slice(0, i), ...locals.slice(i + 1)];
  }
  const stored = [...byId.values()].sort((a, b) => a.id - b.id);
  return [...stored, ...locals];
}

// The poll cursor: the highest stored id (0 when none).
export function lastStoredId(rows: { id: number; local?: boolean }[]): number {
  let max = 0;
  for (const r of rows) if (!r.local && r.id > max) max = r.id;
  return max;
}

// The newest message time of a thread (for picking the team to open).
function newest(list: ChatMessage[] | undefined): number {
  if (!list?.length) return 0;
  return list.reduce((m, r) => Math.max(m, r.id), 0);
}

// Which team /chats opens: the active one, else the team with the newest
// message, else the first team.
export function pickChatTeam(teams: { id: string }[], chats: Record<string, ChatMessage[]>, active: string | null): string | null {
  if (!teams.length) return null;
  if (active && teams.some((t) => t.id === active)) return active;
  let best: string | null = null;
  let bestId = 0;
  for (const t of teams) {
    const n = newest(chats[t.id]);
    if (n > bestId) {
      bestId = n;
      best = t.id;
    }
  }
  return best ?? teams[0].id;
}

// Show the avatar and name when the speaker changes (agents only).
export function speakerChanged(prev: ChatRow | undefined, cur: ChatRow): boolean {
  if (cur.who === "me" || cur.who === "system") return false;
  return !prev || prev.who !== cur.who;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

// ---- Text pieces: «Lead» pills, @mention pills, linked phrases ----

export type Segment =
  | { t: "text"; text: string }
  | { t: "lead"; text: string }
  | { t: "mention"; text: string }
  | { t: "link"; text: string; href: string };

const LINKS: { re: RegExp; href: string }[] = [
  { re: /\bthe leads\b/i, href: "/leads" },
  { re: /\byour catalog\b/i, href: "/products" },
  { re: /\bdrafts\b/i, href: "/emails" },
  { re: /\bcalendar\b/i, href: "/calendar" },
];
const LINK_RE = /\b(the leads|your catalog|drafts|calendar)\b/gi;
const PIECE_RE = /«([^«»]{1,120})»|@[\p{L}\p{N}_'-]+/gu;

// `mentionable` holds names an @ can point to (first names and full names
// without spaces, any case). "@You" is always a pill.
export function segmentText(text: string, mentionable: string[] = [], links = true): Segment[] {
  const names = new Set(["you", ...mentionable.map((n) => n.toLowerCase())]);
  const out: Segment[] = [];
  const pushText = (s: string) => {
    if (!s) return;
    if (!links) return void out.push({ t: "text", text: s });
    let last = 0;
    for (const m of s.matchAll(LINK_RE)) {
      const i = m.index ?? 0;
      if (i > last) out.push({ t: "text", text: s.slice(last, i) });
      const href = LINKS.find((l) => l.re.test(m[0]))?.href ?? "/";
      out.push({ t: "link", text: m[0], href });
      last = i + m[0].length;
    }
    if (last < s.length) out.push({ t: "text", text: s.slice(last) });
  };
  let last = 0;
  for (const m of text.matchAll(PIECE_RE)) {
    const i = m.index ?? 0;
    const whole = m[0];
    let seg: Segment | null = null;
    if (m[1] !== undefined) seg = { t: "lead", text: m[1] };
    else {
      const name = whole.slice(1).replace(/['-]+$/, "");
      // Not an email address: an @ right after a letter or digit is not a mention.
      const before = i > 0 ? text[i - 1] : "";
      if (!/[\p{L}\p{N}.]/u.test(before) && names.has(name.toLowerCase())) seg = { t: "mention", text: `@${name}` };
    }
    if (!seg) continue;
    pushText(text.slice(last, i));
    out.push(seg);
    // A trailing ' or - that was cut from a mention stays as text.
    last = seg.t === "mention" ? i + seg.text.length : i + whole.length;
  }
  pushText(text.slice(last));
  return out;
}

// ---- Cards drawn from markers ----

export type Cards = {
  approve: string | null; // job id
  run: string | null; // job id
  leads: string[]; // lead ids
  scrape: ScrapeBriefCard | null;
  writepick: WritePick | null;
  replies: string[];
  offer: Offer | null;
};

export const OFFER_REPLIES = ["Yes, go ahead", "No, thanks"];

// What cards a message carries. ⟦meet…⟧ (Milestone 10), ⟦job⟧, ⟦answer⟧ and
// ⟦writeanswer⟧ draw nothing.
export function cardsOf(text: string): Cards {
  const leads = (findMarker(text, "leads") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const replies = readJsonMarker<unknown>(text, "replies");
  const offer = readJsonMarker<Offer>(text, "offer");
  let list = Array.isArray(replies) ? replies.filter((r): r is string => typeof r === "string" && r.trim() !== "").slice(0, 6) : [];
  if (findMarker(text, "offer") != null && !list.length) list = OFFER_REPLIES;
  return {
    approve: findMarker(text, "approve") || null,
    run: findMarker(text, "run") || null,
    leads,
    scrape: readJsonMarker<ScrapeBriefCard>(text, "scrape"),
    writepick: readJsonMarker<WritePick>(text, "writepick"),
    replies: list,
    offer,
  };
}

export function hasCards(c: Cards): boolean {
  return !!(c.approve || c.run || c.leads.length || c.scrape || c.writepick || c.replies.length);
}

// Job ids of ⟦run⟧ markers in some messages (to follow chain hand-offs).
export function runIdsOf(rows: { text: string }[]): string[] {
  const out: string[] = [];
  for (const r of rows) for (const m of parseMarkers(r.text)) if (m.kind === "run" && m.payload && !out.includes(m.payload)) out.push(m.payload);
  return out;
}

// ---- Composer: @ and /lead triggers, whole-token Backspace ----

export type Trigger = { kind: "mention" | "lead"; start: number; query: string };

// The picker to show for the text before the caret: "@que" or "/lead que".
export function activeTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret);
  const lead = /(^|\s)\/lead(?:\s([^\n«»@/]{0,40}))?$/i.exec(before);
  if (lead) {
    const start = lead.index + lead[1].length;
    return { kind: "lead", start, query: (lead[2] ?? "").trimStart() };
  }
  const at = /(^|\s)@([\p{L}\p{N}_'-]{0,40})$/u.exec(before);
  if (at) return { kind: "mention", start: at.index + at[1].length, query: at[2] };
  return null;
}

// Where the token that ends at the caret starts (a «Lead» pill or an
// @mention, with one space after it), or -1. Backspace then deletes it whole.
export function tokenBefore(text: string, caret: number): number {
  const before = text.slice(0, caret);
  const lead = /«[^«»]*» ?$/.exec(before);
  if (lead) return lead.index;
  const at = /(^|\s)(@[\p{L}\p{N}_'-]+) $/u.exec(before);
  if (at) return at.index + at[1].length;
  return -1;
}

// Replaces text[start, caret) with `insert`; returns the new text and caret.
export function replaceRange(text: string, start: number, caret: number, insert: string): { text: string; caret: number } {
  return { text: text.slice(0, start) + insert + text.slice(caret), caret: start + insert.length };
}

// The ids of picked leads whose «Name» pill is still in the text.
export function pickedLeadIds(text: string, picked: { id: string; name: string }[]): string[] {
  const out: string[] = [];
  for (const p of picked) if (text.includes(`«${p.name}»`) && !out.includes(p.id)) out.push(p.id);
  return out;
}

// ---- Unread (Recent chats) ----

// Keeps the highest last-seen id per team.
export function markSeen(seen: Record<string, number>, teamId: string, id: number): Record<string, number> {
  if (!(id > 0) || (seen[teamId] ?? 0) >= id) return seen;
  return { ...seen, [teamId]: id };
}

// Unread counts with the open team left out (for the dot on the browser tab).
export function anyUnread(counts: Record<string, number>, openTeam: string | null): boolean {
  return Object.entries(counts).some(([t, n]) => t !== openTeam && n > 0);
}
