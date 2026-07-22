import { z } from "zod";

// Request validation lives at the resolver boundary ONLY (CONTEXT.md §3.7):
// resolvers parse req.payload with these before any service or SQL runs.

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(255),
});

export const teamIdSchema = z.object({
  teamId: z.number().int().positive(),
});
