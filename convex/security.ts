import { query } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Resolves whether the authenticated (just signed-in) user is the workspace
 * owner. Called right after a successful sign-in with the freshly minted
 * session; the sender in "src/app/api/auth/[...all]/route.ts" is responsible
 * for the Telegram delivery so the bot token stays in the Next.js runtime.
 */
export const checkOwnerLogin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await authComponent.safeGetAuthUser(ctx);
    if (!identity) return { isOwner: false as const };

    const profile = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", identity._id))
      .unique();
    if (!profile || !profile.active || profile.role !== "owner") {
      return { isOwner: false as const };
    }
    return { isOwner: true as const, userName: profile.name, role: profile.role };
  },
});