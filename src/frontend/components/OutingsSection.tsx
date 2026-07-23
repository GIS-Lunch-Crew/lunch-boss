import React from "react";
import {
  Box,
  Button,
  Heading,
  Inline,
  Pressable,
  Stack,
  Text,
  User,
  xcss,
} from "@forge/react";
import LoadingIcon from "./LoadingIcon";
import type { EventSummary, Team } from "../../types";

type Props = {
  // null = still loading.
  events: EventSummary[] | null;
  // For mapping an outing's teamIds to names (the parent's allTeams).
  teams: Team[] | null;
  busy: boolean;
  onStartOuting: () => void;
  // Clicking a card opens the Event-detail page.
  onOpenEvent: (event: EventSummary) => void;
  // The bossless card's Claim Bossdom button. Always active — eligibility
  // (you need a submitted order) is enforced server-side, which answers
  // ineligible claimers with a guide message.
  onClaimEvent: (event: EventSummary) => void;
};

// Cards scroll horizontally; the Inline doesn't wrap, so it overflows and the
// Box scrolls.
const scrollRow = xcss({ overflow: "auto" });
// The card is a Box again (not one big Pressable) so the bossless card can
// hold a real Claim button — nested press targets aren't allowed. The info
// area stays clickable via an inner Pressable.
// The card box draws the border only — padding lives INSIDE the press areas
// so the click range reaches the drawn border with no dead rim.
const cardStyle = (event: EventSummary) =>
  xcss({
    minWidth: "360px",
    minHeight: "160px",
    borderColor: event.hasMyOrder
      ? "color.border.success"
      : "color.border.bold",
    borderWidth: "border.width.selected",
    borderStyle: "solid",
    borderRadius: "radius.small",
    backgroundColor: "elevation.surface",
    opacity: event.placedAt !== null ? "opacity.disabled" : undefined,
  });
// Bossed card: ONE press area covering the whole card. `height: 100%` makes
// it fill the stretched card box, so a shorter card is clickable to its
// bottom border, not just to where its content stops. Padding lives on the
// inner layout boxes (the press area itself is full-bleed).
const pressableCardStyle = xcss({
  backgroundColor: "elevation.surface",
  padding: "space.0",
  width: "100%",
  height: "100%",
  textAlign: "left",
  borderRadius: "radius.small",
});
// The tinted when/who band runs full-bleed, border to border.
const bandStyle = xcss({
  backgroundColor: "color.background.neutral",
  padding: "space.100",
  width: "100%",
});
// Inner layout boxes (inside the single press area).
const topPadStyle = xcss({
  paddingInline: "space.200",
  paddingBlockStart: "space.200",
  paddingBlockEnd: "space.100",
  width: "100%",
});
const bottomPadStyle = xcss({
  paddingInline: "space.200",
  paddingBlockStart: "space.100",
  paddingBlockEnd: "space.200",
  width: "100%",
});
// NOTE: the User chip resets the cursor to the arrow over itself, and UI
// Kit gives us no supported override (xcss allows neither `cursor` nor
// `pointerEvents`, and UserProps is just { accountId }). Click-through onto
// the surrounding press area still works; only the hover cursor is off.
// Fills the press area (a flex button that would otherwise center its
// content vertically in a stretched card) so rows anchor to the TOP with
// fixed spacing — restaurant, date, boss slot, and team rows sit at uniform
// offsets across cards, and the leftover height pools at the bottom.
const fillBoxStyle = xcss({ height: "100%", width: "100%" });
// Nudges the Claim Bossdom button down so it rides the same line as the
// User chip on neighboring cards (the chip renders a touch taller).
const claimNudgeStyle = xcss({ paddingBlockStart: "space.150" });
// One cell of the 2-wide team grid. Right padding gives the pills breathing
// room without breaking the no-gap Inline (which keeps columns aligned row
// over row); the last cell in a row loses the padding so it stays flush with
// the card's right edge.
const teamCellStyle = xcss({ width: "50%", paddingInlineEnd: "space.100" });
const teamCellLastStyle = xcss({ width: "50%" });
// A team name's pill — faded teal, fully rounded, bordered. Uses the
// design system's own pre-faded fill token rather than the `opacity`
// property: opacity applies to the whole subtree, so it was fading the
// team name text along with the fill/border, with no way to exclude a
// child from its parent's opacity.
const teamPillStyle = xcss({
  width: "100%",
  textAlign: "center",
  backgroundColor: "color.background.accent.teal.subtler",
  borderColor: "color.border.accent.teal",
  borderWidth: "border.width",
  borderStyle: "solid",
  borderRadius: "radius.full",
  paddingInline: "space.100",
  paddingBlockStart: "space.025",
  paddingBlockEnd: "space.025",
});

// Stored UTC instant ("YYYY-MM-DD HH:MM:SS") → the viewer's local time, to the
// minute (no seconds).
const formatInstant = (value: string): string => {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const OutingsSection = ({
  events,
  teams,
  busy,
  onStartOuting,
  onOpenEvent,
  onClaimEvent,
}: Props) => {
  const teamName = (id: number): string =>
    (teams ?? []).find((team) => team.id === id)?.name ?? `Team ${id}`;

  return (
    <Stack grow="fill" space="space.150">
      {/* The button hugs the heading — it must not drift outward with the
          width of the event strip. */}
      <Inline space="space.200" alignBlock="center" grow="fill">
        <Heading as="h2">Today's Events</Heading>
        <Button appearance="primary" isDisabled={busy} onClick={onStartOuting}>
          Be a Lunch Boss (New Event)
        </Button>
      </Inline>
      {events === null ? (
        <LoadingIcon />
      ) : events.length === 0 ? (
        <Text align="center">No events today yet. Be a Lunch Boss!</Text>
      ) : (
        <Box xcss={scrollRow}>
          {/* alignBlock="stretch" equalizes card heights across the row —
              the tallest (most teams) sets the height for all. The row is
              left-justified so the first card anchors to the left edge,
              whether or not the row overflows into horizontal scroll. */}
          <Inline space="space.150" alignBlock="stretch" grow="fill">
            {events.map((event) => {
              // 2-wide team grid rows; the card grows downward row by row and
              // the stretch above keeps sibling cards the same height. No gap
              // between the 50% cells so columns line up row over row.
              const teamRows: number[][] = [];
              for (let i = 0; i < event.teamIds.length; i += 2) {
                teamRows.push(event.teamIds.slice(i, i + 2));
              }
              const open = () => onOpenEvent(event);
              const dateBlock = (
                <Stack space="space.050" alignInline="center" grow="fill">
                  <Text>{formatInstant(event.scheduledAt)}</Text>
                  {event.originalScheduledAt !== event.scheduledAt && (
                    <Stack space="space.0" alignInline="center">
                      <Text size="small">Original Time:</Text>
                      <Text size="small">
                        {formatInstant(event.originalScheduledAt)}
                      </Text>
                    </Stack>
                  )}
                </Stack>
              );
              const teamsBlock =
                teamRows.length > 0 ? (
                  <Stack space="space.050" grow="fill" alignInline="stretch">
                    {teamRows.map((row) => (
                      <Inline key={row[0]} space="space.0" grow="fill">
                        {row.map((id, index) => (
                          <Box
                            key={id}
                            xcss={
                              index < row.length - 1
                                ? teamCellStyle
                                : teamCellLastStyle
                            }
                          >
                            <Box xcss={teamPillStyle}>
                              <Text>{teamName(id)}</Text>
                            </Box>
                          </Box>
                        ))}
                      </Inline>
                    ))}
                  </Stack>
                ) : (
                  <Text>—</Text>
                );

              // Bossed card: ONE press area — the whole card opens the event.
              // Bossless card: everything still opens the event except the
              // Claim Bossdom button itself (buttons can't nest in a press
              // area, so the press areas wrap around it).
              // One structure for both card types: the whole card is a
              // single press area (fills the stretched height). The band's
              // boss slot holds the User chip — or, when bossless, the Claim
              // Bossdom button, which handles its own click. The button's
              // click will also bubble to the card press (UI Kit exposes no
              // stopPropagation), so a claim may open the event page too —
              // by design, that shows the freshly claimed state.
              return (
                <Box key={event.id} xcss={cardStyle(event)}>
                  <Pressable
                    xcss={pressableCardStyle}
                    isDisabled={busy}
                    onClick={open}
                  >
                    <Box xcss={fillBoxStyle}>
                      <Stack space="space.0" alignInline="stretch">
                        <Box xcss={topPadStyle}>
                          <Heading as="h3">{event.restaurantName}</Heading>
                        </Box>
                        <Box xcss={bandStyle}>
                          <Stack space="space.100" alignInline="center">
                            {dateBlock}
                            {event.hostAccountId !== null ? (
                              <User accountId={event.hostAccountId} />
                            ) : (
                              <Box xcss={claimNudgeStyle}>
                                <Button
                                  appearance="primary"
                                  isDisabled={busy || event.placedAt !== null}
                                  onClick={() => onClaimEvent(event)}
                                >
                                  Claim Bossdom
                                </Button>
                              </Box>
                            )}
                          </Stack>
                        </Box>
                        <Box xcss={bottomPadStyle}>{teamsBlock}</Box>
                      </Stack>
                    </Box>
                  </Pressable>
                </Box>
              );
            })}
          </Inline>
        </Box>
      )}
    </Stack>
  );
};

export default OutingsSection;
