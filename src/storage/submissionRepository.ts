import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { CurrentSubmission } from "../types";

// Repository for user_current_submission — at most one row per user,
// enforced by PRIMARY KEY (account_id) (CONTEXT.md §3.12).

type SubmissionRow = Omit<CurrentSubmission, "total"> & {
  total: string | number | null;
};

export const findByAccount = async (
  accountId: string,
): Promise<CurrentSubmission | null> => {
  const result = await sql
    .prepare<SubmissionRow>(
      `SELECT
         s.restaurant_id AS restaurantId,
         r.name AS restaurantName,
         s.items,
         s.total,
         s.notes,
         s.submitted_at AS submittedAt
       FROM user_current_submission s
       JOIN restaurants r ON r.id = s.restaurant_id
       WHERE s.account_id = ?`,
    )
    .bindParams(accountId)
    .execute();

  const row = result.rows[0];
  if (!row) {
    return null;
  }
  // DECIMAL columns arrive as strings.
  return { ...row, total: row.total === null ? null : Number(row.total) };
};

export const insert = async (
  accountId: string,
  restaurantId: number,
  items: string | null,
  total: number | null,
  notes: string | null,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      `INSERT INTO user_current_submission (account_id, restaurant_id, items, total, notes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bindParams(accountId, restaurantId, items, total, notes)
    .execute();
};

export const updateDetails = async (
  accountId: string,
  items: string | null,
  total: number | null,
  notes: string | null,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "UPDATE user_current_submission SET items = ?, total = ?, notes = ? WHERE account_id = ?",
    )
    .bindParams(items, total, notes, accountId)
    .execute();
};

export const remove = async (accountId: string): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "DELETE FROM user_current_submission WHERE account_id = ?",
    )
    .bindParams(accountId)
    .execute();
};
