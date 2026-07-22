import { sql } from "@forge/sql";
import type { EventOrder } from "../types";

// Repository for event_orders — orders submitted against an event. Submission
// logic ships in the Orders slice; until then listByEvent returns [] and
// countByEvent returns 0 (the table exists, empty).

// All orders on an event, submission order. Backs the detail page's table.
export const listByEvent = async (eventId: number): Promise<EventOrder[]> => {
  const result = await sql
    .prepare<EventOrder>(
      `SELECT
         account_id AS accountId,
         items,
         total,
         notes,
         submitted_at AS submittedAt
       FROM event_orders
       WHERE event_id = ?
       ORDER BY submitted_at`,
    )
    .bindParams(eventId)
    .execute();
  return result.rows;
};

export const countByEvent = async (eventId: number): Promise<number> => {
  const result = await sql
    .prepare<{ count: number }>(
      "SELECT COUNT(*) AS count FROM event_orders WHERE event_id = ?",
    )
    .bindParams(eventId)
    .execute();
  return Number(result.rows[0]?.count ?? 0);
};
