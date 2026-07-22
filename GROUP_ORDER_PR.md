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
- **Restaurant change window**: while an outing has **zero orders**, the Lunch
  Boss may change restaurant, time (later), and teams. Once **≥1 order** exists,
  the restaurant can no longer be changed; time stays editable (later-only) and
  teams stay editable.
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
