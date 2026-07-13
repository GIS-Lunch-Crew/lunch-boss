import * as restaurantRepository from "../storage/restaurantRepository";
import * as savedRestaurantRepository from "../storage/savedRestaurantRepository";
import * as submissionRepository from "../storage/submissionRepository";
import * as orderRepository from "../storage/orderRepository";
import type {
  CurrentSubmission,
  GetOrdersInput,
  PlacedOrder,
  SubmitOrderInput,
  UpdateSubmissionInput,
} from "../types";

// Order lifecycle logic (CONTEXT.md §3.12):
//   selecting (frontend only) → submitted (one per user) → placed (immutable).

const orNull = (value: string | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

export const getCurrentSubmission = async (
  accountId: string,
): Promise<CurrentSubmission | null> => submissionRepository.findByAccount(accountId);

export const submitOrder = async (
  accountId: string,
  input: SubmitOrderInput,
): Promise<CurrentSubmission> => {
  const existing = await submissionRepository.findByAccount(accountId);
  if (existing !== null) {
    throw new Error(
      "You already have a submitted order — place or clear it first.",
    );
  }

  const restaurant = await restaurantRepository.findById(input.restaurantId);
  if (restaurant === null) {
    throw new Error("Restaurant not found.");
  }
  // Invariant: submitting an order to a restaurant brings it back if it was
  // soft-deleted and ensures it's in the caller's pool (idempotent save).
  // Covers re-orders of deleted restaurants and the race where a restaurant
  // is deleted while someone has it selected.
  if (restaurant.deletedAt !== null) {
    await restaurantRepository.resurrect(restaurant.id);
  }
  await savedRestaurantRepository.save(accountId, restaurant.id);

  // The check above is a friendly guard; the PRIMARY KEY on account_id is
  // the real one-per-user enforcement if two devices race past it.
  await submissionRepository.insert(
    accountId,
    input.restaurantId,
    orNull(input.items),
    input.total ?? null,
    orNull(input.notes),
  );

  const created = await submissionRepository.findByAccount(accountId);
  if (created === null) {
    throw new Error("Failed to create the submitted order.");
  }
  return created;
};

// Overwrite semantics: total/notes are replaced with the provided values,
// and an omitted field clears the stored one (the form always sends the
// full current state). The restaurant cannot be changed here (§3.12).
export const updateSubmission = async (
  accountId: string,
  input: UpdateSubmissionInput,
): Promise<void> => {
  const existing = await submissionRepository.findByAccount(accountId);
  if (existing === null) {
    throw new Error("No submitted order to update.");
  }
  await submissionRepository.updateDetails(
    accountId,
    orNull(input.items),
    input.total ?? null,
    orNull(input.notes),
  );
};

export const getOrders = async (
  accountId: string,
  input: GetOrdersInput,
): Promise<PlacedOrder[]> =>
  orderRepository.listByAccount(accountId, input.from, input.to);

export const clearSubmission = async (accountId: string): Promise<void> => {
  await submissionRepository.remove(accountId);
};

export const placeOrder = async (accountId: string): Promise<void> => {
  const submission = await submissionRepository.findByAccount(accountId);
  if (submission === null) {
    throw new Error("No submitted order to place.");
  }
  await orderRepository.insert(
    accountId,
    submission.restaurantId,
    submission.items,
    submission.total,
    submission.notes,
  );
  await submissionRepository.remove(accountId);
};
