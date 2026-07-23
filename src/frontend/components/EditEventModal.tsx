import React, { useEffect, useState } from "react";
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
  Stack,
  Text,
  TimePicker,
  xcss,
} from "@forge/react";
import type { EventSummary, Team } from "../../types";

const timeWidth = xcss({ width: "150px" });
const dateWidth = xcss({ width: "150px" });

// Half-hour slots across the full 24h, same as the create modal.
const HALF_HOUR_TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, "0");
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

const toMs = (instant: string): number =>
  new Date(`${instant.replace(" ", "T")}Z`).getTime();

const two = (n: number): string => String(n).padStart(2, "0");

// The event's stored UTC instant → its local date ("YYYY-MM-DD") and time
// ("HH:mm"), to seed the pickers.
const toLocalDate = (instant: string): string => {
  const d = new Date(`${instant.replace(" ", "T")}Z`);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};
const toLocalTime = (instant: string): string => {
  const d = new Date(`${instant.replace(" ", "T")}Z`);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

const formatInstant = (value: string): string => {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

type Props = {
  isOpen: boolean;
  // The event being edited (its detail's teamIds if loaded, else the card's).
  event: EventSummary | null;
  // Strictly the caller's teams — a takeover boss re-targets to their own
  // teams; pre-checks are the event's teams ∩ mine.
  teams: Team[] | null;
  busy: boolean;
  todayDate: string;
  // date = local YYYY-MM-DD, time = local HH:mm; the parent combines them
  // into a UTC instant and invokes updateEvent.
  onSave: (date: string, time: string, teamIds: number[]) => void;
  onCancel: () => void;
};

// The boss's Edit Details modal: date + time (later-only — the pickers accept
// anything, but Save rejects an instant at/before now or at/before the
// current scheduled time; the service enforces the same) and the team
// checklist (≥1).
const EditEventModal = ({
  isOpen,
  event,
  teams,
  busy,
  todayDate,
  onSave,
  onCancel,
}: Props) => {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  // CheckboxGroup values are strings; converted to numbers on submit.
  const [teamIds, setTeamIds] = useState<string[]>([]);

  // Seed from the event each time the modal opens (the pickers mount fresh
  // per open, so their defaultValues line up with this state).
  useEffect(() => {
    if (isOpen && event) {
      setDate(toLocalDate(event.scheduledAt));
      setTime(toLocalTime(event.scheduledAt));
      const mine = new Set((teams ?? []).map((team) => team.id));
      setTeamIds(
        event.teamIds
          .filter((id) => mine.has(id))
          .map((id) => String(id)),
      );
    }
    // Re-seeding on every teams refresh would clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event?.id]);

  if (event === null) {
    return <ModalTransition>{null}</ModalTransition>;
  }

  const teamOptions = (teams ?? []).map((team) => ({
    label: team.name,
    value: String(team.id),
  }));

  // Later-only, on the combined local instant: after now AND after the
  // currently scheduled time.
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  const candidateMs =
    date !== "" && match
      ? (() => {
          const [y, mo, d] = date.split("-").map(Number);
          return new Date(
            y,
            mo - 1,
            d,
            Number(match[1]),
            Number(match[2]),
          ).getTime();
        })()
      : null;
  const laterOnly =
    candidateMs !== null &&
    candidateMs > Date.now() &&
    candidateMs > toMs(event.scheduledAt);
  // Unchanged time is fine when only the teams changed.
  const timeUntouched =
    candidateMs !== null && candidateMs === toMs(event.scheduledAt);
  const canSave =
    !busy && teamIds.length > 0 && (laterOnly || timeUntouched);

  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={onCancel}>
          <ModalHeader>
            <Inline grow="fill" spread="space-between" alignBlock="center">
              <ModalTitle>Edit Details</ModalTitle>
              <Pressable onClick={onCancel} isDisabled={busy}>
                <Icon glyph="cross" label="Close" />
              </Pressable>
            </Inline>
          </ModalHeader>
          <ModalBody>
            <Stack space="space.150">
              <Inline space="space.150" shouldWrap>
                <Stack space="space.050">
                  <Label labelFor="editEventDate">Date</Label>
                  <Box xcss={dateWidth}>
                    <DatePicker
                      id="editEventDate"
                      minDate={todayDate}
                      defaultValue={toLocalDate(event.scheduledAt)}
                      placeholder={toLocalDate(event.scheduledAt)}
                      onChange={(value) => setDate(value)}
                    />
                  </Box>
                </Stack>
                <Stack space="space.050">
                  <Label labelFor="editEventTime">Time</Label>
                  <Box xcss={timeWidth}>
                    <TimePicker
                      id="editEventTime"
                      timeFormat="h:mm A"
                      times={HALF_HOUR_TIMES}
                      defaultValue={toLocalTime(event.scheduledAt)}
                      timeIsEditable
                      onChange={(value) => setTime(value)}
                    />
                  </Box>
                </Stack>
              </Inline>
              {candidateMs !== null && !laterOnly && !timeUntouched && (
                <Text>
                  The new time must be later than{" "}
                  {formatInstant(event.scheduledAt)}.
                </Text>
              )}
              <Stack space="space.050">
                <Label labelFor="editEventTeams">Visible to teams</Label>
                {teamOptions.length === 0 ? (
                  <Text>Join a team first to edit this event's teams.</Text>
                ) : (
                  <CheckboxGroup
                    name="editEventTeams"
                    options={teamOptions}
                    value={teamIds}
                    onChange={(values) => setTeamIds((values as string[]) ?? [])}
                  />
                )}
              </Stack>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Inline space="space.100">
              <Button
                appearance="primary"
                isDisabled={!canSave}
                onClick={() => onSave(date, time, teamIds.map(Number))}
              >
                Save
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

export default EditEventModal;
