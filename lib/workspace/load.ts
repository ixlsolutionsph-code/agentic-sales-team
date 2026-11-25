import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { EMPTY_WORKSPACE, type WorkspaceData } from "@/lib/types";
import { toWorkspaceData } from "./shape";

type Row = Record<string, unknown>;

// Loads one workspace's agents, teams, agent config and states, team-member
// overrides and messages. Every query filters on the given workspace id.
export async function loadWorkspaceData(workspaceId: string): Promise<WorkspaceData> {
  if (!db) return EMPTY_WORKSPACE;
  const [agents, teams, config, states, teamMembers, messages] = await Promise.all([
    db.execute(sql`SELECT * FROM agents WHERE user_id = ${workspaceId}::uuid ORDER BY created_at ASC, id ASC`),
    db.execute(sql`SELECT * FROM teams WHERE user_id = ${workspaceId}::uuid ORDER BY created_at ASC, id ASC`),
    db.execute(sql`SELECT agent_id, role, goal, permissions, settings FROM agent_config WHERE user_id = ${workspaceId}::uuid`),
    db.execute(sql`SELECT agent_id, removed, paused FROM agent_states WHERE user_id = ${workspaceId}::uuid`),
    db.execute(sql`SELECT team_id, members FROM team_members WHERE user_id = ${workspaceId}::uuid`),
    db.execute(
      sql`SELECT id, agent_id, who, text, created_at FROM messages WHERE user_id = ${workspaceId}::uuid ORDER BY id ASC`,
    ),
  ]);
  return toWorkspaceData({
    agents: agents.rows as Row[],
    teams: teams.rows as Row[],
    config: config.rows as Row[],
    states: states.rows as Row[],
    teamMembers: teamMembers.rows as Row[],
    messages: messages.rows as Row[],
  });
}
