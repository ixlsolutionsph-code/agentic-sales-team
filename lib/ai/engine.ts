// Shared parts of the AI engines (01-prd.md §7.6). Engines are pure: they get
// their inputs and an `ai` function, and return a result. The runner writes it.
import { LEAD_FIELD_LIMITS, UNTRUSTED_RULE, cleanField, fence, sanitizeText } from "./untrusted";

// The JSON call the engines use. null = no AI key (use the fallback).
export type AIJson = <T>(system: string, prompt: string, schema: Record<string, unknown>, opts: { temperature: number; maxTokens: number }) => Promise<T>;

export type EngineAgent = { name: string; role: string; goal: string };
export type EngineResearch = { summary: string; priorities: string[]; hooks: string[]; angle: string };
export type EngineLead = {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  platform: string | null;
  fitReason: string;
  research: EngineResearch | null;
};
export type EngineProduct = { id: string; name: string; description: string; price: string; category: string };

export const SYSTEM_BASE = `You work for a small business as one of its AI sales agents. Be accurate and plain. ${UNTRUSTED_RULE}`;

// The lead, cleaned and fenced, as the prompt sees it.
export function leadBlock(l: EngineLead): string {
  const lines = [
    `Name: ${cleanField(l.name, LEAD_FIELD_LIMITS.name)}`,
    `Title: ${cleanField(l.title, LEAD_FIELD_LIMITS.title) || "unknown"}`,
    `Company: ${cleanField(l.company, LEAD_FIELD_LIMITS.company) || "unknown"}`,
    `Contact: ${l.email ? "email" : l.platform ? `${l.platform} message` : "unknown"}`,
  ];
  if (l.fitReason) lines.push(`Why they may fit: ${cleanField(l.fitReason, LEAD_FIELD_LIMITS.fit)}`);
  if (l.research?.summary) {
    lines.push(`Research summary: ${cleanField(l.research.summary, 800)}`);
    if (l.research.angle) lines.push(`Best angle: ${cleanField(l.research.angle, 300)}`);
    if (l.research.priorities?.length) lines.push(`Priorities: ${l.research.priorities.map((p) => cleanField(p, 160)).join("; ")}`);
  }
  return fence(lines.join("\n"));
}

export function agentBlock(a: EngineAgent): string {
  return `You are ${cleanField(a.name, 120)}, a ${cleanField(a.role, 80)}.${a.goal ? ` Your goal: ${cleanField(a.goal, 500)}` : ""}`;
}

export function productsBlock(list: EngineProduct[]): string {
  if (!list.length) return "(no products)";
  return fence(
    list
      .map((p) => `[${p.id}] ${cleanField(p.name, 200)} | ${cleanField(p.category, 80) || "-"} | ${cleanField(p.price, 60) || "price on request"} | ${cleanField(p.description, 400)}`)
      .join("\n"),
  );
}

export function firstNameOf(name: string): string {
  return cleanField(name, 120).split(" ")[0] ?? "";
}

export const clampScore = (n: unknown, min = 0, max = 100) => {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : min;
};

export const str = (v: unknown, max: number) => sanitizeText(typeof v === "string" ? v : "").trim().slice(0, max);
export const strList = (v: unknown, n: number, max: number) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : [];

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
