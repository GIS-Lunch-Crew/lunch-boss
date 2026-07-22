# Group ("Team") Lunch Orders

## Context

Lunch Boss today is single-user: each person keeps a personal restaurant pool,
selects/randomizes a restaurant, submits one in-flight order, and places it into
their own history (`CONTEXT.md` §1, §3.12). The four SQL tables all key on
`account_id`; there is no concept of a team or a shared order.

We want groups to eat together **without** removing the solo experience. The
model:

- A person can join/create **Teams** (many per user).
- Anyone can start an **Outing** — a run to one restaurant at one time, visible
  to a chosen set of their teams. The person who starts it is that outing's
  **Lunch Boss**. Outings are not scarce: if you want a different one, you start
  your own. This deliberately avoids any "one Lunch Boss per team per day"
  scarcity and the rotation/voting machinery that would require.
- Teammates **submit orders to an outing**; after the outing's time passes,
  anyone who ordered can **place the whole batch** into everyone's history.
- The **solo flow is untouched** and remains the default. Ordering solo is just
  "having an order with no outing." A person can hold one solo order **and**
  orders on several outings at once (coffee with team A at 10, lunch with team B
  at 1).

Intended outcome: a group can coordinate a real lunch order end-to-end, while
someone with no team — or who just wants their own lunch — sees today's app
unchanged.

## Relationship to the existing single-user flow

Group ordering is **strictly additive**. Every decision in `CONTEXT.md` §3
stays in force and unchanged:

- `user_current_submission` (PK `account_id`) still means "my one in-flight solo
  order" and behaves exactly as today. Solo select/random/submit/edit/clear/
  place are unchanged.
- The solo submit-invariant (submitting auto-saves the restaurant to your pool,
  §3.12) is unchanged **for the solo flow**. Only _outing_ orders differ here —
  they do not auto-save (opt-in toggle instead; see Design Decisions).
- Solo selection/wheel still spins your own pool.
- Soft-delete, resurrect-on-readd, restaurant identity/normalization (§3.10),
  the three-stage order lifecycle (§3.12), zod-at-boundary (§3.7), and the
  resolver → service → repository layering (§7) all carry over untouched.

Group tables and resolvers layer on top; they do not modify the solo tables
(other than adding a nullable `event_id` to `orders`, which is `NULL` for every
solo order).

## Terminology

Internal identifiers may use neutral names (`host_account_id`, `events`), but
**all user-visible text uses the Lunch Boss vocabulary** — "Lunch Boss,"
"bossdom," "start an outing," "step down," "claim bossdom" — never "host."

## Working protocol for this build

If anything comes up during implementation that we **have not explicitly
discussed** — a schema choice, a UX behavior, an edge case, a naming call —
**stop and ask.** Do not decide it unilaterally, including in auto mode. An
undiscussed decision is out of scope until raised.

## Design Decisions

- **Teams**: many-per-user. Join from a dropdown of all site teams, or type a
  new name to create it. Name uniqueness is normalized (trim+lowercase) while
  storing what was typed — reuse the restaurant-identity normalization pattern
  (`CONTEXT.md` §3.10).
- **An outing has a restaurant from creation** (no restaurant-less outings for
  now).
- **Outing time is stored as an absolute instant (UTC)**, rendered in each
  viewer's local time. Time edits are **later-only** (new time must be after
  both the current time and now). The outing carries its original time so we can
  show "time changed, original X → current Y" and notify people who ordered.
- **Wheel / explicit selection for the Lunch Boss = the boss's own personal
  pool** (a cross-team union breaks down: a traveler joining another city's team
  would pollute the wheel — the NYC/LA case). The boss is the caller, so the
  existing `getSavedRestaurants` already returns the right pool — no new wheel
  plumbing.
- **Restaurant is fixed at creation** — it is never edited. To use a different
  restaurant, delete the outing (only possible with zero orders) and recreate.
- **Editing an outing**: the Lunch Boss may edit the **time (later only)** and
  the **teams (≥1)** at any time **before** the scheduled time. Editing has
  nothing to do with orders. After the scheduled time the outing is frozen (no
  edits).
- **Deleting an outing**: boss-only, allowed **only when the outing has zero
  orders** (the `event_orders` count check). With orders present, deletion is
  blocked — the boss steps down instead (slice 5).
- **Outing visibility**: an outing appears in a viewer's list when **any** of:
  (a) they created it, (b) one of their teams is targeted, or (c) they have an
  order on it. All three are queried; (c) simply can't be true until orders
  exist (slice 3).
- **After the scheduled time**: the only action is **Place all orders** — no new
  submissions, edits, or cancels. The order set is frozen.
- **Placement**: anyone with an order on the outing can place it, after the
  time. First placer wins; the batch lands in every participant's history.
- **Step down / claim**: the Lunch Boss can step down (the outing becomes "up
  for grabs"). Anyone with a submitted order can claim bossdom. To claim without
  an order, submit one first.
- **Pool add is opt-in for outing orders**: submitting to an outing does **not**
  auto-add the restaurant to your pool; the order form has an opt-in toggle
  (default **off**) to add it. (Solo flow keeps its auto-save, above.)
- **At-least-one-team per outing**: enforced in the service + frontend only (a
  cross-row count MySQL can't express as a constraint — no DB backstop, by
  design; also a step toward possible future private outings).
- **Deferred (not now)**: daily cleanup/sweep of prior-day unplaced outing
  orders and empty unplaced outings; team-owned curated restaurant pools;
  multiple bosses placing an outing in batches (each outing places once);
  graying out declined outings needs its own small table and can ship later.

## Data Model Additions

New tables (migrations are append-only — add v007+; never edit v001–v006):

**`teams`**
| column | type / notes |
|---|---|
| `id` | PK auto-increment |
| `name` | `NOT NULL` — stored as typed |
| `name_normalized` | `NOT NULL`, `UNIQUE` — trim+lowercase for dedupe |
| `created_by` | `account_id`, attribution only |
| `created_at` | timestamp |

**`team_members`** (a user's team memberships)
| column | type / notes |
|---|---|
| `account_id` | Atlassian account ID |
| `team_id` | FK → `teams.id` |
| | `PRIMARY KEY (account_id, team_id)` |

**`events`** (an outing)
| column | type / notes |
|---|---|
| `id` | PK auto-increment |
| `host_account_id` | `NULL` allowed — `NULL` = up for grabs. (User-visible: the outing's Lunch Boss) |
| `created_by` | `account_id`, immutable attribution |
| `restaurant_id` | FK → `restaurants.id`, `NOT NULL` |
| `scheduled_at` | timestamp (UTC instant), `NOT NULL` |
| `original_scheduled_at` | timestamp, set = `scheduled_at` at creation, never changed — powers "time changed" display |
| `placed_at` | `NULL` until placed |
| `created_at` | timestamp |

**`event_teams`** (which teams can see an outing)
| column | type / notes |
|---|---|
| `event_id` | FK → `events.id` |
| `team_id` | FK → `teams.id` |
| | `PRIMARY KEY (event_id, team_id)` |

**`event_orders`** (in-flight orders on an outing; one per person per outing)
| column | type / notes |
|---|---|
| `event_id` | FK → `events.id` |
| `account_id` | who ordered |
| `items` / `total` / `notes` | order details (same shape as solo submissions) |
| `submitted_at` | timestamp |
| | `PRIMARY KEY (event_id, account_id)` — one order per person per outing |

**`orders`** gains `event_id INT NULL` (`NULL` = solo order; set = placed from
that outing). Lets history show group context and lets us query orders by
team / Lunch Boss / date transitively through the outing.

**Unchanged:** `restaurants`, `user_saved_restaurants`,
`user_current_submission` (solo, PK `account_id`), and the solo columns on
`orders`. Solo flow keeps working exactly as-is.

---

## Build Order (vertical slices)

Built as end-to-end slices so each is demoable when its UI commit lands
(`CONTEXT.md` §8: every step deployable **and demonstrable**). Backend and UI
are usually separate commits within a slice; the slice becomes demoable at its
UI commit. This is purely commit ordering — the design/schema above is unchanged.

1. **Teams** — create / join / leave / list. *(Demo: make a team, join one.)*
2. **Start & see outings** — `events` + `event_teams`, create/read/edit backend,
   Home strip + create-outing UI. *(Demo: start an outing; a teammate sees it.)*
3. **Order on an outing** — `event_orders`, submit/edit/cancel, detail + order
   form + pool toggle. Also: `getEvent` detail resolver, and **resurrect the
   restaurant on order submission** (soft-deleted-restaurant race, like solo
   `submitOrder`). *(Demo: order on an outing.)*
4. **Place the batch** — `orders.event_id` + placement + place button.
   *(Demo: place; it lands in everyone's history.)*
5. **Step down / claim + time-change notice** — depends on orders existing, so
   it follows slice 3–4. *(Demo: boss steps down, an orderer claims; a time
   change notifies.)*
6. **Polish** — decline/gray-out (optional), docs.

---

## Implementation Log

### Commit 1 — order history dates timezone-correct (`4a93ac9`)

Prep, independent of the group feature: establishes the store-UTC /
convert-at-the-edges convention the outing-time work depends on. Order history
now maps the viewer's **local** calendar day to a UTC window on the way in, and
renders stored UTC timestamps in the viewer's **local** time on the way out.

| File                                       | Purpose                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/validation/orderSchemas.ts`           | `getOrders` now accepts `from`/`to` as UTC instants (`YYYY-MM-DD HH:MM:SS`) instead of `YYYY-MM-DD` dates.                                                                                                                      |
| `src/storage/orderRepository.ts`           | Filters `ordered_at` directly against a **half-open** UTC range (`>= from AND < to`) instead of `DATE(ordered_at)`. Fixes the near-midnight "wrong day" straddle and keeps the range sargable for `idx_orders_account_ordered`. |
| `src/frontend/index.tsx`                   | Converts each picked local calendar day into UTC instant bounds before invoking `getOrders`; the `DatePicker`/filter state still deal in local dates.                                                                           |
| `src/frontend/components/OrderHistory.tsx` | `formatDate` parses the zone-less DB timestamp as UTC and renders it in the viewer's local time; updated the now-stale filter caveat comment.                                                                                   |

### Commit 2 — Teams backend (schema + resolvers, no UI)

Slice 1, backend half: the data + API layer for teams. Backend only — the Teams
tab lands in the next commit. Create-or-join on a normalized name mirrors
`addRestaurant` (an existing name links you in rather than erroring); both paths
end with the caller as a member.

| File | Purpose |
| --- | --- |
| `src/storage/migrations.ts` | `v007_create_teams`, `v008_create_team_members`. `teams.name_normalized` has a UNIQUE backstop; `team_members` PK `(account_id, team_id)`. |
| `src/types/index.ts` | `Team`, `CreateTeamInput`, `CreateTeamResult` / `CreateTeamOutcome`. |
| `src/validation/teamSchemas.ts` | `createTeamSchema`, `teamIdSchema` (resolver-boundary zod). |
| `src/storage/teamRepository.ts` | `findByNormalizedName`, `findById`, `listAll`, `insert`. |
| `src/storage/teamMemberRepository.ts` | `save` (INSERT IGNORE, idempotent join), `remove`, `listByAccount`. |
| `src/services/teamService.ts` | `createTeam` (create-or-join), `joinTeam`, `leaveTeam`, `listTeams`, `getMyTeams`. |
| `src/resolvers/teams.ts` | Resolvers: `getTeams`, `getMyTeams`, `createTeam`, `joinTeam`, `leaveTeam`. |
| `src/resolvers/index.ts` | Registered the team resolvers. |

### Commit 3 — Teams UI (completes the teams slice)

Slice 1, UI half — the frontend over the commit-2 backend. Teams are now usable
end to end: create, join, and leave from a new **Teams** tab (position 3: Home /
Restaurants / Teams / History). `Select` isn't creatable, so joining an existing
team (dropdown) and creating/joining by name (text field) are separate controls.

| File | Purpose |
| --- | --- |
| `src/frontend/components/TeamsPanel.tsx` | New. "My teams" list with Leave buttons; a join `Select` (only teams you're not already in); a "Create or join by name" `Textfield` + button (leans on `createTeam`'s create-or-join). |
| `src/frontend/index.tsx` | `myTeams`/`allTeams` state; `refreshTeams` (parallel `getMyTeams` + `getTeams`) in the load effect; `handleCreateOrJoinByName` (message by outcome), `handleJoinTeam`, `handleLeaveTeam`; new Teams tab + panel. |

### Commit 4 — Outings backend (create / read / edit / delete, no UI)

Slice 2, backend half. An outing ("event") is one restaurant at one time,
hosted by a Lunch Boss, visible to a chosen set of teams. Backend only — the
outings UI is next. Also corrected the doc's edit/delete/visibility Design
Decisions (restaurant is fixed at creation; edit = later-time + teams before
the event time, frozen after; delete only at zero orders; visibility = created
/ my-team / have-an-order). `event_orders` is created here (empty) so the delete
guard and the "do I have an order?" visibility clause run now.

| File | Purpose |
| --- | --- |
| `src/storage/migrations.ts` | `v009_create_events`, `v010_create_event_teams`, `v011_create_event_orders` (table only). |
| `src/types/index.ts` | `EventSummary`, `CreateEventInput`, `UpdateEventInput`, `GetTodaysEventsInput`. |
| `src/validation/eventSchemas.ts` | `createEventSchema`, `updateEventSchema`, `getTodaysEventsSchema`, `eventIdSchema`. |
| `src/storage/eventRepository.ts` | `insert`, `listVisibleToday` (created-by-me / my-team / have-an-order), `findById`, `updateScheduledAt`, `remove`. |
| `src/storage/eventTeamRepository.ts` | `saveMany`, `listByEvents`, `removeByEvent`, `setTeams` (PUT — add missing, drop removed). |
| `src/storage/eventOrderRepository.ts` | `countByEvent` (delete guard; queried by visibility until order logic lands slice 3). |
| `src/services/eventService.ts` | `createEvent` (future-time; no resurrect — deferred), `getTodaysEvents`, `updateEvent` (boss-only; later-time + teams; frozen after event time), `deleteEvent` (boss-only; zero orders). |
| `src/resolvers/events.ts` | `createEvent`, `getTodaysEvents`, `updateEvent`, `deleteEvent`. |
| `src/resolvers/index.ts` | Registered the event resolvers. |

Deferred to slice 3: `getEvent` detail resolver; resurrect-on-order-submission.

### Commit 5 — Outings UI: today's strip + create (slice 2 demoable)

Slice 2, UI half — completes the slice. Home gains a "Today's outings" strip and
a "Start an outing" modal. Outings can be created for any future day; the strip
shows today's. Edit/delete land next.

| File | Purpose |
| --- | --- |
| `src/frontend/components/OutingsSection.tsx` | New. "Today's outings" heading + "Start an outing" button + horizontal-scroll cards (restaurant, local time, Lunch Boss via `User`, team names via `allTeams`). |
| `src/frontend/components/CreateOutingModal.tsx` | New. Restaurant `Select` (your pool), `DatePicker` + `TimePicker`, `CheckboxGroup` of your teams; parent combines date + time into a UTC instant. |
| `src/frontend/index.tsx` | `outings`/`createOutingOpen` state; `refreshOutings` (today's local-day bounds); `todayLocalDate` + `localDateTimeToUtc` helpers; `handleStartOuting`/`handleCreateOuting`; Home render (Current order → Today's outings → Stats) + modal. |

Notes: state is named `outings` (not `events`) to avoid colliding with the
bridge Events-API import; `TimePicker` is a Preview component.

### Commit 6 — spin-the-wheel in the create panel

Follow-on to slice 2 (a deferred fork): the Lunch Boss can pick the restaurant
by spinning the wheel from inside the "Be a Lunch Boss" panel, not just the
`Select`. Frontend only — the wheel already fetches the boss's own pool
(`getSavedRestaurants`), so no resolver/service/repository/SQL change.

The wheel Custom UI emits its winner to one shared Events-API channel
(`lunch-boss.wheel-result`). The host now disambiguates *why* the wheel was
spun via a `wheelPurposeRef` (a **ref**, not state — the `events.on` handler is
subscribed once with `[]` deps, so state would be captured stale and misroute a
create-panel spin to the solo order flow). The result is routed in-panel by a
**content-swap** (the wheel `Frame` replaces the form inside the same modal
body), so the modal never unmounts and the half-filled date/time/teams survive.

| File | Purpose |
| --- | --- |
| `src/frontend/index.tsx` | `wheelPurposeRef` + `createEventWheelWinner` state; `pickRandom` tags `"solo"`; the shared `events.on` handler branches (`"solo"` → `startSelection` unchanged, `"create-event"` → route to the create panel); `handleOpenCreateWheel` tags `"create-event"`; passes `wheelWinner` + `onOpenWheel` to the modal. |
| `src/frontend/components/CreateOutingModal.tsx` | "Spin the wheel" button beside a now-**controlled** Restaurant `Select` (pool 0 → disabled, pool 1 → instant fill, 2+ → spin, mirroring the solo rules); `showWheel` content-swap rendering the wheel `Frame` in the modal body; effects sync an arriving `wheelWinner` into the field and reset the wheel view whenever the modal closes. |

Solo flow (`WheelModal`, `pickRandom` pool-size rules, `startSelection`) is
unchanged apart from the one-line purpose tag.

### Commit 7 — Event-detail backend (`getEvent`) + backend "outing" string sweep

Events-slice backend half for the Event-detail page. (Re-slice note: the detail
page is where Events and Orders overlap, so the split is by *layer* — this
slice builds the whole page with every control rendered but inert; the Orders
slice then wires submit/edit/cancel, resurrect-on-submit, Add-to-Pool, and
placement.) `getEvent` bakes the same visibility rule as the today-list
(created-by-me / my-team / have-an-order) into its WHERE, so a hidden event and
a nonexistent one both read "Event not found." No date bound on the lookup —
deliberate, so a placed event stays openable in its preserved state. Also fixes
the 9 backend strings that leaked "outing" to users via error banners
(`describeError` surfaces `error.message` verbatim).

| File | Purpose |
| --- | --- |
| `src/types/index.ts` | `EventOrder` (one person's order on an event — same shape as `CurrentSubmission`, minus the restaurant, which lives on the event); `EventDetail` = `EventSummary` + restaurant contact fields (`address`, `phone`, `website`, `menuUrl`) + `orders: EventOrder[]` + server-computed `myOrder`. |
| `src/storage/eventRepository.ts` | `findDetailById(id, accountId)` — the detail select (summary fields + restaurant contact columns, same `deleted_at`-ignoring JOIN) with the visibility clause in the WHERE; not-visible returns `null`, indistinguishable from not-found. |
| `src/storage/eventOrderRepository.ts` | `listByEvent` — all orders on an event in submission order; returns `[]` until the Orders slice writes rows. |
| `src/services/eventService.ts` | `getEvent` — assembles the detail row + teamIds + orders + `myOrder` (found by the caller's accountId); `null` row → "Event not found." Also: 8 error strings reworded outing → event. |
| `src/validation/eventSchemas.ts` | The 9th string: "An outing must keep at least one team" → "An event must keep at least one team". |
| `src/resolvers/events.ts` | `getEvent` resolver, reusing the existing `eventIdSchema`. |

A definitive sweep confirms the only remaining "outing" occurrences are
internal identifiers (component/file names, element ids, the `outings` state),
never user-visible text.
