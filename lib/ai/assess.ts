// Assess: accept or dismiss a found lead against the agent and team goal
// (01-prd.md §7.6). Temperature 0.2, 300 tokens. **Fails open**: without AI
// or on any error the lead is accepted at score 50, and its fit reason is
// left as it was (reason = null).
import { cleanField } from "./untrusted";
import { SYSTEM_BASE, agentBlock, clampScore, leadBlock, str, type AIJson, type EngineAgent, type EngineLead } from "./engine";

export type AssessResult = { accept: boolean; score: number; reason: string | null; failedOpen: boolean };

const SCHEMA = {
  type: "object",
  properties: { accept: { type: "boolean" }, score: { type: "integer" }, reason: { type: "string" } },
  required: ["accept", "score", "reason"],
};

export const FAIL_OPEN: AssessResult = { accept: true, score: 50, reason: null, failedOpen: true };

export async function assessLead(lead: EngineLead, agent: EngineAgent, teamGoal: string, ai: AIJson | null): Promise<AssessResult> {
  if (!ai) return FAIL_OPEN;
  try {
    const prompt = [
      agentBlock(agent),
      teamGoal ? `The team's shared goal: ${cleanField(teamGoal, 500)}` : "",
      "Decide whether this lead is a real potential buyer for us. Accept real fits; dismiss sellers, job seekers, competitors and anyone unrelated.",
      "score: 1–100 fit. reason: one line under 20 words.",
      "Lead:",
      leadBlock(lead),
    ]
      .filter(Boolean)
      .join("\n\n");
    const r = await ai<Record<string, unknown>>(SYSTEM_BASE, prompt, SCHEMA, { temperature: 0.2, maxTokens: 300 });
    if (typeof r?.accept !== "boolean") return FAIL_OPEN;
    const reason = str(r.reason, 300).split(/\s+/).slice(0, 20).join(" ");
    return { accept: r.accept, score: clampScore(r.score, 1, 100), reason: reason || null, failedOpen: false };
  } catch (e) {
    console.error("assess failed open", e instanceof Error ? e.message : e);
    return FAIL_OPEN;
  }
}
