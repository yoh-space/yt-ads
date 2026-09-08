import { query } from "../_generated/server";
import { requireOwner } from "../users";

/**
 * Machine activity summary for the owner machines page.
 */
export const getMachineSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [machines, jobs] = await Promise.all([
      ctx.db.query("machines").filter((q) => q.eq(q.field("active"), true)).collect(),
      ctx.db.query("jobCards").collect(),
    ]);
    const jobMap = new Map<string, typeof jobs[number][]>();
    for (const job of jobs) {
      const list = jobMap.get(job.machineId) ?? [];
      list.push(job);
      jobMap.set(job.machineId, list);
    }
    const byStatus = new Map<string, number>();
    for (const machine of machines) byStatus.set(machine.status, (byStatus.get(machine.status) ?? 0) + 1);

    return {
      machines: machines.map((m) => {
        const machineJobs = jobMap.get(m._id) ?? [];
        const active = machineJobs.find((j) => j.status === "In production");
        return {
          id: m._id,
          name: m.name,
          code: m.code,
          type: m.type,
          status: m.status,
          activeJob: active ? { code: active.code, title: active.title } : null,
          queuedCount: machineJobs.filter((j) => j.status === "Queued").length,
        };
      }),
      byStatus: Object.fromEntries(byStatus),
      machinesCount: machines.length,
    };
  },
});