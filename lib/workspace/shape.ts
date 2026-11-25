// Pure helpers that turn database rows into the client store's shapes.
// No database or server imports, so they can be unit tested.
import type { Agent, AgentConfig, AgentState, ChatMessage, Team, WorkspaceData } from "@/lib/types";

type Row = Record<string, unknown>;

const str = (v: unknown, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : str(v));
const obj = <T>(v: unknown): T | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null);

export function toAgent(r: Row): Agent {
  return {
    id: str(r.id),
    name: str(r.name),
    initials: str(r.initials),
    role: str(r.role),
    color: str(r.color),
    status: str(r.status),
    task: str(r.task),
    score: num(r.score),
    goal: str(r.goal),
    char: r.char == null ? null : num(r.char),
    type: str(r.type, "custom"),
    capabilities: strList(r.capabilities),
    createdAt: iso(r.created_at),
  };
}

export function toTeam(r: Row): Team {
  return {
    id: str(r.id),
    name: str(r.name),
    icon: str(r.icon),
    iconBg: str(r.icon_bg),
    description: str(r.description),
    goal: str(r.goal),
    members: strList(r.members),
    activity: strList(r.activity),
    meetings: num(r.meetings),
    pipeline: str(r.pipeline, "-"),
    leads: num(r.leads),
    template: str(r.template, "custom"),
    createdAt: iso(r.created_at),
  };
}

export function toConfigMap(rows: Row[]): Record<string, AgentConfig> {
  const out: Record<string, AgentConfig> = {};
  for (const r of rows) {
    out[str(r.agent_id)] = {
      role: r.role == null ? null : str(r.role),
      goal: r.goal == null ? null : str(r.goal),
      permissions: obj<Record<string, boolean>>(r.permissions),
      settings: obj<Record<string, Record<string, unknown>>>(r.settings),
    };
  }
  return out;
}

export function toStateMap(rows: Row[]): Record<string, AgentState> {
  const out: Record<string, AgentState> = {};
  for (const r of rows) out[str(r.agent_id)] = { removed: r.removed === true, paused: r.paused === true };
  return out;
}

export function toTeamMemberMap(rows: Row[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of rows) out[str(r.team_id)] = strList(r.members);
  return out;
}

// Groups message rows by their thread key (the agent_id column), oldest first.
export function groupMessages(rows: Row[]): Record<string, ChatMessage[]> {
  const out: Record<string, ChatMessage[]> = {};
  for (const r of rows) {
    const key = str(r.agent_id);
    (out[key] ??= []).push({ id: num(r.id), who: str(r.who), text: str(r.text), createdAt: iso(r.created_at) });
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.id - b.id);
  return out;
}

export function toWorkspaceData(rows: {
  agents: Row[];
  teams: Row[];
  config: Row[];
  states: Row[];
  teamMembers: Row[];
  messages: Row[];
}): WorkspaceData {
  return {
    agents: rows.agents.map(toAgent),
    teams: rows.teams.map(toTeam),
    config: toConfigMap(rows.config),
    states: toStateMap(rows.states),
    teamMembers: toTeamMemberMap(rows.teamMembers),
    messages: groupMessages(rows.messages),
  };
}
