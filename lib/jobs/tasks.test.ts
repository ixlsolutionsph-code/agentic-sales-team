import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/cron/auth";
import type { JobRow } from "./store";
import { resultSummary, toTask } from "./tasks";

const job = (p: Partial<JobRow>): JobRow => ({
  id: "j1",
  workspaceId: "w",
  agentId: "x1",
  kind: "research",
  status: "done",
  params: { agent: { id: "x1", name: "Maya", role: "Researcher", goal: "", task: "" } },
  result: null,
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  ...p,
});

describe("task lines", () => {
  it("summarises each kind's result", () => {
    expect(resultSummary("research", { picked: 5, researched: 4, failed: 1 })).toBe("Researched 4 leads · 1 failed");
    expect(resultSummary("qualify", { picked: 1, qualified: 1 })).toBe("Scored 1 lead");
    expect(resultSummary("outreach", { picked: 3, draftsCreated: 2, unchanged: 1 })).toBe("Drafted 2 emails · 1 unchanged");
    expect(resultSummary("proposal", { picked: 2, proposalsCreated: 2, skipped: 1 })).toBe("Wrote 2 proposals · 1 left for later");
    expect(resultSummary("assess", { picked: 3, accepted: 2, dismissed: 1 })).toBe("Accepted 2 · dismissed 1");
    expect(resultSummary("match", { picked: 2, matched: 2, matches: 3 })).toBe("Matched 2 leads · 3 product matches");
    expect(resultSummary("research", { picked: 0 })).toBe("No leads needed this");
  });

  it("shows waiting, running, failed and done states", () => {
    expect(toTask(job({ status: "queued" })).summary).toBe("Waiting to start");
    expect(toTask(job({ status: "needs_approval" })).summary).toBe("Waiting for your go-ahead");
    expect(toTask(job({ status: "failed", error: "Timed out: the run was stopped before it finished." })).summary).toContain("Timed out");
    const running = toTask(job({ status: "running", result: { steps: [{ id: "work", status: "active", label: "Lead research: 2 of 5 researched" }] } }));
    expect(running.summary).toBe("Lead research: 2 of 5 researched");
    expect(running.label).toBe("Lead research");
  });
});

describe("cron secret", () => {
  it("refuses with no secret set, no header or a wrong one", () => {
    expect(isCronAuthorized("Bearer x", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer x", "")).toBe(false);
    expect(isCronAuthorized(null, "abc")).toBe(false);
    expect(isCronAuthorized("Bearer abd", "abc")).toBe(false);
    expect(isCronAuthorized("Bearer abcd", "abc")).toBe(false);
    expect(isCronAuthorized("abc", "abc")).toBe(false);
  });

  it("accepts the exact bearer secret", () => {
    expect(isCronAuthorized("Bearer abc", "abc")).toBe(true);
  });
});
