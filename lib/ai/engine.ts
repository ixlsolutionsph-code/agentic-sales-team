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

// The owner reviews and sends every message from their own mail, so the
// writing is in the voice of a member of their team: it never mentions AI,
// automation or "agents" (the owner's choice, 2026-11-26).
export const SYSTEM_BASE =
  "You work on the sales team of a small business. Be accurate and plain. " +
  "In anything written for a lead (emails, messages, proposals), write as a member of the team: " +
  `never mention AI, automation, bots or being an agent. ${UNTRUSTED_RULE}`;

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

const SIGN_OFF = /(?<=\S)\s+(Sincerely|Kind regards|Best regards|Warm regards|Regards|Respectfully|Yours sincerely),[ \t]*(?=\S)/;
// Words ending in "." that don't end a sentence.
const NOT_AN_END = /\b(Dr|Mr|Mrs|Ms|Prof|Inc|Co|Corp|Ltd|St|Jr|Sr|No|vs|e\.g|i\.e)\.$/i;

// Splits one long block into paragraphs of about 3 sentences.
export function toParagraphs(text: string, perParagraph = 3): string {
  if (/\n\s*\n/.test(text)) return text; // already has paragraphs
  const parts = text.split(/(?<=[.?])\s+(?=[A-Z"“(])/);
  const sentences: string[] = [];
  for (const p of parts) {
    if (sentences.length && NOT_AN_END.test(sentences[sentences.length - 1])) sentences[sentences.length - 1] += ` ${p}`;
    else sentences.push(p);
  }
  if (sentences.length <= perParagraph + 1) return text;
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) out.push(sentences.slice(i, i + perParagraph).join(" "));
  return out.join("\n\n");
}

// Lays out a letter: "Dear …," on its own line, the body in short
// paragraphs, the sign-off and name on their own lines. Adds the greeting
// and signature when they are missing.
export function layoutLetter(body: string, firstName: string, signer: string): string {
  let b = body.replace(/[ \t]+\n/g, "\n").trim();
  b = b.replace(/^(Dear [^,\n]{1,60},)[ \t]*(?=\S)/i, "$1\n\n");
  b = b.replace(SIGN_OFF, "\n\n$1,\n");
  if (!/^dear\b/i.test(b)) b = `Dear ${firstName || "Sir or Madam"},\n\n${b}`;
  // The name goes right under the sign-off, with no blank line between.
  b = b.replace(/\b(Sincerely|Kind regards|Best regards|Warm regards|Regards|Respectfully|Yours sincerely),[ \t]*\n\s*\n(?=\S)/i, "$1,\n");
  if (!b.slice(-120).includes(signer)) b = `${b}\n\nKind regards,\n${signer}`;
  // Paragraphs for the middle part only.
  const m = b.match(/^(Dear [^\n]*\n\n)([\s\S]*?)(\n\n(?:Sincerely|Kind regards|Best regards|Warm regards|Regards|Respectfully|Yours sincerely),\n[\s\S]*)?$/i);
  if (m) b = `${m[1]}${toParagraphs(m[2].trim())}${m[3] ?? ""}`;
  return b.replace(/\n{3,}/g, "\n\n").trim();
}
