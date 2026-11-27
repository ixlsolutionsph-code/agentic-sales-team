// Open questions in a team thread and the answers the cards send back. Pure.
//
// CARD ANSWER FORMATS (the chat screen sends these as the user's message):
//
// 1. Search questions card (⟦scrape:…⟧). The user message is a visible
//    summary of the choices, then the answer marker:
//      "Looking for: HR managers · Where: Manila · 10 leads⟦answer:<urlencoded JSON>⟧"
//    JSON: { kind: "scrape", brief: ScrapeBrief } with only the fields the
//    user filled ({ product?, what?, where?, count? }). Build it with
//    `scrapeAnswerMessage(brief)`.
//
// 2. Outreach lead picker (⟦writepick:…⟧). The user message is
//      "Write to «Ana Cruz», «Ben Lee»⟦writeanswer:<urlencoded JSON>⟧"
//    or "Write to everyone⟦writeanswer:<urlencoded JSON>⟧"
//    JSON: { ids: string[] } (lead ids) or { ids: "all" }. Build it with
//    `writeAnswerMessage(picks)`.
//
// Both markers are written with jsonMarker() and read with readJsonMarker()
// from ./markers. Typed answers also work: plain text fills the search brief,
// and lead names (or "everyone") answer the picker.
import type { ChatMessage } from "@/lib/types";
import { jsonMarker, parseMarkers, readJsonMarker, type Offer, type ScrapeBrief, type ScrapeBriefCard, type WritePick } from "./markers";

export type ScrapeAnswer = { kind: "scrape"; brief: ScrapeBrief };
export type WriteAnswer = { ids: string[] | "all" };

const countLabel = (n: number) => `${n} lead${n === 1 ? "" : "s"}`;

// The user message the search card sends.
export function scrapeAnswerMessage(brief: ScrapeBrief): string {
  const clean: ScrapeBrief = {};
  if (brief.product?.trim()) clean.product = brief.product.trim();
  if (brief.what?.trim()) clean.what = brief.what.trim();
  if (brief.where?.trim()) clean.where = brief.where.trim();
  if (typeof brief.count === "number" && brief.count > 0) clean.count = Math.round(brief.count);
  const parts: string[] = [];
  if (clean.product) parts.push(`For: ${clean.product}`);
  if (clean.what) parts.push(`Looking for: ${clean.what}`);
  if (clean.where) parts.push(`Where: ${clean.where}`);
  if (clean.count) parts.push(countLabel(clean.count));
  const answer: ScrapeAnswer = { kind: "scrape", brief: clean };
  return `${parts.join(" · ") || "Here are the details"}${jsonMarker("answer", answer)}`;
}

export function readScrapeAnswer(text: string): ScrapeBrief | null {
  const a = readJsonMarker<ScrapeAnswer>(text, "answer");
  if (!a || a.kind !== "scrape" || !a.brief || typeof a.brief !== "object") return null;
  const b = a.brief;
  const out: ScrapeBrief = {};
  if (typeof b.product === "string" && b.product.trim()) out.product = b.product.trim().slice(0, 200);
  if (typeof b.what === "string" && b.what.trim()) out.what = b.what.trim().slice(0, 300);
  if (typeof b.where === "string" && b.where.trim()) out.where = b.where.trim().slice(0, 120);
  const n = Number(b.count);
  if (Number.isFinite(n) && n > 0) out.count = Math.round(n);
  return out;
}

// The user message the outreach picker sends.
export function writeAnswerMessage(picks: { id: string; name: string }[] | "all"): string {
  if (picks === "all") return `Write to everyone${jsonMarker("writeanswer", { ids: "all" } satisfies WriteAnswer)}`;
  const names = picks.map((p) => `«${p.name.replace(/[«»⟦⟧]/g, "")}»`).join(", ");
  return `Write to ${names}${jsonMarker("writeanswer", { ids: picks.map((p) => p.id) } satisfies WriteAnswer)}`;
}

export function readWriteAnswer(text: string): WriteAnswer | null {
  const a = readJsonMarker<WriteAnswer>(text, "writeanswer");
  if (!a) return null;
  if (a.ids === "all") return { ids: "all" };
  if (!Array.isArray(a.ids)) return null;
  const ids = [...new Set(a.ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 64))];
  return { ids };
}

// ---- Open questions ----

export type OpenQuestion =
  | { kind: "approve"; msg: ChatMessage; jobId: string; answered: boolean }
  | { kind: "scrape"; msg: ChatMessage; card: ScrapeBriefCard; answered: boolean }
  | { kind: "writepick"; msg: ChatMessage; pick: WritePick; answered: boolean }
  | { kind: "offer"; msg: ChatMessage; offer: Offer; answered: boolean };

const QUESTION_KINDS = new Set(["approve", "scrape", "writepick", "offer"]);

// The latest agent question in the thread (newest message that carries an
// approve, scrape, writepick or offer marker, from an agent or the system).
// `answered` is true when the user has written after it. `thread` is oldest
// first and must not include the message being handled.
export function latestQuestion(thread: ChatMessage[]): OpenQuestion | null {
  for (let i = thread.length - 1; i >= 0; i--) {
    const msg = thread[i];
    if (msg.who === "me") continue;
    const kinds = parseMarkers(msg.text).map((m) => m.kind);
    if (!kinds.some((k) => QUESTION_KINDS.has(k))) continue;
    const answered = thread.slice(i + 1).some((m) => m.who === "me");
    if (kinds.includes("approve")) {
      const jobId = parseMarkers(msg.text).find((m) => m.kind === "approve")!.payload;
      return { kind: "approve", msg, jobId, answered };
    }
    if (kinds.includes("scrape")) {
      const card = readJsonMarker<ScrapeBriefCard>(msg.text, "scrape");
      if (card && card.brief) return { kind: "scrape", msg, card, answered };
      return null;
    }
    if (kinds.includes("writepick")) {
      const pick = readJsonMarker<WritePick>(msg.text, "writepick");
      if (pick && Array.isArray(pick.leads)) return { kind: "writepick", msg, pick, answered };
      return null;
    }
    const offer = readJsonMarker<Offer>(msg.text, "offer");
    if (offer && (offer.kind === "wider-search" || offer.kind === "action")) return { kind: "offer", msg, offer, answered };
    return null;
  }
  return null;
}
