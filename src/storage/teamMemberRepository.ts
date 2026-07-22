import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { Team } from "../types";

// Repository for team_members — each row is one user's membership in one team.
// The user side is the Atlassian accountId (CONTEXT.md §3.3), not a users table.

// INSERT IGNORE makes joining idempotent via the composite primary key:
// re-joining a team you're already in is a silent no-op.
export const save = async (
  accountId: string,
  teamId: number,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "INSERT IGNORE INTO team_members (account_id, team_id) VALUES (?, ?)",
    )
    .bindParams(accountId, teamId)
    .execute();
};

export const remove = async (
  accountId: string,
  teamId: number,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "DELETE FROM team_members WHERE account_id = ? AND team_id = ?",
    )
    .bindParams(accountId, teamId)
    .execute();
};

// The caller's teams, joined to team details, ordered by name.
export const listByAccount = async (accountId: string): Promise<Team[]> => {
  const result = await sql
    .prepare<Team>(
      `SELECT t.id, t.name, t.created_by AS createdBy
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.account_id = ?
       ORDER BY t.name`,
    )
    .bindParams(accountId)
    .execute();
  return result.rows;
};
