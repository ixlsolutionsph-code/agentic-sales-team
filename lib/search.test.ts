import { describe, expect, it } from "vitest";
import type { Agent, Team } from "./types";
import { noMatchesText, searchLocal } from "./search";

const agent = (id: string, name: string, role = "SDR") => ({ id, name, role }) as Agent;
const team = (id: string, name: string) => ({ id, name }) as Team;

describe("global search (browser part)", () => {
  it("finds agents by name or role, and teams by name, ignoring case", () => {
    const r = searchLocal("maya", [agent("1", "Maya"), agent("2", "Theo", "Mayan expert")], [team("t", "MAYA team")]);
    expect(r.agents.map((a) => a.id)).toEqual(["1", "2"]);
    expect(r.teams.map((t) => t.id)).toEqual(["t"]);
  });

  it("caps agents at 5 and teams at 4", () => {
    const agents = Array.from({ length: 8 }, (_, i) => agent(String(i), `Agent ${i}`));
    const teams = Array.from({ length: 8 }, (_, i) => team(String(i), `Team ${i}`));
    const r = searchLocal("a", agents, teams);
    expect(r.agents).toHaveLength(5);
    expect(r.teams).toHaveLength(4);
  });

  it("returns nothing for a blank query", () => {
    expect(searchLocal("   ", [agent("1", "Maya")], [])).toEqual({ agents: [], teams: [] });
  });

  it("says when nothing matches", () => {
    expect(noMatchesText(" zed ")).toBe('No matches for "zed"');
  });
});
