import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const role = v.union(
  v.literal("owner"),
  v.literal("manager"),
  v.literal("admin"),
  v.literal("storekeeper"),
  v.literal("receptionist"),
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

/**
 * Payment-first customer order lifecycle. Orders enter as unpriced requests
 * (PENDING_REVIEW) and only reach production after reception prices the order
 * and confirms payment or credit. `EXPIRED` is a terminal state applied to
 * unconfirmed orders past their expiration window.
 */
export const orderStatus = v.union(
  v.literal("PENDING_REVIEW"),
  v.literal("PRICED_AND_PENDING_PAYMENT"),
  v.literal("CONFIRMED_PAID_OR_CREDIT"),
  v.literal("JOB_CARD_CREATED"),
  v.literal("IN_PRODUCTION"),
  v.literal("COMPLETED"),
  v.literal("READY_FOR_PICKUP"),
  v.literal("EXPIRED"),
  v.literal("EXPIRED_JUNK"),
);

/** Payment verification result recorded by reception during checkout. */
export const paymentStatus = v.union(
  v.literal("UNPAID"),
  v.literal("PAID"),
  v.literal("APPROVED_CREDIT"),
);

/** Packaging unit tracked by the central (parent) inventory tier. */
export const inventoryUnitType = v.union(
  v.literal("ROLL"),
  v.literal("SHEET"),
  v.literal("LITER"),
);

/** Lifecycle of a stock batch issued to the production floor. */
export const operatorStockStatus = v.union(
  v.literal("ACTIVE"),
  v.literal("PENDING_CLEARANCE"),
  v.literal("CLEARED"),
  v.literal("EXHAUSTED"),
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

// Canonical service type identifiers used across the app. Keep in sync with
// src/constants/services.ts
export const serviceType = v.union(
  v.literal("banner_print"),
  v.literal("sticker_white"),
  v.literal("sticker_transparent"),
  v.literal("sticker_reflective"),
  v.literal("sticker_mesh"),
  v.literal("sticker_frosted"),
  v.literal("hq_print_and_cut"),
  v.literal("light_box_a1"),
  v.literal("light_box_a2"),
  v.literal("neon_light"),
  v.literal("roll_up_standard"),
  v.literal("roll_up_deluxe"),
  v.literal("uv_print_mica"),
  v.literal("uv_print_foam"),
  v.literal("uv_print_cladding"),
  v.literal("uv_print_canvas"),
  v.literal("foam_cutout"),
  v.literal("foam_engrave"),
  v.literal("mica_cutout"),
  v.literal("mica_engrave"),
  v.literal("dtf"),
  v.literal("sublimation"),
);


export const exceptionReason = v.union(
  v.literal("Sample Print"),
  v.literal("Minor Repair"),
  v.literal("Test Cut"),
  v.literal("Internal Maintenance"),
);

/** Authoritative event types for the event-sourced inventory ledger. */
export const stockEventType = v.union(
  v.literal("STOCK_IN"),
  v.literal("STORE_TO_OPERATOR_TRANSFER"),
  v.literal("PRODUCTION_CONSUMPTION"),
  v.literal("OFFCUT_RETURN"),
  v.literal("SCRAP_LOG"),
  v.literal("RECONCILIATION_ADJUSTMENT"),
  v.literal("EXCEPTION_STOCK_OUT"),
);

export const inventoryCustody = v.union(
  v.literal("parent"),
  v.literal("operator"),
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
  v.literal("Low"),
);

export const accent = v.union(
  v.literal("cyan"),
  v.literal("gold"),
  v.literal("violet"),
  v.literal("blue"),
  v.literal("green"),
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
  v.literal("linear"),
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

export const invoiceType = v.union(
  v.literal("PROFORMA"),
  v.literal("TAX_INVOICE"),
);

export const invoiceStatus = v.union(
  v.literal("DRAFT"),
  v.literal("ISSUED"),
  v.literal("VOID"),
);

/** Owner-managed conversion rule used when a material has no local override. */
export const unitConversionRule = v.object({
  materialName: v.string(),
  purchaseUnit,
  baseUnit: unit,
  inputDimension: v.optional(v.number()),
  conversionRatio: v.number(),
});

export const invoiceLineItem = v.object({
  description: v.string(),
  quantity: v.number(),
  unit: v.string(),
  unitPrice: v.number(),
  lineTotal: v.number(),
});

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
  v.literal("clearance_granted"),
  v.literal("clearance_rejected"),
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
    /** Deprecated materialized base balance; ledger events are authoritative. */
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

  customerOrders: defineTable({
    code: v.string(),
    clientName: v.string(),
    phone: v.string(),
    serviceType: serviceType,
    dimensions: v.string(),
    quantity: v.string(),
    /** Final total price confirmed by reception during checkout. */
    amount: v.optional(v.number()),
    /** Set once reception confirms advance payment or approves credit. */
    paymentStatus: v.optional(paymentStatus),
    paymentMethod: v.optional(v.string()),
    paymentConfirmedAt: v.optional(v.number()),
    paymentConfirmedBy: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    preferredDueDate: v.number(),
    status: orderStatus,
    priority: orderPriority,
    source: orderSource,
    notes: v.optional(v.string()),
    tinNumber: v.optional(v.string()),
    companyLegalName: v.optional(v.string()),
    invoiceType: v.optional(invoiceType),
    invoiceNumber: v.optional(v.string()),
    invoiceId: v.optional(v.id("invoices")),
    subtotal: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    paymentReceiptStorageId: v.optional(v.id("_storage")),
    paymentReceiptFileName: v.optional(v.string()),
    paymentReceiptUploadedAt: v.optional(v.number()),
    paymentReceiptVerifiedAt: v.optional(v.number()),
    paymentReceiptVerifiedBy: v.optional(v.string()),
    machineId: v.optional(v.id("machines")),
    jobCardId: v.optional(v.id("jobCards")),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    archiveReason: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
    overdueInquiryAt: v.optional(v.number()),
    lastOverdueNotifiedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_phone", ["phone"])
    .index("by_telegram_chat_id", ["telegramChatId"])
    .index("by_status", ["status"])
    .index("by_due_date", ["preferredDueDate"])
    .index("by_expires_at", ["expiresAt"]),

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

  /** Immutable commercial document generated from an order. */
  invoices: defineTable({
    orderId: v.id("customerOrders"),
    invoiceNumber: v.string(),
    type: invoiceType,
    status: invoiceStatus,
    clientName: v.string(),
    companyLegalName: v.optional(v.string()),
    tinNumber: v.optional(v.string()),
    lineItems: v.array(invoiceLineItem),
    subtotal: v.number(),
    taxRate: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    currency: v.string(),
    issuedBy: v.string(),
    issuedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_number", ["invoiceNumber"])
    .index("by_issued_at", ["issuedAt"]),

  /**
   * Authoritative inventory event stream. Balances on materials, parentInventory,
   * and operatorSubStock are projections maintained transactionally from these
   * events and are never the source of accounting truth.
   */
  stock_movements: defineTable({
    materialId: v.id("materials"),
    eventType: stockEventType,
    custody: inventoryCustody,
    balanceEffect: v.union(v.literal("in"), v.literal("out"), v.literal("transfer"), v.literal("none")),
    quantity: v.number(),
    unit: stockInputUnit,
    baseUnit: unit,
    baseQuantity: v.number(),
    /** Whole packaging units involved in a parent-store transfer or receipt. */
    packageQuantity: v.optional(v.number()),
    packageUnit: v.optional(inventoryUnitType),
    /** Snapshot of the rate used; later owner changes do not rewrite history. */
    conversionRatio: v.optional(v.number()),
    parentInventoryId: v.optional(v.id("parentInventory")),
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    operatorId: v.optional(v.string()),
    machineId: v.optional(v.id("machines")),
    jobCardId: v.optional(v.id("jobCards")),
    materialRequestId: v.optional(v.id("materialRequests")),
    offcutId: v.optional(v.id("offcuts")),
    reconciliationId: v.optional(v.id("weeklyReconciliations")),
    materialReconciliationId: v.optional(v.id("reconciliations")),
    note: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_material_created", ["materialId", "createdAt"])
    .index("by_event_type", ["eventType"])
    .index("by_parent_inventory", ["parentInventoryId"])
    .index("by_operator_sub_stock", ["operatorSubStockId"])
    .index("by_machine_created", ["machineId", "createdAt"])
    .index("by_job_card", ["jobCardId"]),

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
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    operatorId: v.optional(v.string()),
    machineId: v.optional(v.id("machines")),
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
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    operatorId: v.optional(v.string()),
    machineId: v.optional(v.id("machines")),
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
    /** Owner-managed purchase-unit conversion defaults, versioned by events. */
    unitConversionDefaults: v.optional(v.array(unitConversionRule)),
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
    /** Order expiration window in hours for unpaid/unconfirmed orders. */
    orderExpirationHours: v.optional(v.number()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  })
    .index("by_key", ["key"]),

  /**
   * Two-tier inventory, tier 1 — the central store. One row per tracked
   * material holding whole packaging units (rolls / sheets / liter containers)
   * plus the standard conversion factor used when issuing a unit to the
   * production floor. The linked `materials` row keeps the catalog-level
   * base-unit quantity used by the existing deduction and reporting logic.
   */
  parentInventory: defineTable({
    materialId: v.id("materials"),
    unitType: inventoryUnitType,
    /** Whole packaging units currently held in the central store. */
    totalStockQuantity: v.number(),
    /** Conversion factor for ROLL units: base units (m or m²) per roll. */
    lengthPerRoll: v.optional(v.number()),
    /** Conversion factor for SHEET units: base units (m²) per sheet. */
    areaPerSheet: v.optional(v.number()),
    /** Conversion factor for LITER units: litres per container (default 1). */
    volumePerContainer: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_material", ["materialId"])
    .index("by_unit_type", ["unitType"]),

  /**
  /**
   * Current operator custody projection. Each row represents a packaging-unit
   * handover converted to the machine's production unit.
   */
  operatorSubStock: defineTable({
    parentInventoryId: v.optional(v.id("parentInventory")),
    materialId: v.id("materials"),
    operatorId: v.string(),
    machineId: v.id("machines"),
    issuedUnits: v.number(),
    issuedQuantity: v.number(),
    currentRemaining: v.number(),
    status: operatorStockStatus,
    issuedBy: v.optional(v.string()),
    issuedAt: v.number(),
    updatedAt: v.number(),
    /** Owner/admin clearance trail recorded once the batch is fully reconciled. */
    clearedBy: v.optional(v.string()),
    clearedAt: v.optional(v.number()),
    clearanceNote: v.optional(v.string()),
  })
    .index("by_parent_inventory", ["parentInventoryId"])
    .index("by_machine", ["machineId"])
    .index("by_operator", ["operatorId"])
    .index("by_material_machine", ["materialId", "machineId"])
    .index("by_status", ["status"]),

  /**
   * Weekly audit log comparing the system-calculated floor balance against a
   * physical count. A non-zero discrepancy is written off to both inventory
   * tiers and stays auditable through `stock_movements`.
   */
  weeklyReconciliations: defineTable({
    machineId: v.id("machines"),
    operatorId: v.string(),
    /** Floor-stock reference of the physical count. */
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    systemCalculatedRemaining: v.number(),
    physicalActualRemaining: v.number(),
    /** physical − system (negative = wastage/loss). */
    discrepancy: v.number(),
    unit: unit,
    reconciledBy: v.string(),
    reconciledAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_machine", ["machineId"])
    .index("by_reconciled_at", ["reconciledAt"]),

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
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_telegram_id", ["telegramId"]),

  /**
   * One-shot data migrations. A row is written once a given backfill has run to
   * completion so idempotent migrations never execute twice against a dataset.
   * Keyed by the migration's unique name.
   */
  migrations: defineTable({
    key: v.string(),
    ranAt: v.number(),
  })
    .index("by_key", ["key"]),
});
