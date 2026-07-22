import React from "react";
import {
  Button,
  DynamicTable,
  Inline,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import type { Restaurant } from "../../types";

type Props = {
  restaurants: Restaurant[] | null;
  busy: boolean;
  // True while a submitted order exists — the restaurant is locked, so
  // starting a new selection is not allowed (CONTEXT.md §3.12).
  selectionDisabled: boolean;
  // The restaurant backing the current in-progress order, whether still
  // selecting or already submitted (CONTEXT.md §3.12).
  selectedRestaurantId: number | null;
  onSelect: (restaurant: Restaurant) => void;
  onEdit: (restaurant: Restaurant) => void;
  onRemove: (restaurantId: number) => void;
};

const head = {
  cells: [
    { key: "name", content: "Name" },
    { key: "phone", content: "Phone" },
    { key: "address", content: "Address" },
    { key: "actions", content: "" },
  ],
};

const RestaurantTable = ({
  restaurants,
  busy,
  selectionDisabled,
  selectedRestaurantId,
  onSelect,
  onEdit,
  onRemove,
}: Props) => {
  const highlightedRowIndex = (restaurants ?? []).findIndex(
    (restaurant) => restaurant.id === selectedRestaurantId,
  );

  const rows = (restaurants ?? []).map((restaurant) => ({
    key: String(restaurant.id),
    cells: [
      { key: "name", content: restaurant.name },
      {
        key: "phone",
        content: restaurant.phone === "" ? "—" : restaurant.phone,
      },
      {
        key: "address",
        content: restaurant.address === "" ? "—" : restaurant.address,
      },
      // --- Row actions ---
      {
        key: "actions",
        content: (
          <Inline space="space.050">
            <Button
              appearance="subtle"
              isDisabled={busy || selectionDisabled}
              isSelected={restaurant.id === selectedRestaurantId}
              onClick={() => onSelect(restaurant)}
            >
              Select
            </Button>
            <Button
              appearance="subtle"
              isDisabled={busy}
              onClick={() => onEdit(restaurant)}
            >
              Edit
            </Button>
            <Button
              appearance="subtle"
              isDisabled={busy}
              onClick={() => onRemove(restaurant.id)}
            >
              Remove
            </Button>
          </Inline>
        ),
      },
    ],
  }));

  return (
    <Stack grow="fill" space="space.100">
      {restaurants === null ? (
        <Spinner label="Loading your restaurants" />
      ) : restaurants.length === 0 ? (
        <Text>No restaurants exist yet. Add one above.</Text>
      ) : (
        <DynamicTable
          head={head}
          rows={rows}
          highlightedRowIndex={
            highlightedRowIndex === -1 ? undefined : [highlightedRowIndex]
          }
        />
      )}
    </Stack>
  );
};

export default RestaurantTable;
