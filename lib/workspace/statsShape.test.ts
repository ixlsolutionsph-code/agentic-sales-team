import { describe, expect, it } from "vitest";
import { firstName, greeting, monthWord, ringSpots, sumNumbers, toWorkspaceStats, ZERO_NUMBERS } from "./statsShape";

describe("workspace stats", () => {
  it("turns rows into per-agent numbers, jobs and activity", () => {
    const out = toWorkspaceStats({
      leads: [{ agent_id: "a", leads: "3", pipeline: "1", scored_sum: "150", scored_count: "2", month_leads: "1" }],
      meetings: [{ agent_id: "a", meetings: 2 }, { agent_id: "b", meetings: "1" }],
      jobs: [{ agent_id: "a", kind: "scrape", status: "running", lead_count: "4" }],
      activity: [{ id: "u1", agent_id: "a", text: "Added a lead", created_at: new Date("2026-01-01T00:00:00Z") }],
    });
    expect(out.perAgent.a).toEqual({ leads: 3, pipeline: 1, scoredSum: 150, scoredCount: 2, monthLeads: 1, meetings: 2 });
    expect(out.perAgent.b).toEqual({ ...ZERO_NUMBERS, meetings: 1 });
    expect(out.liveJobs).toEqual([{ agentId: "a", kind: "scrape", status: "running", leadCount: 4 }]);
    expect(out.activity[0]).toEqual({ id: "u1", agentId: "a", text: "Added a lead", createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("adds up a group once per agent", () => {
    const per = { a: { ...ZERO_NUMBERS, leads: 2, monthLeads: 1 }, b: { ...ZERO_NUMBERS, leads: 5, monthLeads: 5 } };
    expect(sumNumbers(["a", "b", "a", "x"], per)).toMatchObject({ leads: 7, monthLeads: 6 });
    expect(sumNumbers([], per)).toEqual(ZERO_NUMBERS);
  });
});

describe("dashboard words", () => {
  it("greets by the time of day", () => {
    expect(greeting(0)).toBe("Good morning");
    expect(greeting(11)).toBe("Good morning");
    expect(greeting(12)).toBe("Good afternoon");
    expect(greeting(17)).toBe("Good afternoon");
    expect(greeting(18)).toBe("Good evening");
  });

  it("uses the first name and the month in capitals", () => {
    expect(firstName("  Ana  Cruz ")).toBe("Ana");
    expect(firstName("")).toBe("");
    expect(monthWord(new Date(2026, 10, 25))).toBe("NOVEMBER");
  });

  it("places up to 8 agents on the ring, the first at the top", () => {
    expect(ringSpots(0)).toEqual([]);
    expect(ringSpots(12)).toHaveLength(8);
    const four = ringSpots(4);
    expect(four[0]).toEqual({ left: 50, top: 12 });
    expect(four[1]).toEqual({ left: 92, top: 50 });
    expect(four[2]).toEqual({ left: 50, top: 88 });
    expect(four[3]).toEqual({ left: 8, top: 50 });
  });
});
