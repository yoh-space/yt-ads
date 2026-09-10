export type Role =
  | "owner"
  | "manager"
  | "admin"
  | "storekeeper"
  | "receptionist"
  | "laser_operator"
  | "cnc_operator"
  | "plotter_operator"
  | "printer_operator";
export type Unit = "m²" | "m" | "sheet" | "piece" | "pcs" | "L" | "mL";
export type PurchaseUnit = "roll" | "sheet" | "pack" | "canister" | "liter" | "piece";
export type PackageUnit = "ROLL" | "SHEET" | "PACKAGE" | "CANISTER" | "PIECE";
type MaterialSpecification =
  | "Color Type"
  | "Roll Weight & Size"
  | "Thickness / Size (in millimeters)"
  | "Color Type / Finish"
  | "Thickness (in millimeters)"
  | "Roll Width / Type (in meters)"
  | "Ink Type & Color Config"
  | "Wattage"
  | "Height (in centimeters)"
  | "Roll Width / Type";
type JobStatus = "Queued" | "In production" | "Completed" | "Paused";
export type MachineStatus = "Running" | "Available" | "Maintenance" | "Unavailable";
type Priority = "High" | "Medium" | "Low";
export type CustomerOrderStatus = "PENDING_REVIEW" | "PRICED_AND_PENDING_PAYMENT" | "CONFIRMED_PAID_OR_CREDIT" | "JOB_CARD_CREATED" | "IN_PRODUCTION" | "COMPLETED" | "READY_FOR_PICKUP" | "EXPIRED" | "EXPIRED_JUNK";
export type OrderPriority = "High" | "Medium" | "Low";
type OrderSource = "public_portal" | "walk_in";
export type ExceptionReason = "Sample Print" | "Minor Repair" | "Test Cut" | "Internal Maintenance";

export type CustomerOrder = {
  id: string;
  code: string;
  clientName: string;
  phone: string;
  serviceType: string;
  dimensions: string;
  quantity: string;
  amount?: number;
  paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "FULLY_PAID" | "PAID" | "APPROVED_CREDIT";
  paymentMethod?: string;
  advanceDueAmount?: number;
  advancePaidAmount?: number;
  remainingDueAmount?: number;
  finalPaidAmount?: number;
  paymentConfirmedAt?: number;
  paymentConfirmedBy?: string;
  fileName?: string;
  fileUrl?: string;
  preferredDueDate: number;
  status: CustomerOrderStatus;
  priority: OrderPriority;
  source: OrderSource;
  notes?: string;
  tinNumber?: string;
  companyLegalName?: string;
  machineId?: string;
  machineName?: string;
  jobCardId?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  telegramChatId?: string;
  overdue: boolean;
};

export type TrackedOrder = Pick<CustomerOrder, "id" | "code" | "clientName" | "serviceType" | "dimensions" | "quantity" | "preferredDueDate" | "status" | "priority" | "createdAt" | "updatedAt" | "overdue">;

export type Accent = "cyan" | "gold" | "violet" | "blue" | "green";
type ProductionType = "area" | "linear" | "ink" | "unit";
type ReconciliationStatus = "Open" | "Reviewed" | "Resolved";

export type Material = {
  id: string;
  name: string;
  category: string;
  unit: Unit;
  baseUnit?: Unit;
  purchaseUnit?: PurchaseUnit;
  packageUnit?: PackageUnit;
  packageSize?: number;
  packageLabel?: string;
  conversionRatio?: number;
  specification?: MaterialSpecification | string;
  specificationValue?: string;
  specificationOptions?: string[];
  displayUnit?: string;
  quantity: number;
  reorderAt: number;
  rollEquivalent?: number;
  sheetEquivalent?: number;
  storageLocation?: string;
  averageUse?: string;
  reorderRule?: string;
  scrapRule?: string;
  accent: "cyan" | "gold" | "violet" | "blue" | "green";
  productionType?: ProductionType;
  consumptionRate?: number;
  etbValue?: number;
  rollWidth?: number;
  sheetWidth?: number;
  sheetLength?: number;
};

export type Machine = {
  id: string;
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model?: string;
  capability?: string;
  notes?: string;
  operatorRole: Role;
  materialUnit: Unit;
  status: "Running" | "Available" | "Maintenance" | "Unavailable";
  activeJob?: string;
};

export type JobCard = {
  id: string;
  code: string;
  client: string;
  title: string;
  machineId: string;
  materialId: string;
  quantity: number;
  unit: Unit;
  status: JobStatus;
  due: string;
  priority: Priority;
  orderId?: string;
  orderStatus?: CustomerOrderStatus;
  orderOverdue?: boolean;
  orderDueTimestamp?: number;
  length?: number;
  width?: number;
  deductOnComplete?: boolean;
  serviceType?: string;
};

export type ScrapLog = {
  id: string;
  materialId: string;
  label: string;
  quantity: number;
  unit: Unit;
  reason: string;
  createdAt: string;
};

export type MaterialRequestStatus = "Requested" | "Partially Issued" | "Issued" | "Received" | "Short Stock" | "Discrepancy";

export type MaterialRequest = {
  id: string;
  jobCardId: string;
  materialId: string;
  requestedQuantity: number;
  issuedQuantity: number;
  unit: Unit;
  status: MaterialRequestStatus;
  requestedBy: string;
  issuedBy?: string;
  receivedBy?: string;
  requestedAt: number;
  issuedAt?: number;
  receivedAt?: number;
  note?: string;
  requestGroupId?: string;
  packageUnit?: PackageUnit;
  requestedPackages?: number;
  issuedPackages?: number;
  conversionRatioSnapshot?: number;
  parentInventoryId?: string;
  operatorSubStockId?: string;
  machineId?: string;
  jobCode: string;
  client: string;
  jobTitle: string;
  materialName: string;
  machineName?: string;
  pickLocation?: string;
  requesterName: string;
  issuerName?: string;
  receiverName?: string;
};

export type Profile = {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  image?: string;
};

export const roleLabels: Record<Role, { am: string; en: string; initial: string }> = {
  owner: { am: "ባለቤት", en: "Owner", initial: "OW" },
  manager: { am: "ማኔጀር", en: "Manager", initial: "MG" },
  admin: { am: "ዋና ሥራ አስኪያጅ", en: "General Manager", initial: "GM" },
  storekeeper: { am: "መጋዘን ኃላፊ", en: "Storekeeper", initial: "SK" },
  receptionist: { am: "ተቀባይ", en: "Receptionist", initial: "RC" },
  laser_operator: { am: "Laser ኦፕሬተር", en: "Laser Cutter", initial: "LC" },
  cnc_operator: { am: "CNC ኦፕሬተር", en: "CNC Router", initial: "CN" },
  plotter_operator: { am: "Plotter ኦፕሬተር", en: "Vinyl Cutter", initial: "PL" },
  printer_operator: { am: "Printer ኦፕሬተር", en: "Large Format Print", initial: "PR" },
};
