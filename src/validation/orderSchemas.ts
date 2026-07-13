import { z } from "zod";

export const submitOrderSchema = z.object({
  restaurantId: z.number().int().positive(),
  items: z.string().trim().max(2000).optional(),
  total: z.number().nonnegative().optional(),
  notes: z.string().trim().max(1000).optional(),
});

// restaurantId deliberately absent: the restaurant is locked once submitted
// (CONTEXT.md §3.12) — clearing is the only way to change it.
export const updateSubmissionSchema = z.object({
  items: z.string().trim().max(2000).optional(),
  total: z.number().nonnegative().optional(),
  notes: z.string().trim().max(1000).optional(),
});
