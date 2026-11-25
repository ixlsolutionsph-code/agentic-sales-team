import { describe, expect, it } from "vitest";
import type { Team } from "@/lib/types";
import { leadPoolOf, membersOfTeam, teammatesOf, teamsOfAgent } from "./membership";

const team = (id: string, members: string[]) => ({ id, members }) as Team;

describe("team membership", () => {
  it("uses the override when present, else the team's list, minus deleted agents", () => {
    const t = team("t1", ["a", "b"]);
    expect(membersOfTeam(t, {}, {})).toEqual(["a", "b"]);
    expect(membersOfTeam(t, { t1: ["c"] }, {})).toEqual(["c"]);
    expect(membersOfTeam(t, { t1: [] }, {})).toEqual([]);
    expect(membersOfTeam(t, {}, { b: { removed: true, paused: false } })).toEqual(["a"]);
  });

  it("finds an agent's teams and teammates", () => {
    const teams = [team("t1", ["a", "b"]), team("t2", ["a", "c", "b"]), team("t3", ["d"])];
    expect(teamsOfAgent("a", teams, {}, {}).map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(teammatesOf("a", teams, {}, {})).toEqual(["b", "c"]);
    expect(teammatesOf("d", teams, {}, {})).toEqual([]);
    expect(teammatesOf("a", teams, { t2: ["a"] }, {})).toEqual(["b"]);
  });

  it("the lead pool is the members' leads", () => {
    const leads = [
      { id: 1, agentId: "a" },
      { id: 2, agentId: "z" },
      { id: 3, agentId: "b" },
    ];
    expect(leadPoolOf(["a", "b"], leads).map((l) => l.id)).toEqual([1, 3]);
    expect(leadPoolOf([], leads)).toEqual([]);
  });
});
