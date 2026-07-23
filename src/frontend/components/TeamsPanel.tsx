import React, { useState } from "react";
import {
  Button,
  Heading,
  Inline,
  Label,
  Select,
  Spinner,
  Stack,
  Text,
  Textfield,
} from "@forge/react";
import type { Team } from "../../types";

type Props = {
  // null = still loading.
  myTeams: Team[] | null;
  allTeams: Team[] | null;
  busy: boolean;
  // Create-or-join by typed name (an existing name joins; a new one creates).
  onCreateOrJoinByName: (name: string) => void;
  onJoin: (teamId: number) => void;
  onLeave: (teamId: number) => void;
};

const TeamsPanel = ({
  myTeams,
  allTeams,
  busy,
  onCreateOrJoinByName,
  onJoin,
  onLeave,
}: Props) => {
  const [newName, setNewName] = useState("");

  // Only offer teams the caller isn't already in. Select isn't creatable, so
  // creating a brand-new team goes through the name field below.
  const myIds = new Set((myTeams ?? []).map((team) => team.id));
  const joinable = (allTeams ?? []).filter((team) => !myIds.has(team.id));

  return (
    <Stack grow="fill" space="space.300">
      <Stack grow="fill" space="space.150">
        <Heading as="h2">My Teams</Heading>
        {myTeams === null ? (
          <Spinner label="Loading your teams" />
        ) : myTeams.length === 0 ? (
          <Text>You're not in any teams yet.</Text>
        ) : (
          <Stack space="space.100">
            {myTeams.map((team) => (
              <Inline key={team.id} spread="space-between" alignBlock="center">
                <Text>{team.name}</Text>
                <Button
                  appearance="subtle"
                  isDisabled={busy}
                  onClick={() => onLeave(team.id)}
                >
                  Leave
                </Button>
              </Inline>
            ))}
          </Stack>
        )}
      </Stack>

      <Stack grow="fill" space="space.150">
        <Heading as="h2">Join or Create a Team</Heading>
        {joinable.length > 0 && (
          <Stack space="space.050">
            <Label labelFor="joinTeam">Join an existing team</Label>
            <Select
              // Remount on membership change so the control clears after a join.
              key={`join-${joinable.length}`}
              id="joinTeam"
              placeholder="Select a team to join"
              options={joinable.map((team) => ({
                label: team.name,
                value: String(team.id),
              }))}
              onChange={(option) => {
                if (option) {
                  onJoin(Number((option as { value: string }).value));
                }
              }}
            />
          </Stack>
        )}
        <Stack space="space.050">
          <Label labelFor="newTeam">Create or join by name</Label>
          <Inline space="space.100" alignBlock="end">
            <Textfield
              id="newTeam"
              value={newName}
              placeholder="Team name"
              onChange={(event) => setNewName(event.target.value)}
            />
            <Button
              appearance="primary"
              isDisabled={busy || newName.trim() === ""}
              onClick={() => {
                onCreateOrJoinByName(newName);
                setNewName("");
              }}
            >
              Create or join
            </Button>
          </Inline>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default TeamsPanel;
