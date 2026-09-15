import { query } from "../_generated/server";
import { requireOwner } from "../users";

/**
 * Team / staff and access summary for the owner team page.
 */
export const getTeamSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [users, machines] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("machines").collect(),
    ]);
    const byRole = new Map<string, number>();
    for (const user of users) {
      if (user.assigned === false) continue;
      byRole.set(user.role, (byRole.get(user.role) ?? 0) + 1);
    }
    return {
      totalStaff: users.length,
      activeStaff: users.filter((u) => u.active).length,
      byRole: Object.fromEntries(byRole),
      machines: machines
        .filter((machine) => machine.active)
        .map((machine) => ({
          id: machine._id,
          name: machine.name,
          code: machine.code,
          operatorRole: machine.operatorRole,
        })),
      team: users
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({
          id: u._id,
          authUserId: u.authUserId,
          name: u.name,
          email: u.email,
          role: u.role,
          assigned: u.assigned !== false,
          active: u.active,
          assignedMachineIds: u.assignedMachineIds ?? [],
        })),
    };
  },
});
