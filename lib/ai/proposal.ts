// Proposal: 150–250 words with 2–4 offerings from the catalog, each with its
// name and price (01-prd.md §7.6). Temperature 0.5, 900 tokens, up to 5
// products. Never invents products or prices. No AI: lists the catalog.
import { SYSTEM_BASE, agentBlock, firstNameOf, leadBlock, productsBlock, str, type AIJson, type EngineAgent, type EngineLead, type EngineProduct } from "./engine";

export type ProposalResult = { title: string; body: string; productsUsed: string[] };
export const PROPOSAL_PRODUCTS = 5;

const SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, body: { type: "string" }, productsUsed: { type: "array", items: { type: "string" } } },
  required: ["title", "body", "productsUsed"],
};

// Keeps only names of products that were offered (compared without case), once each.
export function cleanProductsUsed(raw: unknown, offered: EngineProduct[]): string[] {
  const byLower = new Map(offered.map((p) => [p.name.trim().toLowerCase(), p.name]));
  const out: string[] = [];
  for (const n of Array.isArray(raw) ? raw : []) {
    const hit = typeof n === "string" ? byLower.get(n.trim().toLowerCase()) : undefined;
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export function proposalFallback(lead: EngineLead, agent: EngineAgent, products: EngineProduct[]): ProposalResult {
  const list = products.slice(0, PROPOSAL_PRODUCTS);
  const lines = list.map((p) => `- ${p.name}${p.price ? ` (${p.price})` : ""}${p.description ? `: ${p.description}` : ""}`);
  return {
    title: `Proposal for ${lead.company || lead.name}`,
    body: `[Catalog list: AI was not available. Please edit before sending.]\n\nDear ${firstNameOf(lead.name) || "Sir or Madam"},\n\nHere are the services we can offer:\n\n${lines.join("\n")}\n\nKind regards,\n${agent.name}`,
    productsUsed: list.map((p) => p.name),
  };
}

export async function draftProposal(lead: EngineLead, agent: EngineAgent, products: EngineProduct[], ai: AIJson | null): Promise<ProposalResult> {
  const offered = products.slice(0, PROPOSAL_PRODUCTS);
  if (!ai) return proposalFallback(lead, agent, offered);
  const prompt = [
    agentBlock(agent),
    `Write a short sales proposal for ${lead.name}${lead.company ? ` at ${lead.company}` : ""}. 150 to 250 words, plain text, formal.`,
    "Offer 2 to 4 of the products below that fit best, each by its exact name and with its exact price as listed. Never invent products, prices or features.",
    "title: a short proposal title. productsUsed: the exact names of the products you offered.",
    "Lead:",
    leadBlock(lead),
    "Our products ([id] name | category | price | description):",
    productsBlock(offered),
  ].join("\n\n");
  const r = await ai<Record<string, unknown>>(SYSTEM_BASE, prompt, SCHEMA, { temperature: 0.5, maxTokens: 900 });
  const body = str(r?.body, 4000);
  if (!body) throw new Error("proposal: empty body");
  return {
    title: str(r?.title, 160) || `Proposal for ${lead.company || lead.name}`,
    body,
    productsUsed: cleanProductsUsed(r?.productsUsed, offered),
  };
}
