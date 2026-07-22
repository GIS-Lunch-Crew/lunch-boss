import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";

// Repository for the events table — the ONLY code touching @forge/sql for
// events. Decisionless (CONTEXT.md §7): the service owns the rules. Row→object
// mapping is inline. teamIds are NOT selected here — the service assembles them
// via eventTeamRepository.

// EventSummary without teamIds (the service adds those). The restaurants JOIN
// omits deleted_at so an outing keeps showing its restaurant name even if the
// restaurant is later soft-deleted (same reasoning as order history).
export type EventRow = {
  id: number;
  hostAccountId: string | null;
  createdBy: string;
  restaurantId: number;
  restaurantName: string;
  scheduledAt: string;
  originalScheduledAt: string;
  placedAt: string | null;
};

const SELECT_FIELDS = `
  e.id,
  e.host_account_id AS hostAccountId,
  e.created_by AS createdBy,
  e.restaurant_id AS restaurantId,
  r.name AS restaurantName,
  e.scheduled_at AS scheduledAt,
  e.original_scheduled_at AS originalScheduledAt,
  e.placed_at AS placedAt`;

// Outings within [from, to) (the viewer's local day as UTC bounds) that are
// visible to the caller: they created it, one of their teams is targeted, or
// they have an order on it. The order-EXISTS clause queries an empty table
// until order submission ships, so it simply never matches for now.
export const listVisibleToday = async (
  accountId: string,
  from: string,
  to: string,
): Promise<EventRow[]> => {
  const result = await sql
    .prepare<EventRow>(
      `SELECT ${SELECT_FIELDS}
       FROM events e
       JOIN restaurants r ON r.id = e.restaurant_id
       WHERE e.scheduled_at >= ? AND e.scheduled_at < ?
         AND (
           e.created_by = ?
           OR EXISTS (
             SELECT 1 FROM event_teams et
             JOIN team_members tm ON tm.team_id = et.team_id
             WHERE et.event_id = e.id AND tm.account_id = ?
           )
           OR EXISTS (
             SELECT 1 FROM event_orders eo
             WHERE eo.event_id = e.id AND eo.account_id = ?
           )
         )
       ORDER BY e.scheduled_at`,
    )
    .bindParams(from, to, accountId, accountId, accountId)
    .execute();
  return result.rows;
};

// EventRow plus the restaurant's contact fields, for the detail page.
export type EventDetailRow = EventRow & {
  address: string;
  phone: string;
  website: string | null;
  menuUrl: string | null;
};

// Single-event read for the detail page, with the same visibility rule as
// listVisibleToday baked in: not visible to the caller → null, so the service
// reports it exactly like a nonexistent event.
export const findDetailById = async (
  id: number,
  accountId: string,
): Promise<EventDetailRow | null> => {
  const result = await sql
    .prepare<EventDetailRow>(
      `SELECT ${SELECT_FIELDS},
         r.address,
         r.phone,
         r.website,
         r.menu_url AS menuUrl
       FROM events e
       JOIN restaurants r ON r.id = e.restaurant_id
       WHERE e.id = ?
         AND (
           e.created_by = ?
           OR EXISTS (
             SELECT 1 FROM event_teams et
             JOIN team_members tm ON tm.team_id = et.team_id
             WHERE et.event_id = e.id AND tm.account_id = ?
           )
           OR EXISTS (
             SELECT 1 FROM event_orders eo
             WHERE eo.event_id = e.id AND eo.account_id = ?
           )
         )
       LIMIT 1`,
    )
    .bindParams(id, accountId, accountId, accountId)
    .execute();
  return result.rows[0] ?? null;
};

export const findById = async (id: number): Promise<EventRow | null> => {
  const result = await sql
    .prepare<EventRow>(
      `SELECT ${SELECT_FIELDS}
       FROM events e
       JOIN restaurants r ON r.id = e.restaurant_id
       WHERE e.id = ?
       LIMIT 1`,
    )
    .bindParams(id)
    .execute();
  return result.rows[0] ?? null;
};

export const insert = async (input: {
  hostAccountId: string;
  createdBy: string;
  restaurantId: number;
  scheduledAt: string;
  originalScheduledAt: string;
}): Promise<number> => {
  const result = await sql
    .prepare<UpdateQueryResponse>(
      `INSERT INTO events
         (host_account_id, created_by, restaurant_id, scheduled_at, original_scheduled_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bindParams(
      input.hostAccountId,
      input.createdBy,
      input.restaurantId,
      input.scheduledAt,
      input.originalScheduledAt,
    )
    .execute();
  return result.rows.insertId;
};

// First-placer-wins gate: the `placed_at IS NULL` condition means exactly one
// caller's UPDATE can land — everyone else affects 0 rows and reports "already
// placed". (The conditional-write pattern; no transaction needed.)
export const markPlaced = async (id: number): Promise<number> => {
  const result = await sql
    .prepare<UpdateQueryResponse>(
      "UPDATE events SET placed_at = CURRENT_TIMESTAMP WHERE id = ? AND placed_at IS NULL",
    )
    .bindParams(id)
    .execute();
  return result.rows.affectedRows;
};

export const updateScheduledAt = async (
  id: number,
  scheduledAt: string,
): Promise<number> => {
  const result = await sql
    .prepare<UpdateQueryResponse>(
      "UPDATE events SET scheduled_at = ? WHERE id = ?",
    )
    .bindParams(scheduledAt, id)
    .execute();
  return result.rows.affectedRows;
};

export const remove = async (id: number): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>("DELETE FROM events WHERE id = ?")
    .bindParams(id)
    .execute();
};
