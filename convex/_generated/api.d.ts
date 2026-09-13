/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _auditRoutingCoverage from "../_auditRoutingCoverage.js";
import type * as admin from "../admin.js";
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
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as inventoryLedger from "../inventoryLedger.js";
import type * as jobConsumption from "../jobConsumption.js";
import type * as jobs from "../jobs.js";
import type * as lowStock from "../lowStock.js";
import type * as machines from "../machines.js";
import type * as manager_inventory from "../manager/inventory.js";
import type * as manager_machines from "../manager/machines.js";
import type * as manager_orders from "../manager/orders.js";
import type * as manager_overview from "../manager/overview.js";
import type * as manager_requisitions from "../manager/requisitions.js";
import type * as materialRequests from "../materialRequests.js";
import type * as materialUsage from "../materialUsage.js";
import type * as materials from "../materials.js";
import type * as migrations from "../migrations.js";
import type * as notificationHelpers from "../notificationHelpers.js";
import type * as notifications from "../notifications.js";
import type * as offcuts from "../offcuts.js";
import type * as operator_common from "../operator/common.js";
import type * as operator_inventory from "../operator/inventory.js";
import type * as operator_jobs from "../operator/jobs.js";
import type * as operator_machines from "../operator/machines.js";
import type * as operator_offcuts from "../operator/offcuts.js";
import type * as operator_overview from "../operator/overview.js";
import type * as operator_reconciliation from "../operator/reconciliation.js";
import type * as operator_requests from "../operator/requests.js";
import type * as orderAutomation from "../orderAutomation.js";
import type * as orderDetails from "../orderDetails.js";
import type * as orders from "../orders.js";
import type * as overuseExceptions from "../overuseExceptions.js";
import type * as owner_analytics from "../owner/analytics.js";
import type * as owner_audit from "../owner/audit.js";
import type * as owner_common from "../owner/common.js";
import type * as owner_configAudit from "../owner/configAudit.js";
import type * as owner_databaseFirstCatalogs from "../owner/databaseFirstCatalogs.js";
import type * as owner_driftDetection from "../owner/driftDetection.js";
import type * as owner_inventory from "../owner/inventory.js";
import type * as owner_machineInkRules from "../owner/machineInkRules.js";
import type * as owner_machineMaterialLinks from "../owner/machineMaterialLinks.js";
import type * as owner_machineServiceRoutes from "../owner/machineServiceRoutes.js";
import type * as owner_machines from "../owner/machines.js";
import type * as owner_materials from "../owner/materials.js";
import type * as owner_migrateMachineConfig from "../owner/migrateMachineConfig.js";
import type * as owner_orders from "../owner/orders.js";
import type * as owner_overview from "../owner/overview.js";
import type * as owner_priceEstimates from "../owner/priceEstimates.js";
import type * as owner_reconciliation from "../owner/reconciliation.js";
import type * as owner_revenue from "../owner/revenue.js";
import type * as owner_seedDatabaseFirst from "../owner/seedDatabaseFirst.js";
import type * as owner_seedMachines from "../owner/seedMachines.js";
import type * as owner_serviceBOM from "../owner/serviceBOM.js";
import type * as owner_serviceDefinitions from "../owner/serviceDefinitions.js";
import type * as owner_team from "../owner/team.js";
import type * as payment from "../payment.js";
import type * as receptionist_jobs from "../receptionist/jobs.js";
import type * as receptionist_orders from "../receptionist/orders.js";
import type * as receptionist_overview from "../receptionist/overview.js";
import type * as reconciliation from "../reconciliation.js";
import type * as reports from "../reports.js";
import type * as resetSystemData from "../resetSystemData.js";
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
import type * as utils_inkColor from "../utils/inkColor.js";
import type * as utils_normalizer from "../utils/normalizer.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  _auditRoutingCoverage: typeof _auditRoutingCoverage;
  admin: typeof admin;
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
  catalog: typeof catalog;
  crons: typeof crons;
  dashboard: typeof dashboard;
  http: typeof http;
  inventory: typeof inventory;
  inventoryLedger: typeof inventoryLedger;
  jobConsumption: typeof jobConsumption;
  jobs: typeof jobs;
  lowStock: typeof lowStock;
  machines: typeof machines;
  "manager/inventory": typeof manager_inventory;
  "manager/machines": typeof manager_machines;
  "manager/orders": typeof manager_orders;
  "manager/overview": typeof manager_overview;
  "manager/requisitions": typeof manager_requisitions;
  materialRequests: typeof materialRequests;
  materialUsage: typeof materialUsage;
  materials: typeof materials;
  migrations: typeof migrations;
  notificationHelpers: typeof notificationHelpers;
  notifications: typeof notifications;
  offcuts: typeof offcuts;
  "operator/common": typeof operator_common;
  "operator/inventory": typeof operator_inventory;
  "operator/jobs": typeof operator_jobs;
  "operator/machines": typeof operator_machines;
  "operator/offcuts": typeof operator_offcuts;
  "operator/overview": typeof operator_overview;
  "operator/reconciliation": typeof operator_reconciliation;
  "operator/requests": typeof operator_requests;
  orderAutomation: typeof orderAutomation;
  orderDetails: typeof orderDetails;
  orders: typeof orders;
  overuseExceptions: typeof overuseExceptions;
  "owner/analytics": typeof owner_analytics;
  "owner/audit": typeof owner_audit;
  "owner/common": typeof owner_common;
  "owner/configAudit": typeof owner_configAudit;
  "owner/databaseFirstCatalogs": typeof owner_databaseFirstCatalogs;
  "owner/driftDetection": typeof owner_driftDetection;
  "owner/inventory": typeof owner_inventory;
  "owner/machineInkRules": typeof owner_machineInkRules;
  "owner/machineMaterialLinks": typeof owner_machineMaterialLinks;
  "owner/machineServiceRoutes": typeof owner_machineServiceRoutes;
  "owner/machines": typeof owner_machines;
  "owner/materials": typeof owner_materials;
  "owner/migrateMachineConfig": typeof owner_migrateMachineConfig;
  "owner/orders": typeof owner_orders;
  "owner/overview": typeof owner_overview;
  "owner/priceEstimates": typeof owner_priceEstimates;
  "owner/reconciliation": typeof owner_reconciliation;
  "owner/revenue": typeof owner_revenue;
  "owner/seedDatabaseFirst": typeof owner_seedDatabaseFirst;
  "owner/seedMachines": typeof owner_seedMachines;
  "owner/serviceBOM": typeof owner_serviceBOM;
  "owner/serviceDefinitions": typeof owner_serviceDefinitions;
  "owner/team": typeof owner_team;
  payment: typeof payment;
  "receptionist/jobs": typeof receptionist_jobs;
  "receptionist/orders": typeof receptionist_orders;
  "receptionist/overview": typeof receptionist_overview;
  reconciliation: typeof reconciliation;
  reports: typeof reports;
  resetSystemData: typeof resetSystemData;
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
  "utils/inkColor": typeof utils_inkColor;
  "utils/normalizer": typeof utils_normalizer;
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
