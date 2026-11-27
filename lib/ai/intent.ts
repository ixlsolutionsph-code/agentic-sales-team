// What a chat message asks for (01-prd.md §7.4 "Intent"). The LLM at
// temperature 0.2; with no AI (or when it fails) the keyword rules, in the
// spec's order: status → question → search start → book-meeting, follow-up,
// proposal, qualify, enrich, match, assess, research, outreach, scrape.
import { stripMarkers } from "@/lib/chat/markers";
import { looksLikeQuestion } from "@/lib/chat/yesNo";
import { SYSTEM_BASE, type AIJson } from "./engine";
import { cleanField, fence } from "./untrusted";

export const INTENTS = [
  "scrape",
  "research",
  "outreach",
  "follow-up",
  "book-meeting",
  "qualify",
  "proposal",
  "enrich",
  "match",
  "assess",
  "status",
  "chat",
  "unknown",
] as const;
export type IntentKind = (typeof INTENTS)[number];

// `what` = the buyer to look for ("HR managers at hospitals"), when said.
export type Intent = {
  intent: IntentKind;
  industry: string;
  titles: string[];
  geo: string;
  target: number | null;
  what: string;
};

const EMPTY = { industry: "", titles: [] as string[], geo: "", target: null, what: "" };

export function isIntentKind(v: unknown): v is IntentKind {
  return typeof v === "string" && (INTENTS as readonly string[]).includes(v);
}

// The text the rules read: no markers, no @mentions.
export function plainText(text: string): string {
  return stripMarkers(String(text ?? ""))
    .replace(/@[\p{L}\p{N}_'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STATUS =
  /\b(any ?updates?|an update|status|progress|how('?s| is| are) (it|things|everything|the (search|work|run)) going|what('?s| is| are| have) (you|everyone|the team|you all|you guys) (been )?(doing|working on|up to|done)|what did you (do|find)|where are we|how far along|are you done|is it done|did you finish)\b/i;
const SEARCH_START =
  /^(please\s+)?(can you\s+|could you\s+|would you\s+|pls\s+)?(please\s+)?(find|search( for)?|look( for| up)?|get me|scrape|source|hunt( for)?|prospect( for)?|dig up|pull)\b/i;

const RULES: [Exclude<IntentKind, "status" | "chat" | "unknown">, RegExp][] = [
  ["book-meeting", /\b(book|schedule|set ?up|arrange|organi[sz]e)\b[^.?!]*\b(meetings?|calls?|demos?|appointments?)\b|\bmeetings?\b/i],
  ["follow-up", /\bfollow[- ]?ups?\b|\bfollow up\b|\bnudge\b|\bcheck in with\b/i],
  ["proposal", /\bproposals?\b|\bquotes?\b|\boffers? (for|to)\b/i],
  ["qualify", /\bqualif(y|ies|ication)\b|\bscor(e|ing)\b|\brank (the )?leads\b/i],
  ["enrich", /\benrich(ment)?\b|\bcontact (details|info)\b|\bphone numbers?\b|\bfind (their )?emails?\b|\bemail addresses\b/i],
  ["match", /\bmatch(es|ing|making)?\b/i],
  ["assess", /\bassess(ment)?\b|\breview (the )?(new |pending )?leads\b|\baccept (the )?(new |pending )?leads\b/i],
  ["research", /\bresearch\b|\blook into\b|\bbackground on\b|\blearn about\b/i],
  ["outreach", /\b(emails?|draft|drafts|write to|outreach|reach out|message|messages|contact them|send)\b/i],
  ["scrape", /\b(find|search|look for)\b|\b(new )?(leads|prospects|buyers|customers|clients)\b/i],
];

// The buyer, place and count from a search request ("find 10 HR managers at
// hospitals in Manila").
export function searchParts(text: string): { what: string; geo: string; target: number | null } {
  let s = plainText(text).replace(/[?!.]+$/, "");
  s = s.replace(SEARCH_START, "").trim();
  let target: number | null = null;
  const n = s.match(/\b(\d{1,3})\b/);
  if (n) {
    target = Number(n[1]) || null;
    s = s.replace(n[0], " ");
  }
  let geo = "";
  const g = s.match(/\s(?:in|from|near|around|based in|located in)\s+([^,;]+?)\s*$/i);
  if (g) {
    geo = g[1].trim();
    s = s.slice(0, g.index).trim();
  }
  s = s
    .replace(/^(me|us)\s+/i, "")
    .replace(/^(some|more|new|a few|a couple of|good|the)\s+/i, "")
    .replace(/^(leads|prospects|people|contacts|buyers|customers|clients)\b\s*(for|of|who are|that are|like|among|:)?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(leads?|prospects?|people|contacts|buyers|customers|clients|some|more|anyone|someone)$/i.test(s)) s = "";
  return { what: cleanField(s, 300), geo: cleanField(geo, 120), target };
}

// The keyword rules (no AI).
export function keywordIntent(text: string): Intent {
  const s = plainText(text);
  if (!s) return { intent: "unknown", ...EMPTY };
  if (STATUS.test(s)) return { intent: "status", ...EMPTY };
  if (looksLikeQuestion(text)) return { intent: "chat", ...EMPTY };
  if (SEARCH_START.test(s)) {
    // "find their emails" is enrichment, not a search.
    const enrich = RULES.find(([k]) => k === "enrich")![1];
    if (!enrich.test(s)) return { intent: "scrape", industry: "", titles: [], ...searchParts(s) };
  }
  for (const [kind, re] of RULES) {
    if (re.test(s)) return kind === "scrape" ? { intent: "scrape", industry: "", titles: [], ...searchParts(s) } : { intent: kind, ...EMPTY };
  }
  return { intent: "chat", ...EMPTY };
}

const SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: [...INTENTS] },
    what: { type: "string" },
    industry: { type: "string" },
    titles: { type: "array", items: { type: "string" } },
    geo: { type: "string" },
    target: { type: "integer" },
  },
  required: ["intent", "what", "industry", "titles", "geo", "target"],
};

const GUIDE = [
  "Classify one chat message the owner of a small business wrote to their sales team.",
  "intent is one of:",
  "- scrape: find or search for new leads (people or companies to sell to)",
  "- assess: review new leads and accept or dismiss them",
  "- research: research leads",
  "- qualify: score or qualify leads",
  "- match: match leads with products from the catalog",
  "- outreach: draft emails or messages to leads",
  "- proposal: write proposals",
  "- book-meeting: book or schedule a meeting or call",
  "- follow-up: follow up with leads",
  "- enrich: find contact details (emails, phone numbers)",
  "- status: asks what the team has done, for updates or progress",
  "- chat: a question or other talk (for example 'how many hot leads do we have?')",
  "- unknown: none of these",
  "A question about the work is chat, not a request to do it. A request to do something is its capability.",
  "For scrape, also fill: what (the buyer to look for, for example 'HR managers at hospitals'; empty if not said), industry, titles (job titles), geo (the place; empty if none), target (how many leads, 0 if not said).",
  "For other intents leave those empty (target 0).",
].join("\n");

// The intent of a message. `ai` = null uses the keyword rules.
export async function detectIntent(text: string, ai: AIJson | null): Promise<Intent> {
  const plain = plainText(text);
  if (!plain) return { intent: "unknown", ...EMPTY };
  if (!ai) return keywordIntent(text);
  try {
    const r = await ai<Record<string, unknown>>(SYSTEM_BASE, `${GUIDE}\n\nMessage:\n${fence(cleanField(plain, 2000))}`, SCHEMA, {
      temperature: 0.2,
      maxTokens: 400,
    });
    if (!isIntentKind(r?.intent)) return keywordIntent(text);
    const target = Math.round(Number(r.target));
    const out: Intent = {
      intent: r.intent,
      what: cleanField(r.what, 300),
      industry: cleanField(r.industry, 120),
      titles: Array.isArray(r.titles) ? r.titles.map((t) => cleanField(t, 80)).filter(Boolean).slice(0, 5) : [],
      geo: cleanField(r.geo, 120),
      target: Number.isFinite(target) && target > 0 ? Math.min(target, 25) : null,
    };
    return out;
  } catch (e) {
    console.error("detectIntent failed", e instanceof Error ? e.message : e);
    return keywordIntent(text);
  }
}
