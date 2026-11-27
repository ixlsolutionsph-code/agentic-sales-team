// The gate (01-prd.md §7.3): a quick check of each search result with a
// light model, to drop sellers, job seekers and competitors before the leads
// are picked. Temperature 0, at most 8 s per call, 16 at a time, 10 s in all.
// It fails open: an error, a slow answer or no AI keeps the result.
import { UNTRUSTED_RULE, cleanField, fence } from "@/lib/ai/untrusted";
import { AGENCY_RULE, JOB_AD_RULE } from "./rules";
import type { SearchMode, Source } from "./firecrawl";

// gemini-2.5-flash-lite (the model in the plan) is closed to new users;
// Google points to this one instead (checked 2026-11-27).
export const GATE_MODEL = "gemini-3.5-flash-lite";
export const GATE_CALL_MS = 8_000;
export const GATE_CONCURRENCY = 16;
export const GATE_BUDGET_MS = 10_000;

export type GateVerdict = { kind: "buyer" | "seller" | "job_seeker" | "other"; competitor: boolean };
export type GateAI = (system: string, prompt: string, schema: Record<string, unknown>) => Promise<unknown>;
export type Dropped = { source: Source; why: string };

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["buyer", "seller", "job_seeker", "other"] },
    competitor: { type: "boolean" },
  },
  required: ["kind", "competitor"],
};

function prompt(s: Source, instruction: string): string {
  return [
    "What we look for and sell:",
    fence(cleanField(instruction, 400)),
    "One search result:",
    fence(`Title: ${s.title}\nSnippet: ${s.description}\nLink: ${s.url}`),
    'kind: "buyer" if the author or company needs what we sell, "seller" if they offer or advertise it, "job_seeker" if they look for a job, otherwise "other".',
    JOB_AD_RULE,
    AGENCY_RULE,
    "competitor: true only if this company clearly sells the same product or service that we sell. " +
      "A company of the kind we are looking for is never a competitor, and when we don't say what we sell, competitor is false.",
  ].join("\n\n");
}

// Why a verdict drops a result, or null to keep it. Intent mode drops
// sellers and job seekers; fit mode drops competitors.
export function dropReason(v: unknown, mode: SearchMode): string | null {
  const x = v as Partial<GateVerdict> | null;
  if (mode === "intent") {
    if (x?.kind === "seller") return "Seller";
    if (x?.kind === "job_seeker") return "Job seeker";
    return null;
  }
  return x?.competitor === true ? "Competitor" : null;
}

function within<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<undefined>((r) => (t = setTimeout(() => r(undefined), ms)))]).finally(() => clearTimeout(t));
}

export async function gateSources(
  sources: Source[],
  mode: SearchMode,
  instruction: string,
  ai: GateAI | null,
  limits = { callMs: GATE_CALL_MS, budgetMs: GATE_BUDGET_MS, concurrency: GATE_CONCURRENCY },
): Promise<{ kept: Source[]; dropped: Dropped[] }> {
  if (!ai || !sources.length) return { kept: sources, dropped: [] };
  const why: (string | null)[] = sources.map(() => null);
  const system = `You sort search results for a sales team. ${UNTRUSTED_RULE}`;
  let next = 0;
  async function worker() {
    while (next < sources.length) {
      const i = next++;
      try {
        const v = await within(ai!(system, prompt(sources[i], instruction), SCHEMA), limits.callMs);
        why[i] = v === undefined ? null : dropReason(v, mode);
      } catch {
        why[i] = null; // fail open
      }
    }
  }
  const workers = Array.from({ length: Math.min(limits.concurrency, sources.length) }, worker);
  // After the budget, whatever is not checked yet is kept.
  await within(Promise.all(workers), limits.budgetMs);
  next = sources.length;
  const kept: Source[] = [];
  const dropped: Dropped[] = [];
  sources.forEach((s, i) => (why[i] ? dropped.push({ source: s, why: why[i]! }) : kept.push(s)));
  return { kept, dropped };
}
