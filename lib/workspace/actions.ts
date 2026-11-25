"use server";

// Thin server actions: read the session, check the input, then call the
// server-only modules with the active workspace id.
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/call-action";
import { MSG } from "@/lib/auth/rules";
import { AGENT_ID_RE, buildAgent, checkNewAgent, type NewAgentInput } from "@/lib/agents/new";
import { cleanSettingsPatch, type CapSettings } from "@/lib/agents/settings";
import { insertAgent, markRemoved, setPaused, upsertAgentConfig } from "@/lib/agents/store";
import { EMPTY_WORKSPACE, type Agent, type WorkspaceData } from "@/lib/types";
import { loadWorkspaceData } from "./load";

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
