import { describe, expect, it } from "vitest";
import {
  canViewNotification,
  getNotificationDomain,
  getAllowedDomainsForRole,
  getNotificationCategoriesForRole,
  resolveNotificationContext,
  type NotificationRecord,
  type NotificationContext,
  type UserProfile,
} from "../notificationPolicy";
import { notifyByPolicy } from "../notificationHelpers";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

describe("Notification Policy & Dispatch Architecture", () => {
  describe("Domain Mappings & Category Scoping", () => {
    it("correctly maps all event types to canonical domains", () => {
      expect(getNotificationDomain("order_received")).toBe("orders");
      expect(getNotificationDomain("order_status")).toBe("orders");
      expect(getNotificationDomain("overdue_order")).toBe("orders");

      expect(getNotificationDomain("material_request")).toBe("inventory");
      expect(getNotificationDomain("material_issue")).toBe("inventory");
      expect(getNotificationDomain("material_received")).toBe("inventory");
      expect(getNotificationDomain("short_stock")).toBe("inventory");
      expect(getNotificationDomain("material_overuse")).toBe("inventory");
      expect(getNotificationDomain("discrepancy")).toBe("inventory");
      expect(getNotificationDomain("exception_stock_out")).toBe("inventory");

      expect(getNotificationDomain("job_update")).toBe("operations");
      expect(getNotificationDomain("machine_update")).toBe("operations");
      expect(getNotificationDomain("clearance_granted")).toBe("operations");
      expect(getNotificationDomain("clearance_rejected")).toBe("operations");

      expect(getNotificationDomain("account_update")).toBe("account");
    });

    it("restricts allowed domains per operational role", () => {
      expect(getAllowedDomainsForRole("receptionist")).toEqual(["orders"]);
      expect(getAllowedDomainsForRole("storekeeper")).toEqual(["inventory"]);
      expect(getAllowedDomainsForRole("crystal_jet_operator")).toEqual(["inventory", "operations"]);
      expect(getAllowedDomainsForRole("laser_operator")).toEqual(["inventory", "operations"]);

      expect(getAllowedDomainsForRole("owner")).toEqual(["orders", "inventory", "operations", "account"]);
      expect(getAllowedDomainsForRole("manager")).toEqual(["orders", "inventory", "operations", "account"]);
      expect(getAllowedDomainsForRole("admin")).toEqual(["orders", "inventory", "operations", "account"]);
    });

    it("generates role-appropriate categories including 'all'", () => {
      expect(getNotificationCategoriesForRole("receptionist")).toEqual(["all", "orders"]);
      expect(getNotificationCategoriesForRole("storekeeper")).toEqual(["all", "inventory"]);
      expect(getNotificationCategoriesForRole("cnc_operator")).toEqual(["all", "inventory", "operations"]);
      expect(getNotificationCategoriesForRole("owner")).toEqual(["all", "orders", "inventory", "operations", "account"]);
    });
  });

  describe("Role & Attribute Filtering (canViewNotification)", () => {
    const receptionist: UserProfile = { authUserId: "u_rec", role: "receptionist" };
    const storekeeper: UserProfile = { authUserId: "u_store", role: "storekeeper" };
    const laserOpAssigned: UserProfile = {
      authUserId: "u_laser",
      role: "laser_operator",
      assignedMachineIds: ["mach_laser_1" as Id<"machines">],
    };
    const laserOpUnassigned: UserProfile = {
      authUserId: "u_laser_2",
      role: "laser_operator",
      assignedMachineIds: [],
    };
    const cncOp: UserProfile = {
      authUserId: "u_cnc",
      role: "cnc_operator",
      assignedMachineIds: ["mach_cnc_1" as Id<"machines">],
    };
    const manager: UserProfile = { authUserId: "u_mgr", role: "manager" };
    const owner: UserProfile = { authUserId: "u_owner", role: "owner" };

    it("enforces receptionist scope: orders only", () => {
      const orderNotification: NotificationRecord = {
        title: "Order Received",
        message: "New order #101",
        type: "order_received",
      };
      const inventoryNotification: NotificationRecord = {
        title: "Low Stock",
        message: "Banner flex low",
        type: "short_stock",
      };
      const opsNotification: NotificationRecord = {
        title: "Machine Running",
        message: "Laser 1 online",
        type: "machine_update",
      };

      expect(canViewNotification(receptionist, orderNotification)).toBe(true);
      expect(canViewNotification(receptionist, inventoryNotification)).toBe(false);
      expect(canViewNotification(receptionist, opsNotification)).toBe(false);
    });

    it("enforces storekeeper scope: inventory only", () => {
      const inventoryNotification: NotificationRecord = {
        title: "Material Request",
        message: "Acrylic sheet requested",
        type: "material_request",
      };
      const orderNotification: NotificationRecord = {
        title: "Order Status",
        message: "Order ready",
        type: "order_status",
      };
      const opsNotification: NotificationRecord = {
        title: "Clearance Granted",
        message: "Inspection passed",
        type: "clearance_granted",
      };

      expect(canViewNotification(storekeeper, inventoryNotification)).toBe(true);
      expect(canViewNotification(storekeeper, orderNotification)).toBe(false);
      expect(canViewNotification(storekeeper, opsNotification)).toBe(false);
    });

    it("enforces machine operator scoping and assigned machine bounds", () => {
      const laserJobNotification: NotificationRecord = {
        title: "Job Assigned",
        message: "Job for laser 1",
        type: "job_update",
      };
      const laser1Context: NotificationContext = {
        machineId: "mach_laser_1" as Id<"machines">,
        machineRole: "laser_operator",
      };
      const laser2Context: NotificationContext = {
        machineId: "mach_laser_2" as Id<"machines">,
        machineRole: "laser_operator",
      };
      const cncContext: NotificationContext = {
        machineId: "mach_cnc_1" as Id<"machines">,
        machineRole: "cnc_operator",
      };

      // Assigned operator sees their assigned machine
      expect(canViewNotification(laserOpAssigned, laserJobNotification, laser1Context)).toBe(true);
      // Assigned operator is blocked from unassigned machine
      expect(canViewNotification(laserOpAssigned, laserJobNotification, laser2Context)).toBe(false);
      // Blocked from completely different machine role
      expect(canViewNotification(laserOpAssigned, laserJobNotification, cncContext)).toBe(false);

      // Unassigned operator sees any machine matching their role
      expect(canViewNotification(laserOpUnassigned, laserJobNotification, laser1Context)).toBe(true);
      expect(canViewNotification(laserOpUnassigned, laserJobNotification, laser2Context)).toBe(true);
      expect(canViewNotification(laserOpUnassigned, laserJobNotification, cncContext)).toBe(false);

      // CNC operator sees CNC machine
      expect(canViewNotification(cncOp, laserJobNotification, cncContext)).toBe(true);
    });

    it("permits operators to receive production-handoff order_status on their machine", () => {
      const orderStatusNotification: NotificationRecord = {
        title: "Order Ready for Production",
        message: "Order #202 sent to machine",
        type: "order_status",
      };
      const laser1Context: NotificationContext = {
        machineId: "mach_laser_1" as Id<"machines">,
        machineRole: "laser_operator",
      };

      expect(canViewNotification(laserOpAssigned, orderStatusNotification, laser1Context)).toBe(true);
      expect(canViewNotification(cncOp, orderStatusNotification, laser1Context)).toBe(false);

      // Other order events like order_received remain blocked for operators
      const orderReceived: NotificationRecord = {
        title: "Order Received",
        message: "New order",
        type: "order_received",
      };
      expect(canViewNotification(laserOpAssigned, orderReceived, laser1Context)).toBe(false);
    });

    it("protects account_update privacy while preserving owner/admin oversight", () => {
      const accountNotification: NotificationRecord = {
        title: "Account Updated",
        message: "Role updated",
        type: "account_update",
        recipientAuthUserId: "u_laser",
      };

      // Recipient can view
      expect(canViewNotification(laserOpAssigned, accountNotification)).toBe(true);
      // Other operator cannot view
      expect(canViewNotification(cncOp, accountNotification)).toBe(false);
      // Storekeeper cannot view
      expect(canViewNotification(storekeeper, accountNotification)).toBe(false);
      // Manager cannot view another user's account update
      expect(canViewNotification(manager, accountNotification)).toBe(false);
      // Owner can view for audit
      expect(canViewNotification(owner, accountNotification)).toBe(true);
    });
  });

  describe("Dispatch & Candidate Resolution (notifyByPolicy)", () => {
    it("filters recipients by policy and suppresses the actor", async () => {
      const inserted: Array<{ recipient: string; title: string; type: string }> = [];

      const mockUsers = [
        { authUserId: "u_actor", role: "receptionist", active: true },
        { authUserId: "u_rec_2", role: "receptionist", active: true },
        { authUserId: "u_store", role: "storekeeper", active: true },
        { authUserId: "u_laser", role: "laser_operator", active: true, assignedMachineIds: ["mach_laser_1"] },
        { authUserId: "u_owner", role: "owner", active: true },
      ];

      const mockDb = {
        query: (table: string) => ({
          collect: async () => (table === "users" ? mockUsers : []),
          withIndex: () => ({
            order: () => ({
              take: async () => [],
            }),
          }),
        }),
        get: async (id: string) => {
          if (id === "mach_laser_1") {
            return { _id: "mach_laser_1", name: "Laser Cutter 1", operatorRole: "laser_operator" };
          }
          return null;
        },
        insert: async (_table: string, doc: any) => {
          inserted.push({
            recipient: doc.recipientAuthUserId,
            title: doc.title,
            type: doc.type,
          });
        },
      };

      const mockCtx = { db: mockDb } as unknown as MutationCtx;

      // Dispatch order event targeting all roles
      await notifyByPolicy(mockCtx, {
        type: "order_received",
        title: "Order Placed",
        message: "Customer paid for order",
        actorAuthUserId: "u_actor", // actor is receptionist 1
        targetRoles: ["receptionist", "storekeeper", "laser_operator", "owner"],
      });

      // Recipient 1 (actor) must be suppressed
      expect(inserted.some((i) => i.recipient === "u_actor")).toBe(false);
      // Receptionist 2 must receive it
      expect(inserted.some((i) => i.recipient === "u_rec_2")).toBe(true);
      // Storekeeper must be filtered out by policy (orders not allowed)
      expect(inserted.some((i) => i.recipient === "u_store")).toBe(false);
      // Laser operator must be filtered out by policy (order_received not allowed)
      expect(inserted.some((i) => i.recipient === "u_laser")).toBe(false);
      // Owner must receive it
      expect(inserted.some((i) => i.recipient === "u_owner")).toBe(true);
    });

    it("dispatches machine-scoped notifications only to matching machine operators", async () => {
      const inserted: string[] = [];

      const mockUsers = [
        { authUserId: "u_laser", role: "laser_operator", active: true, assignedMachineIds: ["mach_laser_1"] },
        { authUserId: "u_cnc", role: "cnc_operator", active: true, assignedMachineIds: ["mach_cnc_1"] },
        { authUserId: "u_store", role: "storekeeper", active: true },
      ];

      const mockDb = {
        query: (table: string) => ({
          collect: async () => (table === "users" ? mockUsers : []),
          withIndex: () => ({
            order: () => ({
              take: async () => [],
            }),
          }),
        }),
        get: async (id: string) => {
          if (id === "mach_laser_1") {
            return { _id: "mach_laser_1", name: "Laser Cutter 1", operatorRole: "laser_operator" };
          }
          return null;
        },
        insert: async (_table: string, doc: any) => {
          inserted.push(doc.recipientAuthUserId);
        },
      };

      const mockCtx = { db: mockDb } as unknown as MutationCtx;

      await notifyByPolicy(mockCtx, {
        type: "machine_update",
        title: "Laser Calibrated",
        message: "Machine calibrated",
        machineId: "mach_laser_1" as Id<"machines">,
        audience: "MACHINE_ROLE",
      });

      expect(inserted).toEqual(["u_laser"]);
    });
  });
});
