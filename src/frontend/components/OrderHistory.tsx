import React from "react";
import {
  Button,
  DatePicker,
  DynamicTable,
  Heading,
  Inline,
  Label,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import type { PlacedOrder } from "../../types";

type Props = {
  orders: PlacedOrder[] | null;
  from: string | undefined;
  to: string | undefined;
  busy: boolean;
  // Re-ordering stages a new selection, so it's unavailable while a
  // submitted order exists (parent passes that in).
  reorderDisabled: boolean;
  onFilterChange: (from: string | undefined, to: string | undefined) => void;
  onReorder: (order: PlacedOrder) => void;
};

const head = {
  cells: [
    { key: "date", content: "Date" },
    { key: "restaurant", content: "Restaurant" },
    { key: "items", content: "Order" },
    { key: "total", content: "Total" },
    { key: "notes", content: "Notes" },
    { key: "actions", content: "" },
  ],
};

// MySQL DATETIME arrives as "YYYY-MM-DD HH:MM:SS".
const formatDate = (value: string): string => {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

// Local date as YYYY-MM-DD. Note: ordered_at is compared with DATE() in the
// database's clock (likely UTC), so near midnight "today" may straddle dates.
const todayLocal = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const OrderHistory = ({
  orders,
  from,
  to,
  busy,
  reorderDisabled,
  onFilterChange,
  onReorder,
}: Props) => {
  const filtered = from !== undefined || to !== undefined;

  const rows = (orders ?? []).map((order) => ({
    key: String(order.id),
    cells: [
      { key: "date", content: formatDate(order.orderedAt) },
      { key: "restaurant", content: order.restaurantName },
      { key: "items", content: order.items ?? "—" },
      {
        key: "total",
        content: order.total != null ? `$${order.total.toFixed(2)}` : "—",
      },
      { key: "notes", content: order.notes ?? "—" },
      {
        key: "actions",
        content: (
          <Button
            appearance="subtle"
            isDisabled={busy || reorderDisabled}
            onClick={() => onReorder(order)}
          >
            Re-order
          </Button>
        ),
      },
    ],
  }));

  return (
    <Stack space="space.100">
      <Heading as="h2">Order history</Heading>
      {/* --- Date filter controls --- */}
      <Inline space="space.200" alignBlock="end">
        <Stack space="space.050">
          <Label labelFor="historyFrom">From</Label>
          <DatePicker
            id="historyFrom"
            defaultValue={from}
            onChange={(value) => onFilterChange(value || undefined, to)}
          />
        </Stack>
        <Stack space="space.050">
          <Label labelFor="historyTo">To</Label>
          <DatePicker
            id="historyTo"
            defaultValue={to}
            onChange={(value) => onFilterChange(from, value || undefined)}
          />
        </Stack>
        <Button
          isDisabled={busy}
          onClick={() => {
            const today = todayLocal();
            onFilterChange(today, today);
          }}
        >
          Today
        </Button>
        {filtered && (
          <Button
            appearance="subtle"
            isDisabled={busy}
            onClick={() => onFilterChange(undefined, undefined)}
          >
            Clear filter
          </Button>
        )}
      </Inline>
      {orders === null ? (
        <Spinner label="Loading your orders" />
      ) : orders.length === 0 ? (
        <Text>
          {filtered
            ? "No orders in this date range."
            : "No orders yet — your placed orders will show up here."}
        </Text>
      ) : (
        <DynamicTable head={head} rows={rows} />
      )}
    </Stack>
  );
};

export default OrderHistory;
