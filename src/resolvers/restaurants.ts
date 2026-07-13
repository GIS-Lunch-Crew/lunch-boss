import type Resolver from "@forge/resolver";
import {
  addRestaurantSchema,
  restaurantIdSchema,
  updateRestaurantSchema,
} from "../validation/restaurantSchemas";
import * as restaurantService from "../services/restaurantService";
import { applyMigrations } from "../storage/migrations";
import type { AddRestaurantResult, Restaurant } from "../types";

// Resolver layer: thin by design (CONTEXT.md §7). Each handler only
// 1. reads the caller's identity from req.context (never from the payload
//    the frontend cannot assert who it is),
// 2. validates req.payload with zod, and
// 3. delegates to the service.

// context is loosely typed by @forge/resolver; accountId is always present
// for real invocations, but fail loudly rather than run queries against ''.
const requireAccountId = (context: { accountId?: unknown }): string => {
  if (typeof context.accountId !== "string" || context.accountId === "") {
    throw new Error("Missing accountId in resolver context");
  }
  return context.accountId;
};

export const registerRestaurantResolvers = (resolver: Resolver): void => {
  resolver.define<void, Restaurant[]>(
    "getSavedRestaurants",
    async ({ context }) =>
      restaurantService.getSavedRestaurants(requireAccountId(context)),
  );

  resolver.define<unknown, AddRestaurantResult>(
    "addRestaurant",
    async ({ payload, context }) => {
      const input = addRestaurantSchema.parse(payload);
      return restaurantService.addRestaurant(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, void>(
    "updateRestaurant",
    async ({ payload }) => {
      const { restaurantId, ...input } = updateRestaurantSchema.parse(payload);
      await restaurantService.updateRestaurant(restaurantId, input);
    },
  );

  resolver.define<unknown, void>(
    "removeSavedRestaurant",
    async ({ payload, context }) => {
      const { restaurantId } = restaurantIdSchema.parse(payload);
      await restaurantService.removeSavedRestaurant(
        requireAccountId(context),
        restaurantId,
      );
    },
  );

  // Dev helper: lets us apply migrations on demand from the UI while
  // tunnelling, instead of waiting for the hourly scheduled trigger.
  // Environment-gated on both sides: the frontend hides the button in
  // production, and this guard blocks direct invokes there too.
  resolver.define<void, string[]>("runMigrations", async ({ context }) => {
    if (context.environmentType === "PRODUCTION") {
      throw new Error("runMigrations is disabled in production.");
    }
    return applyMigrations();
  });
};
