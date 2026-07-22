import type Resolver from "@forge/resolver";
import {
  abandonEventSchema,
  createEventSchema,
  eventIdSchema,
  getTodaysEventsSchema,
  submitEventOrderSchema,
  updateEventOrderSchema,
  updateEventSchema,
} from "../validation/eventSchemas";
import * as eventService from "../services/eventService";
import { requireAccountId } from "./context";
import type {
  AbandonEventResult,
  EventDetail,
  EventOrder,
  EventSummary,
} from "../types";

export const registerEventResolvers = (resolver: Resolver): void => {
  resolver.define<unknown, EventSummary>(
    "createEvent",
    async ({ payload, context }) => {
      const input = createEventSchema.parse(payload);
      return eventService.createEvent(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, EventSummary[]>(
    "getTodaysEvents",
    async ({ payload, context }) => {
      const input = getTodaysEventsSchema.parse(payload);
      return eventService.getTodaysEvents(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, EventDetail>(
    "getEvent",
    async ({ payload, context }) => {
      const { eventId } = eventIdSchema.parse(payload);
      return eventService.getEvent(requireAccountId(context), eventId);
    },
  );

  resolver.define<unknown, void>(
    "updateEvent",
    async ({ payload, context }) => {
      const input = updateEventSchema.parse(payload);
      await eventService.updateEvent(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, AbandonEventResult>(
    "abandonEvent",
    async ({ payload, context }) => {
      const { eventId, deleteMyOrder } = abandonEventSchema.parse(payload);
      return eventService.abandonEvent(
        requireAccountId(context),
        eventId,
        deleteMyOrder ?? false,
      );
    },
  );

  resolver.define<unknown, void>(
    "claimEvent",
    async ({ payload, context }) => {
      const { eventId } = eventIdSchema.parse(payload);
      await eventService.claimEvent(requireAccountId(context), eventId);
    },
  );

  resolver.define<unknown, EventOrder>(
    "submitEventOrder",
    async ({ payload, context }) => {
      const input = submitEventOrderSchema.parse(payload);
      return eventService.submitEventOrder(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, void>(
    "updateEventOrder",
    async ({ payload, context }) => {
      const input = updateEventOrderSchema.parse(payload);
      await eventService.updateEventOrder(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, void>(
    "cancelEventOrder",
    async ({ payload, context }) => {
      const { eventId } = eventIdSchema.parse(payload);
      await eventService.cancelEventOrder(requireAccountId(context), eventId);
    },
  );

  resolver.define<unknown, void>(
    "placeEventOrders",
    async ({ payload, context }) => {
      const { eventId } = eventIdSchema.parse(payload);
      await eventService.placeEventOrders(requireAccountId(context), eventId);
    },
  );
};
