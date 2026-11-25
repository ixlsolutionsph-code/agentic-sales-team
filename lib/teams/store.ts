import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import type { Team } from "@/lib/types";

// Every function takes the workspace id explicitly and only touches rows of
// that workspace.

export async function insertTeam(workspaceId: string, t: Team): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`
    INSERT INTO teams (user_id, id, name, icon, icon_bg, description, goal, members, template)
    VALUES (${workspaceId}::uuid, ${t.id}, ${t.name}, ${t.icon}, ${t.iconBg}, ${t.description}, ${t.goal},
            ${JSON.stringify(t.members)}::jsonb, ${t.template})
    ON CONFLICT DO NOTHING
    RETURNING id`);
  return res.rows.length === 1;
}

// Edit team: name, icon (and its tint) and the shared goal.
export async function updateTeam(
  workspaceId: string,
  teamId: string,
  patch: { name: string; icon: string; iconBg: string; goal: string },
): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`
    UPDATE teams SET name = ${patch.name}, icon = ${patch.icon}, icon_bg = ${patch.iconBg}, goal = ${patch.goal}
    WHERE user_id = ${workspaceId}::uuid AND id = ${teamId}
    RETURNING id`);
  return res.rows.length === 1;
}

// Saves the full member list in team_members (it replaces teams.members).
// Only written when the team exists in the same workspace.
export async function upsertTeamMembers(workspaceId: string, teamId: string, members: string[]): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`
    INSERT INTO team_members (user_id, team_id, members)
    SELECT ${workspaceId}::uuid, ${teamId}, ${JSON.stringify(members)}::jsonb
    WHERE EXISTS (SELECT 1 FROM teams WHERE user_id = ${workspaceId}::uuid AND id = ${teamId})
    ON CONFLICT (user_id, team_id) DO UPDATE SET members = EXCLUDED.members
    RETURNING team_id`);
  return res.rows.length === 1;
}

// Deletes the team and its member list. Its chat messages are kept.
export async function deleteTeamRows(workspaceId: string, teamId: string): Promise<boolean> {
  const db = requireDb();
  const res = await db.execute(sql`
    WITH m AS (
      DELETE FROM team_members WHERE user_id = ${workspaceId}::uuid AND team_id = ${teamId} RETURNING team_id
    )
    DELETE FROM teams WHERE user_id = ${workspaceId}::uuid AND id = ${teamId}
    RETURNING id`);
  return res.rows.length === 1;
}
