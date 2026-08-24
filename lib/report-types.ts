export type ReportPeriod = "weekly" | "biweekly" | "monthly";

export type ReportSummary = {
  period: ReportPeriod;
  startAt: number;
  endAt: number;
  days: number;
  seededDataNote: string;
  inventory: {
    trackedMaterials: number;
    lowStockMaterials: number;
    totalBaseQuantity: number;
    movementCount: number;
    stockInByUnit: Array<{ unit: string; quantity: number }>;
    stockOutByUnit: Array<{ unit: string; quantity: number }>;
  };
  production: {
    machineCount: number;
    runningMachines: number;
    jobCardsCreated: number;
    activeJobs: number;
    completedJobs: number;
    plannedQuantity: number;
    logCount: number;
    inputQuantity: number;
    outputQuantity: number;
    wasteQuantity: number;
    wasteRate: number;
  };
  recovery: {
    offcutReturns: number;
    reusableOffcuts: number;
    scrapRecords: number;
    scrapQuantity: number;
    scrapByUnit: Array<{ unit: string; quantity: number }>;
  };
};

export type AuditCategory = "all" | "inventory" | "production" | "recovery";

export type AuditEvent = {
  id: string;
  category: Exclude<AuditCategory, "all">;
  action: string;
  actorId: string;
  actorName: string;
  at: number;
  summary: string;
  detail: string;
};
