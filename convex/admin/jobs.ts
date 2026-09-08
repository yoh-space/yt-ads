import { query } from "../_generated/server";
import { requireAdminRole } from "../users";

/**
 * Job card summary for the admin jobs page: status counts plus recent job cards
 * with machine names resolved for everyday reading.
 */
export const getJobSummary = query({
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const [jobs, machines] = await Promise.all([
      ctx.db.query("jobCards").collect(),
      ctx.db.query("machines").collect(),
    ]);
    const machineMap = new Map(machines.map((m) => [m._id, m.name]));

    const byStatus = new Map<string, number>();
    for (const job of jobs) {
      byStatus.set(job.status, (byStatus.get(job.status) ?? 0) + 1);
    }

    const recent = jobs
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15)
      .map((job) => ({
        id: job._id,
        code: job.code,
        title: job.title,
        client: job.client,
        machineName: machineMap.get(job.machineId) ?? "Machine",
        status: job.status,
        priority: job.priority,
        createdAt: job.createdAt,
      }));

    return {
      totalJobs: jobs.length,
      byStatus: Object.fromEntries(byStatus),
      inProduction: jobs.filter((j) => j.status === "In production").length,
      queued: jobs.filter((j) => j.status === "Queued").length,
      recent,
    };
  },
});