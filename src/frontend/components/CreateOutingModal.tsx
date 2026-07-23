import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CheckboxGroup,
  DatePicker,
  Frame,
  Icon,
  Inline,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  Pressable,
  Select,
  Stack,
  Text,
  TimePicker,
  xcss,
} from "@forge/react";
import type { Restaurant, Team } from "../../types";

const timeWidth = xcss({ width: "150px" });
const dateWidth = xcss({ width: "150px" });

// Half-hour slots across the full 24h (00:00–23:30) — outings aren't limited to
// work hours.
const HALF_HOUR_TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, "0");
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

type Props = {
  isOpen: boolean;
  // The boss's own pool (explicit pick) and their teams (visibility targets).
  restaurants: Restaurant[] | null;
  teams: Team[] | null;
  busy: boolean;
  // Local YYYY-MM-DD, used as the DatePicker's minDate so past days are greyed.
  todayDate: string;
  // The Date field's default value, recomputed by the parent on every
  // render: today, or tomorrow if it's past the last bookable slot (23:30).
  defaultDate: string;
  // The next bookable half-hour slot from now (e.g. "11:30" at 11:15). Used
  // to trim the Time dropdown down to from-now-onward options when the
  // picked date is today, so opening it never requires scrolling past
  // already-past times. Not used to pre-select a value.
  earliestTimeToday: string;
  // A wheel result the host routed here; syncs into the Restaurant field.
  wheelWinner: { id: number; name: string } | null;
  // Tags the next wheel result for this panel before its Frame mounts.
  onOpenWheel: () => void;
  // date = local YYYY-MM-DD, time = local HH:mm; the parent combines them into
  // a UTC instant before invoking createEvent.
  onCreate: (
    restaurantId: number,
    date: string,
    time: string,
    teamIds: number[],
  ) => void;
  onCancel: () => void;
};

const CreateOutingModal = ({
  isOpen,
  restaurants,
  teams,
  busy,
  todayDate,
  defaultDate,
  earliestTimeToday,
  wheelWinner,
  onOpenWheel,
  onCreate,
  onCancel,
}: Props) => {
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  // CheckboxGroup values are strings; converted to numbers on submit.
  const [teamIds, setTeamIds] = useState<string[]>([]);
  // Content-swap flag: while true the body shows the wheel Frame in place of
  // the form (the modal never unmounts, so the other fields survive).
  const [showWheel, setShowWheel] = useState(false);

  // The modal itself never unmounts (only its inner <Modal> content does), so
  // without this the Date field would keep showing whatever day was left
  // from the previous time it was opened instead of a fresh "today" default.
  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      setTime("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // A wheel result arrived — fill the Restaurant field and swap back to the
  // form. Fires only when wheelWinner changes (the host sends a fresh object
  // each spin, so a repeat winner still lands).
  useEffect(() => {
    if (wheelWinner) {
      setRestaurantId(wheelWinner.id);
      setShowWheel(false);
    }
  }, [wheelWinner]);

  // Closing the modal (header ✕, Cancel, or a successful create) must not leave
  // the wheel staged for the next open.
  useEffect(() => {
    if (!isOpen) {
      setShowWheel(false);
    }
  }, [isOpen]);

  const pool = restaurants ?? [];
  const restaurantOptions = pool.map((restaurant) => ({
    label: restaurant.name,
    value: String(restaurant.id),
  }));
  const selectedRestaurantOption =
    restaurantOptions.find((option) => option.value === String(restaurantId)) ??
    null;

  // Mirrors the solo flow: an empty pool disables the spin; a pool of one skips
  // the wheel and fills that restaurant; two or more spins.
  const handleSpin = () => {
    if (pool.length === 1) {
      setRestaurantId(pool[0].id);
      return;
    }
    onOpenWheel();
    setShowWheel(true);
  };
  const teamOptions = (teams ?? []).map((team) => ({
    label: team.name,
    value: String(team.id),
  }));

  // Today only shows from-now-onward slots, so opening the dropdown never
  // needs scrolling past times that are already too late to pick. Any other
  // date shows the full day (falls back to the full list if, in some edge
  // case, filtering would leave nothing to pick).
  const timesForPicker =
    date === todayDate
      ? (() => {
          const upcoming = HALF_HOUR_TIMES.filter(
            (slot) => slot >= earliestTimeToday,
          );
          return upcoming.length > 0 ? upcoming : HALF_HOUR_TIMES;
        })()
      : HALF_HOUR_TIMES;

  const canCreate =
    !busy &&
    restaurantId !== null &&
    date !== "" &&
    time !== "" &&
    teamIds.length > 0;

  return (
    <ModalTransition>
      {isOpen && (
        <Modal>
          <ModalHeader>
            <Inline grow="fill" spread="space-between" alignBlock="center">
              <ModalTitle>Be a Lunch Boss (New Event)</ModalTitle>
              <Pressable onClick={onCancel} isDisabled={busy}>
                <Icon glyph="cross" label="Close" />
              </Pressable>
            </Inline>
          </ModalHeader>
          {showWheel ? (
            <>
              <ModalBody>
                <Stack space="space.150">
                  <Text>Spin the wheel — fate picks the restaurant.</Text>
                  <Frame resource="wheel" />
                </Stack>
              </ModalBody>
              <ModalFooter>
                <Button
                  appearance="subtle"
                  isDisabled={busy}
                  onClick={() => setShowWheel(false)}
                >
                  Cancel
                </Button>
              </ModalFooter>
            </>
          ) : (
            <>
              <ModalBody>
                <Stack space="space.150">
                  <Stack space="space.050">
                    <Label labelFor="outingRestaurant">Restaurant</Label>
                    <Inline space="space.100" alignBlock="center">
                      <Select
                        id="outingRestaurant"
                        placeholder="Pick from your pool"
                        options={restaurantOptions}
                        value={selectedRestaurantOption}
                        onChange={(option) =>
                          setRestaurantId(
                            option
                              ? Number((option as { value: string }).value)
                              : null,
                          )
                        }
                      />
                      <Button
                        isDisabled={busy || pool.length === 0}
                        onClick={handleSpin}
                      >
                        Spin the wheel
                      </Button>
                    </Inline>
                  </Stack>
                  <Inline space="space.150" shouldWrap>
                    <Stack space="space.050">
                      <Label labelFor="outingDate">Date</Label>
                      <Box xcss={dateWidth}>
                        <DatePicker
                          id="outingDate"
                          minDate={todayDate}
                          defaultValue={defaultDate}
                          placeholder={defaultDate}
                          onChange={(value) => setDate(value)}
                        />
                      </Box>
                    </Stack>
                    <Stack space="space.050">
                      <Label labelFor="outingTime">Time</Label>
                      <Box xcss={timeWidth}>
                        <TimePicker
                          id="outingTime"
                          timeFormat="h:mm A"
                          times={timesForPicker}
                          placeholder="1:30 PM"
                          timeIsEditable
                          onChange={(value) => setTime(value)}
                        />
                      </Box>
                    </Stack>
                  </Inline>
                  <Stack space="space.050">
                    <Label labelFor="outingTeams">Visible to teams</Label>
                    {teamOptions.length === 0 ? (
                      <Text>Join a team first to create an event.</Text>
                    ) : (
                      <CheckboxGroup
                        name="outingTeams"
                        options={teamOptions}
                        value={teamIds}
                        onChange={(values) =>
                          setTeamIds((values as string[]) ?? [])
                        }
                      />
                    )}
                  </Stack>
                </Stack>
              </ModalBody>
              <ModalFooter>
                <Inline space="space.100">
                  <Button
                    appearance="primary"
                    isDisabled={!canCreate}
                    onClick={() => {
                      if (restaurantId !== null) {
                        onCreate(restaurantId, date, time, teamIds.map(Number));
                      }
                    }}
                  >
                    Be the Boss (Create Event)
                  </Button>
                  <Button
                    appearance="subtle"
                    isDisabled={busy}
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                </Inline>
              </ModalFooter>
            </>
          )}
        </Modal>
      )}
    </ModalTransition>
  );
};

export default CreateOutingModal;
