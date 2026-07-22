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
};

// Cards scroll horizontally; the Inline doesn't wrap, so it overflows and the
// Box scrolls.
const scrollRow = xcss({ overflow: "auto" });
const cardStyle = xcss({
  minWidth: "size.1000",
  padding: "space.200",
  borderColor: "color.border",
  borderWidth: "border.width",
  borderStyle: "solid",
  borderRadius: "radius.small",
  backgroundColor: "elevation.surface",
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
              <Pressable
                key={event.id}
                xcss={cardStyle}
                isDisabled={busy}
                onClick={() => onOpenEvent(event)}
              >
                <Stack space="space.100" alignInline="start">
                  <Heading as="h3">{event.restaurantName}</Heading>
                  <Text>{formatInstant(event.scheduledAt)}</Text>
                  {event.hostAccountId ? (
                    <User accountId={event.hostAccountId} />
                  ) : (
                    <Text>Up for grabs</Text>
                  )}
                  <Text>
                    {event.teamIds.length > 0
                      ? event.teamIds.map(teamName).join(", ")
                      : "—"}
                  </Text>
                </Stack>
              </Pressable>
            ))}
          </Inline>
        </Box>
      )}
    </Stack>
  );
};

export default OutingsSection;
