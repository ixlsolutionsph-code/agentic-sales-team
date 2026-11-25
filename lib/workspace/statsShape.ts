// Workspace numbers for the dashboard and team pages. Pure: rows in, shapes
// out, so it can be unit tested. The queries are in ./stats.ts.
import type { LiveJob } from "@/lib/agents/derive";

// Per agent, over its accepted leads (and its meetings).
export type AgentNumbers = {
  leads: number;
  pipeline: number; // leads in contacted, engaged or replied
  scoredSum: number; // sum of scores above 0
  scoredCount: number; // leads with a score above 0
  monthLeads: number; // leads worked this month
  meetings: number;
};

export type ActivityLine = { id: string; agentId: string; text: string; createdAt: string };

export type WorkspaceStats = {
  perAgent: Record<string, AgentNumbers>;
  liveJobs: LiveJob[];
  activity: ActivityLine[]; // newest first
};

export const ZERO_NUMBERS: AgentNumbers = { leads: 0, pipeline: 0, scoredSum: 0, scoredCount: 0, monthLeads: 0, meetings: 0 };
export const EMPTY_WORKSPACE_STATS: WorkspaceStats = { perAgent: {}, liveJobs: [], activity: [] };

// Lead statuses that count as "In pipeline".
export const PIPELINE_STATUSES = ["contacted", "engaged", "replied"] as const;

type Row = Record<string, unknown>;
const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : s(v));

export function toWorkspaceStats(rows: { leads: Row[]; meetings: Row[]; jobs: Row[]; activity: Row[] }): WorkspaceStats {
  const perAgent: Record<string, AgentNumbers> = {};
  const get = (id: string) => (perAgent[id] ??= { ...ZERO_NUMBERS });
  for (const r of rows.leads) {
    const a = get(s(r.agent_id));
    a.leads += n(r.leads);
    a.pipeline += n(r.pipeline);
    a.scoredSum += n(r.scored_sum);
    a.scoredCount += n(r.scored_count);
    a.monthLeads += n(r.month_leads);
  }
  for (const r of rows.meetings) get(s(r.agent_id)).meetings += n(r.meetings);
  return {
    perAgent,
    liveJobs: rows.jobs.map((r) => ({ agentId: s(r.agent_id), kind: s(r.kind), status: s(r.status), leadCount: n(r.lead_count) })),
    activity: rows.activity.map((r) => ({ id: s(r.id), agentId: s(r.agent_id), text: s(r.text), createdAt: iso(r.created_at) })),
  };
}

// The numbers of a group of agents added up.
export function sumNumbers(agentIds: string[], perAgent: Record<string, AgentNumbers>): AgentNumbers {
  const out = { ...ZERO_NUMBERS };
  for (const id of new Set(agentIds)) {
    const a = perAgent[id];
    if (!a) continue;
    out.leads += a.leads;
    out.pipeline += a.pipeline;
    out.scoredSum += a.scoredSum;
    out.scoredCount += a.scoredCount;
    out.monthLeads += a.monthLeads;
    out.meetings += a.meetings;
  }
  return out;
}

// "Good morning" before noon, "Good afternoon" before 6 PM, else "Good evening".
export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export function monthWord(d: Date): string {
  return MONTHS[d.getMonth()];
}

// Where up to 8 agents sit on the hub's ellipse, as percentages of the box.
// The first one is at the top; the rest follow clockwise, evenly spaced.
export function ringSpots(count: number, rx = 42, ry = 38): { left: number; top: number }[] {
  const k = Math.max(0, Math.min(8, Math.floor(count)));
  const out: { left: number; top: number }[] = [];
  for (let i = 0; i < k; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / k;
    out.push({ left: Math.round((50 + rx * Math.cos(a)) * 10) / 10, top: Math.round((50 + ry * Math.sin(a)) * 10) / 10 });
  }
  return out;
}
