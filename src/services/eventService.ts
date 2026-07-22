import * as eventRepository from "../storage/eventRepository";
import * as eventTeamRepository from "../storage/eventTeamRepository";
import * as eventOrderRepository from "../storage/eventOrderRepository";
import * as restaurantRepository from "../storage/restaurantRepository";
import * as savedRestaurantRepository from "../storage/savedRestaurantRepository";
import type {
  CreateEventInput,
  EventDetail,
  EventOrder,
  EventSummary,
  GetTodaysEventsInput,
  SubmitEventOrderInput,
  UpdateEventInput,
  UpdateEventOrderInput,
} from "../types";

// Business logic for outings (CONTEXT.md §7): no @forge/sql or @forge/resolver.
// Team membership and pool membership are enforced by the UI (you only pick
// your own teams / your own pool), so they're not re-checked here. Teams can't
// be deleted, so their existence is guaranteed.

// UTC instant string ("YYYY-MM-DD HH:MM:SS") → epoch ms, for the future/later
// comparisons the DB can't express.
const toMs = (instant: string): number =>
  new Date(`${instant.replace(" ", "T")}Z`).getTime();

const orNull = (value: string | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export const createEvent = async (
  accountId: string,
  input: CreateEventInput,
): Promise<EventSummary> => {
  const restaurant = await restaurantRepository.findById(input.restaurantId);
  if (restaurant === null) {
    throw new Error("Restaurant not found.");
  }
  if (toMs(input.scheduledAt) <= Date.now()) {
    throw new Error("Event time must be in the future.");
  }
  // We do NOT resurrect a soft-deleted restaurant here. In the race where it's
  // deleted after the boss picked it, the outing is still valid — the
  // events→restaurants JOIN ignores deleted_at, so it displays fine.
  // TODO(slice 3): resurrect the restaurant when an order is submitted to the
  // outing, mirroring solo submitOrder (CONTEXT.md §3.12).

  const id = await eventRepository.insert({
    hostAccountId: accountId,
    createdBy: accountId,
    restaurantId: restaurant.id,
    scheduledAt: input.scheduledAt,
    originalScheduledAt: input.scheduledAt,
  });
  await eventTeamRepository.saveMany(id, input.teamIds);

  return {
    id,
    hostAccountId: accountId,
    createdBy: accountId,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    scheduledAt: input.scheduledAt,
    originalScheduledAt: input.scheduledAt,
    placedAt: null,
    teamIds: input.teamIds,
  };
};

export const getTodaysEvents = async (
  accountId: string,
  input: GetTodaysEventsInput,
): Promise<EventSummary[]> => {
  const rows = await eventRepository.listVisibleToday(
    accountId,
    input.from,
    input.to,
  );
  const teamRows = await eventTeamRepository.listByEvents(
    rows.map((row) => row.id),
  );
  const teamIdsByEvent = new Map<number, number[]>();
  for (const { eventId, teamId } of teamRows) {
    const list = teamIdsByEvent.get(eventId) ?? [];
    list.push(teamId);
    teamIdsByEvent.set(eventId, list);
  }
  return rows.map((row) => ({
    ...row,
    teamIds: teamIdsByEvent.get(row.id) ?? [],
  }));
};

// Single-event detail for the event page. Visibility (created it / a team of
// mine is targeted / I have an order) is baked into the repository query, so
// a hidden event and a nonexistent one both read "Event not found."
export const getEvent = async (
  accountId: string,
  eventId: number,
): Promise<EventDetail> => {
  const row = await eventRepository.findDetailById(eventId, accountId);
  if (row === null) {
    throw new Error("Event not found.");
  }
  const [teamRows, orders] = await Promise.all([
    eventTeamRepository.listByEvents([row.id]),
    eventOrderRepository.listByEvent(eventId),
  ]);
  return {
    ...row,
    teamIds: teamRows.map(({ teamId }) => teamId),
    orders,
    myOrder: orders.find((order) => order.accountId === accountId) ?? null,
  };
};

// --- Orders on an event ---
// All three writes start from findDetailById, so the getEvent visibility rule
// (created it / a team of mine is targeted / I have an order) also gates
// writes — a crafted invoke against a hidden event reads "Event not found."
// Once the event's time passes the order set is frozen: no submit/edit/cancel
// (placement is the only post-time action).

export const submitEventOrder = async (
  accountId: string,
  input: SubmitEventOrderInput,
): Promise<EventOrder> => {
  const event = await eventRepository.findDetailById(input.eventId, accountId);
  if (event === null) {
    throw new Error("Event not found.");
  }
  if (toMs(event.scheduledAt) <= Date.now()) {
    throw new Error(
      "This event's time has passed; orders can no longer be submitted.",
    );
  }
  const existing = await eventOrderRepository.findByEventAndAccount(
    input.eventId,
    accountId,
  );
  if (existing !== null) {
    throw new Error("You already have an order on this event.");
  }

  // Resurrect a soft-deleted restaurant on order submission (the race deferred
  // from createEvent), mirroring solo submitOrder. Unlike solo, the restaurant
  // is NOT auto-saved to the caller's pool — addToPool is the opt-in.
  const restaurant = await restaurantRepository.findById(event.restaurantId);
  if (restaurant !== null && restaurant.deletedAt !== null) {
    await restaurantRepository.resurrect(restaurant.id);
  }
  if (input.addToPool === true) {
    await savedRestaurantRepository.save(accountId, event.restaurantId);
  }

  // The check above is a friendly guard; the PRIMARY KEY on
  // (event_id, account_id) is the real one-per-person enforcement if two
  // devices race past it.
  await eventOrderRepository.insert(
    input.eventId,
    accountId,
    orNull(input.items),
    input.total ?? null,
    orNull(input.notes),
  );

  const created = await eventOrderRepository.findByEventAndAccount(
    input.eventId,
    accountId,
  );
  if (created === null) {
    throw new Error("Failed to create the order.");
  }
  return created;
};

// Overwrite semantics like solo updateSubmission: the form sends full state,
// an omitted field clears the stored one.
export const updateEventOrder = async (
  accountId: string,
  input: UpdateEventOrderInput,
): Promise<void> => {
  const event = await eventRepository.findDetailById(input.eventId, accountId);
  if (event === null) {
    throw new Error("Event not found.");
  }
  if (toMs(event.scheduledAt) <= Date.now()) {
    throw new Error(
      "This event's time has passed; orders can no longer be edited.",
    );
  }
  const existing = await eventOrderRepository.findByEventAndAccount(
    input.eventId,
    accountId,
  );
  if (existing === null) {
    throw new Error("No order on this event to update.");
  }
  await eventOrderRepository.updateDetails(
    input.eventId,
    accountId,
    orNull(input.items),
    input.total ?? null,
    orNull(input.notes),
  );
};

export const cancelEventOrder = async (
  accountId: string,
  eventId: number,
): Promise<void> => {
  const event = await eventRepository.findDetailById(eventId, accountId);
  if (event === null) {
    throw new Error("Event not found.");
  }
  if (toMs(event.scheduledAt) <= Date.now()) {
    throw new Error(
      "This event's time has passed; orders can no longer be canceled.",
    );
  }
  const existing = await eventOrderRepository.findByEventAndAccount(
    eventId,
    accountId,
  );
  if (existing === null) {
    throw new Error("No order on this event to cancel.");
  }
  await eventOrderRepository.remove(eventId, accountId);
};

// Edit is Lunch-Boss-only and allowed only before the outing's time (frozen
// after). Restaurant is not editable; time may only move later; teams stay ≥1.
export const updateEvent = async (
  accountId: string,
  input: UpdateEventInput,
): Promise<void> => {
  const event = await eventRepository.findById(input.eventId);
  if (event === null) {
    throw new Error("Event not found.");
  }
  if (event.hostAccountId !== accountId) {
    throw new Error("Only the Lunch Boss can edit this event.");
  }
  if (toMs(event.scheduledAt) <= Date.now()) {
    throw new Error("This event's time has passed; it can no longer be edited.");
  }

  if (input.scheduledAt !== undefined) {
    if (toMs(input.scheduledAt) <= Date.now()) {
      throw new Error("The new time must be in the future.");
    }
    if (toMs(input.scheduledAt) <= toMs(event.scheduledAt)) {
      throw new Error("You can only move an event to a later time.");
    }
    await eventRepository.updateScheduledAt(input.eventId, input.scheduledAt);
  }

  if (input.teamIds !== undefined) {
    await eventTeamRepository.setTeams(input.eventId, input.teamIds);
  }
};

// Delete is Lunch-Boss-only and allowed only when the outing has zero orders.
// With orders present the boss steps down instead (later slice).
export const deleteEvent = async (
  accountId: string,
  eventId: number,
): Promise<void> => {
  const event = await eventRepository.findById(eventId);
  if (event === null) {
    throw new Error("Event not found.");
  }
  if (event.hostAccountId !== accountId) {
    throw new Error("Only the Lunch Boss can delete this event.");
  }
  const orderCount = await eventOrderRepository.countByEvent(eventId);
  if (orderCount > 0) {
    throw new Error(
      "This event already has orders and can't be deleted — step down instead.",
    );
  }
  await eventTeamRepository.removeByEvent(eventId);
  await eventRepository.remove(eventId);
};
