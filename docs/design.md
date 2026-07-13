# Design

## Theme: "diner specials board"

The visual direction is a chalkboard diner menu board, grounded in the lunch/restaurant subject rather than a generic light-background SaaS look. Palette and font tokens live in `static/lunch-boss/src/styles/global.css`.

| Token                | Hex       | Role                                                     |
| -------------------- | --------- | -------------------------------------------------------- |
| `--color-bg`         | `#24211d` | Page/app background (chalkboard)                         |
| `--color-bg-raised`  | `#2e2a24` | Input fields, restaurant chips                           |
| `--color-text`       | `#f4ede0` | Primary "chalk" text color                               |
| `--color-text-muted` | `#cabfa9` | Secondary/muted text                                     |
| `--color-mustard`    | `#e8a93b` | Primary accent — buttons, wheel hub, title               |
| `--color-tomato`     | `#d14d33` | Secondary accent — pointer, remove actions, winner stamp |
| `--color-basil`      | `#5c8a5f` | Wheel wedge alternate hue                                |
| `--color-butter`     | `#f6d67a` | Hover/glow highlight, focus outline                      |

Deliberately avoids the generic "warm cream background + serif + terracotta accent" AI-design default by going dark/chalkboard instead of light/cream.

## Typography

- **Display**: "Anton" (OFL-licensed, self-hosted as `static/lunch-boss/src/assets/fonts/Anton-Regular.woff2`, declared via `@font-face` in `global.css`). Used for the "LUNCH BOSS" title and the winner reveal. Self-hosted rather than CDN-linked because Forge's Custom UI static-resource model expects self-contained bundles — no external network calls for assets.
- **Body**: system-ui sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) for inputs, lists, and buttons — prioritizes legibility over personality for UI chrome.

## Layout

Single column, vertically stacked (`App.jsx` render order): marquee header → restaurant text input + "Add to the menu" button → removable restaurant chips → wheel with hub button → order ticket slot.

## The wheel (`components/Wheel.jsx`)

- Rendered as an SVG pie chart; wedge count = number of restaurants.
- Wedge fill colors cycle through the four theme hues (plus tints/shades for wheels with more than ~6 wedges) via `utils/colors.js`'s `getWedgeColors`, which explicitly checks and fixes the wrap-around case (first and last wedge are circularly adjacent too, not just sequential neighbors).
- The wheel only ever spins forward: rotation state is cumulative degrees, never reset to 0, so each spin's CSS `transition` always has a real value to animate from wherever the wheel last stopped.
- Spin trigger is the center hub button, styled like a retro diner counter bell — not a separate "Spin" button elsewhere in the layout. It's fully hidden (not just disabled) while a spin is in progress, so it can't be double-clicked mid-animation.
- Deceleration uses a `cubic-bezier(0.17, 0.67, 0.12, 0.99)` ease-out curve over a 4s CSS transition.

## Winner reveal (`components/OrderTicket.jsx`)

Instead of a generic confetti burst, the winner is revealed via a themed "order ticket" — a ticket-shaped element with the winner's name and an "ORDER UP!" stamp mark. It animates in with a scale+rotate "stamp" settle (`styles/OrderTicket.css`), gated behind `@media (prefers-reduced-motion: no-preference)`; the reduced-motion fallback is a plain opacity fade.

Long winner names are truncated with an ellipsis (`text-overflow: ellipsis`, single-line via `white-space: nowrap`) rather than allowed to wrap — see the next section for why.

## Fixed-height layout (`App.css` `.app__ticket-slot`)

Confluence Custom UI macros auto-resize their iframe to match content height. Early versions of this app rendered `OrderTicket` directly in the flex column and had it return `null` when there was no winner — which meant the ticket's height (and the flex `gap` around it) appeared and disappeared as spins started/completed, and the whole macro visibly resized on the page every cycle.

The fix: `OrderTicket` is always wrapped in a permanently-present `.app__ticket-slot` div with a fixed `height: 140px`. Whether a winner is set or not, this slot always occupies the same space, so the macro's overall height never changes across the idle → spinning → winner-revealed → spinning-again cycle. This is also why the winner name is forced single-line (a wrapped two-line name would blow past the fixed slot height and reintroduce the same jank).
