import React from "react";
import {
  Box,
  Button,
  Heading,
  Inline,
  Pressable,
  Spinner,
  Stack,
  Text,
  User,
  xcss,
} from "@forge/react";
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
const cardStyle = xcss({
  minWidth: "280px",
  minHeight: "160px",
  padding: "space.200",
  borderColor: "color.border",
  borderWidth: "border.width",
  borderStyle: "solid",
  borderRadius: "radius.small",
  backgroundColor: "elevation.surface",
});
const pressableInfoStyle = xcss({
  backgroundColor: "elevation.surface",
  padding: "space.0",
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
      <Inline spread="space-between" alignBlock="center">
        <Heading as="h2">Today's Events</Heading>
        <Button appearance="primary" isDisabled={busy} onClick={onStartOuting}>
          Be a Lunch Boss
        </Button>
      </Inline>
      {events === null ? (
        <Spinner label="Loading events" />
      ) : events.length === 0 ? (
        <Text>No events today yet — be a Lunch Boss!</Text>
      ) : (
        <Box xcss={scrollRow}>
          <Inline space="space.150" alignBlock="start">
            {events.map((event) => (
              <Box key={event.id} xcss={cardStyle}>
                <Stack space="space.100">
                  <Pressable
                    xcss={pressableInfoStyle}
                    isDisabled={busy}
                    onClick={() => onOpenEvent(event)}
                  >
                    <Stack space="space.100" alignInline="start">
                      <Heading as="h3">{event.restaurantName}</Heading>
                      <Text>{formatInstant(event.scheduledAt)}</Text>
                      {event.originalScheduledAt !== event.scheduledAt && (
                        <Stack space="space.0">
                          <Text size="small">Original Time:</Text>
                          <Text size="small">
                            {formatInstant(event.originalScheduledAt)}
                          </Text>
                        </Stack>
                      )}
                      {event.hostAccountId !== null && (
                        <User accountId={event.hostAccountId} />
                      )}
                      {/* Teams stack — the card grows down, not ever wider. */}
                      {event.teamIds.length > 0 ? (
                        <Stack space="space.025">
                          {event.teamIds.map((id) => (
                            <Text key={id}>{teamName(id)}</Text>
                          ))}
                        </Stack>
                      ) : (
                        <Text>—</Text>
                      )}
                    </Stack>
                  </Pressable>
                  {event.hostAccountId === null && (
                    <Inline>
                      <Button
                        appearance="primary"
                        isDisabled={busy || event.placedAt !== null}
                        onClick={() => onClaimEvent(event)}
                      >
                        Claim Bossdom
                      </Button>
                    </Inline>
                  )}
                </Stack>
              </Box>
            ))}
          </Inline>
        </Box>
      )}
    </Stack>
  );
};

export default OutingsSection;
