export type Role =
  | "owner"
  | "manager"
  | "admin"
  | "storekeeper"
  | "laser_operator"
  | "cnc_operator"
  | "plotter_operator"
  | "printer_operator";

export type Unit = "m²" | "m" | "sheet" | "piece" | "L";

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
