import { describe, expect, it } from "vitest";
import { groupMessages, toAgent, toConfigMap, toStateMap, toTeam, toTeamMemberMap, toWorkspaceData } from "./shape";

describe("workspace row shapes", () => {
  it("maps an agent row and fills safe defaults", () => {
    const a = toAgent({
      id: "x1",
      name: "Maya",
      initials: "M",
      role: "SDR",
      color: "#006AFF",
      status: "idle",
      task: "Ready for work",
      score: "7",
      goal: "Book meetings.",
      char: null,
      type: null,
      capabilities: ["scrape", 3],
      created_at: new Date("2026-01-02T03:04:05Z"),
    });
    expect(a).toMatchObject({ id: "x1", score: 7, char: null, type: "custom", capabilities: ["scrape"] });
    expect(a.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("maps a team row", () => {
    const t = toTeam({ id: "t1", name: "EMEA", icon: "🚀", icon_bg: "#fff", members: ["x1"], meetings: 2 });
    expect(t).toMatchObject({ id: "t1", iconBg: "#fff", members: ["x1"], meetings: 2, pipeline: "-", leads: 0 });
  });

  it("builds config, state and team-member maps by id", () => {
    expect(toConfigMap([{ agent_id: "x1", role: null, goal: "G", permissions: { scrape: true }, settings: [] }])).toEqual({
      x1: { role: null, goal: "G", permissions: { scrape: true }, settings: null },
    });
    expect(toStateMap([{ agent_id: "x1", removed: true, paused: "yes" }])).toEqual({ x1: { removed: true, paused: false } });
    expect(toTeamMemberMap([{ team_id: "t1", members: ["x1", "x2"] }])).toEqual({ t1: ["x1", "x2"] });
  });

  it("groups messages by thread, oldest first", () => {
    const g = groupMessages([
      { id: 3, agent_id: "t1", who: "me", text: "c", created_at: "2026-01-01" },
      { id: 1, agent_id: "t1", who: "me", text: "a", created_at: "2026-01-01" },
      { id: 2, agent_id: "t2", who: "Maya", text: "b", created_at: "2026-01-01" },
    ]);
    expect(Object.keys(g).sort()).toEqual(["t1", "t2"]);
    expect(g.t1.map((m) => m.text)).toEqual(["a", "c"]);
  });

  it("returns empty lists for an empty workspace", () => {
    expect(toWorkspaceData({ agents: [], teams: [], config: [], states: [], teamMembers: [], messages: [] })).toEqual({
      agents: [],
      teams: [],
      config: {},
      states: {},
      teamMembers: {},
      messages: {},
    });
  });
});
