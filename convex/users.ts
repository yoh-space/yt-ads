import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { role } from "./schema";
import type { Role } from "./types";
import { hasPermission, hasAnyPermission, type Permission } from "./authorization";
import { notifyUser } from "./notificationHelpers";
import { verifyTelegramInitData } from "./telegramAuth";

const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin"];
export const OPERATOR_ROLES: Role[] = ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"];

type AuthIdentity = NonNullable<Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>>;

/**
 * Finds the application profile for an identity, relinking by email when the
 * stored `authUserId` no longer matches (for example after the authentication
 * provider's user records were reset but the application profiles were kept).
 */
async function resolveProfileByIdentity(ctx: QueryCtx | MutationCtx, identity: AuthIdentity) {
  const byId = await ctx.db
    .query("users")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", identity._id))
    .unique();
  if (byId) return byId;
  if (identity.email) {
    const normalized = identity.email.toLowerCase();
    const byEmail = (await ctx.db.query("users").collect()).find(
      (user) => user.email.toLowerCase() === normalized,
    );
    if (byEmail) return byEmail;
  }
  return null;
}

/**
 * Resolves the signed-in user's application profile. Matches strictly by the
 * stored `authUserId` so that a stale link surfaces as `null` and the client
 * triggers `ensureProfile` to relink it. Reads never mutate, so a by-email
 * fallback is intentionally not applied here.
 */
export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await authComponent.safeGetAuthUser(ctx);
    if (!identity) return null;
    return ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", identity._id))
      .unique();
  },
});

/** Returns the active company settings for the signed-in workspace. */
export const getCompanySettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await authComponent.safeGetAuthUser(ctx);
    if (!identity) return null;
    return ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", "yt-advertisement"))
      .unique();
  },
});

/**
 * Creates or updates a Telegram customer profile (the `telegramUsers` table,
 * separate from staff application profiles) when the bot receives a shared
 * contact. Called by the bot webhook with no user identity, so like the other
 * bot-facing handlers it performs its own input validation instead of RBAC.
 */
export const upsertUser = mutation({
  args: {
    telegramId: v.string(),
    phone: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const telegramId = args.telegramId.trim();
    const phone = args.phone.replace(/[^+\d]/g, "").trim();
    if (!telegramId) throw new Error("Telegram ID is required.");
    if (!/^\+?\d{7,15}$/.test(phone)) throw new Error("Enter a valid phone number.");
    const name = args.name?.trim() || undefined;
    const now = Date.now();
    const existing = await ctx.db
      .query("telegramUsers")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        phone,
        name: name ?? existing.name,
        verifiedAt: now,
        updatedAt: now,
      });
      return (await ctx.db.get(existing._id))!;
    }
    const id = await ctx.db.insert("telegramUsers", {
      telegramId,
      phone,
      name,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return (await ctx.db.get(id))!;
  },
});

/**
 * Returns the Telegram customer profile for a Telegram user id, including the
 * verified phone number. Public so the Mini App (whose visitors are Telegram
 * customers, not signed-in staff) can read their own phone for order submission.
 */
export const getByTelegramId = query({
  args: { telegramId: v.string(), initData: v.string() },
  handler: async (ctx, args) => {
    const verified = await verifyTelegramInitData(args.initData);
    const telegramId = args.telegramId.trim();
    if (verified.telegramId !== telegramId) throw new Error("Telegram identity mismatch.");
    if (!telegramId) return null;
    return ctx.db
      .query("telegramUsers")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
  },
});

export const updateTelegramProfile = mutation({
  args: {
    telegramId: v.string(),
    initData: v.string(),
    phone: v.string(),
    name: v.optional(v.string()),
    companyLegalName: v.optional(v.string()),
    tinNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    telegramId: v.string(),
    phone: v.string(),
    name: v.optional(v.string()),
    companyLegalName: v.optional(v.string()),
    tinNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const telegramId = args.telegramId.trim();
    const verified = await verifyTelegramInitData(args.initData);
    if (!telegramId || verified.telegramId !== telegramId) throw new Error("Telegram identity mismatch.");
    const phone = args.phone.replace(/[^+\d]/g, "").trim();
    if (!/^\+?\d{7,15}$/.test(phone)) throw new Error("Enter a valid phone number.");
    const name = args.name?.trim() || undefined;
    const companyLegalName = args.companyLegalName?.trim() || undefined;
    const tinNumber = args.tinNumber?.replace(/\D/g, "").trim() || undefined;
    const notes = args.notes?.trim() || undefined;
    if (name && name.length > 160) throw new Error("Name is too long.");
    if (companyLegalName && companyLegalName.length > 160) throw new Error("Company name is too long.");
    if (tinNumber && !/^\d{10}$/.test(tinNumber)) throw new Error("TIN must contain exactly 10 digits.");
    if (notes && notes.length > 2000) throw new Error("Notes are too long.");
    const existing = await ctx.db.query("telegramUsers").withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId)).unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { phone, name, companyLegalName, tinNumber, notes, verifiedAt: now, updatedAt: now });
      return { telegramId, phone, name, companyLegalName, tinNumber, notes };
    }
    await ctx.db.insert("telegramUsers", { telegramId, phone, name, companyLegalName, tinNumber, notes, verifiedAt: now, createdAt: now, updatedAt: now });
    return { telegramId, phone, name, companyLegalName, tinNumber, notes };
  },
});

/**
 * Bot-only lookup for a customer's verified phone + display name, used so the
 * `/start` handler can skip the share-contact prompt for known customers and
 * the Mini App launcher can deep-link with the right phone.
 *
 * Authentication is a shared secret (`TELEGRAM_BOT_TOKEN`) — only callers
 * that already hold the bot token may read a record, which prevents the deploy
 * URL from being used to enumerate Telegram customer phone numbers. The Mini
 * App never sees the bot token and therefore uses the regular `getByTelegramId`
 * initData-protected query instead.
 */
export const getTelegramProfileForBot = query({
  args: { telegramId: v.string(), botToken: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.TELEGRAM_BOT_TOKEN;
    if (!expected || args.botToken !== expected) {
      throw new Error("Unauthorized");
    }
    const telegramId = args.telegramId.trim();
    if (!telegramId) return null;
    const profile = await ctx.db
      .query("telegramUsers")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", telegramId))
      .unique();
    if (!profile) return null;
    return {
      telegramId: profile.telegramId,
      phone: profile.phone,
      name: profile.name,
      verifiedAt: profile.verifiedAt,
    };
  },
});

/** Creates an application profile for a real Better Auth identity on first sign-in. */
export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await authComponent.safeGetAuthUser(ctx);
    if (!identity) return null;
    const existing = await resolveProfileByIdentity(ctx, identity);
    if (existing) {
      if (existing.authUserId !== identity._id) {
        await ctx.db.patch(existing._id, { authUserId: identity._id });
      }
      return existing;
    }

    const isFirst = (await ctx.db.query("users").collect()).length === 0;
    const userId = await ctx.db.insert("users", {
      authUserId: identity._id,
      name: identity.name ?? identity.email ?? "Team member",
      email: identity.email ?? "",
      image: identity.image ?? undefined,
      role: isFirst ? "owner" : "storekeeper",
      active: true,
    });
    return (await ctx.db.get(userId))!;
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireRoleManager(ctx);
    return ctx.db.query("users").collect();
  },
});

/**
 * Removes every application profile that is not an owner (and not the calling
 * owner), leaving only the real YT Advertisement owner and the seeded
 * workspace. Use this to drop leftover demo/admin profiles. The underlying
 * Better Auth accounts are not deleted here; remove them from the auth side if
 * their sign-in should be fully revoked.
 */
/**
 * Deletes a single user profile by ID. Owner-only.
 */
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { profile: actor } = await requirePermission(ctx, "team.manage");
    if (actor.role !== "owner") throw new Error("Only the owner can delete user profiles.");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found.");
    await ctx.db.delete(args.userId);
    return { deleted: target.email };
  },
});

export const pruneDemoUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await authComponent.safeGetAuthUser(ctx);
    if (identity) {
      const actor = await ctx.db
        .query("users")
        .withIndex("by_auth_user", (q) => q.eq("authUserId", identity._id))
        .unique();
      if (!actor || actor.role !== "owner") {
        throw new Error("Only the owner can prune users.");
      }
    }
    const users = await ctx.db.query("users").collect();
    const removed: string[] = [];
    for (const user of users) {
      if (user.role === "owner") continue;
      if (identity && user.authUserId === identity._id) continue;
      await ctx.db.delete(user._id);
      removed.push(user.email);
    }
    const remaining = (await ctx.db.query("users").collect()).map((user) => user.email);
    return { removed, remaining };
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role },
  handler: async (ctx, args) => {
    const { profile: actor } = await requirePermission(ctx, "team.manage");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User profile not found.");
    if (target.role === "owner" && actor.role !== "owner") {
      throw new Error("Only the owner can change the owner profile.");
    }
    if (args.role === "owner" && actor.role !== "owner") {
      throw new Error("Only the owner can assign the owner role.");
    }
    if (actor.role === "manager" && args.role === "owner") {
      throw new Error("Managers cannot assign the owner role.");
    }
    await ctx.db.patch(args.userId, {
      role: args.role,
      assignedMachineIds: args.role === target.role && OPERATOR_ROLES.includes(args.role)
        ? target.assignedMachineIds
        : undefined,
    });
    await notifyUser(ctx, target.authUserId, {
      title: "Role updated",
      message: `Your workspace role is now ${args.role}.`,
      type: "account_update",
      actorAuthUserId: actor.authUserId,
      relatedTable: "users",
      relatedId: args.userId,
    });
  },
});

export const setActive = mutation({
  args: { userId: v.id("users"), active: v.boolean() },
  handler: async (ctx, args) => {
    const { profile: actor } = await requirePermission(ctx, "team.manage");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User profile not found.");
    if (target.authUserId === actor.authUserId && !args.active) {
      throw new Error("You cannot deactivate your own profile.");
    }
    if (target.role === "owner" && actor.role !== "owner") {
      throw new Error("Only the owner can deactivate the owner profile.");
    }
    await ctx.db.patch(args.userId, { active: args.active });
    if (args.active) {
      await notifyUser(ctx, target.authUserId, {
        title: "Profile access restored",
        message: "Your YT Advertisement workspace access has been restored.",
        type: "account_update",
        actorAuthUserId: actor.authUserId,
        relatedTable: "users",
        relatedId: args.userId,
      });
    }
  },
});

/** Assigns an operator to one or more production machines for scoped visibility. */
export const setMachineScope = mutation({
  args: {
    userId: v.id("users"),
    machineIds: v.array(v.id("machines")),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const { profile: actor } = await requirePermission(ctx, "team.manage");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User profile not found.");
    if (!OPERATOR_ROLES.includes(target.role)) {
      if (args.machineIds.length > 0) throw new Error("Only operator profiles can have machine scope.");
      await ctx.db.patch(args.userId, { assignedMachineIds: undefined });
      return { updated: true };
    }

    const uniqueMachineIds = [...new Set(args.machineIds)];
    const machines = await Promise.all(uniqueMachineIds.map((machineId) => ctx.db.get(machineId)));
    if (machines.some((machine) => !machine || !machine.active)) {
      throw new Error("Machine scope can only include active machines.");
    }
    if (machines.some((machine) => machine!.operatorRole !== target.role)) {
      throw new Error("Each selected machine must match the operator role.");
    }

    await ctx.db.patch(args.userId, {
      assignedMachineIds: uniqueMachineIds.length > 0 ? uniqueMachineIds : undefined,
    });
    if (target.authUserId !== actor.authUserId) {
      await notifyUser(ctx, target.authUserId, {
        title: "Machine scope updated",
        message: uniqueMachineIds.length > 0
          ? "Your notification and operator workspace scope was updated."
          : "Your notifications now include all active machines assigned to your role.",
        type: "account_update",
        actorAuthUserId: actor.authUserId,
        relatedTable: "users",
        relatedId: args.userId,
      });
    }
    return { updated: true };
  },
});

export const updateApplicationProfile = mutation({
  args: {
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required.");
    await ctx.db.patch(profile._id, {
      name,
      email: identity.email ?? profile.email,
      image: args.image?.trim() || undefined,
    });
    return (await ctx.db.get(profile._id))!;
  },
});

export const updateCompanySettings = mutation({
  args: {
    companyName: v.string(),
    logoUrl: v.optional(v.string()),
    industry: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    timezone: v.optional(v.string()),
    reportAutomationEnabled: v.optional(v.boolean()),
    reportFrequency: v.optional(v.string()),
    reportRecipients: v.optional(v.array(v.string())),
    reportDeliveryTime: v.optional(v.string()),
    notificationPreferences: v.optional(v.object({
      inventoryInApp: v.boolean(), inventoryEmail: v.boolean(), inventoryTelegram: v.boolean(),
      approvalsInApp: v.boolean(), approvalsEmail: v.boolean(), approvalsTelegram: v.boolean(),
      reconciliationInApp: v.boolean(), reconciliationEmail: v.boolean(), reconciliationTelegram: v.boolean(),
      financialInApp: v.boolean(), financialEmail: v.boolean(), financialTelegram: v.boolean(),
    })),
    paymentInstructions: v.optional(v.object({
      cbe: v.optional(v.object({ accountName: v.string(), accountNumber: v.string(), enabled: v.boolean() })),
      boa: v.optional(v.object({ accountName: v.string(), accountNumber: v.string(), enabled: v.boolean() })),
      telebirr: v.optional(v.object({ displayName: v.string(), merchantId: v.string(), enabled: v.boolean() })),
      cbeBirr: v.optional(v.object({ displayName: v.string(), merchantId: v.string(), enabled: v.boolean() })),
    })),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "company_settings.update");
    const settings = await ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", "yt-advertisement"))
      .unique();
    if (!settings) throw new Error("Company settings have not been seeded yet.");
    if (args.paymentInstructions) {
      const channels = Object.values(args.paymentInstructions);
      for (const channel of channels) {
        if (!channel) continue;
        const identifier = "accountNumber" in channel ? channel.accountNumber : channel.merchantId;
        const name = "accountName" in channel ? channel.accountName : channel.displayName;
        if (channel.enabled && (!identifier.trim() || !name.trim())) throw new Error("Enabled payment channels require a name and identifier.");
        if (identifier.length > 80 || name.length > 120) throw new Error("Payment channel details are too long.");
      }
      if (!channels.some((channel) => channel?.enabled)) throw new Error("Enable at least one customer payment channel.");
    }
    await ctx.db.patch(settings._id, {
      companyName: args.companyName.trim() || settings.companyName,
      logoUrl: args.logoUrl?.trim() || undefined,
      industry: args.industry?.trim() || settings.industry,
      address: args.address?.trim() || settings.address,
      phone: args.phone?.trim() || settings.phone,
      taxId: args.taxId?.trim() || settings.taxId,
      timezone: args.timezone?.trim() || settings.timezone,
      reportAutomationEnabled: args.reportAutomationEnabled ?? settings.reportAutomationEnabled,
      reportFrequency: args.reportFrequency ?? settings.reportFrequency,
      reportRecipients: args.reportRecipients ?? settings.reportRecipients,
      reportDeliveryTime: args.reportDeliveryTime ?? settings.reportDeliveryTime,
      notificationPreferences: args.notificationPreferences ?? settings.notificationPreferences,
      paymentInstructions: args.paymentInstructions ?? settings.paymentInstructions,
      paymentInstructionsVersion: args.paymentInstructions ? (settings.paymentInstructionsVersion ?? 0) + 1 : settings.paymentInstructionsVersion,
    });
    return (await ctx.db.get(settings._id))!;
  },
});

export async function requireActiveProfile(ctx: QueryCtx | MutationCtx) {
  const identity = await authComponent.getAuthUser(ctx);
  const profile = await resolveProfileByIdentity(ctx, identity);
  if (!profile || !profile.active) {
    throw new Error("Active team profile required.");
  }
  return { identity, profile };
}

/** Permission-based guard (RBAC): the active profile must hold `permission`. */
export async function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
  const result = await requireActiveProfile(ctx);
  if (!hasPermission(result.profile.role, permission)) {
    throw new Error(`Permission '${permission}' is required for this action.`);
  }
  return result;
}

/** Permission-based guard (RBAC): the active profile must hold at least one of `permissions`. */
export async function requireAnyPermission(ctx: QueryCtx | MutationCtx, permissions: Permission[]) {
  const result = await requireActiveProfile(ctx);
  if (!hasAnyPermission(result.profile.role, permissions)) {
    throw new Error("You do not have permission for this action.");
  }
  return result;
}

export async function requireRoles(ctx: QueryCtx | MutationCtx, allowedRoles: Role[]) {
  const result = await requireActiveProfile(ctx);
  const effectiveRoles = allowedRoles.includes("admin")
    ? [...new Set([...allowedRoles, "owner", "manager"])]
    : allowedRoles;
  if (!effectiveRoles.includes(result.profile.role)) {
    throw new Error(`Role ${result.profile.role} is not permitted for this action.`);
  }
  return result;
}

export async function requireRoleManager(ctx: QueryCtx | MutationCtx) {
  return requireRoles(ctx, MANAGEMENT_ROLES);
}

export async function requireOwner(ctx: QueryCtx | MutationCtx) {
  return requireRoles(ctx, ["owner"]);
}

/** Backwards-compatible guard: owner, manager, and legacy admins can administer operations. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return (await requireRoles(ctx, MANAGEMENT_ROLES)).profile;
}

export const ADMIN_ROLES: Role[] = ["admin"];
export const MANAGER_ROLES: Role[] = ["manager"];
export const STOREKEEPER_ROLES: Role[] = ["storekeeper"];
export const RECEPTIONIST_ROLES: Role[] = ["receptionist"];

/**
 * Strict role guard without the management-admin expansion performed by
 * `requireRoles`. Used by per-role workspace namespaces so that each namespace
 * is reachable only by its own role. Returns the active profile.
 */
export async function requireExactRole(ctx: QueryCtx | MutationCtx, role: Role) {
  const result = await requireActiveProfile(ctx);
  if (result.profile.role !== role) {
    throw new Error(`Role ${result.profile.role} is not permitted for this action.`);
  }
  return result;
}

/** Admin-only guard for the /dashboard/admin workspace namespace. */
export async function requireAdminRole(ctx: QueryCtx | MutationCtx) {
  return requireExactRole(ctx, "admin");
}

/** Manager-only guard for the /dashboard/manager workspace namespace. */
export async function requireManagerRole(ctx: QueryCtx | MutationCtx) {
  return requireExactRole(ctx, "manager");
}

/** Storekeeper-only guard for the /dashboard/storekeeper workspace namespace. */
export async function requireStorekeeper(ctx: QueryCtx | MutationCtx) {
  return requireExactRole(ctx, "storekeeper");
}

/** Receptionist-only guard for the /dashboard/receptionist workspace namespace. */
export async function requireReceptionist(ctx: QueryCtx | MutationCtx) {
  return requireExactRole(ctx, "receptionist");
}

/** Operator guard for the /dashboard/operator workspace namespace (any operator role). */
export async function requireOperator(ctx: QueryCtx | MutationCtx) {
  return requireRoles(ctx, OPERATOR_ROLES);
}
