// Which of the team's leads a chat message names (01-prd.md §7.6
// "resolveLeads"): all, some or none. Name matching first; the LLM
// (temperature 0.15, 300 tokens) only when the message seems to name someone
// that plain matching didn't find.
import { isEveryone } from "@/lib/chat/outreachTarget";
import { SYSTEM_BASE, type AIJson } from "./engine";
import { cleanField, fence } from "./untrusted";

export type ResolveLead = { id: string; name: string; company?: string };
export type Resolved = { mode: "all" | "some" | "none"; leadIds: string[] };

const norm = (s: string) =>
  ` ${String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;

// Leads whose full name, «pill» or (unique) first name is in the text.
export function matchLeadNames(text: string, leads: ResolveLead[]): string[] {
  const t = norm(text);
  const out: string[] = [];
  const add = (id: string) => {
    if (!out.includes(id)) out.push(id);
  };
  // Pills: «Name»
  for (const m of String(text ?? "").matchAll(/«([^»]{1,120})»/g)) {
    const n = norm(m[1]);
    for (const l of leads) if (norm(l.name) === n) add(l.id);
  }
  for (const l of leads) {
    const full = norm(l.name);
    if (full.trim().length >= 3 && full.trim().includes(" ") && t.includes(full)) add(l.id);
  }
  // First names, only when exactly one lead has that first name.
  const byFirst = new Map<string, ResolveLead[]>();
  for (const l of leads) {
    const first = norm(l.name).trim().split(" ")[0];
    if (first && first.length >= 3) byFirst.set(first, [...(byFirst.get(first) ?? []), l]);
  }
  for (const [first, list] of byFirst) {
    if (list.length === 1 && t.includes(` ${first} `) && !STOP.has(first)) add(list[0].id);
  }
  return out;
}

// Words that are also common first names or words in requests.
const STOP = new Set(["will", "may", "june", "april", "mark", "bill", "grace", "hope", "joy", "the", "and", "all", "new", "best", "top"]);

const SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["all", "some", "none"] },
    leadIds: { type: "array", items: { type: "string" } },
  },
  required: ["mode", "leadIds"],
};

// Does the text seem to name a person ("write to Ana", "email Dr. Reyes")?
function seemsToName(text: string): boolean {
  return /\b(to|with|for|email|message|contact|write|research|qualify)\s+(dr\.?\s+|mr\.?\s+|ms\.?\s+|mrs\.?\s+)?[A-Z][\p{L}'-]+/u.test(text);
}

export async function resolveLeads(text: string, leads: ResolveLead[], ai: AIJson | null): Promise<Resolved> {
  if (isEveryone(text)) return { mode: "all", leadIds: [] };
  const named = matchLeadNames(text, leads);
  if (named.length) return { mode: "some", leadIds: named };
  if (!ai || !leads.length || !seemsToName(text)) return { mode: "none", leadIds: [] };
  const list = leads.slice(0, 200);
  const prompt = [
    "The owner of a small business wrote a chat message to their sales team. Decide which of the leads below the message means.",
    'mode "all": every lead. "some": only the leads it names (return their ids). "none": it names no lead.',
    "Only return ids from the list. Never guess.",
    "Message:",
    fence(cleanField(text, 1000)),
    "Leads (id | name | company):",
    fence(list.map((l) => `${l.id} | ${cleanField(l.name, 120)} | ${cleanField(l.company ?? "", 120)}`).join("\n")),
  ].join("\n\n");
  try {
    const r = await ai<{ mode?: unknown; leadIds?: unknown }>(SYSTEM_BASE, prompt, SCHEMA, { temperature: 0.15, maxTokens: 300 });
    const ids = new Set(list.map((l) => l.id));
    const picked = Array.isArray(r?.leadIds) ? [...new Set(r.leadIds.filter((x): x is string => typeof x === "string" && ids.has(x)))] : [];
    if (r?.mode === "all") return { mode: "all", leadIds: [] };
    if (picked.length) return { mode: "some", leadIds: picked };
    return { mode: "none", leadIds: [] };
  } catch (e) {
    console.error("resolveLeads failed", e instanceof Error ? e.message : e);
    return { mode: "none", leadIds: [] };
  }
}
