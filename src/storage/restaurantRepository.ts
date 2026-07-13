import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { Restaurant } from "../types";

// Repository layer: the ONLY code that touches @forge/sql for the
// restaurants table. Decisionless by design (CONTEXT.md §7) it exposes
// lookups and writes; the service layer decides what to do with them.
// Row→object translation happens inline via SELECT ... AS camelCase.

// Includes deleted_at so the service can distinguish an active duplicate
// (link it) from a soft-deleted one (resurrect it) CONTEXT.md §3.10.
export type RestaurantWithDeletion = Restaurant & { deletedAt: string | null };

const SELECT_FIELDS = `
  id,
  name,
  phone,
  address,
  website,
  menu_url AS menuUrl,
  created_by AS createdBy,
  deleted_at AS deletedAt`;

// Identity lookup per CONTEXT.md §3.10: the caller passes already-normalized
// (trimmed, lowercased) values; stored values are normalized in SQL for the
// comparison. Soft-deleted rows are intentionally included.
export const findByNormalizedIdentity = async (
  name: string,
  phone: string,
  address: string,
): Promise<RestaurantWithDeletion | null> => {
  const result = await sql
    .prepare<RestaurantWithDeletion>(
      `SELECT ${SELECT_FIELDS}
       FROM restaurants
       WHERE LOWER(TRIM(name)) = ?
         AND LOWER(TRIM(phone)) = ?
         AND LOWER(TRIM(address)) = ?
       LIMIT 1`,
    )
    .bindParams(name, phone, address)
    .execute();

  return result.rows[0] ?? null;
};

export const findById = async (
  id: number,
): Promise<RestaurantWithDeletion | null> => {
  const result = await sql
    .prepare<RestaurantWithDeletion>(
      `SELECT ${SELECT_FIELDS}
       FROM restaurants
       WHERE id = ?
       LIMIT 1`,
    )
    .bindParams(id)
    .execute();

  return result.rows[0] ?? null;
};

export const insert = async (input: {
  name: string;
  phone: string;
  address: string;
  website: string | null;
  menuUrl: string | null;
  createdBy: string;
}): Promise<number> => {
  const result = await sql
    .prepare<UpdateQueryResponse>(
      `INSERT INTO restaurants (name, phone, address, website, menu_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bindParams(
      input.name,
      input.phone,
      input.address,
      input.website,
      input.menuUrl,
      input.createdBy,
    )
    .execute();

  return result.rows.insertId;
};

export const update = async (
  id: number,
  input: {
    name: string;
    phone: string;
    address: string;
    website: string | null;
    menuUrl: string | null;
  },
): Promise<number> => {
  const result = await sql
    .prepare<UpdateQueryResponse>(
      `UPDATE restaurants
       SET name = ?, phone = ?, address = ?, website = ?, menu_url = ?
       WHERE id = ?`,
    )
    .bindParams(
      input.name,
      input.phone,
      input.address,
      input.website,
      input.menuUrl,
      id,
    )
    .execute();

  return result.rows.affectedRows;
};

// Clears a soft delete (CONTEXT.md §3.10 resurrect-on-readd).
export const resurrect = async (id: number): Promise<void> => {
  await sql
    .prepare<UpdateQueryResponse>(
      "UPDATE restaurants SET deleted_at = NULL WHERE id = ?",
    )
    .bindParams(id)
    .execute();
};
