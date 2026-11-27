// How a job shows in the agent's Tasks list. Pure, so it can be unit tested.
import { capabilityLabel } from "@/lib/agentTypes";
import type { Step } from "@/lib/scrape/steps";
import type { JobRow } from "./store";

export type Task = {
  id: string;
  kind: string;
  label: string; // "Lead research"
  status: string;
  summary: string; // "Researched 4 leads · 1 failed"
  error: string | null;
  steps: Step[];
  leadCount: number;
  createdAt: string;
  finishedAt: string | null;
};

const n = (r: Record<string, unknown> | null, k: string) => Number(r?.[k]) || 0;
const plural = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

// The result line for a finished run.
// A lead search: "N sources · N dropped · N leads" (01-prd.md §7.3).
export function searchSummary(result: Record<string, unknown> | null): string {
  return `${plural(n(result, "sources"), "source")} · ${n(result, "dropped")} dropped · ${plural(n(result, "leadsFound"), "lead")}`;
}

export function resultSummary(kind: string, result: Record<string, unknown> | null): string {
  if (kind === "scrape") return searchSummary(result);
  const picked = n(result, "picked");
  if (!picked) return "No leads needed this";
  const parts: string[] = [];
  switch (kind) {
    case "research":
      parts.push(`Researched ${plural(n(result, "researched"), "lead")}`);
      break;
    case "qualify":
      parts.push(`Scored ${plural(n(result, "qualified"), "lead")}`);
      break;
    case "assess":
      parts.push(`Accepted ${n(result, "accepted")} · dismissed ${n(result, "dismissed")}`);
      break;
    case "match":
      parts.push(`Matched ${plural(n(result, "matched"), "lead")} · ${plural(n(result, "matches"), "product match", "product matches")}`);
      break;
    case "outreach":
      parts.push(`Drafted ${plural(n(result, "draftsCreated"), "email")}`);
      break;
    case "proposal":
      parts.push(`Wrote ${plural(n(result, "proposalsCreated"), "proposal")}`);
      break;
    default:
      parts.push(`Worked on ${plural(picked, "lead")}`);
  }
  if (n(result, "failed")) parts.push(`${n(result, "failed")} failed`);
  if (n(result, "skipped")) parts.push(`${n(result, "skipped")} left for later`);
  if (n(result, "unchanged")) parts.push(`${n(result, "unchanged")} unchanged`);
  return parts.join(" · ");
}

export function toTask(j: JobRow): Task {
  const steps = Array.isArray(j.result?.steps) ? (j.result!.steps as Step[]) : [];
  let summary: string;
  if (j.status === "queued") summary = "Waiting to start";
  else if (j.status === "needs_approval") summary = "Waiting for your go-ahead";
  else if (j.status === "running") summary = (j.kind === "scrape" ? steps[steps.length - 1] : steps.find((s) => s.id === "work"))?.label ?? "Working…";
  else if (j.status === "dismissed") summary = "Cancelled";
  else if (j.status === "failed") summary = j.error ?? "Failed";
  else summary = resultSummary(j.kind, j.result);
  return {
    id: j.id,
    kind: j.kind,
    label: capabilityLabel(j.kind),
    status: j.status,
    summary,
    error: j.error,
    steps,
    leadCount: Number(j.params?.leadCount) || j.params?.leadIds?.length || 0,
    createdAt: j.createdAt,
    finishedAt: j.finishedAt,
  };
}

export const LIVE_STATUSES = new Set(["queued", "running"]);
