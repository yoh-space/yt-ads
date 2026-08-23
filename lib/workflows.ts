import type { JobCard, Machine, Material, Offcut, ScrapLog, Unit } from "@/lib/operations-types";
import { convertToBase } from "@/lib/units";

export function applyStockMovement(
  materials: Material[],
  materialId: string,
  direction: "in" | "out",
  quantity: number,
  inputUnit: "roll" | "sheet" | Unit,
): Material[] {
  return materials.map((material) => {
    if (material.id !== materialId) return material;
    const converted = convertToBase(quantity, inputUnit, material.unit, material.rollEquivalent, material.sheetEquivalent);
    return { ...material, quantity: Math.max(0, Number((material.quantity + (direction === "in" ? converted : -converted)).toFixed(2))) };
  });
}

export function assignJobToMachine(machines: Machine[], job: JobCard): Machine[] {
  return machines.map((machine) => machine.id === job.machineId ? { ...machine, status: "Running", activeJob: job.code } : machine);
}

export function completeProductionJob(jobs: JobCard[], machines: Machine[], jobId: string): { jobs: JobCard[]; machines: Machine[] } {
  const completedJob = jobs.find((job) => job.id === jobId);
  return {
    jobs: jobs.map((job) => job.id === jobId ? { ...job, status: "Completed" } : job),
    machines: machines.map((machine) => machine.activeJob === completedJob?.code ? { ...machine, status: "Available", activeJob: undefined } : machine),
  };
}

export function returnOffcutToInventory(materials: Material[], offcut: Offcut): Material[] {
  return materials.map((material) => material.id === offcut.materialId ? { ...material, quantity: Number((material.quantity + offcut.area).toFixed(2)) } : material);
}

export function recordScrap(scraps: ScrapLog[], scrap: ScrapLog): ScrapLog[] {
  return [scrap, ...scraps];
}
