import React from "react";
import {
  Button,
  DynamicTable,
  Heading,
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
  onSelect,
  onEdit,
  onRemove,
}: Props) => {
  const rows = (restaurants ?? []).map((restaurant) => ({
    key: String(restaurant.id),
    cells: [
      { key: "name", content: restaurant.name },
      {
        key: "phone",
        content: restaurant.phone === "" ? "N/A" : restaurant.phone,
      },
      {
        key: "address",
        content: restaurant.address === "" ? "N/A" : restaurant.address,
      },
      // --- Row actions ---
      {
        key: "actions",
        content: (
          <Inline space="space.050">
            <Button
              appearance="subtle"
              isDisabled={busy || selectionDisabled}
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
    <Stack space="space.100">
      <Heading as="h2">My restaurant pool</Heading>
      {restaurants === null ? (
        <Spinner label="Loading your restaurants" />
      ) : restaurants.length === 0 ? (
        <Text>No restaurants exist yet. Add one above.</Text>
      ) : (
        <DynamicTable head={head} rows={rows} />
      )}
    </Stack>
  );
};

export default RestaurantTable;
