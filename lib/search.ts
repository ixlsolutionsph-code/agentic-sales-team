// Global search, the part done in the browser: agents (up to 5) and teams
// (up to 4). Leads and products come from the server in Milestone 6.
import type { Agent, Team } from "./types";

export const SEARCH_LIMITS = { agents: 5, teams: 4 } as const;

export function searchLocal(q: string, agents: Agent[], teams: Team[]): { agents: Agent[]; teams: Team[] } {
  const needle = q.trim().toLowerCase();
  if (!needle) return { agents: [], teams: [] };
  const hit = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(needle));
  return {
    agents: agents.filter((a) => hit(a.name, a.role)).slice(0, SEARCH_LIMITS.agents),
    teams: teams.filter((t) => hit(t.name)).slice(0, SEARCH_LIMITS.teams),
  };
}

export function noMatchesText(q: string): string {
  return `No matches for "${q.trim()}"`;
}
