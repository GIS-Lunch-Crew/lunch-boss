import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";

// Repository for orders — immutable placed-order history (CONTEXT.md §3.12).
// Listing/filtering arrives with the order-history slice.

export const insert = async (
  accountId: string,
  restaurantId: number,
  items: string | null,
  total: number | null,
  notes: string | null,
): Promise<number> => {
  const result = await sql
    .prepare<UpdateQueryResponse>(
      `INSERT INTO orders (account_id, restaurant_id, items, total, notes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bindParams(accountId, restaurantId, items, total, notes)
    .execute();

  return result.rows.insertId;
};
