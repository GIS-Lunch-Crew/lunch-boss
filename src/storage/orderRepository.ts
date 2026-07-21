import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { PlacedOrder } from "../types";

type TopRestaurantRow = {
  restaurantId: number;
  restaurantName: string;
  count: number;
};

export type OrderStatsRow = {
  totalOrders: number;
  topRestaurant: TopRestaurantRow | null;
};

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

// Home-tab aggregate stats: total orders placed, plus the most-ordered
// restaurant (ties broken by whichever MySQL returns first).
export const getStats = async (accountId: string): Promise<OrderStatsRow> => {
  const totalResult = await sql
    .prepare<{ totalOrders: number }>(
      `SELECT COUNT(*) AS totalOrders FROM orders WHERE account_id = ?`,
    )
    .bindParams(accountId)
    .execute();
  const totalOrders = Number(totalResult.rows[0]?.totalOrders ?? 0);

  const topResult = await sql
    .prepare<TopRestaurantRow>(
      `SELECT
         o.restaurant_id AS restaurantId,
         r.name AS restaurantName,
         COUNT(*) AS count
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.account_id = ?
       GROUP BY o.restaurant_id, r.name
       ORDER BY count DESC
       LIMIT 1`,
    )
    .bindParams(accountId)
    .execute();
  const topRow = topResult.rows[0];

  return {
    totalOrders,
    topRestaurant: topRow
      ? {
          restaurantId: topRow.restaurantId,
          restaurantName: topRow.restaurantName,
          count: Number(topRow.count),
        }
      : null,
  };
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
