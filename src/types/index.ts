// Shared entity shapes used across resolvers, services, repositories, and the
// frontend. These mirror the database schema documented in CONTEXT.md §4, in
// app-shaped camelCase (repositories translate from snake_case columns).

export type Restaurant = {
  id: number;
  name: string;
  // '' means "not provided", stored NOT NULL DEFAULT '' so the composite
  // unique identity constraint (name, phone, address) stays airtight.
  phone: string;
  address: string;
  website: string | null;
  menuUrl: string | null;
  // Atlassian accountId of whoever first added it. Attribution only
  // user can edit any restaurant (CONTEXT.md §3.10).
  createdBy: string;
};

// Payload the frontend sends when adding a restaurant to the caller's pool.
export type AddRestaurantInput = {
  name: string;
  phone?: string;
  address?: string;
  website?: string;
  menuUrl?: string;
};

// addRestaurant never fails on duplicates... reports what it did instead,
// so the frontend can message appropriately (CONTEXT.md §3.10).
export type AddRestaurantOutcome =
  | "created"
  | "linked-existing"
  | "resurrected";

export type AddRestaurantResult = {
  restaurant: Restaurant;
  outcome: AddRestaurantOutcome;
};
