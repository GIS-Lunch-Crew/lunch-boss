import type Resolver from "@forge/resolver";
import {
  createEventSchema,
  eventIdSchema,
  getTodaysEventsSchema,
  updateEventSchema,
} from "../validation/eventSchemas";
import * as eventService from "../services/eventService";
import { requireAccountId } from "./context";
import type { EventSummary } from "../types";

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

  resolver.define<unknown, void>(
    "updateEvent",
    async ({ payload, context }) => {
      const input = updateEventSchema.parse(payload);
      await eventService.updateEvent(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, void>(
    "deleteEvent",
    async ({ payload, context }) => {
      const { eventId } = eventIdSchema.parse(payload);
      await eventService.deleteEvent(requireAccountId(context), eventId);
    },
  );
};
