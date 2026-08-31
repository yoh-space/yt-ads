/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as authorization from "../authorization.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as machines from "../machines.js";
import type * as materialRequests from "../materialRequests.js";
import type * as materialUsage from "../materialUsage.js";
import type * as materials from "../materials.js";
import type * as notificationHelpers from "../notificationHelpers.js";
import type * as notifications from "../notifications.js";
import type * as offcuts from "../offcuts.js";
import type * as orders from "../orders.js";
import type * as reconciliation from "../reconciliation.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as systemConfigs from "../systemConfigs.js";
import type * as types from "../types.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  auth: typeof auth;
  authorization: typeof authorization;
  crons: typeof crons;
  dashboard: typeof dashboard;
  http: typeof http;
  jobs: typeof jobs;
  machines: typeof machines;
  materialRequests: typeof materialRequests;
  materialUsage: typeof materialUsage;
  materials: typeof materials;
  notificationHelpers: typeof notificationHelpers;
  notifications: typeof notifications;
  offcuts: typeof offcuts;
  orders: typeof orders;
  reconciliation: typeof reconciliation;
  reports: typeof reports;
  seed: typeof seed;
  systemConfigs: typeof systemConfigs;
  types: typeof types;
  units: typeof units;
  users: typeof users;
  validation: typeof validation;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
