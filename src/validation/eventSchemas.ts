import { z } from "zod";

// Request validation at the resolver boundary only (CONTEXT.md §3.7). Time
// values are UTC instants ("YYYY-MM-DD HH:MM:SS") computed client-side; the
// future/later-only rules can't be expressed in zod (they compare to "now" and
// to the stored row), so they live in the service.
const instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "Expected YYYY-MM-DD HH:MM:SS");

export const createEventSchema = z.object({
  restaurantId: z.number().int().positive(),
  scheduledAt: instant,
  teamIds: z.array(z.number().int().positive()).min(1, "Pick at least one team"),
});

export const updateEventSchema = z.object({
  eventId: z.number().int().positive(),
  scheduledAt: instant.optional(),
  teamIds: z
    .array(z.number().int().positive())
    .min(1, "An event must keep at least one team")
    .optional(),
});

export const getTodaysEventsSchema = z.object({
  from: instant,
  to: instant,
});

export const eventIdSchema = z.object({
  eventId: z.number().int().positive(),
});
