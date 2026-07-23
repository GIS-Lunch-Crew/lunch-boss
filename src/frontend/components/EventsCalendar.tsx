import {
  Box,
  Button,
  Heading,
  Inline,
  Pressable,
  Stack,
  Text,
  xcss,
} from "@forge/react";
import LoadingIcon from "./LoadingIcon";
import type { EventSummary } from "../../types";

type Props = {
  // Displayed month, in the viewer's local calendar (month is 1-12).
  year: number;
  month: number;
  // The month's visible events (null = still loading).
  events: EventSummary[] | null;
  // Local YYYY-MM-DD; selectedDate null = no day selected.
  selectedDate: string | null;
  todayDate: string;
  onSelectDay: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

// A day cell shows at most this many rows. When a day has more events than
// fit, the last row becomes "+N more" — the cell must NEVER grow.
const MAX_CELL_LINES = 5;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Every cell (and the weekday header cells) takes a fixed seventh of the row
// so columns line up whatever a day contains.
const CELL_WIDTH = "14.28%";

const cellColumnStyle = xcss({ width: CELL_WIDTH });
// Filler cells for the days before the 1st / after the last of the month.
const emptyCellStyle = xcss({
  height: "8rem",
  width: "100%",
  backgroundColor: "elevation.surface.sunken",
  borderColor: "color.border",
  borderWidth: "border.width",
  borderStyle: "solid",
});
// Fixed-size press target for a day. Today gets the thicker brand border the
// event cards use for emphasis; the selected day gets the selected tint.
const dayCellStyle = (isToday: boolean, isSelected: boolean) =>
  xcss({
    height: "8rem",
    width: "100%",
    overflow: "hidden",
    textAlign: "left",
    padding: "space.050",
    backgroundColor: isSelected ? "color.background.selected" : "elevation.surface",
    borderColor: isToday ? "color.border.brand" : "color.border",
    borderWidth: isToday ? "border.width.selected" : "border.width",
    borderStyle: "solid",
  });
// Anchors cell content to the top — a Pressable is a flex button that would
// otherwise center its children vertically (same fix as the event cards).
const cellFillStyle = xcss({ height: "100%", width: "100%" });
// One event line: green when the viewer has an order on it, faded once the
// orders are placed — the same signals the event cards use.
const eventLineStyle = (event: EventSummary) =>
  xcss({
    width: "100%",
    backgroundColor: event.hasMyOrder
      ? "color.background.success"
      : "color.background.neutral",
    borderRadius: "radius.small",
    paddingInline: "space.050",
    opacity: event.placedAt !== null ? "opacity.disabled" : undefined,
  });

// A stored UTC instant ("YYYY-MM-DD HH:MM:SS") → the viewer's LOCAL calendar
// day as YYYY-MM-DD. This is what decides which cell an event lands in.
export const localDateKey = (instant: string): string => {
  const date = new Date(`${instant.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) {
    return instant.slice(0, 10);
  }
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
};

const EventsCalendar = ({
  year,
  month,
  events,
  selectedDate,
  todayDate,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: Props) => {
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  // Bucket the month's events by local day. Fetch order (scheduled_at ASC)
  // is preserved, so each day's lines read in time order.
  const byDay = new Map<string, EventSummary[]>();
  for (const event of events ?? []) {
    const key = localDateKey(event.scheduledAt);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      byDay.set(key, [event]);
    }
  }

  // Weeks run Sunday–Saturday. Cells: leading nulls to the month's first
  // weekday, the days themselves, trailing nulls to square off the last week.
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <Stack grow="fill" space="space.150">
      <Inline space="space.200" alignBlock="center">
        <Button appearance="subtle" onClick={onPrevMonth}>
          ‹
        </Button>
        <Heading as="h3">{monthLabel}</Heading>
        <Button appearance="subtle" onClick={onNextMonth}>
          ›
        </Button>
      </Inline>

      {events === null ? (
        <LoadingIcon />
      ) : (
        <Stack space="space.0" grow="fill">
          <Inline space="space.0" grow="fill">
            {WEEKDAY_LABELS.map((label) => (
              <Box key={label} xcss={cellColumnStyle}>
                <Text size="small" weight="bold">
                  {label}
                </Text>
              </Box>
            ))}
          </Inline>
          {weeks.map((week, weekIndex) => (
            <Inline key={weekIndex} space="space.0" grow="fill">
              {week.map((day, dayIndex) => {
                if (day === null) {
                  return (
                    <Box key={`blank-${dayIndex}`} xcss={cellColumnStyle}>
                      <Box xcss={emptyCellStyle} />
                    </Box>
                  );
                }
                const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = byDay.get(dateKey) ?? [];
                // ≤5 events all fit; 6+ shows 4 plus a "+N more" row so the
                // cell never exceeds MAX_CELL_LINES rows.
                const visible =
                  dayEvents.length <= MAX_CELL_LINES
                    ? dayEvents
                    : dayEvents.slice(0, MAX_CELL_LINES - 1);
                const hiddenCount = dayEvents.length - visible.length;
                return (
                  <Box key={dateKey} xcss={cellColumnStyle}>
                    <Pressable
                      xcss={dayCellStyle(
                        dateKey === todayDate,
                        dateKey === selectedDate,
                      )}
                      onClick={() => onSelectDay(dateKey)}
                    >
                      <Box xcss={cellFillStyle}>
                        <Stack space="space.025" grow="fill">
                          <Text
                            size="small"
                            weight={dateKey === todayDate ? "bold" : "regular"}
                          >
                            {day}
                          </Text>
                          {visible.map((event) => (
                            <Box key={event.id} xcss={eventLineStyle(event)}>
                              <Text size="small" maxLines={1}>
                                {event.restaurantName}
                              </Text>
                            </Box>
                          ))}
                          {hiddenCount > 0 && (
                            <Text size="small">+{hiddenCount} more</Text>
                          )}
                        </Stack>
                      </Box>
                    </Pressable>
                  </Box>
                );
              })}
            </Inline>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default EventsCalendar;
