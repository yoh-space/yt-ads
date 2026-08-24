import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { role } from "./schema";
import type { Role } from "./types";

/**
 * Resolves the signed-in user's application profile (which carries the role)
 * from the Better Auth identity. Returns null when unauthenticated.
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

/**
 * Ensures a profile exists for the current Better Auth user, creating one with a
 * sensible default role on first sign-in. The first account becomes the admin;
 * subsequent accounts start as storekeepers and can be promoted by an admin.
 */
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
      role: isFirst ? "admin" : "storekeeper",
      active: true,
    });
    return (await ctx.db.get(userId))!;
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("users").collect();
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

export const setActive = mutation({
  args: { userId: v.id("users"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { active: args.active });
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
  if (!allowedRoles.includes(result.profile.role)) {
    throw new Error(`Role ${result.profile.role} is not permitted for this action.`);
  }
  return result;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return (await requireRoles(ctx, ["admin"])).profile;
}
