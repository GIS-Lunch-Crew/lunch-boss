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

// --- Teams (group ordering) ---

export type Team = {
  id: number;
  name: string;
  // Atlassian accountId of whoever created it (attribution only).
  createdBy: string;
};

export type CreateTeamInput = {
  name: string;
};

// Like addRestaurant, createTeam never fails on an existing (normalized) name:
// it links the caller to the existing team instead and reports which happened.
export type CreateTeamOutcome = "created" | "joined-existing";

export type CreateTeamResult = {
  team: Team;
  outcome: CreateTeamOutcome;
};

// --- Outings / events (group ordering) ---

// An outing in the day's list. Times are UTC instants ("YYYY-MM-DD HH:MM:SS"),
// rendered locally by the frontend. teamIds are the teams the outing targets.
// hostAccountId is the Lunch Boss (null = up for grabs). placedAt set = the
// batch was placed.
export type EventSummary = {
  id: number;
  hostAccountId: string | null;
  createdBy: string;
  restaurantId: number;
  restaurantName: string;
  scheduledAt: string;
  originalScheduledAt: string;
  placedAt: string | null;
  teamIds: number[];
};

export type CreateEventInput = {
  restaurantId: number;
  scheduledAt: string; // UTC instant
  teamIds: number[]; // ≥1
};

// Restaurant is fixed at creation, so it's not editable here. scheduledAt may
// only move later (service-enforced); teamIds must stay ≥1 when provided.
export type UpdateEventInput = {
  eventId: number;
  scheduledAt?: string;
  teamIds?: number[];
};

// Half-open UTC instant bounds for the viewer's local "today" (same convention
// as getOrders — computed client-side).
export type GetTodaysEventsInput = {
  from: string;
  to: string;
};

// Submitting an order to an event. Unlike solo, the restaurant isn't picked
// here (it's the event's) and isn't auto-saved to the pool — addToPool is the
// opt-in toggle (default off).
export type SubmitEventOrderInput = {
  eventId: number;
  items?: string;
  total?: number;
  notes?: string;
  addToPool?: boolean;
};

// Overwrite semantics like UpdateSubmissionInput: the form sends full state,
// an omitted field clears the stored one.
export type UpdateEventOrderInput = {
  eventId: number;
  items?: string;
  total?: number;
  notes?: string;
};

// What abandonEvent did: with orders remaining the event goes bossless
// ("abandoned"); with none it's deleted. The UI refreshes or closes on this.
export type AbandonEventResult = {
  outcome: "abandoned" | "deleted";
};

// One person's in-flight order on an event (event_orders row). Same order
// shape as CurrentSubmission; the restaurant lives on the event, not the row.
export type EventOrder = {
  accountId: string;
  items: string | null;
  total: number | null;
  notes: string | null;
  submittedAt: string;
};

// The event-detail page payload: the summary plus the restaurant's contact
// fields ('' means "not provided", as on Restaurant) and everyone's orders.
// myOrder is server-computed for the caller (null = hasn't ordered).
export type EventDetail = EventSummary & {
  address: string;
  phone: string;
  website: string | null;
  menuUrl: string | null;
  orders: EventOrder[];
  myOrder: EventOrder | null;
};
