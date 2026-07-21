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

// The caller's one in-flight order (CONTEXT.md §3.12). The restaurant is
// locked once submitted; total/notes stay editable until placed or cleared.
export type CurrentSubmission = {
  restaurantId: number;
  restaurantName: string;
  // Free-text description of what was ordered ("items" because ORDER is a
  // reserved SQL keyword).
  items: string | null;
  total: number | null;
  notes: string | null;
  submittedAt: string;
};

// Resolver responses must never be a bare null — the bridge delivers null
// as an empty object, which the frontend can't distinguish from real data.
// Wrapping keeps the "no submission" case unambiguous.
export type CurrentSubmissionResult = {
  submission: CurrentSubmission | null;
};

export type SubmitOrderInput = {
  restaurantId: number;
  items?: string;
  total?: number;
  notes?: string;
};

export type UpdateSubmissionInput = {
  items?: string;
  total?: number;
  notes?: string;
};

// Immutable placed-order history (CONTEXT.md §3.12).
export type PlacedOrder = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  items: string | null;
  total: number | null;
  notes: string | null;
  orderedAt: string;
};

// Inclusive YYYY-MM-DD bounds; both optional.
export type GetOrdersInput = {
  from?: string;
  to?: string;
};

// Lightweight aggregate stats for the Home tab — computed in SQL so the
// frontend never has to fetch full order history just to show counts.
export type OrderStats = {
  totalRestaurants: number;
  totalOrders: number;
  topRestaurant: {
    restaurantId: number;
    restaurantName: string;
    count: number;
  } | null;
};
