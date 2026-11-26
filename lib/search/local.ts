// Global search, the part done in the browser: agents (up to 5) and teams
// (up to 4). Leads and products come from the server (./store.ts).
import type { Agent, Team } from "@/lib/types";

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

// Leads and products are searched on the server once the query has at least
// 2 characters, 200 ms after the last key press (02-sitemap.md §5).
export const MIN_SERVER_CHARS = 2;
export const SERVER_DEBOUNCE_MS = 200;

export function wantsServerSearch(q: string): boolean {
  return q.trim().length >= MIN_SERVER_CHARS;
}
