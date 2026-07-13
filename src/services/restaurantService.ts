import * as restaurantRepository from '../storage/restaurantRepository';
import * as savedRestaurantRepository from '../storage/savedRestaurantRepository';
import type { AddRestaurantInput, AddRestaurantResult, Restaurant } from '../types';

// Service layer: business logic only. Never imports @forge/sql or
// @forge/resolver (CONTEXT.md §7) — storage goes through repositories, and
// payload validation already happened at the resolver boundary.

// "Exact match" for restaurant identity means normalized comparison:
// trimmed and lowercased (CONTEXT.md §3.10). We *store* what the user typed;
// we *compare* normalized.
const normalize = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

// Optional descriptive fields: empty string collapses to NULL in storage.
const orNull = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

// Adding a restaurant never fails on duplicates — per CONTEXT.md §3.10 the
// three outcomes are:
//   created          — no identity match; new row inserted
//   linked-existing  — active match found; just saved to the caller's pool
//   resurrected      — soft-deleted match found; deleted_at cleared first
// All three paths end with the restaurant in the caller's pool.
export const addRestaurant = async (
  accountId: string,
  input: AddRestaurantInput
): Promise<AddRestaurantResult> => {
  const existing = await restaurantRepository.findByNormalizedIdentity(
    normalize(input.name),
    normalize(input.phone),
    normalize(input.address)
  );

  if (existing === null) {
    const restaurant: Restaurant = {
      id: 0, // replaced with the real id below
      name: input.name.trim(),
      phone: (input.phone ?? '').trim(),
      address: (input.address ?? '').trim(),
      website: orNull(input.website),
      menuUrl: orNull(input.menuUrl),
      createdBy: accountId,
    };
    restaurant.id = await restaurantRepository.insert(restaurant);
    await savedRestaurantRepository.save(accountId, restaurant.id);
    return { restaurant, outcome: 'created' };
  }

  const wasDeleted = existing.deletedAt !== null;
  if (wasDeleted) {
    await restaurantRepository.resurrect(existing.id);
  }
  await savedRestaurantRepository.save(accountId, existing.id);

  const { deletedAt: _deletedAt, ...restaurant } = existing;
  return { restaurant, outcome: wasDeleted ? 'resurrected' : 'linked-existing' };
};

// Same identity check as adding, but pointed at every row except the one
// being edited (CONTEXT.md §3.10). Unlike create — where a duplicate links
// into the pool — an edit that collides with another restaurant is rejected.
export const updateRestaurant = async (
  restaurantId: number,
  input: AddRestaurantInput,
): Promise<void> => {
  const match = await restaurantRepository.findByNormalizedIdentity(
    normalize(input.name),
    normalize(input.phone),
    normalize(input.address),
  );
  if (match !== null && match.id !== restaurantId) {
    throw new Error(
      "Another restaurant with the same name, phone, and address already exists.",
    );
  }

  const affectedRows = await restaurantRepository.update(restaurantId, {
    name: input.name.trim(),
    phone: (input.phone ?? "").trim(),
    address: (input.address ?? "").trim(),
    website: orNull(input.website),
    menuUrl: orNull(input.menuUrl),
  });
  if (affectedRows === 0) {
    throw new Error("Restaurant not found.");
  }
};

export const getSavedRestaurants = async (accountId: string): Promise<Restaurant[]> =>
  savedRestaurantRepository.listByAccount(accountId);

export const removeSavedRestaurant = async (
  accountId: string,
  restaurantId: number
): Promise<void> => savedRestaurantRepository.remove(accountId, restaurantId);
