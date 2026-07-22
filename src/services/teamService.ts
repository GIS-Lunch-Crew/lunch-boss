import * as teamRepository from "../storage/teamRepository";
import * as teamMemberRepository from "../storage/teamMemberRepository";
import type { CreateTeamInput, CreateTeamResult, Team } from "../types";

// Business logic for teams (CONTEXT.md §7): no @forge/sql or @forge/resolver.
// Storage goes through repositories; payloads are validated at the boundary.

// Team-name identity is normalized (trim+lowercase), same principle as
// restaurant identity (CONTEXT.md §3.10): store what was typed, compare
// normalized.
const normalize = (value: string): string => value.trim().toLowerCase();

// Creating a team never fails on an existing name — like addRestaurant it
// links the caller to the existing team and reports which happened. Both
// paths end with the caller as a member.
export const createTeam = async (
  accountId: string,
  input: CreateTeamInput,
): Promise<CreateTeamResult> => {
  const nameNormalized = normalize(input.name);
  const existing = await teamRepository.findByNormalizedName(nameNormalized);

  if (existing !== null) {
    await teamMemberRepository.save(accountId, existing.id);
    return { team: existing, outcome: "joined-existing" };
  }

  const name = input.name.trim();
  const id = await teamRepository.insert({ name, nameNormalized, createdBy: accountId });
  await teamMemberRepository.save(accountId, id);
  return { team: { id, name, createdBy: accountId }, outcome: "created" };
};

export const joinTeam = async (
  accountId: string,
  teamId: number,
): Promise<void> => {
  const team = await teamRepository.findById(teamId);
  if (team === null) {
    throw new Error("Team not found.");
  }
  await teamMemberRepository.save(accountId, teamId);
};

// No guard needed: an outing snapshots the team(s) it targets, so leaving a
// team never orphans an outing, and you still see outings you created.
export const leaveTeam = async (
  accountId: string,
  teamId: number,
): Promise<void> => teamMemberRepository.remove(accountId, teamId);

export const listTeams = async (): Promise<Team[]> => teamRepository.listAll();

export const getMyTeams = async (accountId: string): Promise<Team[]> =>
  teamMemberRepository.listByAccount(accountId);
