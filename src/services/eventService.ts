import * as eventRepository from "../storage/eventRepository";
import * as eventTeamRepository from "../storage/eventTeamRepository";
import * as eventOrderRepository from "../storage/eventOrderRepository";
import * as restaurantRepository from "../storage/restaurantRepository";
import type {
  CreateEventInput,
  EventSummary,
  GetTodaysEventsInput,
  UpdateEventInput,
} from "../types";

// Business logic for outings (CONTEXT.md §7): no @forge/sql or @forge/resolver.
// Team membership and pool membership are enforced by the UI (you only pick
// your own teams / your own pool), so they're not re-checked here. Teams can't
// be deleted, so their existence is guaranteed.

// UTC instant string ("YYYY-MM-DD HH:MM:SS") → epoch ms, for the future/later
// comparisons the DB can't express.
const toMs = (instant: string): number =>
  new Date(`${instant.replace(" ", "T")}Z`).getTime();

export const createEvent = async (
  accountId: string,
  input: CreateEventInput,
): Promise<EventSummary> => {
  const restaurant = await restaurantRepository.findById(input.restaurantId);
  if (restaurant === null) {
    throw new Error("Restaurant not found.");
  }
  if (toMs(input.scheduledAt) <= Date.now()) {
    throw new Error("Outing time must be in the future.");
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

// Edit is Lunch-Boss-only and allowed only before the outing's time (frozen
// after). Restaurant is not editable; time may only move later; teams stay ≥1.
export const updateEvent = async (
  accountId: string,
  input: UpdateEventInput,
): Promise<void> => {
  const event = await eventRepository.findById(input.eventId);
  if (event === null) {
    throw new Error("Outing not found.");
  }
  if (event.hostAccountId !== accountId) {
    throw new Error("Only the Lunch Boss can edit this outing.");
  }
  if (toMs(event.scheduledAt) <= Date.now()) {
    throw new Error("This outing's time has passed; it can no longer be edited.");
  }

  if (input.scheduledAt !== undefined) {
    if (toMs(input.scheduledAt) <= Date.now()) {
      throw new Error("The new time must be in the future.");
    }
    if (toMs(input.scheduledAt) <= toMs(event.scheduledAt)) {
      throw new Error("You can only move an outing to a later time.");
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
    throw new Error("Outing not found.");
  }
  if (event.hostAccountId !== accountId) {
    throw new Error("Only the Lunch Boss can delete this outing.");
  }
  const orderCount = await eventOrderRepository.countByEvent(eventId);
  if (orderCount > 0) {
    throw new Error(
      "This outing already has orders and can't be deleted — step down instead.",
    );
  }
  await eventTeamRepository.removeByEvent(eventId);
  await eventRepository.remove(eventId);
};
