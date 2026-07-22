import React from "react";
import {
  Button,
  DynamicTable,
  Heading,
  Icon,
  Inline,
  Link,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  Pressable,
  Spinner,
  Stack,
  Strong,
  Text,
  User,
} from "@forge/react";
import EventOrderForm from "./EventOrderForm";
import type { EventDetail, EventSummary, Team } from "../../types";

type Props = {
  // The card the user clicked (null = closed). Seeds the instant paint —
  // restaurant, time, and teams render from it before getEvent returns.
  summary: EventSummary | null;
  // The full detail (null = still loading). Fills the order form, contact
  // fields, and the orders table.
  detail: EventDetail | null;
  // For mapping teamIds to names (the parent's allTeams).
  teams: Team[] | null;
  // True when the event's restaurant is already in the caller's pool.
  inPool: boolean;
  busy: boolean;
  onClose: () => void;
};

// Stored UTC instant ("YYYY-MM-DD HH:MM:SS") → the viewer's local time, to the
// minute (same rendering as the event cards).
const formatInstant = (value: string): string => {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const toMs = (instant: string): number =>
  new Date(`${instant.replace(" ", "T")}Z`).getTime();

// The Event-detail page (page-sized modal), top to bottom: the caller's order
// form; restaurant + time (large); team names; the restaurant's contact
// fields; the table of everyone's orders with Place All Orders at its top.
//
// Events slice: everything renders, nothing writes. The Orders slice wires
// the form and placement.
const EventDetailModal = ({
  summary,
  detail,
  teams,
  inPool,
  busy,
  onClose,
}: Props) => {
  if (summary === null) {
    return <ModalTransition>{null}</ModalTransition>;
  }

  const teamName = (id: number): string =>
    (teams ?? []).find((team) => team.id === id)?.name ?? `Team ${id}`;
  // Detail is fresher than the card's snapshot where both exist.
  const teamIds = detail?.teamIds ?? summary.teamIds;
  const scheduledAt = detail?.scheduledAt ?? summary.scheduledAt;
  const placedAt = detail?.placedAt ?? summary.placedAt;

  // Place All Orders: enabled only after the event's time AND for someone
  // with a submitted order on it; once placed it stays disabled and reads
  // "Orders Placed" (the preserved state).
  const placed = placedAt !== null;
  const timePassed = toMs(scheduledAt) <= Date.now();
  const canPlace =
    !busy && !placed && timePassed && detail !== null && detail.myOrder !== null;

  const orderRows = (detail?.orders ?? []).map((order) => ({
    key: `order-${order.accountId}`,
    cells: [
      { key: "person", content: <User accountId={order.accountId} /> },
      { key: "items", content: order.items ?? "—" },
      {
        key: "total",
        content: order.total != null ? `$${order.total.toFixed(2)}` : "—",
      },
      { key: "notes", content: order.notes ?? "—" },
    ],
  }));

  return (
    <ModalTransition>
      <Modal width="x-large" onClose={onClose}>
        <ModalHeader>
          <Inline grow="fill" spread="space-between" alignBlock="center">
            <ModalTitle>Event Details</ModalTitle>
            <Pressable onClick={onClose} isDisabled={busy}>
              <Icon glyph="cross" label="Close" />
            </Pressable>
          </Inline>
        </ModalHeader>
        <ModalBody>
          <Stack space="space.300">
            {detail === null ? (
              <Spinner label="Loading event" />
            ) : (
              <EventOrderForm
                myOrder={detail.myOrder}
                restaurantName={summary.restaurantName}
                inPool={inPool}
                busy={busy}
              />
            )}

            <Stack space="space.100">
              <Heading as="h2">{summary.restaurantName}</Heading>
              <Heading as="h2">{formatInstant(scheduledAt)}</Heading>
              <Inline space="space.300" shouldWrap>
                {teamIds.map((id) => (
                  <Heading key={id} as="h4">
                    {teamName(id)}
                  </Heading>
                ))}
              </Inline>
            </Stack>

            {detail !== null && (
              <Stack space="space.050">
                <Text>
                  <Strong>Address:</Strong> {detail.address || "—"}
                </Text>
                <Text>
                  <Strong>Website:</Strong>{" "}
                  {detail.website ? (
                    <Link href={detail.website} openNewTab>
                      {detail.website}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Text>
                <Text>
                  <Strong>Menu:</Strong>{" "}
                  {detail.menuUrl ? (
                    <Link href={detail.menuUrl} openNewTab>
                      {detail.menuUrl}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Text>
                <Text>
                  <Strong>Phone:</Strong> {detail.phone || "—"}
                </Text>
              </Stack>
            )}

            <Stack space="space.100">
              <Inline spread="space-between" alignBlock="center">
                <Heading as="h3">Orders</Heading>
                {/* Inert until the Orders slice wires placeEventOrders. */}
                <Button
                  appearance="primary"
                  isDisabled={!canPlace}
                  onClick={() => {}}
                >
                  {placed ? "Orders Placed" : "Place All Orders"}
                </Button>
              </Inline>
              {detail === null ? (
                <Spinner label="Loading orders" />
              ) : (
                <DynamicTable
                  head={{
                    cells: [
                      { key: "person", content: "Person" },
                      { key: "items", content: "Order" },
                      { key: "total", content: "Total" },
                      { key: "notes", content: "Notes" },
                    ],
                  }}
                  rows={orderRows}
                  emptyView={<Text>No orders on this event yet.</Text>}
                />
              )}
            </Stack>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button appearance="subtle" isDisabled={busy} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
};

export default EventDetailModal;
