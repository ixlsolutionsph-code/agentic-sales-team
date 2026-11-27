// Who in the chat picks up a request, and the hand-off texts (01-prd.md §7.4
// "Routing"). Also @mention parsing and the status line ("any updates?").
// Pure (no database), so it can be unit tested; lib/chat/reply.ts uses it.
import { capabilityLabel, isEngineReady } from "@/lib/agentTypes";
import { resultSummary } from "@/lib/jobs/tasks";
import type { JobRow } from "@/lib/jobs/store";

export type ChatAgent = {
  id: string;
  name: string;
  role: string;
  goal: string;
  capabilities: string[];
  paused: boolean;
  settings: Record<string, Record<string, unknown>> | null;
};
export type ChatTeam = { id: string; name: string; goal: string; members: ChatAgent[] };

// Capabilities that can't run from the chat yet (none since Milestone 10).
export const CHAT_SOON = new Set<string>();
export function isChatReady(cap: string): boolean {
  return isEngineReady(cap) && !CHAT_SOON.has(cap);
}

// Words for each capability in the chat texts.
// noun: "This needs {noun}." / "No one on this team does {noun}."
// can:  "No agent can {can} yet."
// verb: "Understood. I'm {verb} now (…)."
export const CAP_WORDS: Record<string, { noun: string; can: string; verb: string; done: string }> = {
  scrape: { noun: "lead scraping", can: "find leads", verb: "searching for leads", done: "a lead search" },
  research: { noun: "lead research", can: "research leads", verb: "researching leads", done: "researching leads" },
  outreach: { noun: "email drafting", can: "draft emails", verb: "drafting emails", done: "drafting outreach" },
  "follow-up": { noun: "follow-ups", can: "write follow-ups", verb: "writing follow-ups", done: "follow-ups" },
  "book-meeting": { noun: "meeting booking", can: "book meetings", verb: "booking meetings", done: "booking a meeting" },
  qualify: { noun: "lead qualification", can: "qualify leads", verb: "qualifying leads", done: "qualifying leads" },
  proposal: { noun: "proposal drafting", can: "write proposals", verb: "writing proposals", done: "writing proposals" },
  enrich: { noun: "contact enrichment", can: "enrich contacts", verb: "enriching contacts", done: "enriching contacts" },
  match: { noun: "matchmaking", can: "match leads with products", verb: "matching leads with products", done: "matching leads with products" },
  assess: { noun: "lead assessment", can: "review new leads", verb: "reviewing the new leads", done: "reviewing new leads" },
};
const words = (cap: string) => CAP_WORDS[cap] ?? { noun: capabilityLabel(cap).toLowerCase(), can: `do ${capabilityLabel(cap).toLowerCase()}`, verb: `working on ${capabilityLabel(cap).toLowerCase()}`, done: capabilityLabel(cap).toLowerCase() };

export function firstName(name: string): string {
  return String(name ?? "").trim().split(/\s+/)[0] ?? "";
}

// ---- Texts ----

export const MSG_NOBODY = "No one picked that up. Try @mentioning an agent on this team.";
export const MSG_OFFER_NO = "Okay. Just ask when you need me.";
export const MSG_QUESTION_STOPPED = "Okay, I stopped. Ask me again when you're ready.";

export const soonText = (cap: string) => `${capabilityLabel(cap)} isn't available yet, so I'm unable to run it at the moment.`;
export const noAgentText = (cap: string) => `No agent can ${words(cap).can} yet. Create an agent with that capability, and I will send requests to it.`;
export const teammateText = (cap: string, to: ChatAgent) => `This needs ${words(cap).noun}. That is the area of @${firstName(to.name)}, not mine. I am sending this to them.`;
export const otherTeamText = (cap: string, to: ChatAgent) => `No one on this team does ${words(cap).noun}. @${firstName(to.name)} does. I am sending this to them.`;
export const ackText = (cap: string, summary: string) => `Understood. I'm ${words(cap).verb} now (${summary}).`;

// ---- Mentions ----

const MENTION_RE = /@[\p{L}\p{N}_'-]+/gu;
const key = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// The agents @mentioned in the text, in order. A mention matches the first
// name or the full name without spaces ("@Maya", "@MayaSantos"), any case.
export function parseMentions(text: string, agents: Pick<ChatAgent, "id" | "name">[]): string[] {
  const out: string[] = [];
  for (const m of String(text ?? "").matchAll(MENTION_RE)) {
    const token = key(m[0].slice(1).replace(/'s$/i, "").replace(/[-']+$/, ""));
    if (!token) continue;
    const full = agents.find((a) => key(a.name) === token);
    const hit = full ?? agents.find((a) => key(firstName(a.name)) === token);
    if (hit && !out.includes(hit.id)) out.push(hit.id);
  }
  return out;
}

// ---- Routing ----

export type Route =
  | { kind: "soon"; speaker: ChatAgent | null; text: string }
  | { kind: "none"; speaker: ChatAgent | null; text: string }
  // `lines` are posted in this thread first (hand-off texts), then `agent` acts for `team`.
  | { kind: "act"; agent: ChatAgent; team: ChatTeam; lines: { who: string; text: string }[] };

const can = (a: ChatAgent, cap: string) => a.capabilities.includes(cap);
// Live members first (a paused agent gets no steps, 01-prd.md §7.2).
const pickWith = (list: ChatAgent[], cap: string) => list.find((a) => can(a, cap) && !a.paused) ?? list.find((a) => can(a, cap)) ?? null;

// Who handles a capability asked for in `team`'s chat (01-prd.md §7.4):
// the mentioned agent if it has it; else a teammate; else someone on another
// team; else nobody. "Soon" capabilities are answered as such.
export function resolve(cap: string, team: ChatTeam, mentioned: ChatAgent | null, allTeams: ChatTeam[]): Route {
  const speakerFallback = mentioned ?? team.members.find((a) => can(a, cap)) ?? team.members[0] ?? null;
  if (!isChatReady(cap)) return { kind: "soon", speaker: speakerFallback, text: soonText(cap) };
  if (mentioned && can(mentioned, cap)) return { kind: "act", agent: mentioned, team, lines: [] };
  const mate = pickWith(team.members, cap);
  if (mate) {
    const lines = mentioned ? [{ who: mentioned.id, text: teammateText(cap, mate) }] : [];
    return { kind: "act", agent: mate, team, lines };
  }
  for (const other of allTeams) {
    if (other.id === team.id) continue;
    const a = pickWith(other.members, cap);
    if (a) {
      const speaker = mentioned ?? team.members[0] ?? null;
      return { kind: "act", agent: a, team: other, lines: [{ who: speaker?.id ?? "system", text: otherTeamText(cap, a) }] };
    }
  }
  return { kind: "none", speaker: mentioned ?? team.members[0] ?? null, text: noAgentText(cap) };
}

// The team an agent works for when it acts from this chat: this team if it
// is a member, else the first team that has it.
export function teamOfAgent(agentId: string, current: ChatTeam, allTeams: ChatTeam[]): ChatTeam {
  if (current.members.some((m) => m.id === agentId)) return current;
  return allTeams.find((t) => t.members.some((m) => m.id === agentId)) ?? current;
}

// Who answers a question or a status request: the mentioned agent, else the
// last agent that spoke in the thread, else the first member.
export function pickSpeaker(team: ChatTeam, mentioned: ChatAgent | null, thread: { who: string }[]): ChatAgent | null {
  if (mentioned) return mentioned;
  for (let i = thread.length - 1; i >= 0; i--) {
    const m = team.members.find((a) => a.id === thread[i].who);
    if (m) return m;
  }
  return team.members[0] ?? null;
}

// ---- Status ("any updates?") ----

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The agent's latest real job in words (running, waiting, failed, done).
// `job` = the newest job that was not cancelled, or null.
export function describeWork(job: JobRow | null): string {
  if (!job) return "I haven't run anything yet. Ask me when you need me.";
  const w = words(job.kind);
  const count = Number(job.params?.leadCount) || job.params?.leadIds?.length || 0;
  const leads = count ? ` on ${plural(count, "lead")}` : "";
  switch (job.status) {
    case "running":
      return job.kind === "scrape" ? "I'm searching for leads right now. The results will appear here when I'm done." : `I'm ${w.verb} right now${leads}.`;
    case "queued":
      return `I'm about to start ${w.noun}${leads}. It is in the queue.`;
    case "needs_approval":
      return `I'm waiting for your go-ahead to start ${w.noun}${leads}. Press Proceed when you're ready.`;
    case "failed":
      return `My last run (${w.noun}) didn't finish: ${job.error || "something went wrong"}`;
    case "done": {
      if (job.kind === "scrape") {
        const n = Number(job.result?.leadsFound) || 0;
        return n ? `I've just finished a lead search: found ${plural(n, "new lead")}.` : "I've just finished a lead search, but it found no new leads.";
      }
      return `I've just finished ${w.done}: ${lowerFirst(resultSummary(job.kind, job.result))}.`;
    }
    default:
      return "I haven't run anything yet. Ask me when you need me.";
  }
}
