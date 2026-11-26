// Qualify: a 1–100 score with a tier and a reason (01-prd.md §7.6). Temperature 0.3, 300 tokens.
import { leadTier } from "@/lib/leads/types";
import { SYSTEM_BASE, agentBlock, clampScore, leadBlock, str, type AIJson, type EngineAgent, type EngineLead } from "./engine";

export type QualifyResult = { score: number; tier: "Hot" | "Warm" | "Cold"; reason: string };

const SCHEMA = {
  type: "object",
  properties: { score: { type: "integer" }, tier: { type: "string" }, reason: { type: "string" } },
  required: ["score", "tier", "reason"],
};

const tierOf = (score: number) => leadTier(score) ?? "Cold";

// No AI: 60 with an email, else 45.
export function qualifyFallback(lead: EngineLead): QualifyResult {
  const score = lead.email ? 60 : 45;
  return { score, tier: tierOf(score), reason: lead.email ? "Scored without AI: has an email address." : "Scored without AI: no email address." };
}

export async function qualifyLead(lead: EngineLead, agent: EngineAgent, ai: AIJson | null): Promise<QualifyResult> {
  if (!ai) return qualifyFallback(lead);
  const prompt = [
    agentBlock(agent),
    "Score how likely this lead is to buy from us, from 1 (very unlikely) to 100 (ready to buy).",
    "Hot is 75 or more, Warm is 50 to 74, Cold is below 50. Give one short sentence as the reason.",
    "Lead:",
    leadBlock(lead),
  ].join("\n\n");
  const r = await ai<Record<string, unknown>>(SYSTEM_BASE, prompt, SCHEMA, { temperature: 0.3, maxTokens: 300 });
  const score = clampScore(r?.score, 1, 100);
  return { score, tier: tierOf(score), reason: str(r?.reason, 300) || "No reason given." };
}
