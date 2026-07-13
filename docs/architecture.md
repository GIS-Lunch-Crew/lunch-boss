# Architecture

Lunch Boss is a single Atlassian Forge app with one module: a Confluence macro (`lunch-boss-hello-world-macro` in `manifest.yml`). It has two halves — a Custom UI frontend and a backend resolver — that talk to each other through Forge's bridge/invoke mechanism.

## Why Custom UI, not UI Kit

The app originally started from Forge's `confluence-macro-ui-kit` template (UI Kit: `render: native`, frontend built with `@forge/react` components). UI Kit only renders a fixed set of native Atlassian components — there's no `<div>`, no SVG, no canvas, and no CSS transforms. The core feature (a spinning wheel with a real rotation animation) can't be built that way, so the app was migrated to **Custom UI**: the frontend is a standalone static web app (plain React, HTML, CSS) served in an iframe, built with Vite, and bundled into `static/lunch-boss/build/`.

`manifest.yml`'s module entry reflects this — no `render: native`, and its `resources` entry points at the built static directory rather than a source `.jsx` file directly:

```yaml
modules:
  macro:
    - key: lunch-boss-hello-world-macro
      resource: main
      resolver:
        function: resolver
      title: lunch-boss
resources:
  - key: main
    path: static/lunch-boss/build
```

`AGENTS.md` was updated alongside this migration to allow either UI Kit or Custom UI per-module going forward, rather than mandating UI Kit only — see its "Creating Apps" and "UI Development" sections.

## Backend

`src/index.js` re-exports the resolver handler; the actual logic lives in `src/resolvers/index.js`, using `@forge/resolver`. Two resolver functions exist:

- `getRestaurants` — reads the current user's saved restaurant list from Forge KVS.
- `saveRestaurants` — validates/sanitizes a submitted list and writes it back to KVS.

See [`database.md`](./database.md) for the storage schema and [`security.md`](./security.md) for how user identity is trusted.

## Frontend (`static/lunch-boss/`)

Built and bundled independently from the backend — it has its own `package.json`, `vite.config.js`, and dependency tree (React, `@forge/bridge`). Entry point is `src/main.jsx`, which mounts `App.jsx`.

Component/module breakdown:

- **`App.jsx`** — top-level orchestration only. Holds UI-only state (`inputValue`, `isSpinning`, `winner`) and wires together the other pieces. Delegates all persistence logic to `useRestaurants`.
- **`hooks/useRestaurants.js`** — owns the restaurant list's lifecycle: loads it via `invoke('getRestaurants')` on mount, and persists every add/remove immediately via `invoke('saveRestaurants', ...)` using an optimistic-update-then-reconcile-or-rollback pattern (see [`database.md`](./database.md) for why there's no debounce).
- **`components/Header.jsx`**, **`RestaurantInput.jsx`**, **`RestaurantList.jsx`** — presentational; validation/dedupe logic lives in the hook, not these components.
- **`components/Wheel.jsx`** + **`utils/wheelMath.js`** + **`utils/colors.js`** — the spinning wheel. `Wheel.jsx` renders an SVG wheel and a center hub button (the spin trigger); `wheelMath.js` computes wedge angles, picks a random winner index, and computes the CSS rotation target (cumulative, never resets to 0, so every spin animates forward from wherever the wheel last stopped); `colors.js` cycles wedge fill colors from the theme palette so adjacent wedges (including the wrap-around pair) never repeat.
- **`components/OrderTicket.jsx`** — the winner-reveal element. See [`design.md`](./design.md) for its animation and the fixed-height layout slot it lives in.

Frontend ↔ backend communication is exclusively through `@forge/bridge`'s `invoke(functionName, payload)`, which calls the matching `resolver.define(...)` function in `src/resolvers/index.js`. There is no other API surface.

## Testing

No test framework is set up yet (no Jest/RTL config, no test files). Changes are currently verified manually by building, deploying, and exercising the macro directly — see [`deployment.md`](./deployment.md).
