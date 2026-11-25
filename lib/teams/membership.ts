// Who is on a team. A row in team_members replaces teams.members when
// present; deleted agents are never counted.
import type { AgentState, Team } from "@/lib/types";

type Overrides = Record<string, string[]>;
type States = Record<string, AgentState>;

// The team's member ids: the override, else the team's own list, minus deleted agents.
export function membersOfTeam(team: Pick<Team, "id" | "members">, overrides: Overrides, states: States): string[] {
  const list = overrides[team.id] ?? team.members;
  return list.filter((id) => states[id]?.removed !== true);
}

// The teams an agent is on.
export function teamsOfAgent(agentId: string, teams: Team[], overrides: Overrides, states: States): Team[] {
  return teams.filter((t) => membersOfTeam(t, overrides, states).includes(agentId));
}

// Everyone who shares a team with the agent, without the agent itself.
export function teammatesOf(agentId: string, teams: Team[], overrides: Overrides, states: States): string[] {
  const out: string[] = [];
  for (const t of teamsOfAgent(agentId, teams, overrides, states)) {
    for (const id of membersOfTeam(t, overrides, states)) if (id !== agentId && !out.includes(id)) out.push(id);
  }
  return out;
}

// The team's lead pool: the leads that belong to its members.
export function leadPoolOf<L extends { agentId: string }>(memberIds: string[], leads: L[]): L[] {
  const set = new Set(memberIds);
  return leads.filter((l) => set.has(l.agentId));
}
