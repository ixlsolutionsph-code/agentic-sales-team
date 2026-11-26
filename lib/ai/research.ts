// Research: a short brief on the lead (01-prd.md §7.6). Temperature 0.6, 700 tokens.
import { SYSTEM_BASE, agentBlock, leadBlock, str, strList, type AIJson, type EngineAgent, type EngineLead, type EngineResearch } from "./engine";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    priorities: { type: "array", items: { type: "string" } },
    hooks: { type: "array", items: { type: "string" } },
    angle: { type: "string" },
  },
  required: ["summary", "priorities", "hooks", "angle"],
};

export const PLACEHOLDER_PREFIX = "Placeholder brief (AI was not available):";

export function researchFallback(lead: EngineLead): EngineResearch {
  const who = [lead.name, lead.title, lead.company ? `at ${lead.company}` : ""].filter(Boolean).join(", ").replace(", at", " at");
  return { summary: `${PLACEHOLDER_PREFIX} ${who}.`, priorities: [], hooks: [], angle: "" };
}

export async function researchLead(lead: EngineLead, agent: EngineAgent, ai: AIJson | null): Promise<EngineResearch> {
  if (!ai) return researchFallback(lead);
  const prompt = [
    agentBlock(agent),
    "Write a short research brief on this lead, from what the details say and what is generally true for their role and kind of business.",
    "Do not invent specific facts about the person or company (no made-up numbers, events or names).",
    "summary: 2–3 sentences. priorities: 2–4 likely business priorities. hooks: 1–3 conversation openers. angle: one sentence on the best way to approach them.",
    "Lead:",
    leadBlock(lead),
  ].join("\n\n");
  const r = await ai<Record<string, unknown>>(SYSTEM_BASE, prompt, SCHEMA, { temperature: 0.6, maxTokens: 700 });
  const summary = str(r?.summary, 800);
  if (!summary) throw new Error("research: empty summary");
  return {
    summary,
    priorities: strList(r?.priorities, 4, 200),
    hooks: strList(r?.hooks, 3, 200),
    angle: str(r?.angle, 300),
  };
}
