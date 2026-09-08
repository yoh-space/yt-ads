/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_common from "../admin/common.js";
import type * as admin_inventory from "../admin/inventory.js";
import type * as admin_jobs from "../admin/jobs.js";
import type * as admin_machines from "../admin/machines.js";
import type * as admin_materials from "../admin/materials.js";
import type * as admin_orders from "../admin/orders.js";
import type * as admin_overview from "../admin/overview.js";
import type * as admin_reconciliation from "../admin/reconciliation.js";
import type * as admin_reports from "../admin/reports.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as authorization from "../authorization.js";
import type * as bomResolver from "../bomResolver.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as inventoryLedger from "../inventoryLedger.js";
import type * as jobConsumption from "../jobConsumption.js";
import type * as jobs from "../jobs.js";
import type * as machines from "../machines.js";
import type * as materialRequests from "../materialRequests.js";
import type * as materialUsage from "../materialUsage.js";
import type * as materials from "../materials.js";
import type * as migrations from "../migrations.js";
import type * as notificationHelpers from "../notificationHelpers.js";
import type * as notifications from "../notifications.js";
import type * as offcuts from "../offcuts.js";
import type * as orderAutomation from "../orderAutomation.js";
import type * as orders from "../orders.js";
import type * as overuseExceptions from "../overuseExceptions.js";
import type * as owner_audit from "../owner/audit.js";
import type * as owner_common from "../owner/common.js";
import type * as owner_inventory from "../owner/inventory.js";
import type * as owner_machines from "../owner/machines.js";
import type * as owner_materials from "../owner/materials.js";
import type * as owner_orders from "../owner/orders.js";
import type * as owner_overview from "../owner/overview.js";
import type * as owner_reconciliation from "../owner/reconciliation.js";
import type * as owner_revenue from "../owner/revenue.js";
import type * as owner_team from "../owner/team.js";
import type * as reconciliation from "../reconciliation.js";
import type * as reports from "../reports.js";
import type * as security from "../security.js";
import type * as seed from "../seed.js";
import type * as serviceRecipes from "../serviceRecipes.js";
import type * as services from "../services.js";
import type * as storekeeper_overview from "../storekeeper/overview.js";
import type * as storekeeper_parentInventory from "../storekeeper/parentInventory.js";
import type * as storekeeper_requisitions from "../storekeeper/requisitions.js";
import type * as systemConfigs from "../systemConfigs.js";
import type * as telegramAuth from "../telegramAuth.js";
import type * as telegramSessions from "../telegramSessions.js";
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
  "admin/common": typeof admin_common;
  "admin/inventory": typeof admin_inventory;
  "admin/jobs": typeof admin_jobs;
  "admin/machines": typeof admin_machines;
  "admin/materials": typeof admin_materials;
  "admin/orders": typeof admin_orders;
  "admin/overview": typeof admin_overview;
  "admin/reconciliation": typeof admin_reconciliation;
  "admin/reports": typeof admin_reports;
  audit: typeof audit;
  auth: typeof auth;
  authorization: typeof authorization;
  bomResolver: typeof bomResolver;
  crons: typeof crons;
  dashboard: typeof dashboard;
  http: typeof http;
  inventory: typeof inventory;
  inventoryLedger: typeof inventoryLedger;
  jobConsumption: typeof jobConsumption;
  jobs: typeof jobs;
  machines: typeof machines;
  materialRequests: typeof materialRequests;
  materialUsage: typeof materialUsage;
  materials: typeof materials;
  migrations: typeof migrations;
  notificationHelpers: typeof notificationHelpers;
  notifications: typeof notifications;
  offcuts: typeof offcuts;
  orderAutomation: typeof orderAutomation;
  orders: typeof orders;
  overuseExceptions: typeof overuseExceptions;
  "owner/audit": typeof owner_audit;
  "owner/common": typeof owner_common;
  "owner/inventory": typeof owner_inventory;
  "owner/machines": typeof owner_machines;
  "owner/materials": typeof owner_materials;
  "owner/orders": typeof owner_orders;
  "owner/overview": typeof owner_overview;
  "owner/reconciliation": typeof owner_reconciliation;
  "owner/revenue": typeof owner_revenue;
  "owner/team": typeof owner_team;
  reconciliation: typeof reconciliation;
  reports: typeof reports;
  security: typeof security;
  seed: typeof seed;
  serviceRecipes: typeof serviceRecipes;
  services: typeof services;
  "storekeeper/overview": typeof storekeeper_overview;
  "storekeeper/parentInventory": typeof storekeeper_parentInventory;
  "storekeeper/requisitions": typeof storekeeper_requisitions;
  systemConfigs: typeof systemConfigs;
  telegramAuth: typeof telegramAuth;
  telegramSessions: typeof telegramSessions;
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
