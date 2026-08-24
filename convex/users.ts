import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { role } from "./schema";
import type { Role } from "./types";
import { notifyUser } from "./notificationHelpers";

const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin"];

/** Resolves the signed-in user's application profile. */
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
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", identity._id))
      .unique();
    if (existing) return existing;

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

export const setRole = mutation({
  args: { userId: v.id("users"), role },
  handler: async (ctx, args) => {
    const { profile: actor } = await requireRoleManager(ctx);
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
    const { profile: actor } = await requireRoleManager(ctx);
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
    await requireOwner(ctx);
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
  const profile = await ctx.db
    .query("users")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", identity._id))
    .unique();
  if (!profile || !profile.active) {
    throw new Error("Active team profile required.");
  }
  return { identity, profile };
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
