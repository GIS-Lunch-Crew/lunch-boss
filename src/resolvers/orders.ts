import type Resolver from "@forge/resolver";
import {
  getOrdersSchema,
  submitOrderSchema,
  updateSubmissionSchema,
} from "../validation/orderSchemas";
import * as orderService from "../services/orderService";
import { requireAccountId } from "./context";
import type {
  CurrentSubmission,
  CurrentSubmissionResult,
  PlacedOrder,
} from "../types";

export const registerOrderResolvers = (resolver: Resolver): void => {
  resolver.define<void, CurrentSubmissionResult>(
    "getCurrentSubmission",
    async ({ context }) => ({
      submission: await orderService.getCurrentSubmission(
        requireAccountId(context),
      ),
    }),
  );

  resolver.define<unknown, CurrentSubmission>(
    "submitOrder",
    async ({ payload, context }) => {
      const input = submitOrderSchema.parse(payload);
      return orderService.submitOrder(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, void>(
    "updateSubmission",
    async ({ payload, context }) => {
      const input = updateSubmissionSchema.parse(payload);
      await orderService.updateSubmission(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, PlacedOrder[]>(
    "getOrders",
    async ({ payload, context }) => {
      const input = getOrdersSchema.parse(payload ?? {});
      return orderService.getOrders(requireAccountId(context), input);
    },
  );

  resolver.define<void, void>("clearSubmission", async ({ context }) => {
    await orderService.clearSubmission(requireAccountId(context));
  });

  resolver.define<void, void>("placeOrder", async ({ context }) => {
    await orderService.placeOrder(requireAccountId(context));
  });
};
