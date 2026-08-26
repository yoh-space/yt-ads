import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("overdue order alerts", { hours: 1 }, internal.orders.notifyOverdueInternal);

export default crons;
