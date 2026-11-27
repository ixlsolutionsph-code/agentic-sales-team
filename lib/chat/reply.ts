import "server-only";
import type { AIJson } from "@/lib/ai/engine";
import { aiJSON, isAIConfigured } from "@/lib/ai/gemini";
import { detectIntent, plainText, keywordIntent, type Intent } from "@/lib/ai/intent";
import { matchLeadNames, resolveLeads } from "@/lib/ai/resolveLeads";
import type { ActionResult } from "@/lib/auth/call-action";
import { UUID_RE } from "@/lib/auth/rules";
import { MSG_RUN_FAILED } from "@/lib/jobs/limits";
import { getJob, listAgentJobs, type JobRow } from "@/lib/jobs/store";
import { setReviewRows } from "@/lib/leads/store";
import { approveStep, cancelStep } from "@/lib/pod/decisions";
import { enqueuePodStage } from "@/lib/pod/orchestrate";
import { isPodStage } from "@/lib/pod/types";
import type { ChatMessage } from "@/lib/types";
import { inAccountWorkspaces } from "@/lib/workspaces/scope";
import { latestQuestion, readScrapeAnswer, readWriteAnswer, type OpenQuestion } from "./clarify";
import type { ChatResult, FollowJob } from "./contract";
import { converse } from "./converse";
import type { ScrapeBrief } from "./markers";
import {
  MSG_NOBODY,
  MSG_OFFER_NO,
  MSG_QUESTION_STOPPED,
  ackText,
  describeWork,
  parseMentions,
  pickSpeaker,
  resolve,
  teamOfAgent,
  type ChatAgent,
  type ChatTeam,
} from "./orchestrate";
import { MSG_NO_OPEN_LEADS, isEveryone, namesSummary, outreachPickMessage } from "./outreachTarget";
import {
  briefFromInstruction,
  briefFromIntent,
  isLookForMore,
  mergeBrief,
  moreBrief,
  nextBriefStep,
  fillFromText,
  type BriefProduct,
} from "./scrapeBrief";
import {
  briefProducts,
  factualAnswer,
  formatTeamFacts,
  lastSearch,
  loadChatWorld,
  loadTeamFacts,
  openOutreachLeads,
  poolLeadNames,
  poolLeadsByIds,
} from "./teamFacts";
import {
  CHAT_MESSAGES_PER_DAY,
  MSG_CHAT_LIMIT,
  countRecentUserMessages,
  lastTeamMessages,
  listTeamMessages,
  postTeamMessage,
} from "./teamMessages";
import { isStopWord, looksLikeQuestion, readYesNo } from "./yesNo";

// The team chat's server entry after the input checks (01-prd.md §7.4):
// the daily limit, store the user's message, Proceed / Cancel by a typed
// yes / no, else reply(): offers, open questions, "look for more", then
// intent and routing. Posts "No one picked that up…" when nothing answered.

export const MSG_NO_TEAM = "This team no longer exists.";
export const MSG_EMPTY = "Type a message first.";
export const MSG_COULDNT_MATCH = "I couldn't find those leads in the list. ";
const THREAD_LOOKBACK = 40;

type Ctx = {
  ws: string;
  accountId: string;
  team: ChatTeam;
  world: ChatTeam[];
  text: string; // as sent (may carry ⟦answer⟧ / ⟦writeanswer⟧)
  plain: string; // no markers, no @mentions
  picks: { id: string; name: string }[]; // /lead picks in the team's pool
  thread: ChatMessage[]; // before the user's message, oldest first
  follow: FollowJob[];
  ai: AIJson | null;
};

const aiFn = (): AIJson | null => (isAIConfigured() ? (system, prompt, schema, opts) => aiJSON(system, prompt, schema, opts) : null);
const memberIds = (t: ChatTeam) => t.members.map((m) => m.id);

async function post(ctx: Ctx, who: string, text: string): Promise<void> {
  await postTeamMessage(ctx.ws, ctx.team.id, who, text);
}

function agentById(ctx: Ctx, id: string): ChatAgent | null {
  for (const t of ctx.world) {
    const a = t.members.find((m) => m.id === id);
    if (a) return a;
  }
  return null;
}

export async function runTeamChat(
  workspaceId: string,
  accountId: string,
  teamId: string,
  message: string,
  leadIds: string[] = [],
): Promise<ActionResult<ChatResult>> {
  const text = String(message ?? "").trim();
  if (!text) return { ok: false, error: MSG_EMPTY };
  const world = await loadChatWorld(workspaceId);
  const team = world.find((t) => t.id === teamId);
  if (!team) return { ok: false, error: MSG_NO_TEAM };

  const workspaces = await inAccountWorkspaces(accountId);
  const used = await countRecentUserMessages(workspaces.length ? workspaces : [workspaceId]);
  if (used >= CHAT_MESSAGES_PER_DAY) return { ok: false, error: MSG_CHAT_LIMIT };

  const thread = await lastTeamMessages(workspaceId, teamId, THREAD_LOOKBACK);
  const before = thread.length ? thread[thread.length - 1].id : 0;

  // /lead picks: only leads in this team's pool. Picking a lead also accepts it (01-prd.md §7.7).
  const wanted = [...new Set((Array.isArray(leadIds) ? leadIds : []).filter((x) => typeof x === "string" && UUID_RE.test(x)))].slice(0, 50);
  const picked = await poolLeadsByIds(workspaceId, memberIds(team), wanted);

  await postTeamMessage(workspaceId, teamId, "me", text);
  const pending = picked.filter((l) => l.review === "pending").map((l) => l.id);
  if (pending.length) await setReviewRows(workspaceId, pending, "accepted");

  const ctx: Ctx = {
    ws: workspaceId,
    accountId,
    team,
    world,
    text,
    plain: plainText(text),
    picks: picked.map((l) => ({ id: l.id, name: l.name })),
    thread,
    follow: [],
    ai: aiFn(),
  };
  try {
    await dispatch(ctx);
  } catch (e) {
    console.error("teamChat failed", e instanceof Error ? e.message : e);
    await post(ctx, "system", MSG_RUN_FAILED);
  }

  let messages = await listTeamMessages(workspaceId, teamId, before);
  if (!messages.some((m) => m.who !== "me")) {
    const m = await postTeamMessage(workspaceId, teamId, "system", MSG_NOBODY);
    messages = [...messages, m];
  }
  return { ok: true, data: { messages, follow: ctx.follow } };
}

// Branch 3: a short typed yes / no answers the open Proceed / Cancel ask.
async function dispatch(ctx: Ctx): Promise<void> {
  const q = latestQuestion(ctx.thread);
  const yn = readYesNo(ctx.text);
  if (q?.kind === "approve" && yn && UUID_RE.test(q.jobId)) {
    const job = await getJob(ctx.ws, q.jobId);
    if (job && job.status === "needs_approval") {
      if (yn === "yes") {
        const r = await approveStep(ctx.ws, job.id);
        if (r.follow) ctx.follow.push(r.follow);
        if (r.error && !r.messages.length) await post(ctx, job.agentId || "system", r.error);
      } else {
        await cancelStep(ctx.ws, ctx.team.id, job.id);
      }
      return;
    }
  }
  await reply(ctx, q, yn);
}

// Branch 4 (01-prd.md §7.4).
async function reply(ctx: Ctx, q: OpenQuestion | null, yn: "yes" | "no" | null): Promise<void> {
  // A card answer still continues its question, even after other messages.
  const cardAnswer =
    (q?.kind === "scrape" && readScrapeAnswer(ctx.text) != null) || (q?.kind === "writepick" && readWriteAnswer(ctx.text) != null);
  const open = q && (!q.answered || cardAnswer) ? q : null;

  if (open?.kind === "offer") {
    const who = agentById(ctx, open.offer.agentId)?.id ?? open.msg.who;
    if (yn === "no") return post(ctx, who, MSG_OFFER_NO);
    // "Try again" is the quick reply of the relay's failed-stage offer.
    if (yn === "yes" || /^\s*try again\s*[.!]?\s*$/i.test(ctx.plain)) return acceptOffer(ctx, open);
  }
  if (open?.kind === "scrape" || open?.kind === "writepick") {
    if (await continueQuestion(ctx, open, yn)) return;
  }
  // A typed "stop" with no question open stops the team's waiting steps.
  if (isStopWord(ctx.text)) {
    await cancelStep(ctx.ws, ctx.team.id, null);
    return;
  }
  const mentioned = mentionedAgent(ctx);
  if (isLookForMore(ctx.plain)) return lookForMore(ctx, mentioned);
  const intent = await detectIntent(ctx.text, ctx.ai);
  return route(ctx, intent, mentioned);
}

function mentionedAgent(ctx: Ctx): ChatAgent | null {
  const ids = parseMentions(ctx.text, ctx.team.members);
  return ctx.team.members.find((m) => m.id === ids[0]) ?? null;
}

// A typed message that is a new request, not an answer to the open question.
function isNewRequest(plain: string, ownCap: string): boolean {
  const k = keywordIntent(plain);
  if (k.intent === "chat" || k.intent === "unknown") return false;
  if (k.intent === "status") return true;
  if (k.intent === ownCap) return ownCap === "scrape" ? /^(please\s+)?(find|search|look for|get me|scrape)\b/i.test(plain) : false;
  // Counts and places ("10 leads", "leads in Texas") still answer a search question.
  return !(ownCap === "scrape" && k.intent === "scrape");
}

// An open search card or outreach picker. Returns false when the message is
// something else (then it is routed as a new request).
async function continueQuestion(ctx: Ctx, open: Extract<OpenQuestion, { kind: "scrape" | "writepick" }>, yn: "yes" | "no" | null): Promise<boolean> {
  const agent = agentById(ctx, open.msg.who);
  if (!agent) return false;
  const actTeam = teamOfAgent(agent.id, ctx.team, ctx.world);

  if (open.kind === "scrape") {
    const answer = readScrapeAnswer(ctx.text);
    if (answer) {
      await continueSearch(ctx, agent, actTeam, mergeBrief(open.card.brief, answer));
      return true;
    }
  } else {
    const answer = readWriteAnswer(ctx.text);
    if (answer) {
      await continueOutreach(ctx, agent, actTeam, answer.ids);
      return true;
    }
    if (ctx.picks.length) {
      await continueOutreach(ctx, agent, actTeam, ctx.picks.map((p) => p.id));
      return true;
    }
  }
  if (open.answered) return false;
  if (yn === "no" || isStopWord(ctx.text)) {
    await post(ctx, agent.id, MSG_QUESTION_STOPPED);
    return true;
  }
  if (looksLikeQuestion(ctx.text)) {
    await answerQuestion(ctx, agent);
    await post(ctx, agent.id, open.msg.text); // the same question again, so its card stays
    return true;
  }
  if (!ctx.plain) return false;
  if (open.kind === "scrape") {
    if (isNewRequest(ctx.plain, "scrape")) return false;
    const products = await briefProducts(ctx.ws);
    await continueSearch(ctx, agent, actTeam, fillFromText(open.card.brief, ctx.plain, products), products);
    return true;
  }
  if (isEveryone(ctx.plain)) {
    await continueOutreach(ctx, agent, actTeam, "all");
    return true;
  }
  const named = matchLeadNames(ctx.text, open.pick.leads);
  if (named.length) {
    await continueOutreach(ctx, agent, actTeam, named);
    return true;
  }
  if (isNewRequest(ctx.plain, "outreach")) return false;
  await post(ctx, agent.id, `${MSG_COULDNT_MATCH}${open.msg.text}`);
  return true;
}

// ---- Search ----

async function continueSearch(ctx: Ctx, agent: ChatAgent, actTeam: ChatTeam, brief: ScrapeBrief, products?: BriefProduct[], more = false): Promise<void> {
  const list = products ?? (await briefProducts(ctx.ws));
  const step = nextBriefStep(brief, list, { more });
  if (step.kind === "no-products") return post(ctx, agent.id, step.text);
  if (step.kind === "ask") return post(ctx, agent.id, step.message);
  // The confirm ("I'm ready to search: …") is posted by enqueuePodStage.
  const r = await enqueuePodStage(ctx.ws, ctx.accountId, {
    teamId: actTeam.id,
    agentId: agent.id,
    kind: "scrape",
    instruction: step.instruction,
    target: step.target,
    brief: step.brief,
  });
  if (!r.ok) return post(ctx, agent.id, r.error);
  if (r.follow) ctx.follow.push(r.follow);
}

async function lookForMore(ctx: Ctx, mentioned: ChatAgent | null): Promise<void> {
  const r = resolve("scrape", ctx.team, mentioned, ctx.world);
  if (r.kind !== "act") return post(ctx, r.speaker?.id ?? "system", r.text);
  for (const line of r.lines) await post(ctx, line.who, line.text);
  const last = await lastSearch(ctx.ws, memberIds(r.team));
  const products = await briefProducts(ctx.ws);
  if (!last) return continueSearch(ctx, r.agent, r.team, { asks: 0 }, products);
  const b = last.brief && typeof last.brief === "object" ? (last.brief as ScrapeBrief) : briefFromInstruction(last.instruction);
  return continueSearch(ctx, r.agent, r.team, moreBrief(b), products, true);
}

// ---- Outreach ----

async function continueOutreach(ctx: Ctx, agent: ChatAgent, actTeam: ChatTeam, ids: string[] | "all"): Promise<void> {
  if (ids === "all") return runStage(ctx, agent, actTeam, "outreach", undefined, "everyone in the book who has no draft yet");
  const pool = await poolLeadsByIds(ctx.ws, memberIds(actTeam), ids.filter((x) => UUID_RE.test(x)).slice(0, 50));
  if (!pool.length) return post(ctx, agent.id, `${MSG_COULDNT_MATCH}Pick them from the list, or tell me to reach everyone in the book.`);
  return runStage(ctx, agent, actTeam, "outreach", pool.map((l) => l.id), namesSummary(pool.map((l) => l.name)));
}

// ---- Routing ----

async function route(ctx: Ctx, intent: Intent, mentioned: ChatAgent | null): Promise<void> {
  if (intent.intent === "status") {
    const speaker = pickSpeaker(ctx.team, mentioned, ctx.thread);
    if (!speaker) return;
    return post(ctx, speaker.id, describeWork(await latestRealJob(ctx.ws, speaker.id)));
  }
  if (intent.intent === "chat" || intent.intent === "unknown") {
    const speaker = pickSpeaker(ctx.team, mentioned, ctx.thread);
    if (!speaker) return;
    return answerQuestion(ctx, speaker);
  }
  return routeCap(ctx, intent.intent, mentioned, intent);
}

async function routeCap(ctx: Ctx, cap: string, mentioned: ChatAgent | null, intent: Intent | null): Promise<void> {
  const r = resolve(cap, ctx.team, mentioned, ctx.world);
  if (r.kind !== "act") return post(ctx, r.speaker?.id ?? "system", r.text);
  for (const line of r.lines) await post(ctx, line.who, line.text);
  return act(ctx, r.agent, r.team, cap, intent);
}

async function act(ctx: Ctx, agent: ChatAgent, actTeam: ChatTeam, cap: string, intent: Intent | null): Promise<void> {
  if (cap === "scrape") {
    const products = await briefProducts(ctx.ws);
    const brief = intent ? briefFromIntent(intent, ctx.plain, products) : { asks: 0 };
    return continueSearch(ctx, agent, actTeam, brief, products);
  }
  if (cap === "outreach") {
    if (ctx.picks.length) return continueOutreach(ctx, agent, actTeam, ctx.picks.map((p) => p.id));
    if (intent) {
      const pool = (await poolLeadNames(ctx.ws, memberIds(actTeam))).filter((l) => l.review === "accepted");
      const res = await resolveLeads(ctx.plain, pool, ctx.ai);
      if (res.mode === "all") return continueOutreach(ctx, agent, actTeam, "all");
      if (res.mode === "some") return continueOutreach(ctx, agent, actTeam, res.leadIds);
    }
    const leads = await openOutreachLeads(ctx.ws, memberIds(actTeam));
    if (!leads.length) return post(ctx, agent.id, MSG_NO_OPEN_LEADS);
    return post(ctx, agent.id, outreachPickMessage(leads));
  }
  // research, qualify, match, assess, proposal: the named or picked leads, else the stage picks.
  let ids: string[] | undefined;
  let names: string[] = [];
  if (ctx.picks.length) {
    ids = ctx.picks.map((p) => p.id);
    names = ctx.picks.map((p) => p.name);
  } else if (intent) {
    const pool = await poolLeadNames(ctx.ws, memberIds(actTeam));
    const found = matchLeadNames(ctx.plain, pool);
    if (found.length) {
      ids = found;
      names = found.map((id) => pool.find((l) => l.id === id)?.name ?? "");
    }
  }
  const summary = ids?.length ? namesSummary(names) : cap === "assess" ? "the new leads waiting for review" : "the leads in the book that need it";
  return runStage(ctx, agent, actTeam, cap, ids, summary);
}

// "Understood. I'm {verb} now ({summary})." then the stage is queued (it
// posts its own ask or start message).
async function runStage(ctx: Ctx, agent: ChatAgent, actTeam: ChatTeam, cap: string, leadIds: string[] | undefined, summary: string): Promise<void> {
  if (!isPodStage(cap)) return post(ctx, agent.id, MSG_RUN_FAILED);
  await post(ctx, agent.id, ackText(cap, summary));
  const r = await enqueuePodStage(ctx.ws, ctx.accountId, { teamId: actTeam.id, agentId: agent.id, kind: cap, ...(leadIds?.length ? { leadIds } : {}) });
  if (!r.ok) return post(ctx, agent.id, r.error);
  if (r.follow) ctx.follow.push(r.follow);
}

// "yes" to an agent's offer: a wider search, or the offered action.
async function acceptOffer(ctx: Ctx, open: Extract<OpenQuestion, { kind: "offer" }>): Promise<void> {
  const agent = agentById(ctx, open.offer.agentId);
  if (!agent) return;
  if (open.offer.kind === "wider-search") {
    return continueSearch(ctx, agent, teamOfAgent(agent.id, ctx.team, ctx.world), { ...open.offer.brief });
  }
  return routeCap(ctx, open.offer.cap, agent, null);
}

// ---- Conversation ----

async function answerQuestion(ctx: Ctx, speaker: ChatAgent): Promise<void> {
  const facts = await loadTeamFacts(ctx.ws, ctx.team, ctx.plain);
  const text = await converse(
    { agent: speaker, team: ctx.team, history: ctx.thread, question: ctx.text, facts: formatTeamFacts(facts) },
    ctx.ai,
    factualAnswer(facts),
  );
  return post(ctx, speaker.id, text);
}

// The newest job of the agent that was not cancelled.
async function latestRealJob(ws: string, agentId: string): Promise<JobRow | null> {
  const jobs = await listAgentJobs(ws, agentId, 10);
  return jobs.find((j) => j.status !== "dismissed") ?? null;
}
