import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("overdue order alerts", { hours: 1 }, internal.orders.notifyOverdueInternal);
crons.interval("expire orders", { minutes: 30 }, internal.orders.expireOrdersInternal);

// One-shot: normalizes legacy `customerOrders.status` casing shortly after the
// widened schema (see `convex/schema.ts`) is deployed. The migration is
// idempotent and the `migrations` table prevents it from re-running once the
// dataset is clean.
crons.cron("migrate order status casing", "30 2 * * *", internal.migrations.migrateOrderStatusCasing);

export default crons;
