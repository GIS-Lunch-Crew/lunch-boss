import Resolver from "@forge/resolver";
import { kvs } from "@forge/kvs";

const MAX_NAME_LENGTH = 60;
const MAX_RESTAURANTS = 20;

const storageKey = (accountId) => `restaurants:${accountId}`;

// Trims, drops empties, case-insensitively dedupes (keeping the first
// occurrence), and caps both name length and list size. The wheel needs a
// sane, legible wedge count, and KVS values should stay small.
const sanitizeRestaurants = (restaurants) => {
  if (!Array.isArray(restaurants)) {
    return [];
  }

  const seen = new Set();
  const sanitized = [];

  for (const rawName of restaurants) {
    if (typeof rawName !== "string") {
      continue;
    }

    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    const dedupeKey = name.toLowerCase();

    if (!name || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    sanitized.push(name);

    if (sanitized.length >= MAX_RESTAURANTS) {
      break;
    }
  }

  return sanitized;
};

const resolver = new Resolver();

resolver.define("getRestaurants", async (req) => {
  const { accountId } = req.context;
  const restaurants = await kvs.get(storageKey(accountId));
  return restaurants ?? [];
});

resolver.define("saveRestaurants", async (req) => {
  const { accountId } = req.context;
  const sanitized = sanitizeRestaurants(req.payload?.restaurants);
  await kvs.set(storageKey(accountId), sanitized);
  return sanitized;
});

export const handler = resolver.getDefinitions();
