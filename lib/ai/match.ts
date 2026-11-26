// Match: which of the catalog's products really fit this lead (01-prd.md §7.6).
// Temperature 0.3, 900 tokens, up to 8 products. Only real fits, never forced.
// No AI: null (the lead is left for a later run).
import { SYSTEM_BASE, agentBlock, clampScore, leadBlock, productsBlock, str, type AIJson, type EngineAgent, type EngineLead, type EngineProduct } from "./engine";

export type ProductMatch = { productId: string; score: number; reason: string };
export const MATCH_PRODUCTS = 8;
export const MIN_MATCH_SCORE = 50;

const SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: { productId: { type: "string" }, score: { type: "integer" }, reason: { type: "string" } },
        required: ["productId", "score", "reason"],
      },
    },
  },
  required: ["matches"],
};

// Keeps only products that were offered, once each, scoring 50 or more, best first.
export function cleanMatches(raw: unknown, offered: EngineProduct[]): ProductMatch[] {
  const ids = new Set(offered.map((p) => p.id));
  const seen = new Set<string>();
  const list = Array.isArray(raw) ? raw : [];
  const out: ProductMatch[] = [];
  for (const m of list) {
    const id = typeof m?.productId === "string" ? m.productId.trim() : "";
    if (!ids.has(id) || seen.has(id)) continue;
    const score = clampScore(m?.score, 0, 100);
    if (score < MIN_MATCH_SCORE) continue;
    seen.add(id);
    out.push({ productId: id, score, reason: str(m?.reason, 300) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function matchLead(lead: EngineLead, agent: EngineAgent, products: EngineProduct[], ai: AIJson | null): Promise<ProductMatch[] | null> {
  if (!ai) return null;
  const offered = products.slice(0, MATCH_PRODUCTS);
  if (!offered.length) return [];
  const prompt = [
    agentBlock(agent),
    "Which of our products are a real fit for this lead? Only list real fits; an empty list is a good answer when nothing fits. Never force a match.",
    "For each fit give the product id exactly as shown in brackets, a 1–100 fit score, and a one-line reason.",
    "Lead:",
    leadBlock(lead),
    "Our products ([id] name | category | price | description):",
    productsBlock(offered),
  ].join("\n\n");
  const r = await ai<{ matches?: unknown }>(SYSTEM_BASE, prompt, SCHEMA, { temperature: 0.3, maxTokens: 900 });
  return cleanMatches(r?.matches, offered);
}
