import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  DynamicTable,
  Heading,
  Inline,
  Link,
  Popup,
  Spinner,
  Stack,
  Text,
  Textfield,
  Tooltip,
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

type OptionalColumnKey = "phone" | "address" | "website" | "menuUrl";

const OPTIONAL_COLUMNS: { key: OptionalColumnKey; label: string }[] = [
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "website", label: "Website" },
  { key: "menuUrl", label: "Menu URL" },
];

const DEFAULT_VISIBLE_COLUMNS = new Set<OptionalColumnKey>([
  "phone",
  "address",
]);

// Truncates long text cells so a table row can never grow past a sane
// width — otherwise the whole page widens and pushes row actions offscreen.
const TruncatedCell = ({ value }: { value: string }) => (
  <Tooltip content={value}>
    <Box xcss={{ maxWidth: "size.2000" }}>
      <Text maxLines={1}>{value}</Text>
    </Box>
  </Tooltip>
);

const TruncatedLinkCell = ({ url }: { url: string }) => (
  <Tooltip content={url}>
    <Box xcss={{ maxWidth: "size.2000" }}>
      <Text maxLines={1}>
        <Link href={url} openNewTab>
          {url}
        </Link>
      </Text>
    </Box>
  </Tooltip>
);

const RestaurantTable = ({
  restaurants,
  busy,
  selectionDisabled,
  selectedRestaurantId,
  onSelect,
  onEdit,
  onRemove,
}: Props) => {
  const [searchText, setSearchText] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Set<OptionalColumnKey>>(
    DEFAULT_VISIBLE_COLUMNS,
  );
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  const toggleColumn = (key: OptionalColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRestaurants = (restaurants ?? []).filter((restaurant) => {
    if (normalizedSearch === "") return true;
    return (
      restaurant.name.toLowerCase().includes(normalizedSearch) ||
      restaurant.address.toLowerCase().includes(normalizedSearch)
    );
  });

  const highlightedRowIndex = filteredRestaurants.findIndex(
    (restaurant) => restaurant.id === selectedRestaurantId,
  );

  const head = {
    cells: [
      { key: "name", content: "Name", width: 30 },
      ...OPTIONAL_COLUMNS.filter((column) =>
        visibleColumns.has(column.key),
      ).map((column) => ({
        key: column.key,
        content: column.label,
        width: 15,
      })),
      { key: "actions", content: "", width: 20 },
    ],
  };

  const rows = filteredRestaurants.map((restaurant) => {
    const optionalCells = OPTIONAL_COLUMNS.filter((column) =>
      visibleColumns.has(column.key),
    ).map((column) => {
      if (column.key === "phone") {
        return {
          key: "phone",
          content:
            restaurant.phone === "" ? (
              "—"
            ) : (
              <TruncatedCell value={restaurant.phone} />
            ),
        };
      }
      if (column.key === "address") {
        return {
          key: "address",
          content:
            restaurant.address === "" ? (
              "—"
            ) : (
              <TruncatedCell value={restaurant.address} />
            ),
        };
      }
      if (column.key === "website") {
        return {
          key: "website",
          content: restaurant.website ? (
            <TruncatedLinkCell url={restaurant.website} />
          ) : (
            "—"
          ),
        };
      }
      return {
        key: "menuUrl",
        content: restaurant.menuUrl ? (
          <TruncatedLinkCell url={restaurant.menuUrl} />
        ) : (
          "—"
        ),
      };
    });

    return {
      key: String(restaurant.id),
      cells: [
        { key: "name", content: <TruncatedCell value={restaurant.name} /> },
        ...optionalCells,
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
    };
  });

  return (
    <Stack grow="fill" space="space.100">
      {restaurants === null ? (
        <Spinner label="Loading your restaurants" />
      ) : restaurants.length === 0 ? (
        <Text>No restaurants exist yet. Add one above.</Text>
      ) : (
        <Stack space="space.200">
          <Inline space="space.300" alignBlock="center">
            <Heading as="h2">My Restaurant Pool</Heading>
            <Inline space="space.200" alignBlock="center">
              <Box xcss={{ maxWidth: "size.1000" }}>
                <Textfield
                  isCompact
                  placeholder="Search name or address"
                  value={searchText}
                  onChange={(event) =>
                    setSearchText((event.target as HTMLInputElement).value)
                  }
                />
              </Box>
              <Popup
                isOpen={isColumnPickerOpen}
                onClose={() => setIsColumnPickerOpen(false)}
                placement="bottom-end"
                trigger={() => (
                  <Button
                    appearance="default"
                    onClick={() => setIsColumnPickerOpen((prev) => !prev)}
                  >
                    Columns
                  </Button>
                )}
                content={() => (
                  <Box padding="space.150">
                    <Stack space="space.075">
                      {OPTIONAL_COLUMNS.map((column) => (
                        <Checkbox
                          key={column.key}
                          label={column.label}
                          isChecked={visibleColumns.has(column.key)}
                          onChange={() => toggleColumn(column.key)}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              />
            </Inline>
          </Inline>
          {filteredRestaurants.length === 0 ? (
            <Text>No restaurants match your search.</Text>
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
      )}
    </Stack>
  );
};

export default RestaurantTable;
