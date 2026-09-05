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
export type Unit = "m²" | "m" | "sheet" | "piece" | "pcs" | "L";
export type PurchaseUnit = "roll" | "sheet" | "pack" | "liter" | "piece";
export type MaterialSpecification =
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
export type JobStatus = "Queued" | "In production" | "Completed" | "Paused";
export type MachineStatus = "Running" | "Available" | "Maintenance" | "Unavailable";
export type Priority = "High" | "Medium" | "Low";
export type CustomerOrderStatus = "PENDING_REVIEW" | "PRICED_AND_PENDING_PAYMENT" | "CONFIRMED_PAID_OR_CREDIT" | "JOB_CARD_CREATED" | "IN_PRODUCTION" | "COMPLETED" | "READY_FOR_PICKUP" | "EXPIRED" | "EXPIRED_JUNK";
export type OrderPriority = "High" | "Medium" | "Low";
export type OrderSource = "public_portal" | "walk_in";
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
  paymentStatus?: "UNPAID" | "PAID" | "APPROVED_CREDIT";
  paymentMethod?: string;
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
  invoiceType?: "PROFORMA" | "TAX_INVOICE";
  invoiceNumber?: string;
  invoiceId?: string;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  paymentReceiptStorageId?: string;
  paymentReceiptFileName?: string;
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

export type StockException = {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: Unit;
  baseQuantity: number;
  reason: ExceptionReason;
  authorizationNote?: string;
  createdBy: string;
  createdAt: number;
};
export type Accent = "cyan" | "gold" | "violet" | "blue" | "green";
export type ProductionType = "area" | "linear" | "ink" | "unit";
export type ReconciliationStatus = "Open" | "Reviewed" | "Resolved";

export type Material = {
  id: string;
  name: string;
  category: string;
  unit: Unit;
  baseUnit?: Unit;
  purchaseUnit?: PurchaseUnit;
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
  length?: number;
  width?: number;
  deductOnComplete?: boolean;
};

export type Offcut = {
  id: string;
  materialId: string;
  label: string;
  width: number;
  length: number;
  area: number;
  location: string;
  createdAt: string;
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

export type ReconciliationRecord = {
  id: string;
  materialId: string;
  materialName: string;
  materialUnit: Unit;
  status: ReconciliationStatus;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
  etbValue?: number;
  monetaryLoss?: number;
  countedBy: string;
  countedByName: string;
  reviewedBy?: string;
  reviewedByName?: string;
  note?: string;
  createdAt: number;
  reviewedAt?: number;
};

export type ReconciliationSummary = {
  openCounts: number;
  shortageCounts: number;
  surplusCounts: number;
  totalMonetaryLoss: number;
  countRecords: number;
  currentVariances: Array<{
    materialId: string;
    materialName: string;
    unit: Unit;
    variance: number;
    monetaryLoss: number;
    countDate: number;
  }>;
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

export const initialMaterials: Material[] = [
  { id: "mat-banner", name: "Banner", category: "Banner", unit: "m²", baseUnit: "m²", purchaseUnit: "roll", conversionRatio: 160, specification: "Roll Weight & Size", specificationValue: "3 Meter Roll Weight", specificationOptions: ["2 Meter Roll Weight", "3 Meter Roll Weight"], quantity: 286, reorderAt: 160, rollEquivalent: 160, displayUnit: "ሮል", accent: "cyan" },
  { id: "mat-acrylic", name: "Acrylic", category: "Rigid sheet", unit: "m²", baseUnit: "m²", purchaseUnit: "sheet", conversionRatio: 2.977, specification: "Thickness (in millimeters)", specificationValue: "3mm", specificationOptions: ["18mm", "10mm", "8mm", "5mm", "3mm"], quantity: 54.8, reorderAt: 65, sheetEquivalent: 2.977, displayUnit: "ቁጥር", accent: "violet" },
  { id: "mat-vinyl", name: "Normal Sticker", category: "Sticker roll", unit: "m²", baseUnit: "m²", purchaseUnit: "roll", conversionRatio: 63.5, specification: "Roll Width / Type", specificationValue: "1.27 Meter × 50 Meter Roll", specificationOptions: ["1.27 Meter × 50 Meter Roll"], quantity: 417, reorderAt: 240, rollEquivalent: 63.5, displayUnit: "ሮል", accent: "gold" },
  { id: "mat-led", name: "LED Module / Strip", category: "Electrical", unit: "pcs", baseUnit: "pcs", purchaseUnit: "pack", conversionRatio: 20, specification: "Color Type", specificationValue: "Cool White (6000K-6500K)", specificationOptions: ["Cool White (6000K-6500K)", "Warm White (3000K)", "Red", "Green", "Blue", "Yellow", "Amber", "RGB (Multi-Color)", "RGBW"], quantity: 1260, reorderAt: 800, displayUnit: "ቁጥር", accent: "blue" },
  { id: "mat-ink", name: "DTF Ink", category: "Ink", unit: "L", baseUnit: "L", purchaseUnit: "liter", conversionRatio: 1, specification: "Ink Type & Color Config", specificationValue: "CMYK (Cyan, Magenta, Yellow, Key/Black)", specificationOptions: ["CMYK (Cyan, Magenta, Yellow, Key/Black)", "Expanded Gamut / Light Inks (Light Cyan, Light Magenta, Light Black)", "Specialty Inks (White Ink, Spot Gloss / Clear UV Varnish, Primer)", "Ink Formulations: Eco-Solvent, Solvent, UV-Curing Ink, Sublimation Ink"], quantity: 18.2, reorderAt: 12, displayUnit: "ሊትር", accent: "green" },
  { id: "mat-mdf", name: "Foam", category: "Foam board", unit: "m²", baseUnit: "m²", purchaseUnit: "sheet", conversionRatio: 2.977, specification: "Thickness / Size (in millimeters)", specificationValue: "18mm", specificationOptions: ["18mm", "10mm", "8mm", "5mm", "3mm"], quantity: 91.4, reorderAt: 45, sheetEquivalent: 2.977, displayUnit: "ቁጥር", accent: "gold" },
];

export const initialMachines: Machine[] = [
  { id: "m-laser", name: "Laser Cutter 1325", code: "LAS-01", type: "Laser cutter", operatorRole: "laser_operator", materialUnit: "m²", status: "Running", activeJob: "JC-0421" },
  { id: "m-cnc", name: "CNC Router 2030", code: "CNC-02", type: "CNC router", operatorRole: "cnc_operator", materialUnit: "m²", status: "Running", activeJob: "JC-0424" },
  { id: "m-plotter", name: "Graphtec FC9000", code: "PLT-01", type: "Plotter & vinyl cutter", operatorRole: "plotter_operator", materialUnit: "m", status: "Available" },
  { id: "m-printer", name: "Eco-solvent 3.2m", code: "PRT-01", type: "Large format printer", operatorRole: "printer_operator", materialUnit: "m²", status: "Running", activeJob: "JC-0420" },
];

export const initialJobs: JobCard[] = [
  { id: "job-0420", code: "JC-0420", client: "Abyssinia Bank", title: "Branch fascia banners", machineId: "m-printer", materialId: "mat-banner", quantity: 86.4, unit: "m²", status: "In production", due: "Today, 16:30", priority: "High" },
  { id: "job-0421", code: "JC-0421", client: "Bole Medical", title: "Acrylic wayfinding signs", machineId: "m-laser", materialId: "mat-acrylic", quantity: 14.8, unit: "m²", status: "In production", due: "Today, 18:00", priority: "Medium" },
  { id: "job-0424", code: "JC-0424", client: "Ethio Logistics", title: "Reception desk logo", machineId: "m-cnc", materialId: "mat-mdf", quantity: 8.2, unit: "m²", status: "In production", due: "Tomorrow, 10:00", priority: "Low" },
  { id: "job-0426", code: "JC-0426", client: "Hibret Insurance", title: "Fleet sticker set", machineId: "m-plotter", materialId: "mat-vinyl", quantity: 96, unit: "m", status: "Queued", due: "Tomorrow, 15:00", priority: "Medium" },
];

export const initialOffcuts: Offcut[] = [
  { id: "off-01", materialId: "mat-acrylic", label: "Acrylic Clear 3mm", width: 1.2, length: 0.8, area: 0.96, location: "Rack B · Slot 04", createdAt: "08:25" },
  { id: "off-02", materialId: "mat-mdf", label: "Foam · 18mm", width: 0.9, length: 0.6, area: 0.54, location: "Rack C · Slot 02", createdAt: "Yesterday" },
];
