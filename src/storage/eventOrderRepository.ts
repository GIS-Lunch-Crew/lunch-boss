import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { EventOrder } from "../types";

// Repository for event_orders — orders submitted against an event. At most one
// per person per event, enforced by PRIMARY KEY (event_id, account_id).

// DECIMAL columns arrive as strings (same as submissionRepository).
type EventOrderRow = Omit<EventOrder, "total"> & {
  total: string | number | null;
};

const toEventOrder = (row: EventOrderRow): EventOrder => ({
  ...row,
  total: row.total === null ? null : Number(row.total),
});

const SELECT_FIELDS = `
  account_id AS accountId,
  items,
  total,
  notes,
  submitted_at AS submittedAt`;

// All orders on an event, submission order. Backs the detail page's table.
export const listByEvent = async (eventId: number): Promise<EventOrder[]> => {
  const result = await sql
    .prepare<EventOrderRow>(
      `SELECT ${SELECT_FIELDS}
       FROM event_orders
       WHERE event_id = ?
       ORDER BY submitted_at`,
    )
    .bindParams(eventId)
    .execute();
  return result.rows.map(toEventOrder);
};

export const findByEventAndAccount = async (
  eventId: number,
  accountId: string,
): Promise<EventOrder | null> => {
  const result = await sql
    .prepare<EventOrderRow>(
      `SELECT ${SELECT_FIELDS}
       FROM event_orders
       WHERE event_id = ? AND account_id = ?
       LIMIT 1`,
    )
    .bindParams(eventId, accountId)
    .execute();
  const row = result.rows[0];
  return row ? toEventOrder(row) : null;
};

export const insert = async (
  eventId: number,
  accountId: string,
  items: string | null,
  total: number | null,
  notes: string | null,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      `INSERT INTO event_orders (event_id, account_id, items, total, notes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bindParams(eventId, accountId, items, total, notes)
    .execute();
};

export const updateDetails = async (
  eventId: number,
  accountId: string,
  items: string | null,
  total: number | null,
  notes: string | null,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "UPDATE event_orders SET items = ?, total = ?, notes = ? WHERE event_id = ? AND account_id = ?",
    )
    .bindParams(items, total, notes, eventId, accountId)
    .execute();
};

export const remove = async (
  eventId: number,
  accountId: string,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "DELETE FROM event_orders WHERE event_id = ? AND account_id = ?",
    )
    .bindParams(eventId, accountId)
    .execute();
};

// Which of the given event ids the caller has a submitted order on, for
// assembling EventSummary.hasMyOrder in one query rather than per-event.
export const listEventIdsWithOrder = async (
  accountId: string,
  eventIds: number[],
): Promise<number[]> => {
  if (eventIds.length === 0) {
    return [];
  }
  const placeholders = eventIds.map(() => "?").join(", ");
  const result = await sql
    .prepare<{ eventId: number }>(
      `SELECT event_id AS eventId
       FROM event_orders
       WHERE account_id = ? AND event_id IN (${placeholders})`,
    )
    .bindParams(accountId, ...eventIds)
    .execute();
  return result.rows.map((row) => row.eventId);
};

// Delete guard for the event (and, indirectly, visibility).
export const countByEvent = async (eventId: number): Promise<number> => {
  const result = await sql
    .prepare<{ count: number }>(
      "SELECT COUNT(*) AS count FROM event_orders WHERE event_id = ?",
    )
    .bindParams(eventId)
    .execute();
  return Number(result.rows[0]?.count ?? 0);
};
