import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { PlacedOrder } from "../types";

// Repository for orders — immutable placed-order history (CONTEXT.md §3.12).

type OrderRow = Omit<PlacedOrder, "total"> & { total: string | number | null };

// The restaurants JOIN intentionally ignores deleted_at: history must keep
// showing a restaurant's name after it is soft-deleted.
export const listByAccount = async (
  accountId: string,
  from: string | undefined,
  to: string | undefined,
): Promise<PlacedOrder[]> => {
  const conditions = ["o.account_id = ?"];
  const params: (string | number)[] = [accountId];
  if (from !== undefined) {
    conditions.push("DATE(o.ordered_at) >= ?");
    params.push(from);
  }
  if (to !== undefined) {
    conditions.push("DATE(o.ordered_at) <= ?");
    params.push(to);
  }

  const result = await sql
    .prepare<OrderRow>(
      `SELECT
         o.id,
         o.restaurant_id AS restaurantId,
         r.name AS restaurantName,
         o.items,
         o.total,
         o.notes,
         o.ordered_at AS orderedAt
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY o.ordered_at DESC`,
    )
    .bindParams(...params)
    .execute();

  return result.rows.map((row) => ({
    ...row,
    total: row.total === null ? null : Number(row.total),
  }));
};

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
