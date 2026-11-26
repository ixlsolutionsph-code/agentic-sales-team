import "server-only";
import { assessLead } from "@/lib/ai/assess";
import type { AIJson, EngineAgent, EngineLead, EngineProduct } from "@/lib/ai/engine";
import { aiJSON, isAIConfigured } from "@/lib/ai/gemini";
import { MATCH_PRODUCTS, matchLead } from "@/lib/ai/match";
import { OUTREACH_PRODUCTS, draftOutreach } from "@/lib/ai/outreach";
import { PROPOSAL_PRODUCTS, draftProposal } from "@/lib/ai/proposal";
import { qualifyLead } from "@/lib/ai/qualify";
import { researchLead } from "@/lib/ai/research";
import { capabilityLabel } from "@/lib/agentTypes";
import {
  applyAssessResult,
  applyMatchResult,
  applyOutreachResult,
  applyProposalResult,
  applyQualifyResult,
  applyResearchResult,
  setFitReasonIfEmpty,
} from "@/lib/leads/apply";
import { ensureFitReason } from "@/lib/leads/fit";
import type { Lead } from "@/lib/leads/types";
import { searchProducts } from "@/lib/products/store";
import { createStepLog, type StepItem } from "@/lib/scrape/steps";
import { loadRunAgent, pickLeads, poolOf, productCount } from "./context";
import { UserFacingError, userMessage } from "./errors";
import {
  DEFAULT_BATCH,
  MAX_LEADS_PER_RUN,
  MSG_AGENT_UNAVAILABLE,
  MSG_NO_AI,
  MSG_NO_PRODUCTS,
  RUNNABLE_KINDS,
  msgCantRun,
  type JobKind,
} from "./limits";
import { CLAIM_BUDGET_MS, LEAD_BUDGET_MS, PER_LEAD_MS, budget, withDeadline } from "./runtime";
import { claimNextJob, finishJob, reapStaleJobs, writeSteps, type JobRow } from "./store";

// The job runner (01-prd.md §7.5): claims queued jobs one at a time and works
// through each job's leads. Used by POST /api/jobs/run (5 jobs of one
// workspace) and GET /api/cron/jobs (50 jobs of any workspace).

const ai: AIJson = (system, prompt, schema, opts) => aiJSON(system, prompt, schema, opts);

const toEngineLead = (l: Lead): EngineLead => ({
  id: l.id,
  name: l.name,
  title: l.title,
  company: l.company,
  email: l.email,
  platform: l.platform,
  fitReason: l.fitReason,
  research: l.research,
});

// Retrieval: products closest to the lead (title + company + research summary).
async function productsFor(workspaceId: string, l: Lead, k: number): Promise<EngineProduct[]> {
  const q = [l.title, l.company, l.research?.summary ?? ""].filter(Boolean).join(" ");
  const hits = await searchProducts(workspaceId, q || l.name, k);
  return hits.map((p) => ({ id: p.id, name: p.name, description: p.description, price: p.price, category: p.category }));
}

type Counts = Record<string, number>;
const RESULT_KEYS: Record<string, [ok: string, label: string]> = {
  research: ["researched", "researched"],
  qualify: ["qualified", "scored"],
  assess: ["assessed", "assessed"],
  match: ["matched", "matched"],
  outreach: ["draftsCreated", "drafted"],
  proposal: ["proposalsCreated", "written"],
};

// Works on one lead. Returns the line shown in the timeline, or null when
// the lead was left as it was (for example it already had a draft).
async function workOnLead(job: JobRow, agent: EngineAgent, teamGoal: string, l: Lead, useAI: AIJson | null, counts: Counts): Promise<string | null> {
  const w = { workspaceId: job.workspaceId, agentId: job.agentId, agentName: agent.name, leadId: l.id, leadName: l.name };
  const lead = toEngineLead(l);
  switch (job.kind) {
    case "research": {
      const r = await researchLead(lead, agent, useAI);
      if (!(await applyResearchResult(w, r))) return null;
      const fit = ensureFitReason(l.fitReason, r.angle);
      if (fit) await setFitReasonIfEmpty(job.workspaceId, l.id, fit);
      return "Research brief saved";
    }
    case "qualify": {
      const q = await qualifyLead(lead, agent, useAI);
      if (!(await applyQualifyResult(w, q))) return null;
      return `${q.score} · ${q.tier}`;
    }
    case "assess": {
      const a = await assessLead(lead, agent, teamGoal, useAI);
      if (!(await applyAssessResult(w, a))) return null;
      counts[a.accept ? "accepted" : "dismissed"] = (counts[a.accept ? "accepted" : "dismissed"] ?? 0) + 1;
      return a.accept ? `Accepted · ${a.score}` : "Dismissed";
    }
    case "match": {
      const list = await matchLead(lead, agent, await productsFor(job.workspaceId, l, MATCH_PRODUCTS), useAI);
      if (list === null) return null; // no AI: left for a later run
      const n = await applyMatchResult(w, list);
      counts.matches = (counts.matches ?? 0) + n;
      return n ? `${n} ${n === 1 ? "match" : "matches"}` : "No real fit";
    }
    case "outreach": {
      const o = await draftOutreach(lead, agent, await productsFor(job.workspaceId, l, OUTREACH_PRODUCTS), useAI);
      if (!(await applyOutreachResult(w, o))) return null;
      return l.email ? "Email drafted" : "Message drafted";
    }
    case "proposal": {
      const p = await draftProposal(lead, agent, await productsFor(job.workspaceId, l, PROPOSAL_PRODUCTS), useAI);
      if (!(await applyProposalResult(w, p))) return null;
      return `Proposal with ${p.productsUsed.length} ${p.productsUsed.length === 1 ? "product" : "products"}`;
    }
    default:
      throw new UserFacingError(msgCantRun(job.kind));
  }
}

export async function runJob(job: JobRow): Promise<void> {
  const clock = budget(Date.now());
  const log = createStepLog((steps) => writeSteps(job.id, steps));
  const [okKey, verb] = RESULT_KEYS[job.kind] ?? ["done", "done"];
  const counts: Counts = { picked: 0, [okKey]: 0, failed: 0, skipped: 0, unchanged: 0 };
  try {
    // Checked again at run time: the agent may have been paused, deleted or
    // changed, or the AI key removed, since the job was queued.
    const agent = await loadRunAgent(job.workspaceId, job.agentId);
    if (!agent || agent.paused || agent.removed) throw new UserFacingError(MSG_AGENT_UNAVAILABLE);
    if (!agent.capabilities.includes(job.kind)) throw new UserFacingError(msgCantRun(job.kind));
    const useAI = isAIConfigured() ? ai : null;
    if (!useAI && job.kind !== "assess") throw new UserFacingError(MSG_NO_AI);
    if (job.kind === "proposal" && (await productCount(job.workspaceId)) === 0) throw new UserFacingError(MSG_NO_PRODUCTS);

    log.set({ id: "pick", status: "active", label: "Picking leads" });
    const pool = await poolOf(job.workspaceId, job.agentId);
    const size = Math.min(MAX_LEADS_PER_RUN, Math.max(1, Math.floor(Number(job.params.batchSize) || DEFAULT_BATCH)));
    const leads = await pickLeads(job.workspaceId, job.kind, pool.agentIds, job.params.leadIds, size);
    counts.picked = leads.length;
    log.set({
      id: "pick",
      status: "done",
      label: leads.length ? `Picked ${leads.length} ${leads.length === 1 ? "lead" : "leads"}` : "No leads need this right now",
      items: leads.map((l) => ({ title: l.name, meta: l.company || undefined, kind: "source" as const })),
    });

    if (leads.length) {
      const items: StepItem[] = [];
      const label = () => `${capabilityLabel(job.kind)}: ${counts[okKey]} of ${leads.length} ${verb}`;
      log.set({ id: "work", status: "active", label: label() });
      const engineAgent = { name: agent.name, role: agent.role, goal: agent.goal };
      for (const l of leads) {
        // After 180 s no new lead is started; the rest wait for the next run.
        if (clock.over(LEAD_BUDGET_MS)) {
          counts.skipped++;
          continue;
        }
        try {
          const line = await withDeadline(workOnLead(job, engineAgent, pool.teamGoal, l, useAI, counts), PER_LEAD_MS);
          if (line === null) {
            counts.unchanged++;
          } else {
            counts[okKey]++;
            items.push({ title: l.name, meta: line, kind: "done" });
          }
        } catch (e) {
          counts.failed++;
          items.push({ title: l.name, meta: "Failed", kind: "failed" });
          console.error(`job ${job.id} (${job.kind}) lead ${l.id} failed`, e instanceof Error ? e.message : e);
        }
        log.set({ id: "work", status: "active", label: label(), items });
      }
      log.set({ id: "work", status: "done", label: label(), items });
    }
    await log.flush();
    await finishJob(job.id, "done", counts, null);
  } catch (e) {
    if (!(e instanceof UserFacingError)) console.error(`job ${job.id} (${job.kind}) failed`, e);
    await log.flush().catch(() => {});
    await finishJob(job.id, "failed", counts, userMessage(e, job.kind)).catch((err) => console.error("finishJob failed", err));
  }
}

// Works through queued jobs: first fails stale ones, then claims and runs
// jobs one by one until `maxJobs` or the 120 s claim budget is reached.
export async function drainQueue(opts: { workspaceId: string | null; maxJobs: number; kinds?: readonly JobKind[] }): Promise<{ ran: string[]; reaped: number }> {
  const clock = budget(Date.now());
  const reaped = await reapStaleJobs(opts.workspaceId);
  const ran: string[] = [];
  while (ran.length < opts.maxJobs && !clock.over(CLAIM_BUDGET_MS)) {
    const job = await claimNextJob(opts.workspaceId, opts.kinds ?? RUNNABLE_KINDS);
    if (!job) break;
    await runJob(job);
    ran.push(job.id);
  }
  return { ran, reaped };
}
