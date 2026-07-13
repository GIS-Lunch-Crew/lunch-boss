# Storage

## Forge KVS is the only persistence

The app uses Forge Key-Value Store (`@forge/kvs`) exclusively — there is no Forge SQL, no Custom Entities, no external database. All storage logic lives in `src/resolvers/index.js`.

Requires the `storage:app` scope, declared in `manifest.yml`:

```yaml
permissions:
  scopes:
    - storage:app
```

## Schema

One key per user, holding that user's full restaurant list as a single JSON value:

```
key:   restaurants:${accountId}
value: string[]   // e.g. ["Pizza Palace", "Taco Town"]
```

`accountId` comes from `req.context.accountId` inside the resolver (see [`security.md`](./security.md) for why this specific source matters). There is no per-restaurant key, no separate index, no other entity type — the entire list is read and written as one value via `kvs.get`/`kvs.set`.

## Sanitization rules (`saveRestaurants` in `src/resolvers/index.js`)

Applied server-side before every write, regardless of what the client sends:

- Trim whitespace.
- Drop empty strings after trimming.
- Case-insensitive de-duplication (first occurrence wins).
- Truncate each name to 60 characters (`MAX_NAME_LENGTH`).
- Cap the list at 20 entries (`MAX_RESTAURANTS`) — this is a wheel-legibility limit (more wedges than that become hard to read/click), not a KVS size concern.

`saveRestaurants` returns the sanitized array so the frontend can reconcile its optimistic local state with the server's canonical result.

## Write model: full-array-replace, no debounce

There are only two resolver functions — `getRestaurants` and `saveRestaurants` — no separate `addRestaurant`/`removeRestaurant` endpoints. The frontend always holds the complete list in state for rendering, so on every add/remove it just sends the whole updated array. This avoids duplicating validation/dedupe logic across multiple endpoints.

Writes happen immediately on every add/remove (no debounce) — each is already a discrete, infrequent user action for a single user, not rapid keystroke-driven input, so there's no batching benefit to defer them.

## Future considerations

The current schema assumes one independent restaurant list per individual user (`restaurants:${accountId}`) — there is no concept of a shared list, group, or team. Supporting data shared across multiple users would require a different key structure (not scoped to a single user's `accountId`) and corresponding access-control rules, neither of which exist today.
