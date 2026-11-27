// An agent answers a question in the team chat, in character, from real team
// data (01-prd.md §7.4 "Converse"): persona with name, role, goal,
// capabilities and teammates; the last 10 messages; team facts (≤ 3000
// chars). 2–4 sentences, no emojis, and it ends with an offer when an action
// fits (⟦offer⟧ + the "Yes, go ahead" / "No, thanks" quick replies).
// The `ai` function is passed in, so tests never call Gemini.
import { capabilityLabel } from "@/lib/agentTypes";
import { SYSTEM_BASE, type AIJson } from "@/lib/ai/engine";
import { cleanField, fence } from "@/lib/ai/untrusted";
import type { ChatMessage } from "@/lib/types";
import { jsonMarker, repliesMarker, stripMarkers, type Offer } from "./markers";
import { firstName, isChatReady, type ChatAgent, type ChatTeam } from "./orchestrate";

export const HISTORY_TURNS = 10;
export const OFFER_REPLIES = ["Yes, go ahead", "No, thanks"];

export type ConverseInput = {
  agent: ChatAgent;
  team: ChatTeam;
  history: ChatMessage[]; // oldest first; the last 10 are used
  question: string;
  facts: string; // formatTeamFacts(), ≤ 3000 chars
  ownerName?: string;
};

const SCHEMA = {
  type: "object",
  properties: { reply: { type: "string" }, offer: { type: "string" } },
  required: ["reply", "offer"],
};

// Capabilities that can be offered: runnable ones somebody on the team has.
export function offerableCaps(team: ChatTeam): string[] {
  const out: string[] = [];
  for (const m of team.members) for (const c of m.capabilities) if (isChatReady(c) && !out.includes(c)) out.push(c);
  return out;
}

export function personaBlock(agent: ChatAgent, team: ChatTeam): string {
  const caps = agent.capabilities.map(capabilityLabel).join(", ") || "none";
  const mates = team.members
    .filter((m) => m.id !== agent.id)
    .map((m) => `${cleanField(m.name, 80)} (${cleanField(m.role, 60)}: ${m.capabilities.map(capabilityLabel).join(", ") || "no skills"})`);
  return [
    `You are ${cleanField(agent.name, 80)}, the ${cleanField(agent.role, 80)} on the sales team "${cleanField(team.name, 80)}".`,
    agent.goal ? `Your goal: ${cleanField(agent.goal, 400)}` : "",
    team.goal ? `The team's shared goal: ${cleanField(team.goal, 400)}` : "",
    `What you can do: ${caps}.`,
    mates.length ? `Your teammates: ${mates.join("; ")}.` : "You have no teammates on this team.",
  ]
    .filter(Boolean)
    .join("\n");
}

// The last 10 messages as "Name: text" lines, markers removed.
export function historyBlock(history: ChatMessage[], team: ChatTeam, ownerName = "Owner"): string {
  const name = (who: string) => (who === "me" ? ownerName : who === "system" ? "System" : (team.members.find((m) => m.id === who)?.name ?? "Agent"));
  return history
    .slice(-HISTORY_TURNS)
    .map((m) => `${cleanField(name(m.who), 80)}: ${cleanField(stripMarkers(m.text), 600)}`)
    .filter((l) => !l.endsWith(": "))
    .join("\n");
}

export function conversePrompt(input: ConverseInput, caps: string[]): string {
  return [
    personaBlock(input.agent, input.team),
    "Reply to the owner's latest message in character, as a member of their sales team.",
    "Rules: 2 to 4 short sentences. Plain text, no emojis, no lists, no markdown. Use only the facts below and the conversation; " +
      "if they don't answer the question, say so plainly. Never say you did work the facts don't show. Never invent leads, numbers or products.",
    `If one of these team actions would clearly help next (${caps.join(", ") || "none"}), set "offer" to that action id and make your last sentence a short yes/no question offering to do it. Otherwise set "offer" to "".`,
    "Team facts:",
    fence(input.facts || "(no data yet)"),
    "Conversation so far (oldest first):",
    fence(historyBlock(input.history, input.team, input.ownerName) || "(empty)"),
    "The owner's latest message:",
    fence(cleanField(stripMarkers(input.question), 2000)),
  ].join("\n\n");
}

// Removes emojis, marker brackets and extra spaces; keeps at most 4 sentences.
export function tidyReply(text: string): string {
  let t = String(text ?? "")
    .replace(/[⟦⟧]/g, "")
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/[*#_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [t];
  if (sentences.length > 4) t = sentences.slice(0, 4).join("").trim();
  return t.slice(0, 900);
}

// The offer marker for a capability: the speaker if it has it, else the
// first live teammate that does.
export function offerFor(cap: string, agent: ChatAgent, team: ChatTeam): Offer | null {
  if (!isChatReady(cap)) return null;
  const who = agent.capabilities.includes(cap) ? agent : (team.members.find((m) => m.capabilities.includes(cap) && !m.paused) ?? null);
  return who ? { kind: "action", cap, agentId: who.id } : null;
}

export function withOffer(text: string, offer: Offer | null): string {
  if (!offer) return text;
  return `${text}${jsonMarker("offer", offer)}${repliesMarker(OFFER_REPLIES)}`;
}

// The agent's answer, ready to post (with the offer markers when one fits).
// `fallback` is used when there is no AI or the call fails.
export async function converse(input: ConverseInput, ai: AIJson | null, fallback: string): Promise<string> {
  if (!ai) return fallback;
  const caps = offerableCaps(input.team);
  try {
    const r = await ai<{ reply?: unknown; offer?: unknown }>(SYSTEM_BASE, conversePrompt(input, caps), SCHEMA, { temperature: 0.5, maxTokens: 400 });
    const reply = tidyReply(typeof r?.reply === "string" ? r.reply : "");
    if (!reply) return fallback;
    const cap = typeof r?.offer === "string" && caps.includes(r.offer) ? r.offer : "";
    const offer = cap ? offerFor(cap, input.agent, input.team) : null;
    // The offer needs a question to say yes to.
    if (offer && !reply.trim().endsWith("?")) {
      const who = offer.agentId === input.agent.id ? "me" : `@${firstName(input.team.members.find((m) => m.id === offer.agentId)?.name ?? "")}`;
      return withOffer(`${reply} Want ${who} to start on ${capabilityLabel(cap).toLowerCase()}?`, offer);
    }
    return withOffer(reply, offer);
  } catch (e) {
    console.error("converse failed", e instanceof Error ? e.message : e);
    return fallback;
  }
}
