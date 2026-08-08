/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as brief from "../brief.js";
import type * as briefActions from "../briefActions.js";
import type * as channels from "../channels.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as events from "../events.js";
import type * as invites from "../invites.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reactions from "../reactions.js";
import type * as sprints from "../sprints.js";
import type * as teamHelper from "../teamHelper.js";
import type * as teamMembers from "../teamMembers.js";
import type * as teams from "../teams.js";
import type * as tickets from "../tickets.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  brief: typeof brief;
  briefActions: typeof briefActions;
  channels: typeof channels;
  comments: typeof comments;
  crons: typeof crons;
  email: typeof email;
  events: typeof events;
  invites: typeof invites;
  messages: typeof messages;
  migrations: typeof migrations;
  rateLimit: typeof rateLimit;
  reactions: typeof reactions;
  sprints: typeof sprints;
  teamHelper: typeof teamHelper;
  teamMembers: typeof teamMembers;
  teams: typeof teams;
  tickets: typeof tickets;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
