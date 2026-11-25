"use server";

// Thin server actions: read the session, check the input, then call the
// server-only modules with the active workspace id.
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { AGENT_ID_RE, buildAgent, checkNewAgent, type NewAgentInput } from "@/lib/agents/new";
import { cleanSettingsPatch, type CapSettings } from "@/lib/agents/settings";
import { insertAgent, markRemoved, setPaused, upsertAgentConfig } from "@/lib/agents/store";
import {
  TEAM_GOAL_MAX,
  TEAM_ID_RE,
  TEAM_NAME_MAX,
  buildTeam,
  checkNewTeam,
  cleanMemberIds,
  iconBg,
  isTeamIcon,
  type NewTeamInput,
} from "@/lib/teams/new";
import { deleteTeamRows, insertTeam, updateTeam, upsertTeamMembers } from "@/lib/teams/store";
import { EMPTY_WORKSPACE, type Agent, type Team, type WorkspaceData } from "@/lib/types";
import { loadWorkspaceData } from "./load";
import { getTeamLeads, getWorkspaceStats, type TeamLead } from "./stats";
import { EMPTY_WORKSPACE_STATS, type WorkspaceStats } from "./statsShape";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const TRY_AGAIN = "Something went wrong. Please try again.";

// The active workspace's data for the client store. Never throws: on any
// failure the app still opens, with empty lists.
export async function loadWorkspace(): Promise<WorkspaceData> {
  try {
    const s = await getSession();
    if (!s) return EMPTY_WORKSPACE;
    return await loadWorkspaceData(s.userId);
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE") throw e;
    console.error("loadWorkspace failed", e);
    return EMPTY_WORKSPACE;
  }
}

// Creates an agent from the wizard. The server builds the row itself, then
// saves agent_config.settings only if the Settings step set anything.
export async function saveAgent(input: NewAgentInput & { settings?: CapSettings | null }): Promise<ActionResult<Agent>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  const bad = checkNewAgent(input);
  if (bad) return fail(bad);
  let settings: CapSettings | null = null;
  if (input.settings != null) {
    settings = cleanSettingsPatch(input.settings);
    if (!settings) return fail(TRY_AGAIN);
    if (Object.keys(settings).length === 0) settings = null;
  }
  try {
    const agent = buildAgent(input);
    const ok = await insertAgent(s.userId, agent, settings);
    if (!ok) return fail(TRY_AGAIN);
    return { ok: true, data: agent };
  } catch (e) {
    console.error("saveAgent failed", e);
    return fail(MSG.serverDown);
  }
}

// Partial upsert of an agent's edits (role, goal, per-capability settings).
export async function saveAgentConfig(
  agentId: string,
  patch: { role?: string; goal?: string; settings?: CapSettings },
): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof agentId !== "string" || !AGENT_ID_RE.test(agentId) || !patch || typeof patch !== "object") return fail(TRY_AGAIN);
  const clean: { role?: string; goal?: string; settings?: CapSettings } = {};
  if (patch.role !== undefined) {
    if (typeof patch.role !== "string" || !patch.role.trim()) return fail(TRY_AGAIN);
    clean.role = patch.role.trim().slice(0, 80);
  }
  if (patch.goal !== undefined) {
    if (typeof patch.goal !== "string") return fail(TRY_AGAIN);
    clean.goal = patch.goal.trim().slice(0, 500);
  }
  if (patch.settings !== undefined) {
    const settings = cleanSettingsPatch(patch.settings);
    if (!settings) return fail(TRY_AGAIN);
    clean.settings = settings;
  }
  try {
    const ok = await upsertAgentConfig(s.userId, agentId, clean);
    return ok ? { ok: true } : fail("This agent was deleted or the link is wrong.");
  } catch (e) {
    console.error("saveAgentConfig failed", e);
    return fail(MSG.serverDown);
  }
}

export async function setAgentPaused(agentId: string, paused: boolean): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof agentId !== "string" || !AGENT_ID_RE.test(agentId) || typeof paused !== "boolean") return fail(TRY_AGAIN);
  try {
    const ok = await setPaused(s.userId, agentId, paused);
    return ok ? { ok: true } : fail("This agent was deleted or the link is wrong.");
  } catch (e) {
    console.error("setAgentPaused failed", e);
    return fail(MSG.serverDown);
  }
}

// Soft delete (agent_states.removed). The agents row stays.
export async function removeAgent(agentId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof agentId !== "string" || !AGENT_ID_RE.test(agentId)) return fail(TRY_AGAIN);
  try {
    const ok = await markRemoved(s.userId, agentId);
    return ok ? { ok: true } : fail("This agent was deleted or the link is wrong.");
  } catch (e) {
    console.error("removeAgent failed", e);
    return fail(MSG.serverDown);
  }
}

// ---------------------------------------------------------------- teams

const TEAM_GONE = "This team was deleted or the link is wrong.";

// Creates a team from the "Create a team" modal.
export async function saveTeam(input: NewTeamInput): Promise<ActionResult<Team>> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  const bad = checkNewTeam(input);
  if (bad) return fail(bad);
  try {
    const team = buildTeam(input);
    const ok = await insertTeam(s.userId, team);
    return ok ? { ok: true, data: team } : fail(TRY_AGAIN);
  } catch (e) {
    console.error("saveTeam failed", e);
    return fail(MSG.serverDown);
  }
}

// Edit team: name, icon and shared goal.
export async function editTeam(teamId: string, patch: { name: string; icon: string; goal: string }): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof teamId !== "string" || !TEAM_ID_RE.test(teamId) || !patch || typeof patch !== "object") return fail(TRY_AGAIN);
  if (typeof patch.name !== "string" || !patch.name.trim()) return fail("A team name is required.");
  if (!isTeamIcon(patch.icon) || typeof patch.goal !== "string") return fail(TRY_AGAIN);
  try {
    const ok = await updateTeam(s.userId, teamId, {
      name: patch.name.trim().slice(0, TEAM_NAME_MAX),
      icon: patch.icon,
      iconBg: iconBg(patch.icon),
      goal: patch.goal.trim().slice(0, TEAM_GOAL_MAX),
    });
    return ok ? { ok: true } : fail(TEAM_GONE);
  } catch (e) {
    console.error("editTeam failed", e);
    return fail(MSG.serverDown);
  }
}

// Saves the team's full member list (add or remove members).
export async function saveTeamMembers(teamId: string, members: string[]): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  const clean = cleanMemberIds(members);
  if (typeof teamId !== "string" || !TEAM_ID_RE.test(teamId) || clean === null) return fail(TRY_AGAIN);
  try {
    const ok = await upsertTeamMembers(s.userId, teamId, clean);
    return ok ? { ok: true } : fail(TEAM_GONE);
  } catch (e) {
    console.error("saveTeamMembers failed", e);
    return fail(MSG.serverDown);
  }
}

// Deletes the team and its member list. Chat messages are kept.
export async function deleteTeam(teamId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(MSG.serverDown);
  if (typeof teamId !== "string" || !TEAM_ID_RE.test(teamId)) return fail(TRY_AGAIN);
  try {
    const ok = await deleteTeamRows(s.userId, teamId);
    return ok ? { ok: true } : fail(TEAM_GONE);
  } catch (e) {
    console.error("deleteTeam failed", e);
    return fail(MSG.serverDown);
  }
}

// Dashboard and team-page numbers. Never throws: on any failure the numbers
// fall back to 0.
export async function loadStats(monthStartIso: string): Promise<WorkspaceStats> {
  try {
    const s = await getSession();
    if (!s) return EMPTY_WORKSPACE_STATS;
    const d = new Date(monthStartIso);
    const monthStart = Number.isNaN(d.getTime()) ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)) : d;
    return await getWorkspaceStats(s.userId, monthStart);
  } catch (e) {
    console.error("loadStats failed", e);
    return EMPTY_WORKSPACE_STATS;
  }
}

// The first 12 leads in a team's book. Never throws.
export async function loadTeamLeads(agentIds: string[]): Promise<{ leads: TeamLead[]; total: number }> {
  try {
    const s = await getSession();
    const ids = cleanMemberIds(agentIds);
    if (!s || ids === null) return { leads: [], total: 0 };
    return await getTeamLeads(s.userId, ids);
  } catch (e) {
    console.error("loadTeamLeads failed", e);
    return { leads: [], total: 0 };
  }
}
