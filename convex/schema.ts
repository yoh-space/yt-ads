import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const role = v.union(
  v.literal("owner"),
  v.literal("manager"),
  v.literal("admin"),
  v.literal("storekeeper"),
  v.literal("laser_operator"),
  v.literal("cnc_operator"),
  v.literal("plotter_operator"),
  v.literal("printer_operator"),
);

export const unit = v.union(
  v.literal("m²"),
  v.literal("m"),
  v.literal("sheet"),
  v.literal("piece"),
  v.literal("pcs"),
  v.literal("L"),
);

export const jobStatus = v.union(
  v.literal("Queued"),
  v.literal("In production"),
  v.literal("Completed"),
  v.literal("Paused"),
);

export const orderStatus = v.union(
  v.literal("Received"),
  v.literal("In Production"),
  v.literal("Ready for Pickup"),
  v.literal("Completed"),
);

export const orderPriority = v.union(
  v.literal("High"),
  v.literal("Medium"),
  v.literal("Low"),
);

export const orderSource = v.union(
  v.literal("public_portal"),
  v.literal("walk_in"),
);

export const exceptionReason = v.union(
  v.literal("Sample Print"),
  v.literal("Minor Repair"),
  v.literal("Test Cut"),
  v.literal("Internal Maintenance"),
);

export const stockMovementType = v.union(
  v.literal("STANDARD"),
  v.literal("EXCEPTION_STOCK_OUT"),
);

export const machineStatus = v.union(
  v.literal("Running"),
  v.literal("Available"),
  v.literal("Maintenance"),
  v.literal("Unavailable"),
);

export const priority = v.union(
  v.literal("High"),
  v.literal("Medium"),
  v.literal("Normal"),
);

export const accent = v.union(
  v.literal("cyan"),
  v.literal("gold"),
  v.literal("violet"),
  v.literal("blue"),
  v.literal("green"),
);

export const stockDirection = v.union(
  v.literal("in"),
  v.literal("out"),
);

export const purchaseUnit = v.union(
  v.literal("roll"),
  v.literal("sheet"),
  v.literal("pack"),
  v.literal("liter"),
  v.literal("piece"),
);

export const stockInputUnit = v.union(
  purchaseUnit,
  unit,
);

export const offcutStatus = v.union(
  v.literal("available"),
  v.literal("reserved"),
  v.literal("consumed"),
);

/** How a material is depleted for automatic job-card deduction. */
export const productionType = v.union(
  v.literal("area"),
  v.literal("ink"),
  v.literal("unit"),
);

export const reconciliationStatus = v.union(
  v.literal("Open"),
  v.literal("Reviewed"),
  v.literal("Resolved"),
);

export const materialRequestStatus = v.union(
  v.literal("Requested"),
  v.literal("Partially Issued"),
  v.literal("Issued"),
  v.literal("Received"),
  v.literal("Short Stock"),
  v.literal("Discrepancy"),
);

export const notificationType = v.union(
  v.literal("material_request"),
  v.literal("material_issue"),
  v.literal("material_received"),
  v.literal("short_stock"),
  v.literal("discrepancy"),
  v.literal("job_update"),
  v.literal("machine_update"),
  v.literal("account_update"),
  v.literal("order_received"),
  v.literal("order_status"),
  v.literal("overdue_order"),
  v.literal("exception_stock_out"),
);

export default defineSchema({
  companySettings: defineTable({
    key: v.string(),
    companyName: v.string(),
    industry: v.string(),
    address: v.string(),
    phone: v.optional(v.string()),
    ownerAuthUserId: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    timezone: v.string(),
    dailyReportEnabled: v.boolean(),
    monthlyAuditEnabled: v.boolean(),
    active: v.boolean(),
  })
    .index("by_key", ["key"]),

  staff: defineTable({
    personName: v.string(),
    department: v.optional(v.string()),
    responsibility: v.optional(v.string()),
    businessRole: v.string(),
    handlesMaterial: v.optional(v.string()),
    applicationRoles: v.optional(v.array(role)),
    authUserId: v.optional(v.string()),
    active: v.boolean(),
  })
    .index("by_business_role", ["businessRole"])
    .index("by_auth_user", ["authUserId"]),

  users: defineTable({
    authUserId: v.string(),
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    role,
    active: v.boolean(),
  })
    .index("by_auth_user", ["authUserId"])
    .index("by_role", ["role"]),

  notifications: defineTable({
    recipientAuthUserId: v.string(),
    title: v.string(),
    message: v.string(),
    type: notificationType,
    actorAuthUserId: v.optional(v.string()),
    relatedTable: v.optional(v.string()),
    relatedId: v.optional(v.string()),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient_created", ["recipientAuthUserId", "createdAt"])
    .index("by_recipient_read", ["recipientAuthUserId", "readAt"]),

  materials: defineTable({
    name: v.string(),
    category: v.string(),
    unit,
    baseUnit: v.optional(unit),
    purchaseUnit: v.optional(purchaseUnit),
    conversionRatio: v.optional(v.number()),
    specification: v.optional(v.string()),
    specificationValue: v.optional(v.string()),
    specificationOptions: v.optional(v.array(v.string())),
    quantity: v.number(),
    reorderAt: v.number(),
    rollEquivalent: v.optional(v.number()),
    sheetEquivalent: v.optional(v.number()),
    storageLocation: v.optional(v.string()),
    displayUnit: v.optional(v.string()),
    averageUse: v.optional(v.string()),
    reorderRule: v.optional(v.string()),
    scrapRule: v.optional(v.string()),
    accent,
    active: v.boolean(),
    productionType: v.optional(productionType),
    consumptionRate: v.optional(v.number()),
    etbValue: v.optional(v.number()),
    rollWidth: v.optional(v.number()),
    sheetWidth: v.optional(v.number()),
    sheetLength: v.optional(v.number()),
  })
    .index("by_category", ["category"])
    .index("by_unit", ["unit"]),

  machines: defineTable({
    name: v.string(),
    code: v.string(),
    type: v.string(),
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    capability: v.optional(v.string()),
    notes: v.optional(v.string()),
    operatorRole: role,
    materialUnit: unit,
    displayUnit: v.optional(v.string()),
    status: machineStatus,
    activeJob: v.optional(v.string()),
    active: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_operator_role", ["operatorRole"]),

  materialRequests: defineTable({
    jobCardId: v.id("jobCards"),
    materialId: v.id("materials"),
    requestedQuantity: v.number(),
    issuedQuantity: v.number(),
    unit,
    status: materialRequestStatus,
    requestedBy: v.string(),
    issuedBy: v.optional(v.string()),
    receivedBy: v.optional(v.string()),
    requestedAt: v.number(),
    issuedAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    note: v.optional(v.string()),
  })
    .index("by_job_card", ["jobCardId"])
    .index("by_status", ["status"]),

  stockMovements: defineTable({
    materialId: v.id("materials"),
    direction: v.union(stockDirection, v.literal("adjustment"), v.literal("offcut_return")),
    quantity: v.number(),
    unit: stockInputUnit,
    baseUnit: v.optional(unit),
    baseQuantity: v.optional(v.number()),
    movementType: v.optional(stockMovementType),
    exceptionReason: v.optional(v.string()),
    note: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_material", ["materialId"]),

  customerOrders: defineTable({
    code: v.string(),
    clientName: v.string(),
    phone: v.string(),
    serviceType: v.string(),
    dimensions: v.string(),
    quantity: v.string(),
    amount: v.optional(v.number()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    preferredDueDate: v.number(),
    status: orderStatus,
    priority: orderPriority,
    source: orderSource,
    notes: v.optional(v.string()),
    machineId: v.optional(v.id("machines")),
    jobCardId: v.optional(v.id("jobCards")),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    overdueInquiryAt: v.optional(v.number()),
    lastOverdueNotifiedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_phone", ["phone"])
    .index("by_status", ["status"])
    .index("by_due_date", ["preferredDueDate"]),

  stockExceptions: defineTable({
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    baseQuantity: v.number(),
    reason: exceptionReason,
    authorizationNote: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  jobCards: defineTable({
    code: v.string(),
    client: v.string(),
    title: v.string(),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    status: jobStatus,
    due: v.string(),
    priority,
    createdBy: v.string(),
    createdAt: v.number(),
    orderId: v.optional(v.id("customerOrders")),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    deductOnComplete: v.optional(v.boolean()),
  })
    .index("by_status", ["status"])
    .index("by_machine", ["machineId"])
    .index("by_created", ["createdAt"]),

  productionLogs: defineTable({
    jobCardId: v.id("jobCards"),
    machineId: v.id("machines"),
    inputQuantity: v.number(),
    outputQuantity: v.number(),
    wasteQuantity: v.number(),
    unit,
    operatorId: v.string(),
    createdAt: v.number(),
  })
    .index("by_job_card", ["jobCardId"])
    .index("by_machine", ["machineId"]),

  offcuts: defineTable({
    materialId: v.id("materials"),
    label: v.string(),
    width: v.number(),
    length: v.number(),
    area: v.number(),
    location: v.string(),
    usable: v.boolean(),
    status: offcutStatus,
    createdBy: v.string(),
    createdAt: v.string(),
    jobCardId: v.optional(v.id("jobCards")),
    source: v.optional(v.union(v.literal("manual"), v.literal("job_auto"))),
  })
    .index("by_material", ["materialId"])
    .index("by_status", ["status"])
    .index("by_material_status", ["materialId", "status"]),

  offcutConsumptions: defineTable({
    jobCardId: v.id("jobCards"),
    materialId: v.id("materials"),
    offcutId: v.id("offcuts"),
    area: v.number(),
    unit,
    consumedBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_job_card", ["jobCardId"])
    .index("by_offcut", ["offcutId"]),

  scraps: defineTable({
    materialId: v.id("materials"),
    label: v.string(),
    quantity: v.number(),
    unit,
    reason: v.string(),
    createdBy: v.string(),
    createdAt: v.string(),
  }).index("by_material", ["materialId"]),

  reconciliations: defineTable({
    materialId: v.id("materials"),
    status: reconciliationStatus,
    systemQuantity: v.number(),
    countedQuantity: v.number(),
    variance: v.number(),
    etbValue: v.optional(v.number()),
    monetaryLoss: v.optional(v.number()),
    countedBy: v.string(),
    reviewedBy: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_material", ["materialId"])
    .index("by_created", ["createdAt"])
    .index("by_status", ["status"]),

  /**
   * Centralised operational & financial configuration. A single row keyed by
   * `key` ("default") stores ETB valuation rates per base unit, ink
   * consumption, waste / offcut rules, risk controls, and per-material price
   * overrides. Consumed dynamically by reconciliation and material-usage
   * handlers instead of hardcoded fallbacks.
   */
  systemConfigs: defineTable({
    key: v.string(),
    /** ETB valuation rate per square metre for area materials. */
    etbPerSquareMetre: v.number(),
    /** ETB valuation rate per litre of ink. */
    etbPerLitre: v.number(),
    /** ETB valuation rate per unit hardware (piece / pcs). */
    etbPerPiece: v.number(),
    /** ETB valuation rate per metre of linear material. */
    etbPerMetre: v.number(),
    /** ETB valuation rate per sheet (rigid boards). */
    etbPerSheet: v.number(),
    /**
     * Per-material custom ETB price overrides, keyed by canonical material
     * name. Applied ahead of the unit default rates during valuation.
     */
    materialOverrides: v.array(v.object({
      materialName: v.string(),
      etbValue: v.number(),
    })),
    /** Ink consumption in mL per m² of printed area. */
    inkMlPerSquareMetre: v.number(),
    /** Maximum tolerated waste rate as a percentage (0–100). */
    maxAllowedWastePercent: v.number(),
    /** Minimum offcut registration size in m². Smaller offcuts are not tracked. */
    minOffcutAreaSquareMetre: v.number(),
    /** When true, direct exception stock-outs require an admin PIN reference note. */
    requireAdminPinForExceptions: v.boolean(),
    /** ETB threshold above which a direct stock-out must be approved. */
    maxDirectStockOutEtb: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  })
    .index("by_key", ["key"]),

  /**
   * Telegram bot session state keyed per chat. `data` holds the JSON-serialized
   * grammY session (language preference, active flow step, and order draft).
   * Written transactionally by the bot webhook through the Convex-backed
   * session storage adapter so language and in-progress orders survive restarts.
   */
  telegramSessions: defineTable({
    key: v.string(),
    data: v.string(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  /**
   * Telegram customer profiles (distinct from the staff `users` table, which is
   * tied to Better Auth identities). The bot upserts a row when a customer taps
   * the share-contact button, keyed by Telegram user id, so the Mini App can
   * submit orders with the verified phone instead of a manual input field.
   */
  telegramUsers: defineTable({
    telegramId: v.string(),
    phone: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_telegram_id", ["telegramId"]),
});
