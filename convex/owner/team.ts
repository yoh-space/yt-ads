import { query } from "../_generated/server";
import { requireOwner } from "../users";

/**
 * Team / staff and access summary for the owner team page.
 */
export const getTeamSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const users = await ctx.db.query("users").collect();
    const byRole = new Map<string, number>();
    for (const user of users) {
      byRole.set(user.role, (byRole.get(user.role) ?? 0) + 1);
    }
    return {
      totalStaff: users.length,
      activeStaff: users.filter((u) => u.active).length,
      byRole: Object.fromEntries(byRole),
      team: users
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
        })),
    };
  },
});