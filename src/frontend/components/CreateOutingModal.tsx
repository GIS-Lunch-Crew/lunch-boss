import React, { useState } from "react";
import {
  Box,
  Button,
  CheckboxGroup,
  DatePicker,
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
  onCreate,
  onCancel,
}: Props) => {
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  // CheckboxGroup values are strings; converted to numbers on submit.
  const [teamIds, setTeamIds] = useState<string[]>([]);

  const restaurantOptions = (restaurants ?? []).map((restaurant) => ({
    label: restaurant.name,
    value: String(restaurant.id),
  }));
  const teamOptions = (teams ?? []).map((team) => ({
    label: team.name,
    value: String(team.id),
  }));

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
              <ModalTitle>Be a Lunch Boss</ModalTitle>
              <Pressable onClick={onCancel} isDisabled={busy}>
                <Icon glyph="cross" label="Close" />
              </Pressable>
            </Inline>
          </ModalHeader>
          <ModalBody>
            <Stack space="space.150">
              <Stack space="space.050">
                <Label labelFor="outingRestaurant">Restaurant</Label>
                <Select
                  id="outingRestaurant"
                  placeholder="Pick from your pool"
                  options={restaurantOptions}
                  onChange={(option) =>
                    setRestaurantId(
                      option
                        ? Number((option as { value: string }).value)
                        : null,
                    )
                  }
                />
              </Stack>
              <Inline space="space.150" shouldWrap>
                <Stack space="space.050">
                  <Label labelFor="outingDate">Date</Label>
                  <Box xcss={dateWidth}>
                    <DatePicker
                      id="outingDate"
                      minDate={todayDate}
                      placeholder={todayDate}
                      onChange={(value) => setDate(value)}
                    />
                  </Box>
                </Stack>
                <Stack space="space.050">
                  <Label labelFor="outingTime">Time</Label>
                  <Box xcss={timeWidth}>
                    <TimePicker
                      id="outingTime"
                      timeFormat="HH:mm"
                      times={HALF_HOUR_TIMES}
                      placeholder="13:30"
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
                Be the Boss
              </Button>
              <Button appearance="subtle" isDisabled={busy} onClick={onCancel}>
                Cancel
              </Button>
            </Inline>
          </ModalFooter>
        </Modal>
      )}
    </ModalTransition>
  );
};

export default CreateOutingModal;
