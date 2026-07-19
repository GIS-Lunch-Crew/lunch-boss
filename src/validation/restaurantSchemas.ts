import { z } from 'zod';

// Request validation lives at the resolver boundary ONLY (CONTEXT.md §3.7):
// resolvers parse req.payload with these schemas before any service runs, so
// malformed requests never reach business logic or SQL.

export const addRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required').max(255),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(255).optional(),
  website: z.string().trim().max(255).optional(),
  menuUrl: z.string().trim().max(255).optional(),
});

export const restaurantIdSchema = z.object({
  restaurantId: z.number().int().positive(),
});

export const updateRestaurantSchema = addRestaurantSchema.extend({
  restaurantId: z.number().int().positive(),
});
