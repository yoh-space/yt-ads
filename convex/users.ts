import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { role } from "./schema";
import type { Role } from "./types";
import { hasPermission, hasAnyPermission, type Permission } from "./authorization";
import { notifyUser } from "./notificationHelpers";

const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin"];

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
    await ctx.db.patch(args.userId, { role: args.role });
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
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "company_settings.update");
    const settings = await ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", "yt-advertisement"))
      .unique();
    if (!settings) throw new Error("Company settings have not been seeded yet.");
    await ctx.db.patch(settings._id, {
      companyName: args.companyName.trim() || settings.companyName,
      logoUrl: args.logoUrl?.trim() || undefined,
      industry: args.industry?.trim() || settings.industry,
      address: args.address?.trim() || settings.address,
      phone: args.phone?.trim() || settings.phone,
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
