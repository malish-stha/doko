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
import type * as events from "../events.js";
import type * as messages from "../messages.js";
import type * as reactions from "../reactions.js";
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
  events: typeof events;
  messages: typeof messages;
  reactions: typeof reactions;
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
