# Security

## Trusted identity: `req.context.accountId`, never client-supplied

The only thing that makes per-user data isolation in this app actually secure is where the user's `accountId` comes from. `src/resolvers/index.js` reads it from `req.context.accountId` inside the resolver — a value the Forge platform attaches to the request server-side. This is what's used to build the KVS key (`restaurants:${accountId}`, see [`database.md`](./database.md)).

The frontend never sends its own `accountId` to the resolver, and the resolver never trusts one if it did. `@forge/bridge`'s `view.getContext()` can also return an `accountId` client-side, but Atlassian's own docs are explicit that this value is not guaranteed secure/unalterable and must not be used for authorization — it's readable and modifiable in the browser. If a future change needs the user's identity on the frontend (e.g. to display something), it's fine to read it via `view.getContext()` for _display_ purposes, but any access-control decision must still be made resolver-side from `req.context`.

## Scopes

`storage:app` is the only scope currently declared (`manifest.yml`), required by `@forge/kvs`. No product API scopes (Jira/Confluence REST) are used — the app doesn't call `requestConfluence`/`requestJira` or any `asApp()`/`asUser()` product API today.

## UI Kit vs Custom UI context security

Both module types get contextual info through the same `@forge/bridge` methods, but the trust model differs: a **Custom UI resolver**'s context parameters are guaranteed secure and valid for authorization (same as any Forge resolver). The **Custom UI bridge**'s client-side `getContext()`/`view.getContext()` is not — treat anything read that way as informational/display-only, never as an authorization check. This app's module is Custom UI, so this distinction is directly relevant to any resolver work going forward.

## Future considerations

Today, "security" here really just means per-user key isolation — one user's KVS key can't collide with another's, and the key is derived from a trusted source. There's no actual authorization logic (no concept of "can this user read/write this data" beyond "it's always their own"). If data ever needs to be shared or read/written by more than one user, real authorization checks (who's allowed to see/modify what) would need to be added — per-user key isolation alone wouldn't be sufficient.
