import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { Restaurant } from "../types";

// Repository for user_saved_restaurants each row is one restaurant in one
// user's pool. The user side is the Atlassian accountId from resolver
// context, not a users table (CONTEXT.md §3.3).

export const listByAccount = async (
  accountId: string,
): Promise<Restaurant[]> => {
  const result = await sql
    .prepare<Restaurant>(
      `SELECT
         r.id,
         r.name,
         r.phone,
         r.address,
         r.website,
         r.menu_url AS menuUrl,
         r.created_by AS createdBy
       FROM user_saved_restaurants usr
       JOIN restaurants r ON r.id = usr.restaurant_id
       WHERE usr.account_id = ?
         AND r.deleted_at IS NULL
       ORDER BY r.name`,
    )
    .bindParams(accountId)
    .execute();

  return result.rows;
};

// INSERT IGNORE makes saving idempotent: re-saving an already-saved
// restaurant is a silent no-op thanks to the composite primary key.
export const save = async (
  accountId: string,
  restaurantId: number,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "INSERT IGNORE INTO user_saved_restaurants (account_id, restaurant_id) VALUES (?, ?)",
    )
    .bindParams(accountId, restaurantId)
    .execute();
};

// Removes from the caller's pool only the restaurant row itself is
// untouched (other users may still have it saved).
export const remove = async (
  accountId: string,
  restaurantId: number,
): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "DELETE FROM user_saved_restaurants WHERE account_id = ? AND restaurant_id = ?",
    )
    .bindParams(accountId, restaurantId)
    .execute();
};
