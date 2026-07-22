import Resolver from "@forge/resolver";
import { registerRestaurantResolvers } from "./restaurants";
import { registerOrderResolvers } from "./orders";
import { registerTeamResolvers } from "./teams";

// Creates the app's single Resolver and registers all definition groups.
// This file is the "route table": one register call per domain module.
const resolver = new Resolver();

registerRestaurantResolvers(resolver);
registerOrderResolvers(resolver);
registerTeamResolvers(resolver);

export const handler = resolver.getDefinitions();
