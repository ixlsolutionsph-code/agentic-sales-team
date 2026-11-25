// Building and checking a team. Pure: used by the team modal and the server.
import { AGENT_TYPES, TEAM_TEMPLATES, capabilityLabel, type CapabilityId, type TeamTemplateId } from "@/lib/agentTypes";
import { AGENT_ID_RE } from "@/lib/agents/new";
import type { Team } from "@/lib/types";

export const TEAM_NAME_MAX = 80;
export const TEAM_GOAL_MAX = 500;
export const TEAM_MEMBERS_MAX = 50;
export const TEAM_ID_RE = /^tx[0-9a-z]{6,20}$/;

// The 6 team icons and the tint behind each (04-erd.md `icon_bg`).
export const TEAM_ICONS = [
  { icon: "🚀", bg: "#e5f0fe" },
  { icon: "🌎", bg: "#d3f6ea" },
  { icon: "🏛", bg: "#f4ebfc" },
  { icon: "📣", bg: "#ffeccf" },
  { icon: "🎯", bg: "#fde7e4" },
  { icon: "💎", bg: "#e0f4f9" },
] as const;

export const DEFAULT_TEAM_ICON = TEAM_ICONS[0].icon;

export function isTeamIcon(v: unknown): v is string {
  return typeof v === "string" && TEAM_ICONS.some((i) => i.icon === v);
}

export function iconBg(icon: string): string {
  return TEAM_ICONS.find((i) => i.icon === icon)?.bg ?? TEAM_ICONS[0].bg;
}

export function isTeamTemplate(v: unknown): v is TeamTemplateId {
  return typeof v === "string" && TEAM_TEMPLATES.some((t) => t.id === v);
}

export function teamTemplate(id: string) {
  return TEAM_TEMPLATES.find((t) => t.id === id) ?? TEAM_TEMPLATES.find((t) => t.id === "custom")!;
}

// "tx" + Date.now() in base 36 + 3 random base-36 characters.
export function newTeamId(now = Date.now(), rand: () => number = Math.random): string {
  let tail = "";
  for (let i = 0; i < 3; i++) tail += Math.floor(rand() * 36).toString(36);
  return `tx${now.toString(36)}${tail}`;
}

// Keeps only well-formed agent ids, without repeats, in the given order.
export function cleanMemberIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null;
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !AGENT_ID_RE.test(id)) return null;
    if (!out.includes(id)) out.push(id);
  }
  return out.length > TEAM_MEMBERS_MAX ? null : out;
}

export type CoverageRow = { cap: CapabilityId; covered: boolean };

// For each required capability of the template: does a member have it?
export function coverage(templateId: string, memberCaps: string[][]): CoverageRow[] {
  const have = new Set(memberCaps.flat());
  return teamTemplate(templateId).required.map((cap) => ({ cap, covered: have.has(cap) }));
}

export function gaps(templateId: string, memberCaps: string[][]): CapabilityId[] {
  return coverage(templateId, memberCaps)
    .filter((r) => !r.covered)
    .map((r) => r.cap);
}

// The agent type to create for a gap: the first non-custom type whose only
// capability is the gap. When there is none (proposal), a Custom agent with
// just that capability.
// `name` is the suggested name for the new agent.
export function gapAgentType(cap: CapabilityId): { type: string; label: string; name: string; capabilities: CapabilityId[] } {
  const t = AGENT_TYPES.find((x) => x.id !== "custom" && x.capabilities.length === 1 && x.capabilities[0] === cap);
  if (t) return { type: t.id, label: t.label, name: t.label, capabilities: [cap] };
  const word = capabilityLabel(cap).split(" ")[0];
  return { type: "custom", label: "Custom", name: `${word} Agent`, capabilities: [cap] };
}

export type NewTeamInput = {
  id: string;
  name: string;
  icon: string;
  template: string;
  members: string[];
  goal: string;
};

// Server-side check of what the browser sent. Returns an error message or null.
export function checkNewTeam(input: unknown): string | null {
  const bad = "Something went wrong. Please try again.";
  if (!input || typeof input !== "object") return bad;
  const t = input as Record<string, unknown>;
  if (typeof t.id !== "string" || !TEAM_ID_RE.test(t.id)) return bad;
  if (typeof t.name !== "string" || !t.name.trim()) return "A team name is required.";
  if (!isTeamIcon(t.icon)) return bad;
  if (!isTeamTemplate(t.template)) return bad;
  if (cleanMemberIds(t.members) === null) return bad;
  if (typeof t.goal !== "string") return bad;
  return null;
}

// The row a new team is saved as. The legacy counters keep their defaults;
// the screen works its numbers out from leads.
export function buildTeam(input: NewTeamInput, createdAt = new Date().toISOString()): Team {
  return {
    id: input.id,
    name: input.name.trim().slice(0, TEAM_NAME_MAX),
    icon: input.icon,
    iconBg: iconBg(input.icon),
    description: "",
    goal: input.goal.trim().slice(0, TEAM_GOAL_MAX),
    members: cleanMemberIds(input.members) ?? [],
    activity: [],
    meetings: 0,
    pipeline: "-",
    leads: 0,
    template: isTeamTemplate(input.template) ? input.template : "custom",
    createdAt,
  };
}
