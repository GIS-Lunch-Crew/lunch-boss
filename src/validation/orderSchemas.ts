import { z } from "zod";

// Half-open UTC instant bounds ("YYYY-MM-DD HH:MM:SS"), computed on the client
// from the picked local calendar day (see index.tsx). Compared directly against
// ordered_at so "today" means the viewer's local day, not the DB clock's.
const instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "Expected YYYY-MM-DD HH:MM:SS");

export const getOrdersSchema = z.object({
  from: instant.optional(),
  to: instant.optional(),
});

// Well under the total column's DECIMAL(10,2) ceiling (99999999.99) — a
// lunch order total anywhere near that is a typo, not a real value.
const MAX_TOTAL = 100000;

export const submitOrderSchema = z.object({
  restaurantId: z.number().int().positive(),
  items: z.string().trim().max(2000).optional(),
  total: z.number().nonnegative().max(MAX_TOTAL).optional(),
  notes: z.string().trim().max(1000).optional(),
});

// restaurantId deliberately absent: the restaurant is locked once submitted
// (CONTEXT.md §3.12) — clearing is the only way to change it.
export const updateSubmissionSchema = z.object({
  items: z.string().trim().max(2000).optional(),
  total: z.number().nonnegative().max(MAX_TOTAL).optional(),
  notes: z.string().trim().max(1000).optional(),
});
