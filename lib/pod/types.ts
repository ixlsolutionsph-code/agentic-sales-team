// The chain (01-prd.md §7.2). Pure.
import type { JobKind } from "@/lib/jobs/limits";

export const POD_ORDER = ["scrape", "assess", "research", "qualify", "match", "outreach", "proposal"] as const satisfies readonly JobKind[];
export type PodStage = (typeof POD_ORDER)[number];
export const POD_BATCH = 20;

export function isPodStage(k: string): k is PodStage {
  return (POD_ORDER as readonly string[]).includes(k);
}
