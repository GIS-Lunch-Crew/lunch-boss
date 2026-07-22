import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";

// Repository for event_teams — which teams an outing is visible to. Rows are
// added at creation and replaced on edit.

type EventTeamRow = { eventId: number; teamId: number };

export const saveMany = async (
  eventId: number,
  teamIds: number[],
): Promise<void> => {
  if (teamIds.length === 0) {
    return;
  }
  const placeholders = teamIds.map(() => "(?, ?)").join(", ");
  const params: number[] = [];
  for (const teamId of teamIds) {
    params.push(eventId, teamId);
  }
  await sql
    .prepare<UpdateQueryResponse>(
      `INSERT IGNORE INTO event_teams (event_id, team_id) VALUES ${placeholders}`,
    )
    .bindParams(...params)
    .execute();
};

// Team ids for a set of outings, for assembling EventSummary.teamIds in one
// query rather than per-outing.
export const listByEvents = async (
  eventIds: number[],
): Promise<EventTeamRow[]> => {
  if (eventIds.length === 0) {
    return [];
  }
  const placeholders = eventIds.map(() => "?").join(", ");
  const result = await sql
    .prepare<EventTeamRow>(
      `SELECT event_id AS eventId, team_id AS teamId
       FROM event_teams
       WHERE event_id IN (${placeholders})`,
    )
    .bindParams(...eventIds)
    .execute();
  return result.rows;
};

export const removeByEvent = async (eventId: number): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>("DELETE FROM event_teams WHERE event_id = ?")
    .bindParams(eventId)
    .execute();
};

// Converge an outing's team set to exactly `teamIds` — a PUT on the set, not a
// wholesale delete+reinsert. Add any missing teams (INSERT IGNORE), then drop
// the ones no longer in the set; unchanged rows are left untouched. Insert
// before delete means a failure between the two statements leaves a superset,
// never an empty set (@forge/sql has no transactions). Callers guarantee
// teamIds is non-empty (zod), so the NOT IN list is never empty.
export const setTeams = async (
  eventId: number,
  teamIds: number[],
): Promise<void> => {
  await saveMany(eventId, teamIds);
  const placeholders = teamIds.map(() => "?").join(", ");
  await sql
    .prepare<UpdateQueryResponse>(
      `DELETE FROM event_teams
       WHERE event_id = ? AND team_id NOT IN (${placeholders})`,
    )
    .bindParams(eventId, ...teamIds)
    .execute();
};
