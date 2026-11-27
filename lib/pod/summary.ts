// Every text the chain posts (01-prd.md §7.2 and §7.5, 03-user-journey.md J3,
// J6, J10): asks, starts, hand-offs, stops and the cancel summary. Pure.
// Plain words, no emojis, no exclamation marks; agents are @mentioned by first
// name and the user as "@You"; lead names go in «Name» pills.
import { jsonMarker, marker, repliesMarker, type Offer, type ScrapeBrief } from "@/lib/chat/markers";
import type { PodStage } from "./types";

type Result = Record<string, unknown> | null | undefined;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const num = (r: Result, k: string) => Number(r?.[k]) || 0;

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}
export const mention = (name: string) => `@${firstName(name)}`;
export const YOU = "@You";

// ---------------------------------------------------------------- fixed texts

export const MSG_START = "Okay, starting now.";
export const MSG_START_SEARCH = "Okay, starting the search now. I will post the results here.";
export const MSG_NO_NEW_LEADS = "I found no new leads for that search. Try again with more detail, for example the industry, the company size or the location.";
export const MSG_NO_FIT = "I reviewed the new leads, but none of them were a good fit.";
export const MSG_NO_MATCHES = "I found no listings that match these leads, so I'll pass them on without matches.";
export const MSG_STOPPED_SUFFIX = ", but you stopped the run, so I didn't pass it on.";
export const MSG_CANCEL_HEAD = "Okay, stopping now. Here's a summary of what we did:";
export const MSG_CANCEL_NOTHING = "Okay, stopping now. We hadn't done anything yet, so nothing changed.";
export const MSG_ALREADY_HANDLED = "That step was already handled.";
export const MSG_WONT_BOOK = "Okay, I won't book it.";
export const MSG_TEAM_GONE = "This team no longer exists.";
export const MSG_WIDER_QUESTION = "Want me to look again with a wider scope?";
export const WIDER_REPLIES = ["Yes, go ahead", "No, thanks"];
export const TRY_AGAIN_REPLIES = ["Try again"];

// ---------------------------------------------------------------- per stage

type StageText = {
  noun: string; // "please do the {noun}", "Next, I'll do the {noun}."
  verb: string; // "I'm ready to {verb} 6 leads"
  doing: string; // "X was still {doing}."
  failedNoun: string; // "X's {failedNoun} didn't finish"
  nothing: string; // the fixed "nothing to do" text
  final: string; // the last agent's line to the user
};

export const STAGE_TEXT: Record<PodStage, StageText> = {
  scrape: {
    noun: "lead search",
    verb: "search for",
    doing: "searching for leads",
    failedNoun: "search",
    nothing: MSG_NO_NEW_LEADS,
    final: `${YOU}, they are ready for you to review and accept.`,
  },
  assess: {
    noun: "review",
    verb: "review",
    doing: "reviewing leads",
    failedNoun: "review",
    nothing: "There were no new leads to review, so I stopped here.",
    final: `${YOU}, the accepted leads are ready for you to look over.`,
  },
  research: {
    noun: "research",
    verb: "research",
    doing: "researching leads",
    failedNoun: "research",
    nothing: "None of the team's leads need research right now, so I stopped here.",
    final: `${YOU}, the research is ready for you to read.`,
  },
  qualify: {
    noun: "scoring",
    verb: "score",
    doing: "scoring leads",
    failedNoun: "scoring",
    nothing: "None of the team's leads need a score right now, so I stopped here.",
    final: `${YOU}, the scores are ready for you to review.`,
  },
  match: {
    noun: "product matching",
    verb: "find product matches for",
    doing: "matching leads with products",
    failedNoun: "product matching",
    nothing: "None of the team's leads need product matches right now, so I stopped here.",
    final: `${YOU}, the product matches are ready for you to review.`,
  },
  outreach: {
    noun: "email drafts",
    verb: "write emails to",
    doing: "writing emails",
    failedNoun: "email drafting",
    nothing: "None of the team's leads need an email right now, so I stopped here.",
    final: `${YOU}, the drafts are ready for you to review and send.`,
  },
  proposal: {
    noun: "proposals",
    verb: "write proposals for",
    doing: "writing proposals",
    failedNoun: "proposal writing",
    nothing: "None of the team's leads need a proposal right now, so I stopped here.",
    final: `${YOU}, the proposals are ready for you to review and send.`,
  },
};

// The result count that says the stage moved leads on.
export const MOVED_KEY: Record<PodStage, string> = {
  scrape: "leadsFound",
  assess: "accepted",
  research: "researched",
  qualify: "qualified",
  match: "matched",
  outreach: "draftsCreated",
  proposal: "proposalsCreated",
};

export const movedCount = (kind: PodStage, r: Result) => num(r, MOVED_KEY[kind]);
export const failedCount = (r: Result) => num(r, "failed");

// What a stage did, in the past tense without a subject: "researched 5 leads".
// `summary` uses the cancel-summary wording ("found 8 leads").
export function donePhrase(kind: PodStage, r: Result, summary = false): string {
  const n = movedCount(kind, r);
  switch (kind) {
    case "scrape":
      return n ? `found ${plural(n, summary ? "lead" : "new lead")}` : "didn't find any new leads";
    case "assess": {
      const total = n + num(r, "dismissed");
      return total ? `accepted ${n} of ${plural(total, "lead")}` : "had no new leads to review";
    }
    case "research":
      return n ? `researched ${plural(n, "lead")}` : "had no leads to research";
    case "qualify":
      return n ? `scored ${plural(n, "lead")}` : "had no leads to score";
    case "match": {
      const m = num(r, "matches");
      return n ? `found ${plural(m, "product match", "product matches")} for ${plural(n, "lead")}` : "had no leads to match";
    }
    case "outreach":
      return n ? `drafted ${plural(n, "email")}` : "had no leads to write to";
    case "proposal":
      return n ? `wrote ${plural(n, "proposal")}` : "had no leads to write proposals for";
  }
}

export const doneSentence = (kind: PodStage, r: Result) => `I ${donePhrase(kind, r)}.`;

// ---------------------------------------------------------------- asks and starts

// "«A», «B», «C» and 3 more" / "«A» and «B»".
export function leadList(names: string[], max = 3): string {
  const pills = names.filter(Boolean).map((n) => `«${n.replace(/[«»]/g, "")}»`);
  if (pills.length <= 1) return pills.join("");
  if (pills.length <= max) return `${pills.slice(0, -1).join(", ")} and ${pills[pills.length - 1]}`;
  return `${pills.slice(0, max).join(", ")} and ${pills.length - max} more`;
}

export function isAnywhere(where: string | undefined | null): boolean {
  const w = (where ?? "").trim().toLowerCase();
  return !w || w === "anywhere" || w === "everywhere" || w === "worldwide";
}

// "I'm ready to search:\n• For: …\n• Looking for: …\n• Where: …\n• How many: N leads.\nProceed?"
export function scrapeAskText(brief: ScrapeBrief | undefined, target: number, instruction = ""): string {
  if (!brief?.what) {
    const what = instruction.trim().replace(/\.+$/, "");
    return `I'm ready to search:\n• Looking for: ${what || "new leads"}\n• How many: ${plural(target, "lead")}.\nProceed?`;
  }
  return [
    "I'm ready to search:",
    `• For: ${brief.product?.trim() || "Any product"}`,
    `• Looking for: ${brief.what.trim()}`,
    `• Where: ${isAnywhere(brief.where) ? "Anywhere" : brief.where!.trim()}`,
    `• How many: ${plural(target, "lead")}.`,
    "Proceed?",
  ].join("\n");
}

// "I'm ready to research 6 leads: «A», «B», «C» and 3 more. Proceed?"
export function stageAskText(kind: PodStage, count: number, names: string[] = []): string {
  const t = STAGE_TEXT[kind];
  if (!count) return `I'm ready to ${t.verb} the team's leads that still need it. Proceed?`;
  const list = leadList(names);
  return `I'm ready to ${t.verb} ${plural(count, "lead")}${list ? `: ${list}` : ""}. Proceed?`;
}

export const withApprove = (text: string, jobId: string) => `${text}${marker("approve", jobId)}`;

// What the agent says when a step starts (Auto, or after Proceed).
export function startText(kind: string, jobId: string): string {
  return kind === "scrape" ? `${MSG_START_SEARCH}${marker("run", jobId)}` : MSG_START;
}

// The refusal when the team already has this step open.
export function busyText(kind: PodStage, waiting: boolean): string {
  const noun = STAGE_TEXT[kind].noun;
  return waiting
    ? `There is already a ${noun} waiting for your go-ahead. Press Proceed or Cancel on it first.`
    : `There is already a ${noun} running for this team. Wait for it to finish, or stop it first.`;
}

// ---------------------------------------------------------------- hand-offs and stops

export const leadsMarker = (ids: string[]) => (ids.length ? marker("leads", ids.join(",")) : "");

export function handOffText(done: string, kind: PodStage, nextName: string): string {
  return `${done} ${mention(nextName)}, please do the ${STAGE_TEXT[kind].noun}.`;
}

export function sameAgentNextText(done: string, kind: PodStage): string {
  return `${done} Next, I'll do the ${STAGE_TEXT[kind].noun}.`;
}

export function scrapeFoundText(n: number, assessorName: string | null, sameAgent: boolean): string {
  const found = `I found ${plural(n, "new lead")}.`;
  if (sameAgent) return `${found} Next, I'll do the review.`;
  if (assessorName) return `${found} ${mention(assessorName)}, please review them.`;
  return `${found} ${STAGE_TEXT.scrape.final}`;
}

export function stoppedText(kind: PodStage, r: Result): string {
  return `I ${donePhrase(kind, r)}${MSG_STOPPED_SUFFIX}`;
}

export function failedLeadsText(failed: number, done: string | null): string {
  return `${done ? `${done} ` : ""}${YOU}, I couldn't finish ${plural(failed, "lead")} because of an error. I stopped the chain here.`;
}

export function noProductsText(done: string): string {
  return `${done} ${YOU}, there are no products in the catalog yet, so I stopped before the proposals. Add products on the Products page.`;
}

export function finalText(done: string, kind: PodStage): string {
  return `${done} ${STAGE_TEXT[kind].final}`;
}

// "Try again" after failed leads: the offer tells the chat which step to run again.
export function tryAgainMarkers(kind: string, agentId: string): string {
  const offer: Offer = { kind: "action", cap: kind, agentId };
  return `${jsonMarker("offer", offer)}${repliesMarker(TRY_AGAIN_REPLIES)}`;
}

// ---------------------------------------------------------------- wider search

// Widens a search (01-prd.md §7.2): the place becomes its last comma part,
// then "anywhere"; when it is already anywhere the count doubles (max 25).
// Null when it can't be widened any more.
export function widenBrief(brief: ScrapeBrief): ScrapeBrief | null {
  const count = Math.min(25, Math.max(1, Math.floor(Number(brief.count) || 10)));
  if (isAnywhere(brief.where)) {
    if (count >= 25) return null;
    return { ...brief, where: "anywhere", count: Math.min(25, count * 2), asks: undefined };
  }
  const parts = brief.where!.split(",").map((p) => p.trim()).filter(Boolean);
  const where = parts.length > 1 ? parts[parts.length - 1] : "anywhere";
  return { ...brief, where, count, asks: undefined };
}

// "Want me to look again with a wider scope? I'll search for 10 leads in Philippines."
export function widerQuestion(wider: ScrapeBrief): string {
  const count = Math.floor(Number(wider.count) || 10);
  const where = isAnywhere(wider.where) ? "anywhere" : `in ${wider.where}`;
  return `${MSG_WIDER_QUESTION} I'll search for ${plural(count, "lead")} ${where}.`;
}

// The offer paragraph with its markers, or "" when the search can't be widened.
export function widerOfferText(brief: ScrapeBrief | undefined, scoutId: string | null): string {
  if (!brief?.what || !scoutId) return "";
  const wider = widenBrief(brief);
  if (!wider) return "";
  const offer: Offer = { kind: "wider-search", brief: wider, agentId: scoutId };
  return `\n\n${widerQuestion(wider)}${jsonMarker("offer", offer)}${repliesMarker(WIDER_REPLIES)}`;
}

// ---------------------------------------------------------------- cancel summary

export type SummaryJob = { kind: string; status: string; agentName: string; result: Result };

// One line per job of the run: "• Sam found 8 leads", "• Sam's search didn't
// finish", "• Rex was still researching leads. That step will finish, but
// nothing runs after it". Waiting, queued and dismissed steps get no line.
export function summaryLine(j: SummaryJob): string | null {
  const who = firstName(j.agentName) || "An agent";
  const kind = j.kind as PodStage;
  if (!(kind in STAGE_TEXT)) return null;
  if (j.status === "done") return `• ${who} ${donePhrase(kind, j.result, true)}`;
  if (j.status === "failed") return `• ${who}'s ${STAGE_TEXT[kind].failedNoun} didn't finish`;
  if (j.status === "running") return `• ${who} was still ${STAGE_TEXT[kind].doing}. That step will finish, but nothing runs after it`;
  return null;
}

export function cancelSummary(jobs: SummaryJob[]): string {
  const lines = jobs.map(summaryLine).filter((l): l is string => Boolean(l));
  return lines.length ? `${MSG_CANCEL_HEAD}\n${lines.join("\n")}` : MSG_CANCEL_NOTHING;
}
