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

export type MachineStatus = "Running" | "Available" | "Maintenance";

export type Priority = "High" | "Medium" | "Normal";

export type Accent = "cyan" | "gold" | "violet" | "blue" | "green";

export const ROLES: Role[] = [
  "owner",
  "manager",
  "admin",
  "storekeeper",
  "laser_operator",
  "cnc_operator",
  "plotter_operator",
  "printer_operator",
];
