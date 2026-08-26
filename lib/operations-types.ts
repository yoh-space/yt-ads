export type Role =
  | "owner"
  | "manager"
  | "admin"
  | "storekeeper"
  | "laser_operator"
  | "cnc_operator"
  | "plotter_operator"
  | "printer_operator";
export type Unit = "m²" | "m" | "sheet" | "piece" | "pcs" | "L";
export type PurchaseUnit = "roll" | "sheet" | "pack" | "liter" | "piece";
export type JobStatus = "Queued" | "In production" | "Completed" | "Paused";
export type MachineStatus = "Running" | "Available" | "Maintenance";
export type Priority = "High" | "Medium" | "Normal";
export type Accent = "cyan" | "gold" | "violet" | "blue" | "green";

export type Material = {
  id: string;
  name: string;
  category: string;
  unit: Unit;
  baseUnit?: Unit;
  purchaseUnit?: PurchaseUnit;
  conversionRatio?: number;
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
  status: "Running" | "Available" | "Maintenance";
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
  priority: "High" | "Medium" | "Normal";
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
  laser_operator: { am: "Laser ኦፕሬተር", en: "Laser Cutter", initial: "LC" },
  cnc_operator: { am: "CNC ኦፕሬተር", en: "CNC Router", initial: "CN" },
  plotter_operator: { am: "Plotter ኦፕሬተር", en: "Vinyl Cutter", initial: "PL" },
  printer_operator: { am: "Printer ኦፕሬተር", en: "Large Format Print", initial: "PR" },
};

export const initialMaterials: Material[] = [
  { id: "mat-banner", name: "Frontlit Banner 440gsm", category: "Banner roll", unit: "m²", quantity: 286, reorderAt: 160, rollEquivalent: 160, accent: "cyan" },
  { id: "mat-acrylic", name: "Acrylic Clear 3mm", category: "Sheet", unit: "m²", quantity: 54.8, reorderAt: 65, sheetEquivalent: 2.98, accent: "violet" },
  { id: "mat-vinyl", name: "Premium Vinyl Gloss", category: "Vinyl roll", unit: "m", quantity: 417, reorderAt: 240, rollEquivalent: 50, accent: "gold" },
  { id: "mat-led", name: "LED Module 1.5W", category: "Electrical", unit: "piece", quantity: 1260, reorderAt: 800, accent: "blue" },
  { id: "mat-ink", name: "UV Ink — Cyan", category: "Ink", unit: "L", quantity: 18.2, reorderAt: 12, accent: "green" },
  { id: "mat-mdf", name: "MDF Board 18mm", category: "Sheet", unit: "m²", quantity: 91.4, reorderAt: 45, sheetEquivalent: 2.98, accent: "gold" },
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
  { id: "job-0424", code: "JC-0424", client: "Ethio Logistics", title: "Reception desk logo", machineId: "m-cnc", materialId: "mat-mdf", quantity: 8.2, unit: "m²", status: "In production", due: "Tomorrow, 10:00", priority: "Normal" },
  { id: "job-0426", code: "JC-0426", client: "Hibret Insurance", title: "Fleet sticker set", machineId: "m-plotter", materialId: "mat-vinyl", quantity: 96, unit: "m", status: "Queued", due: "Tomorrow, 15:00", priority: "Medium" },
];

export const initialOffcuts: Offcut[] = [
  { id: "off-01", materialId: "mat-acrylic", label: "Acrylic Clear 3mm", width: 1.2, length: 0.8, area: 0.96, location: "Rack B · Slot 04", createdAt: "08:25" },
  { id: "off-02", materialId: "mat-mdf", label: "MDF Board 18mm", width: 0.9, length: 0.6, area: 0.54, location: "Rack C · Slot 02", createdAt: "Yesterday" },
];
