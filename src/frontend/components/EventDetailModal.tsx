import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
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
  Stack,
  Strong,
  Text,
  User,
  xcss,
} from "@forge/react";
import EventOrderForm from "./EventOrderForm";
import LoadingIcon from "./LoadingIcon";
import type { EventDetail, EventSummary, Team } from "../../types";
import { SECTION_MIN_WIDTH } from "../layout";

// Floor width shared with the other tables — isFixedSize + per-column width
// keeps it stable instead of resizing as rows load.
const tableWrapStyle = xcss({ minWidth: SECTION_MIN_WIDTH });

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
  onSubmitOrder: (
    itemsText: string,
    totalText: string,
    notesText: string,
    addToPool: boolean,
  ) => void;
  onSaveOrder: (
    itemsText: string,
    totalText: string,
    notesText: string,
  ) => Promise<boolean>;
  onCancelOrder: () => void;
  onPlaceOrders: () => void;
  // The caller's accountId (from the view context; null until it loads) —
  // decides whether the top section shows the presiding or out-of-office view.
  myAccountId: string | null;
  onAbandon: (deleteMyOrder: boolean) => void;
  onClaim: () => void;
  onOpenEdit: () => void;
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
// Fully wired: the order form (submit/edit/cancel) and Place All Orders.
const EventDetailModal = ({
  summary,
  detail,
  teams,
  inPool,
  busy,
  onClose,
  onSubmitOrder,
  onSaveOrder,
  onCancelOrder,
  onPlaceOrders,
  myAccountId,
  onAbandon,
  onClaim,
  onOpenEdit,
}: Props) => {
  // The Abandon Bossdom checkbox ("Delete My Order"). Reset whenever a
  // different event opens — the modal component stays mounted across opens.
  const [deleteMyOrder, setDeleteMyOrder] = useState(false);
  const summaryId = summary?.id;
  useEffect(() => {
    setDeleteMyOrder(false);
  }, [summaryId]);

  if (summary === null) {
    return <ModalTransition>{null}</ModalTransition>;
  }

  const teamName = (id: number): string =>
    (teams ?? []).find((team) => team.id === id)?.name ?? `Team ${id}`;
  // Detail is fresher than the card's snapshot where both exist.
  const teamIds = detail?.teamIds ?? summary.teamIds;
  const scheduledAt = detail?.scheduledAt ?? summary.scheduledAt;
  const placedAt = detail?.placedAt ?? summary.placedAt;
  const hostAccountId = detail?.hostAccountId ?? summary.hostAccountId;
  const isBoss = myAccountId !== null && hostAccountId === myAccountId;

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
            {/* State-based top line: presiding boss / out-of-office. A
                non-boss viewing a bossed event sees no top section. Buttons
                disable once placed — placed is terminal (and the DB's
                conditional writes arbitrate any race). */}
            {isBoss && (
              <Inline spread="space-between" alignBlock="start">
                <Stack space="space.100">
                  <Text>You are currently presiding over this Event</Text>
                  <Inline>
                    <Button
                      isDisabled={busy || placed || timePassed}
                      onClick={onOpenEdit}
                    >
                      Edit Details
                    </Button>
                  </Inline>
                </Stack>
                <Stack space="space.050" alignInline="end">
                  <Button
                    isDisabled={busy || placed}
                    onClick={() => onAbandon(deleteMyOrder)}
                  >
                    Abandon Bossdom
                  </Button>
                  {detail?.myOrder && (
                    <Checkbox
                      label="Delete My Order"
                      isChecked={deleteMyOrder}
                      isDisabled={busy || placed}
                      onChange={() => setDeleteMyOrder((value) => !value)}
                    />
                  )}
                </Stack>
              </Inline>
            )}
            {hostAccountId === null && (
              <Inline spread="space-between" alignBlock="center">
                <Text>The Boss is out of office</Text>
                <Button
                  isDisabled={busy || placed}
                  onClick={onClaim}
                >
                  Claim Bossdom
                </Button>
              </Inline>
            )}

            {detail === null ? (
              <LoadingIcon />
            ) : (
              <EventOrderForm
                // Field state is local, read on mount — remount whenever the
                // caller's order changes so a write's result shows (same trick
                // as index.tsx's orderKey).
                key={
                  detail.myOrder
                    ? `my-${detail.myOrder.items ?? ""}-${detail.myOrder.total ?? ""}-${detail.myOrder.notes ?? ""}`
                    : "none"
                }
                myOrder={detail.myOrder}
                restaurantName={summary.restaurantName}
                inPool={inPool}
                busy={busy}
                onSubmitOrder={onSubmitOrder}
                onSaveOrder={onSaveOrder}
                onCancelOrder={onCancelOrder}
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
                <Button
                  appearance="primary"
                  isDisabled={!canPlace}
                  onClick={onPlaceOrders}
                >
                  {placed ? "Orders Placed" : "Place All Orders"}
                </Button>
              </Inline>
              {detail === null ? (
                <LoadingIcon />
              ) : (
                <Box xcss={tableWrapStyle}>
                  <DynamicTable
                    head={{
                      cells: [
                        { key: "person", content: "Person", width: 20 },
                        {
                          key: "items",
                          content: "Order",
                          width: 30,
                          shouldTruncate: true,
                        },
                        { key: "total", content: "Total", width: 15 },
                        {
                          key: "notes",
                          content: "Notes",
                          width: 35,
                          shouldTruncate: true,
                        },
                      ],
                    }}
                    rows={orderRows}
                    isFixedSize
                    emptyView={<Text>No orders on this event yet.</Text>}
                  />
                </Box>
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
