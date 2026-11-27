import "server-only";
import { sql } from "drizzle-orm";
import type { AIJson } from "@/lib/ai/engine";
import { aiJSON, isAIConfigured } from "@/lib/ai/gemini";
import { requireDb } from "@/lib/db";
import { knownLeadKeys } from "@/lib/leads/store";
import {
  FirecrawlError,
  buildSearches,
  extractProspects,
  fallbackPlan,
  normalizeProspects,
  planSearch,
  prospectsWithoutAI,
  runSearches,
  urlKey,
  type Prospect,
  type SearchPlan,
} from "@/lib/scrape/firecrawl";
import { GATE_CALL_MS, GATE_MODEL, gateSources, type GateAI } from "@/lib/scrape/gate";
import { createStepLog, type StepItem } from "@/lib/scrape/steps";
import { loadRunAgent, poolOf } from "./context";
import { UserFacingError, userMessage } from "./errors";
import {
  MSG_AGENT_UNAVAILABLE,
  MSG_NO_SEARCH_KEY,
  MSG_SEARCH_DOWN,
  MSG_SEARCH_FAILED,
  MSG_SEARCH_NEEDS_TEXT,
  MSG_SEARCH_NO_CREDITS,
  SCRAPE_DEADLINE_MS,
  SEARCH_TARGET,
  msgCantRun,
} from "./limits";
import { DeadlineError, budget, withDeadline } from "./runtime";
import { claimJobById, claimNextJob, finishJob, reapStaleJobs, writeSteps, type JobRow } from "./store";

// The lead search runner (01-prd.md §7.3): plan → search → gate → extract →
// save, with each step written to the live timeline. 45 s in all.

type Row = Record<string, unknown>;
const PLAN_MS = 8_000;
const SAVE_RESERVE_MS = 3_000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function isSearchConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

function searchKey(): string {
  const k = process.env.FIRECRAWL_API_KEY?.trim();
  if (!k) throw new UserFacingError(MSG_NO_SEARCH_KEY);
  return k;
}

// Who owns the leads a search saves. From the agent page it is the Scout
// itself; the leads are then in the pool of every team the Scout is on.
export function leadOwnerForTeam(scoutId: string): string {
  return scoutId;
}

// A Firecrawl failure, in words the owner can act on.
function searchError(e: unknown): UserFacingError {
  if (e instanceof FirecrawlError) {
    if (e.status === 401 || e.status === 403) return new UserFacingError("The Firecrawl API key was refused. Ask your admin to check it.");
    if (e.status === 402) return new UserFacingError(MSG_SEARCH_NO_CREDITS);
  }
  return new UserFacingError(MSG_SEARCH_DOWN);
}

// Saves new leads as pending, skipping any whose link or email the team
// already has, up to the target. Returns the saved lead ids.
export async function addScrapedLeads(
  workspaceId: string,
  owner: { id: string; name: string },
  prospects: Prospect[],
  poolAgentIds: string[],
  target: number,
): Promise<{ ids: string[]; names: { name: string; fit: string }[]; skipped: number }> {
  const known = await knownLeadKeys(workspaceId, poolAgentIds);
  const knownUrls = new Set([...known.urls].map(urlKey));
  const fresh: Prospect[] = [];
  let skipped = 0;
  for (const p of prospects) {
    if (fresh.length >= target) break;
    if (knownUrls.has(urlKey(p.profileUrl)) || (p.email && known.emails.has(p.email.toLowerCase()))) {
      skipped++;
      continue;
    }
    fresh.push(p);
  }
  if (!fresh.length) return { ids: [], names: [], skipped };
  const db = requireDb();
  const pool = JSON.stringify(poolAgentIds);
  const r = await db.execute(sql`
    INSERT INTO leads (user_id, agent_id, name, title, company, email, status, score, source, review, profile_url, platform, fit_reason)
    SELECT ${workspaceId}::uuid, ${owner.id}, x.name, x.title, x.company, x.email, 'new', 0, 'scrape', 'pending', x.url, x.platform, x.fit
    FROM jsonb_to_recordset(${JSON.stringify(
      fresh.map((p) => ({ name: p.name, title: p.title, company: p.company, email: p.email, url: p.profileUrl, platform: p.platform, fit: p.fitReason })),
    )}::jsonb) AS x(name text, title text, company text, email text, url text, platform text, fit text)
    WHERE EXISTS (SELECT 1 FROM agents WHERE user_id = ${workspaceId}::uuid AND id = ${owner.id})
      AND NOT EXISTS (
        SELECT 1 FROM leads l
        WHERE l.user_id = ${workspaceId}::uuid
          AND l.agent_id IN (SELECT jsonb_array_elements_text(${pool}::jsonb))
          AND (l.profile_url = x.url OR (x.email <> '' AND lower(l.email) = lower(x.email)))
      )
    RETURNING id, name, fit_reason`);
  const rows = r.rows as Row[];
  if (rows.length) {
    await db.execute(sql`
      INSERT INTO activity (user_id, agent_id, type, lead_id, text)
      VALUES (${workspaceId}::uuid, ${owner.id}, 'lead_added', NULL, ${`${owner.name} found ${plural(rows.length, "new lead")}`})`);
  }
  return { ids: rows.map((x) => String(x.id)), names: rows.map((x) => ({ name: String(x.name), fit: String(x.fit_reason ?? "") })), skipped: skipped + fresh.length - rows.length };
}

const planAI: AIJson = (system, prompt, schema, opts) => aiJSON(system, prompt, schema, { ...opts, timeoutMs: PLAN_MS });
const gateAI: GateAI = (system, prompt, schema) => aiJSON(system, prompt, schema, { model: GATE_MODEL, temperature: 0, maxTokens: 60, timeoutMs: GATE_CALL_MS });

function modeText(plan: SearchPlan): string {
  if (plan.mode === "fit") return "LinkedIn people and companies";
  const where = plan.platform === "facebook" ? "Facebook" : plan.platform === "reddit" ? "Reddit" : "Facebook and Reddit";
  return `Recent posts on ${where}`;
}

export async function runScrapeJob(job: JobRow): Promise<void> {
  const clock = budget(Date.now());
  const log = createStepLog((steps) => writeSteps(job.id, steps));
  const counts = { sources: 0, dropped: 0, leadsFound: 0 };
  let leadIds: string[] = [];
  let stopped = false;

  async function work() {
    const agent = await loadRunAgent(job.workspaceId, job.agentId);
    if (!agent || agent.paused || agent.removed) throw new UserFacingError(MSG_AGENT_UNAVAILABLE);
    if (!agent.capabilities.includes("scrape")) throw new UserFacingError(msgCantRun("scrape"));
    const instruction = (job.params.instruction ?? "").trim();
    if (!instruction) throw new UserFacingError(MSG_SEARCH_NEEDS_TEXT);
    const key = searchKey();
    const target = Math.min(SEARCH_TARGET.max, Math.max(SEARCH_TARGET.min, Math.floor(Number(job.params.target) || SEARCH_TARGET.default)));
    const useAI = isAIConfigured();
    const fullInstruction = agent.goal ? `${instruction}. Our goal: ${agent.goal}` : instruction;

    // 1. Plan
    log.set({ id: "plan", status: "active", label: "Planning the search" });
    let plan: SearchPlan;
    try {
      plan = await planSearch(fullInstruction, useAI ? planAI : null);
    } catch (e) {
      console.error(`scrape ${job.id}: plan failed, using the simple plan`, e instanceof Error ? e.message : e);
      plan = fallbackPlan(instruction);
    }
    const searches = buildSearches(plan, target);
    log.set({ id: "plan", status: "done", label: `Planned ${plural(searches.length, "search", "searches")}`, detail: `${modeText(plan)}: ${plan.queries.join(" · ")}` });

    // 2. Search
    log.set({ id: "search", status: "active", label: "Searching the web" });
    let sources;
    try {
      sources = await runSearches(searches, key);
    } catch (e) {
      console.error(`scrape ${job.id}: search failed`, e instanceof Error ? e.message : e);
      throw searchError(e);
    }
    counts.sources = sources.length;
    log.set({
      id: "search",
      status: "done",
      label: `Found ${plural(sources.length, "source")}`,
      items: sources.map((s): StepItem => ({ title: s.title || s.url, meta: s.platform, url: s.url, kind: "source" })),
    });

    // 3. Gate
    log.set({ id: "gate", status: "active", label: "Checking each source" });
    const { kept, dropped } = await gateSources(sources, plan.mode, fullInstruction, useAI ? gateAI : null);
    counts.dropped = dropped.length;
    log.set({
      id: "gate",
      status: "done",
      label: `Kept ${kept.length} · dropped ${dropped.length}`,
      items: dropped.map((d): StepItem => ({ title: d.source.title || d.source.url, meta: d.why, url: d.source.url, kind: "dropped" })),
    });

    // 4. Extract
    log.set({ id: "extract", status: "active", label: "Picking leads" });
    // People the team already has are left out, so the picks are new ones.
    const pool = await poolOf(job.workspaceId, job.agentId);
    const known = await knownLeadKeys(job.workspaceId, pool.agentIds);
    const knownUrls = new Set([...known.urls].map(urlKey));
    const fresh = kept.filter((src) => !knownUrls.has(urlKey(src.url)));
    let prospects: Prospect[];
    if (useAI) {
      const left = Math.max(5_000, SCRAPE_DEADLINE_MS - clock.elapsed() - SAVE_RESERVE_MS);
      const extractAI: AIJson = (system, prompt, schema, opts) => aiJSON(system, prompt, schema, { ...opts, timeoutMs: left });
      const { raw, used } = await extractProspects(fullInstruction, plan, fresh, target, extractAI);
      prospects = normalizeProspects(raw, used, target + 5);
    } else {
      prospects = prospectsWithoutAI(fresh, instruction, target);
    }
    log.set({
      id: "extract",
      status: "done",
      label: `Picked ${plural(prospects.length, "lead")}`,
      items: prospects.map((p): StepItem => ({ title: p.name, meta: p.fitReason || p.company || undefined, url: p.profileUrl, kind: "done" })),
    });

    // 5. Save
    if (stopped) return;
    log.set({ id: "save", status: "active", label: "Saving leads" });
    const saved = await addScrapedLeads(job.workspaceId, { id: leadOwnerForTeam(agent.id), name: agent.name }, prospects, pool.agentIds, target);
    leadIds = saved.ids;
    counts.leadsFound = saved.ids.length;
    log.set({
      id: "save",
      status: "done",
      label: saved.ids.length ? `Saved ${plural(saved.ids.length, "new lead")}` : "No new leads to save",
      detail:
        saved.ids.length < target
          ? `You asked for ${target}. This search found no more new people who fit. Try a wider search for more.`
          : undefined,
      items: saved.names.map((n): StepItem => ({ title: n.name, meta: n.fit || undefined, kind: "done" })),
    });
  }

  try {
    await withDeadline(work(), SCRAPE_DEADLINE_MS).catch((e) => {
      stopped = true;
      throw e;
    });
    await log.flush();
    await finishJob(job.id, "done", { ...counts, leadIds }, null);
  } catch (e) {
    if (!(e instanceof UserFacingError)) console.error(`scrape ${job.id} failed`, e instanceof Error ? e.message : e);
    const msg = e instanceof DeadlineError ? MSG_SEARCH_FAILED : userMessage(e, "scrape");
    await log.flush().catch(() => {});
    await finishJob(job.id, "failed", { ...counts, leadIds }, msg).catch((err) => console.error("finishJob failed", err));
  }
}

// POST /api/scrape: runs one queued search of this workspace now.
export async function runScrapeNow(workspaceId: string, jobId: string): Promise<boolean> {
  await reapStaleJobs(workspaceId);
  const job = await claimJobById(workspaceId, jobId, "scrape");
  if (!job) return false;
  await runScrapeJob(job);
  return true;
}

// GET /api/cron/scrape: one queued search of any workspace (up to 3 tries to claim).
export async function drainScrape(): Promise<{ ran: number; reaped: number }> {
  const reaped = await reapStaleJobs(null);
  for (let i = 0; i < 3; i++) {
    try {
      const job = await claimNextJob(null, ["scrape"]);
      if (!job) return { ran: 0, reaped };
      await runScrapeJob(job);
      return { ran: 1, reaped };
    } catch (e) {
      console.error("drainScrape claim failed", e instanceof Error ? e.message : e);
    }
  }
  return { ran: 0, reaped };
}
