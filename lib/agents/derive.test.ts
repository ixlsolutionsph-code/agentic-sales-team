import { describe, expect, it } from "vitest";
import type { Agent } from "@/lib/types";
import { agentNow, liveAgentCount, teamKpis, teamSubtitle, visibleAgents } from "./derive";
import { EMPTY_STATS, replyRate, workLine } from "./stats";

describe("agent status (derived, never stored)", () => {
  it("is working while a job is live", () => {
    expect(agentNow({ id: "x1" }, undefined, [{ agentId: "x1", kind: "scrape", status: "running", leadCount: 8 }])).toEqual({
      status: "working",
      task: "Lead scraping · 8 leads",
    });
  });

  it("is Paused when paused, else Idle", () => {
    expect(agentNow({ id: "x1" }, { paused: true, removed: false })).toEqual({ status: "waiting", task: "Paused" });
    expect(agentNow({ id: "x1" }, undefined)).toEqual({ status: "idle", task: "Idle" });
    expect(agentNow({ id: "x1" }, undefined, [{ agentId: "x1", kind: "scrape", status: "done", leadCount: 1 }]).status).toBe("idle");
  });

  it("counts live agents, leaving out deleted ones", () => {
    const jobs = [
      { agentId: "a", kind: "scrape", status: "queued", leadCount: 0 },
      { agentId: "b", kind: "scrape", status: "running", leadCount: 0 },
    ];
    expect(liveAgentCount([{ id: "a" }, { id: "b" }, { id: "c" }], { b: { removed: true, paused: false } }, jobs)).toBe(1);
  });
});

describe("visible agents", () => {
  it("hides deleted agents and applies edits", () => {
    const base = { name: "n", initials: "N", color: "", status: "idle", task: "", score: 0, char: null, type: "scout", capabilities: [], createdAt: "" };
    const agents = [
      { ...base, id: "a", role: "Lead Scout", goal: "Old." },
      { ...base, id: "b", role: "Lead Scout", goal: "B." },
    ] as Agent[];
    const out = visibleAgents(agents, { b: { removed: true, paused: false } }, {
      a: { role: null, goal: "New.", permissions: null, settings: null },
    });
    expect(out.map((a) => [a.id, a.goal])).toEqual([["a", "New."]]);
  });
});

describe("teams and stats helpers", () => {
  it("writes the team subtitle", () => {
    expect(teamSubtitle({ template: "fullcycle" }, 3)).toBe("Full-Cycle Pod team · 3 agents");
    expect(teamSubtitle({ template: "nope" }, 1)).toBe("Custom team · 1 agent");
  });

  it("averages only scored leads", () => {
    expect(teamKpis({ meetings: 2, pipeline: "-" }, [0, 80, 60])).toEqual({ meetings: 2, pipeline: "-", leads: 3, avgScore: 70 });
    expect(teamKpis({ meetings: 0, pipeline: "-" })).toEqual({ meetings: 0, pipeline: "-", leads: 0, avgScore: 0 });
  });

  it("shows No work yet until there is work", () => {
    expect(workLine(EMPTY_STATS)).toBe("No work yet");
    expect(workLine({ ...EMPTY_STATS, leads: 1, sent: 0 })).toBe("1 lead · 0 sent");
    expect(workLine({ ...EMPTY_STATS, leads: 12, sent: 3 })).toBe("12 leads · 3 sent");
    expect(replyRate({ ...EMPTY_STATS, sent: 4, replied: 1 })).toBe(25);
    expect(replyRate(EMPTY_STATS)).toBe(0);
  });
});
