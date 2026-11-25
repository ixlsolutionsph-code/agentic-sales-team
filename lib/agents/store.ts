import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import type { Agent } from "@/lib/types";
import type { CapSettings } from "./settings";

// Every function takes the workspace id explicitly and only touches rows of
// that workspace. agent_config / agent_states rows are only written when the
// agent exists in the same workspace.

// Saves a new agent row and, in the same statement, its starting settings
// (only when the wizard's Settings step set something).
export async function insertAgent(workspaceId: string, a: Agent, settings: CapSettings | null): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`
    WITH a AS (
      INSERT INTO agents (user_id, id, name, initials, role, color, status, task, score, goal, char, type, capabilities)
      VALUES (${workspaceId}::uuid, ${a.id}, ${a.name}, ${a.initials}, ${a.role}, ${a.color}, ${a.status}, ${a.task},
              ${a.score}, ${a.goal}, ${a.char}::integer, ${a.type}, ${JSON.stringify(a.capabilities)}::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING user_id, id
    ), c AS (
      INSERT INTO agent_config (user_id, agent_id, settings)
      SELECT user_id, id, ${settings ? JSON.stringify(settings) : null}::jsonb FROM a
      WHERE ${settings !== null}::boolean
      RETURNING agent_id
    )
    SELECT id FROM a`);
  return res.rows.length === 1;
}

// Partial upsert of an agent's edits. Only the given fields change. Settings
// merge per capability: a capability in `patch.settings` replaces that
// capability's object; others are kept.
export async function upsertAgentConfig(
  workspaceId: string,
  agentId: string,
  patch: { role?: string; goal?: string; settings?: CapSettings },
): Promise<boolean> {
  const db = requireDb();
  const hasRole = patch.role !== undefined;
  const hasGoal = patch.goal !== undefined;
  const hasSettings = patch.settings !== undefined;
  const res = await db.execute(sql`
    INSERT INTO agent_config (user_id, agent_id, role, goal, settings)
    SELECT ${workspaceId}::uuid, ${agentId}, ${hasRole ? patch.role! : null}, ${hasGoal ? patch.goal! : null},
           ${hasSettings ? JSON.stringify(patch.settings) : null}::jsonb
    WHERE EXISTS (SELECT 1 FROM agents WHERE user_id = ${workspaceId}::uuid AND id = ${agentId})
    ON CONFLICT (user_id, agent_id) DO UPDATE SET
      role = CASE WHEN ${hasRole}::boolean THEN EXCLUDED.role ELSE agent_config.role END,
      goal = CASE WHEN ${hasGoal}::boolean THEN EXCLUDED.goal ELSE agent_config.goal END,
      settings = CASE WHEN ${hasSettings}::boolean
                      THEN COALESCE(agent_config.settings, '{}'::jsonb) || EXCLUDED.settings
                      ELSE agent_config.settings END
    RETURNING agent_id`);
  return res.rows.length === 1;
}

export async function setPaused(workspaceId: string, agentId: string, paused: boolean): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`
    INSERT INTO agent_states (user_id, agent_id, paused)
    SELECT ${workspaceId}::uuid, ${agentId}, ${paused}::boolean
    WHERE EXISTS (SELECT 1 FROM agents WHERE user_id = ${workspaceId}::uuid AND id = ${agentId})
    ON CONFLICT (user_id, agent_id) DO UPDATE SET paused = EXCLUDED.paused
    RETURNING agent_id`);
  return res.rows.length === 1;
}

// Soft delete: the agents row stays; agent_states.removed = true hides it.
export async function markRemoved(workspaceId: string, agentId: string): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`
    INSERT INTO agent_states (user_id, agent_id, removed)
    SELECT ${workspaceId}::uuid, ${agentId}, true
    WHERE EXISTS (SELECT 1 FROM agents WHERE user_id = ${workspaceId}::uuid AND id = ${agentId})
    ON CONFLICT (user_id, agent_id) DO UPDATE SET removed = true
    RETURNING agent_id`);
  return res.rows.length === 1;
}
