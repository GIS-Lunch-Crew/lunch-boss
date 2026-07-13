# Deployment

## Build order matters

Because the frontend is Custom UI, `forge deploy` ships whatever's already sitting in `static/lunch-boss/build/` — it does not build the frontend itself. The frontend **must** be built before deploying, or you'll deploy a stale (or missing) bundle:

```bash
npm install                # repo root: @forge/resolver, @forge/kvs
npm run build:frontend     # installs + builds static/lunch-boss -> static/lunch-boss/build/
forge lint
forge deploy --non-interactive -e <environment>
```

`npm run build:frontend` (defined in the root `package.json`) runs `npm ci && npm run build` inside `static/lunch-boss/`. The first time the frontend package's dependencies change, run a plain `npm install` there instead of relying on `npm ci` (which requires an existing, current lockfile).

## Scope changes require an upgrade install

`forge deploy` alone updates the code running in an environment. If a deploy adds/changes `permissions.scopes` (or egress) in `manifest.yml`, every site already installed under that environment needs to be explicitly upgraded, or it keeps running with the old permission grant:

```bash
forge install --non-interactive --upgrade --site <site-url> --product confluence -e <environment>
```

If a deploy doesn't touch scopes, no reinstall is needed — the deployed code takes effect on its own.

## Environment ≠ site — check the mapping before deploying

An "environment" name in this app's Forge config (e.g. `development`, `dev-person-a`) is not a fixed, self-evident thing — each environment maps to whichever site it was installed against, and that mapping isn't visible from the manifest. Run this before deploying if there's any doubt which site an environment targets:

```bash
forge install list
```

This matters because a deploy to an environment affects every site installed under it, immediately, whether or not that's the site you meant to change. During this project, an early deploy targeted at `-e development` turned out to be the environment mapped to the team's shared site (not the intended personal sandbox), because a personal install had actually been made under a differently-named environment. Always confirm the environment-to-site mapping with `forge install list` first rather than assuming a name like "development" is a safe default.

## Dev loop

Vite's own dev server doesn't work directly against the Forge iframe host — Custom UI resources are always loaded through Forge's proxy from the built static output, not a live dev server URL. The practical loop is:

```bash
# terminal 1
cd static/lunch-boss && npm run dev   # vite build --watch

# terminal 2
forge tunnel
```

Rebuild-on-save plus `forge tunnel` for hot reload of already-deployed code. Manifest changes (new scopes, new modules, etc.) still require a real `forge deploy` + tunnel restart — the tunnel doesn't pick those up on its own.
