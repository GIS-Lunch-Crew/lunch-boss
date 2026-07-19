import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const getOrdersSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

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
