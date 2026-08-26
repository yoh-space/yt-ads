export type ReportPeriod = "weekly" | "biweekly" | "monthly" | "custom";

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
  financial: {
    totalOrders: number;
    completedOrders: number;
    overdueOrders: number;
    pendingOrders: number;
    estimatedRevenue: number;
  };
  exceptions: Array<{
    id: string;
    materialName: string;
    quantity: number;
    unit: string;
    reason: string;
    operatorName: string;
    authorizationNote?: string;
    createdAt: number;
  }>;
  consumption: {
    topMaterials: Array<{
      materialName: string;
      totalConsumed: number;
      unit: string;
      movementCount: number;
    }>;
    reorderAlerts: Array<{
      materialName: string;
      currentStock: number;
      reorderAt: number;
      unit: string;
      estimatedDaysLeft: number | null;
    }>;
  };
  machineEfficiency: {
    byType: Array<{
      machineType: string;
      machineCount: number;
      jobCount: number;
      logCount: number;
      totalOutput: number;
      totalWaste: number;
    }>;
    wasteValue: {
      totalWasteQuantity: number;
      wasteUnit: string;
      estimatedETB: number;
    };
    operatorActivity: Array<{
      operatorName: string;
      jobCount: number;
      logCount: number;
      outputQuantity: number;
    }>;
  };
};

export type AuditCategory = "all" | "inventory" | "production" | "recovery" | "orders";

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
