import React from "react";
import {
  Box,
  Button,
  DynamicTable,
  Inline,
  Spinner,
  Stack,
  Text,
  xcss,
} from "@forge/react";
import type { Restaurant } from "../../types";
import { SECTION_MIN_WIDTH } from "../layout";

// Floor width shared with the other tables — isFixedSize + per-column width
// keeps it stable instead of resizing as rows load.
const tableWrapStyle = xcss({ minWidth: SECTION_MIN_WIDTH });

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
    { key: "name", content: "Name", width: 30, shouldTruncate: true },
    { key: "phone", content: "Phone", width: 15 },
    { key: "address", content: "Address", width: 35, shouldTruncate: true },
    { key: "actions", content: "", width: 20 },
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
        <Box xcss={tableWrapStyle}>
          <DynamicTable
            head={head}
            rows={rows}
            isFixedSize
            highlightedRowIndex={
              highlightedRowIndex === -1 ? undefined : [highlightedRowIndex]
            }
          />
        </Box>
      )}
    </Stack>
  );
};

export default RestaurantTable;
