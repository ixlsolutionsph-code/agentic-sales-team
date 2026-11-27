// What happens after a chain stage ends (01-prd.md §7.2): who does the next
// stage, and what the agent that just finished says. Pure, so it can be unit
// tested; lib/pod/orchestrate.ts does the reading, posting and queueing.
import type { ScrapeBrief } from "@/lib/chat/markers";
import { MSG_RUN_FAILED, MSG_SEARCH_FAILED } from "@/lib/jobs/limits";
import {
  MSG_NO_FIT,
  MSG_NO_MATCHES,
  STAGE_TEXT,
  doneSentence,
  failedCount,
  failedLeadsText,
  finalText,
  handOffText,
  leadsMarker,
  movedCount,
  noProductsText,
  sameAgentNextText,
  scrapeFoundText,
  stoppedText,
  tryAgainMarkers,
  widerOfferText,
} from "./summary";
import { POD_ORDER, type PodStage } from "./types";

export type ChainMember = { id: string; name: string; capabilities: string[]; paused: boolean };

// The member who does a stage: the first live, not paused member (in team
// order) with the capability. Removed agents are never in the list.
export function stageOwner(members: ChainMember[], kind: PodStage): ChainMember | null {
  return members.find((m) => !m.paused && m.capabilities.includes(kind)) ?? null;
}

export type NextStep = { kind: PodStage; agent: ChainMember } | { stop: "no-products" } | null;

// The next stage a member covers after `from`. Stages nobody covers are
// skipped. With an empty catalog, match is skipped and the chain stops before
// proposal. After a scrape only the Assessor can take over.
export function nextStage(from: PodStage, members: ChainMember[], catalogEmpty: boolean): NextStep {
  if (from === "scrape") {
    const a = stageOwner(members, "assess");
    return a ? { kind: "assess", agent: a } : null;
  }
  const i = POD_ORDER.indexOf(from);
  for (const kind of POD_ORDER.slice(i + 1)) {
    const owner = stageOwner(members, kind);
    if (!owner) continue;
    if (catalogEmpty && kind === "match") continue;
    if (catalogEmpty && kind === "proposal") return { stop: "no-products" };
    return { kind, agent: owner };
  }
  return null;
}

export type ChainJob = {
  kind: PodStage;
  agentId: string;
  status: string; // done | failed
  error: string | null;
  result: Record<string, unknown> | null;
  stopped?: boolean;
  brief?: ScrapeBrief;
};

export type ChainOutcome = {
  text: string; // posted once by the agent that did the job
  next: { kind: PodStage; agentId: string; leadIds?: string[] } | null;
};

const leadIdsOf = (r: Record<string, unknown> | null) =>
  Array.isArray(r?.leadIds) ? (r!.leadIds as unknown[]).map(String).filter(Boolean) : [];

export function decideChain(job: ChainJob, members: ChainMember[], catalogEmpty: boolean): ChainOutcome {
  const r = job.result;
  const stop = (text: string): ChainOutcome => ({ text, next: null });

  // A failed job: its error, and the chain stops.
  if (job.status !== "done") return stop(job.error || (job.kind === "scrape" ? MSG_SEARCH_FAILED : MSG_RUN_FAILED));

  const moved = movedCount(job.kind, r);
  const leadIds = job.kind === "scrape" ? leadIdsOf(r) : [];

  // The team pressed Cancel while this job ran: it hands nothing on.
  if (job.stopped) return stop(`${stoppedText(job.kind, r)}${leadsMarker(leadIds)}`);

  // Leads that failed stop the chain, with "Try again".
  const failed = failedCount(r);
  if (failed > 0) {
    const done = moved ? doneSentence(job.kind, r) : null;
    return stop(`${failedLeadsText(failed, done)}${leadsMarker(leadIds)}${tryAgainMarkers(job.kind, job.agentId)}`);
  }

  const scout = stageOwner(members, "scrape")?.id ?? (job.kind === "scrape" ? job.agentId : null);

  if (job.kind === "scrape") {
    if (!moved) return stop(`${STAGE_TEXT.scrape.nothing}${widerOfferText(job.brief, scout)}`);
    const next = nextStage("scrape", members, catalogEmpty);
    if (!next || "stop" in next) return stop(`${scrapeFoundText(moved, null, false)}${leadsMarker(leadIds)}`);
    const same = next.agent.id === job.agentId;
    return {
      text: `${scrapeFoundText(moved, next.agent.name, same)}${leadsMarker(leadIds)}`,
      next: { kind: "assess", agentId: next.agent.id, leadIds },
    };
  }

  if (!moved) {
    if (job.kind === "assess") {
      const reviewed = Number(r?.dismissed ?? 0);
      return stop(`${reviewed ? MSG_NO_FIT : STAGE_TEXT.assess.nothing}${widerOfferText(job.brief, scout)}`);
    }
    return stop(STAGE_TEXT[job.kind].nothing);
  }

  // Match with no matches does not stop.
  const done = job.kind === "match" && !Number(r?.matches) ? MSG_NO_MATCHES : doneSentence(job.kind, r);
  const next = nextStage(job.kind, members, catalogEmpty);
  if (!next) return stop(finalText(done, job.kind));
  if ("stop" in next) return stop(noProductsText(done));
  const text = next.agent.id === job.agentId ? sameAgentNextText(done, next.kind) : handOffText(done, next.kind, next.agent.name);
  return { text, next: { kind: next.kind, agentId: next.agent.id } };
}
