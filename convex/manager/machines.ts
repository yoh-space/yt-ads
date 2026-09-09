import { query } from "../_generated/server";
import { v } from "convex/values";
import { machineStatus, role, jobStatus } from "../schema";
import { requireManagerRole } from "../users";

const managerMachine = v.object({
  id: v.id("machines"),
  name: v.string(),
  code: v.string(),
  type: v.string(),
  operatorRole: role,
  status: machineStatus,
  activeJobCode: v.optional(v.string()),
  activeJobTitle: v.optional(v.string()),
  activeJobStatus: v.optional(jobStatus),
  activeJobDue: v.optional(v.string()),
});

export const getOverview = query({
  args: {},
  returns: v.object({
    total: v.number(),
    running: v.number(),
    available: v.number(),
    maintenance: v.number(),
    unavailable: v.number(),
    activeJobs: v.number(),
    machines: v.array(managerMachine),
  }),
  handler: async (ctx) => {
    await requireManagerRole(ctx);
    const machines = (await ctx.db.query("machines").order("desc").take(100)).filter((machine) => machine.active);
    const jobs = await ctx.db.query("jobCards").order("desc").take(200);
    const jobByCode = new Map(jobs.map((job) => [job.code, job]));

    const overviewMachines = machines.map((machine) => {
      const job = machine.activeJob ? jobByCode.get(machine.activeJob) : undefined;
      return {
        id: machine._id,
        name: machine.name,
        code: machine.code,
        type: machine.type,
        operatorRole: machine.operatorRole,
        status: machine.status,
        activeJobCode: job?.code,
        activeJobTitle: job?.title,
        activeJobStatus: job?.status,
        activeJobDue: job?.due,
      };
    });

    return {
      total: overviewMachines.length,
      running: overviewMachines.filter((machine) => machine.status === "Running").length,
      available: overviewMachines.filter((machine) => machine.status === "Available").length,
      maintenance: overviewMachines.filter((machine) => machine.status === "Maintenance").length,
      unavailable: overviewMachines.filter((machine) => machine.status === "Unavailable").length,
      activeJobs: overviewMachines.filter((machine) => machine.activeJobCode).length,
      machines: overviewMachines,
    };
  },
});
