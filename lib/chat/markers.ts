// Hidden ⟦kind:payload⟧ markers inside chat message text (04-erd.md §3.3).
// The client strips them before showing the text and draws cards from them.
// Pure, so it can be unit tested and used on both sides.

export type MarkerKind =
  | "approve" // ⟦approve:<jobId>⟧ Proceed / Cancel for a needs_approval job
  | "scrape" // ⟦scrape:<urlencoded JSON ScrapeBriefCard>⟧ the search questions card
  | "answer" // ⟦answer:<json>⟧ the user's answer from a card
  | "run" // ⟦run:<jobId>⟧ live timeline of a job
  | "leads" // ⟦leads:<id,id>⟧ the new leads card
  | "meet" // ⟦meet:<ids>|<yyyy-mm-dd>⟧ (Milestone 10)
  | "meetpick"
  | "meetanswer"
  | "writepick" // ⟦writepick:<json WritePick>⟧ outreach lead picker
  | "writeanswer" // ⟦writeanswer:<json>⟧ its answer
  | "replies" // ⟦replies:<json string[]>⟧ quick replies (≤ 6, each ≤ 80 chars)
  | "job" // ⟦job:<jobId>⟧ makes a job-result post idempotent
  | "offer"; // ⟦offer:<json Offer>⟧ an agent's yes/no offer (for example a wider search)

export type Marker = { kind: MarkerKind; payload: string };

const RE = /⟦([a-z]+):([^⟧]*)⟧/g;

export function marker(kind: MarkerKind, payload: string): string {
  return `⟦${kind}:${payload.replace(/⟧/g, "")}⟧`;
}

export const jsonMarker = (kind: MarkerKind, value: unknown) => marker(kind, encodeURIComponent(JSON.stringify(value)));

export function parseMarkers(text: string): Marker[] {
  const out: Marker[] = [];
  for (const m of text.matchAll(RE)) out.push({ kind: m[1] as MarkerKind, payload: m[2] });
  return out;
}

export function findMarker(text: string, kind: MarkerKind): string | null {
  return parseMarkers(text).find((m) => m.kind === kind)?.payload ?? null;
}

// The JSON value of a jsonMarker, or null.
export function readJsonMarker<T>(text: string, kind: MarkerKind): T | null {
  const p = findMarker(text, kind);
  if (p == null) return null;
  try {
    return JSON.parse(decodeURIComponent(p)) as T;
  } catch {
    return null;
  }
}

export function stripMarkers(text: string): string {
  return text.replace(RE, "").replace(/[ \t]+\n/g, "\n").trim();
}

// Quick replies: at most 6, each at most 80 characters.
export function repliesMarker(list: string[]): string {
  return jsonMarker("replies", list.map((s) => s.slice(0, 80)).filter(Boolean).slice(0, 6));
}

// Removes the «» around lead names, for plain text uses.
export const unpill = (s: string) => s.replace(/[«»]/g, "");

// ---- Card payloads shared by the server and the client ----

// The search brief (01-prd.md §7.4). `asks` counts how many times the card was shown.
export type ScrapeBrief = { product?: string; what?: string; where?: string; count?: number; asks?: number };
export type ScrapeBriefCard = {
  brief: ScrapeBrief;
  missing: ("product" | "what" | "where" | "count")[];
  products: string[]; // names to pick from (only when product is missing)
};
export type WritePick = { leads: { id: string; name: string; company: string }[] };
export type Offer = { kind: "wider-search"; brief: ScrapeBrief; agentId: string } | { kind: "action"; cap: string; agentId: string };
