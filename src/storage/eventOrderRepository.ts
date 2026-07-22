import { sql } from "@forge/sql";

// Repository for event_orders — orders submitted against an outing. Submission
// logic ships in a later slice; for now the only method is the count used by
// the outing's delete guard (and, indirectly, visibility). Returns 0 until
// orders exist.
export const countByEvent = async (eventId: number): Promise<number> => {
  const result = await sql
    .prepare<{ count: number }>(
      "SELECT COUNT(*) AS count FROM event_orders WHERE event_id = ?",
    )
    .bindParams(eventId)
    .execute();
  return Number(result.rows[0]?.count ?? 0);
};
