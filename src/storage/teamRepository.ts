import { sql } from "@forge/sql";
import type { UpdateQueryResponse } from "@forge/sql";
import type { Team } from "../types";

// Repository for the teams table — the ONLY code touching @forge/sql for
// teams. Decisionless by design (CONTEXT.md §7): it exposes lookups and a
// write; the service decides create-vs-join. Row→object mapping is inline.

const SELECT_FIELDS = `id, name, created_by AS createdBy`;

// Normalized-name lookup: the caller passes an already trim+lowercased value,
// matched against the stored name_normalized column.
export const findByNormalizedName = async (
  nameNormalized: string,
): Promise<Team | null> => {
  const result = await sql
    .prepare<Team>(
      `SELECT ${SELECT_FIELDS} FROM teams WHERE name_normalized = ? LIMIT 1`,
    )
    .bindParams(nameNormalized)
    .execute();
  return result.rows[0] ?? null;
};

export const findById = async (id: number): Promise<Team | null> => {
  const result = await sql
    .prepare<Team>(`SELECT ${SELECT_FIELDS} FROM teams WHERE id = ? LIMIT 1`)
    .bindParams(id)
    .execute();
  return result.rows[0] ?? null;
};

export const listAll = async (): Promise<Team[]> => {
  const result = await sql
    .prepare<Team>(`SELECT ${SELECT_FIELDS} FROM teams ORDER BY name`)
    .execute();
  return result.rows;
};

export const insert = async (input: {
  name: string;
  nameNormalized: string;
  createdBy: string;
}): Promise<number> => {
  const result = await sql
    .prepare<UpdateQueryResponse>(
      `INSERT INTO teams (name, name_normalized, created_by)
       VALUES (?, ?, ?)`,
    )
    .bindParams(input.name, input.nameNormalized, input.createdBy)
    .execute();
  return result.rows.insertId;
};
