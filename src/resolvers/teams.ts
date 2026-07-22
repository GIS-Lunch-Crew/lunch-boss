import type Resolver from "@forge/resolver";
import { createTeamSchema, teamIdSchema } from "../validation/teamSchemas";
import * as teamService from "../services/teamService";
import { requireAccountId } from "./context";
import type { CreateTeamResult, Team } from "../types";

export const registerTeamResolvers = (resolver: Resolver): void => {
  // All site teams — powers the join dropdown.
  resolver.define<void, Team[]>("getTeams", async () => teamService.listTeams());

  resolver.define<void, Team[]>("getMyTeams", async ({ context }) =>
    teamService.getMyTeams(requireAccountId(context)),
  );

  resolver.define<unknown, CreateTeamResult>(
    "createTeam",
    async ({ payload, context }) => {
      const input = createTeamSchema.parse(payload);
      return teamService.createTeam(requireAccountId(context), input);
    },
  );

  resolver.define<unknown, void>("joinTeam", async ({ payload, context }) => {
    const { teamId } = teamIdSchema.parse(payload);
    await teamService.joinTeam(requireAccountId(context), teamId);
  });

  resolver.define<unknown, void>("leaveTeam", async ({ payload, context }) => {
    const { teamId } = teamIdSchema.parse(payload);
    await teamService.leaveTeam(requireAccountId(context), teamId);
  });
};
